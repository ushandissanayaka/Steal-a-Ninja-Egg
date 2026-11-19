// Works out what the player can do right now, and turns E, Q and clicks into server messages.
// Stealing and hatching need E held down until the prompt fills; a click swings the bat.

import * as THREE from 'three';
import { INVITE_RADIUS } from '../entities/InviteSpot.js';

const INVITE_NEAR = 4; // the invite popup opens this far out from the pad's edge too
import {
  BIOMES, NESTS, PLOT, PLOTS, RANGE, RULES, SHOPS, WORLD, biomeAt, eggName, formatClock, formatNumber, inPen, nextTreadmill, plotToWorld,
} from '../../shared/gameData.js';
import { TUTORIAL_PETS, TUTORIAL_SHOPS, TUTORIAL_TREADMILL_SECONDS } from '../../shared/progression.js';

const NEAR_EGG_HINT = 30;
const SHOP_POPUPS = [['sell', 'Sell Shop'], ['trails', 'Trails Shop']];
const SHOP_OPEN_RANGE = 22;
const FREE_PAD_RADIUS = 13;
const _v = new THREE.Vector3();

const distance = (a, x, z) => Math.hypot(a.x - x, a.z - z);

export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.action = null;    // { kind, verb, title, at: Vector3, run, holdMs }
    this.done = new Set(); // guide steps done this session (the server keeps them too)
    this.hold = null;      // { id, start, sent } while E is held
    this.holdFill = 0;     // 0..1, shown in the prompt
    this.lastSwing = 0;
  }

  // A JSON field decoded only when it changes (these are read every frame).
  cached(name, json) {
    this.decoded ??= {};
    const c = this.decoded[name];
    if (c && c.json === json) return c.value;
    const value = JSON.parse(json || '[]');
    this.decoded[name] = { json, value };
    return value;
  }

  holdingE() {
    const input = this.game.input;
    return input.keys.has('KeyE') || !!input.pad.buttons[2] || !!input.touchHold;
  }

  // Steal / pick up / hatch: E held until the prompt fills.
  updateHold() {
    const a = this.action;
    if (!a?.holdMs || !this.holdingE()) {
      this.hold = null;
      this.holdFill = 0;
      return;
    }
    const now = performance.now();
    if (this.hold?.id !== a.id) this.hold = { id: a.id, start: now, sent: false };
    this.holdFill = Math.min(1, (now - this.hold.start) / a.holdMs);
    if (this.holdFill >= 1 && !this.hold.sent) {
      this.hold.sent = true;
      a.run();
    }
  }

  update() {
    const { game } = this;
    const me = game.me;
    if (!me) return;
    const pos = game.player.body.pos;
    const plot = PLOTS[me.plot];
    const carried = this.cached('carried', me.carried);
    const pen = this.cached('pen', me.pen);
    const meta = game.meta || {};

    this.action = null;
    const offer = (kind, verb, title, x, y, z, run, extra = {}) => {
      this.action = { kind, verb, title, at: new THREE.Vector3(x, y, z), run, ...extra };
    };

    // the nearest egg (on a nest or dropped)
    let nearestEgg = null;
    let nearestDist = Infinity;
    game.room.state.eggs.forEach((egg, id) => {
      const d = distance(pos, egg.x, egg.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEgg = { id, egg };
      }
    });
    // a ready egg in my pen that I stand next to
    let readySlot = -1;
    pen.forEach((e, i) => {
      if (e.left > 0 || readySlot >= 0) return;
      const at = plotToWorld(plot, PLOT.eggSlots[i].x, PLOT.eggSlots[i].z);
      if (distance(pos, at.x, at.z) < RANGE.slot) readySlot = i;
    });
    const sign = plotToWorld(plot, PLOT.treadmillSign.x, PLOT.treadmillSign.z);
    const nextMill = nextTreadmill(me.treadmill);

    const cap = meta.padCap || RULES.penSlots;
    if (carried.length && inPen(plot, pos.x, pos.z) && pen.length < cap) {
      // in your own pen with an egg: hold E to put it down to grow (in the next free slot)
      const at = plotToWorld(plot, PLOT.eggSlots[pen.length].x, PLOT.eggSlots[pen.length].z);
      offer('place', 'Hold to Place', eggName(carried[0]), at.x, 6, at.z, () => game.room.send('place'), { id: `place${pen.length}`, holdMs: RULES.placeHoldMs });
    } else if (readySlot >= 0) {
      const at = plotToWorld(plot, PLOT.eggSlots[readySlot].x, PLOT.eggSlots[readySlot].z);
      offer('hatch', 'Hold to Hatch', eggName(pen[readySlot]), at.x, 8, at.z, () => game.room.send('hatch', { i: readySlot }), { id: `h${readySlot}`, holdMs: RULES.hatchHoldMs });
    } else if (nearestEgg && carried.length < RULES.carryCap && nearestDist < (nearestEgg.egg.nest ? RANGE.steal : RANGE.pick)) {
      const { id, egg } = nearestEgg;
      const steal = !!egg.nest;
      const holdMs = (steal ? RULES.stealHoldMs : RULES.pickHoldMs) / (meta.steal || 1);
      const locked = this.lockedStage(me, egg.nest || egg.from);
      if (locked) {
        // a stage your speed is not good for yet: its eggs stay put (the server says no too)
        offer('locked', `Need ⚡ ${formatNumber(locked.speed)} Speed`, `${eggName(egg)} · ${locked.name}`, egg.x, 5, egg.z,
          () => game.toast(`You need ${formatNumber(locked.speed)} Speed for ${locked.name}! Run on your Treadmill ⚡`, '#ff5a5a'), { id });
      } else {
        offer(steal ? 'steal' : 'pick', steal ? 'STEAL' : 'Hold to Pick Up', `${eggName(egg)} · ${Number(egg.kg).toFixed(1)} kg`, egg.x, 5, egg.z,
          () => game.room.send('pick', { id }), { id, holdMs });
      }
    } else if (nextMill && distance(pos, sign.x, sign.z) < RANGE.sign) {
      offer('sign', me.treadmill === 'none' ? `Unlock $${formatNumber(nextMill.price)}` : `Upgrade $${formatNumber(nextMill.price)}`, nextMill.name, sign.x, 12, sign.z,
        () => game.room.send('buyTreadmill'));
    }
    this.autoOpenShop(pos);
    this.walkOnPads(pos, meta);
    this.updateHold();
    this.updateGuide({ me, carried, pen, pos, plot, nearestEgg, nearestDist, sign, meta });
  }

  // ---------------------------------------------------------------- the guide (the line at the top)

  // The new-player guide, one step at a time (the line at the top + the arrows on the ground):
  //   steal a first-stage egg -> carry it to your pen -> watch it grow -> hatch it (hold E)
  //   -> visit each lobby shop -> buy your treadmill -> run on it -> again, until 3 animals
  //   -> the second stage (or the treadmill until you are fast enough for it) -> done.
  // After the guide: always the best stage for your speed.
  updateGuide({ me, carried, pen, pos, plot, nearestEgg, nearestDist, sign, meta }) {
    if (carried.length) this.markDone('steal');
    if (pen.length) this.markDone('pen');
    const penMiddle = plotToWorld(plot, (PLOT.penMinX + PLOT.penMaxX) / 2, 0);
    const tutorial = meta.tutorial || 'done';
    const readyAt = pen.findIndex((e) => e.left <= 0);
    const firstStagePets = (this.game.store.get().allPets || []).filter((p) => (p.egg || '') === BIOMES[0].id).length;
    // the first round counts its steps (1/4 ... 4/4); the next rounds count the animals hatched
    const stage = (n, of, text) => (tutorial === 'basics' ? `${n}/${of} · ${text}` : tutorial === 'loop' ? `Animals ${firstStagePets}/${TUTORIAL_PETS} · ${text}` : text);
    let step;
    // carrying an egg: home first, whatever the step
    if (carried.length && pos.z <= WORLD.lineZ) step = { text: stage(2, 4, 'Run back to your Pen with the Egg! 🏃'), guide: penMiddle };
    else if (carried.length) step = { text: inPen(plot, pos.x, pos.z) && pen.length >= (meta.padCap || RULES.penSlots) ? 'Your pen is full! Hatch an egg first' : stage(2, 4, inPen(plot, pos.x, pos.z) ? 'Hold E to put the Egg in your Pen! 🥚' : 'Put the Egg in your Pen! 🥚'), guide: inPen(plot, pos.x, pos.z) ? null : penMiddle };
    else if (readyAt >= 0) {
      const at = plotToWorld(plot, PLOT.eggSlots[readyAt].x, PLOT.eggSlots[readyAt].z);
      step = { text: stage(4, 4, 'Your Egg is ready! Hold E to open it 🐣'), guide: at };
    } else if (pen.length && (tutorial === 'basics' || tutorial === 'loop' || (tutorial === 'done' && pos.z > WORLD.lineZ))) {
      // the countdown of the egg that hatches first: during the guide, and after it whenever you are
      // back in the lobby (out in the biomes the line says where to steal next)
      const i = pen.reduce((best, e, k) => (e.left < pen[best].left ? k : best), 0);
      const at = plotToWorld(plot, PLOT.eggSlots[i].x, PLOT.eggSlots[i].z);
      const clock = formatClock(pen[i].left);
      const text = pen.length > 1 ? `${pen.length} Eggs growing! 🥚 Next hatches in ${clock}` : `Your Egg is growing! 🥚 Hatches in ${clock}`;
      step = tutorial === 'done'
        ? { text, guide: this.stealStep(me, pos).guide }
        : { text: stage(3, 4, text), guide: distance(pos, at.x, at.z) > 25 ? at : null };
    } else if (tutorial === 'basics') {
      step = this.stealStep(me, pos, BIOMES[0], stage(1, 4, 'Steal an Egg from the first stage! Hold E 🥚'));
    } else if (tutorial === 'shops') {
      step = this.shopsStep();
    } else if (tutorial === 'buyTreadmill') {
      step = { text: me.treadmill === 'none' ? 'Buy your first Treadmill! Walk to its sign and click 🏃' : 'Go to your Treadmill! 🏃', guide: sign };
      if (me.treadmill !== 'none') this.advance('treadmill');
    } else if (tutorial === 'treadmill') {
      step = this.treadmillStep(plot, () => this.advance('loop'));
    } else if (tutorial === 'loop') {
      step = this.loopStep(me, pos, plot, firstStagePets);
    } else if (tutorial === 'stage2') {
      step = this.stage2Step(me, pos, plot, carried);
    } else if (nearestEgg?.egg.nest && nearestDist < NEAR_EGG_HINT && this.lockedStage(me, nearestEgg.egg.nest)) {
      // too fast a stage for me: back to the one my speed is good for
      const locked = this.lockedStage(me, nearestEgg.egg.nest);
      step = { text: `Too fast for you! Need ${formatNumber(locked.speed)} Speed ⚡ Go to ${this.bestBiome(me).name}`, guide: this.stealStep(me, pos).guide };
    } else if (nearestEgg?.egg.nest && nearestDist < NEAR_EGG_HINT) step = { text: 'Hold E to steal the Egg! 🥚', guide: null };
    else step = this.stealStep(me, pos);
    this.guide = step.guide || null;
    this.game.store.set({ objective: step.text, carried: carried.length });
  }

  // Each lobby shop in turn; it counts once its popup has opened (walking up to it opens it).
  shopsStep() {
    const popup = this.game.store.get().popup;
    for (const [id] of TUTORIAL_SHOPS) if (popup === id) this.markDone(`shop:${id}`);
    const next = TUTORIAL_SHOPS.findIndex(([id]) => !this.isDone(`shop:${id}`));
    if (next < 0) {
      this.advance('buyTreadmill');
      return { text: 'Now buy your first Treadmill! 🏃', guide: null };
    }
    const [id, name, icon] = TUTORIAL_SHOPS[next];
    return { text: `Shop ${next + 1}/${TUTORIAL_SHOPS.length} · Visit the ${name}! ${icon}`, guide: SHOPS[id] };
  }

  // Run on the treadmill for TUTORIAL_TREADMILL_SECONDS (counted while you are on it), then done().
  treadmillStep(plot, done, label = 'Run on your Treadmill to get faster! ⚡') {
    const { game } = this;
    const now = performance.now();
    const dt = Math.min(0.25, (now - (this.lastTaskAt || now)) / 1000);
    this.lastTaskAt = now;
    if (game.player.onTreadmill) this.treadTime = (this.treadTime || 0) + dt;
    const left = Math.ceil(TUTORIAL_TREADMILL_SECONDS - (this.treadTime || 0));
    if (left <= 0) {
      this.treadTime = 0;
      done();
    }
    const at = plotToWorld(plot, PLOT.treadmill.x, PLOT.treadmill.z);
    return game.player.onTreadmill
      ? { text: `Keep running! ⚡ ${Math.max(0, left)}s`, guide: null }
      : { text: label, guide: at };
  }

  // steal -> grow -> hatch -> treadmill, round and round, until TUTORIAL_PETS first-stage animals
  loopStep(me, pos, plot, pets) {
    if (pets >= TUTORIAL_PETS) {
      this.advance('stage2');
      return { text: 'Great! Time for the next stage!', guide: null };
    }
    // a new animal since the last run: on the treadmill again first
    if (this.loopPets === undefined) this.loopPets = pets;
    if (pets > this.loopPets) { this.loopPets = pets; this.needTread = true; }
    const count = `Animals ${pets}/${TUTORIAL_PETS}`;
    if (this.needTread) return this.treadmillStep(plot, () => { this.needTread = false; }, `${count} · Run on your Treadmill! ⚡`);
    return this.stealStep(me, pos, BIOMES[0], `${count} · Steal another Egg! 🥚`);
  }

  // fast enough for the second stage: steal there; otherwise the treadmill until you are
  stage2Step(me, pos, plot, carried) {
    const second = BIOMES[1];
    if (carried.some((e) => e.type === second.id)) this.advance('done');
    if (me.speed >= second.speed) return this.stealStep(me, pos, second, `You're fast enough! Steal an Egg in ${second.name}! 🍬`);
    const at = plotToWorld(plot, PLOT.treadmill.x, PLOT.treadmill.z);
    const text = `Get to ${formatNumber(second.speed)} Speed for ${second.name}! ⚡ ${formatNumber(me.speed)}/${formatNumber(second.speed)}`;
    return { text, guide: this.game.player.onTreadmill ? null : at };
  }

  // An egg to steal: from the given stage (or the best one your speed is good for), the nearest one.
  stealStep(me, pos, biome = this.bestBiome(me), text = null) {
    const nest = NESTS.find((n) => n.biome === biome.id);
    let guide = null;
    let best = Infinity;
    this.game.room.state.eggs.forEach((egg) => {
      if (!egg.nest?.startsWith(`${nest.id}:`)) return;
      const d = distance(pos, egg.x, egg.z);
      if (d < best) { best = d; guide = egg; }
    });
    if (best < NEAR_EGG_HINT) return { text: text ? `${text.split(' · ')[0]} · Hold E to steal the Egg! 🥚` : 'Hold E to steal the Egg! 🥚', guide: null };
    const here = biomeAt(pos.z);
    return { text: text || (here?.id === biome.id || biome === BIOMES[0] ? 'Steal an Egg!' : `Steal an Egg in ${biome.name}!`), guide: guide || nest };
  }

  // The stage an egg comes from (its nest key "nestId:slot"), if my speed is not good enough for it yet.
  lockedStage(me, key) {
    const nest = key ? NESTS.find((n) => n.id === String(key).split(':')[0]) : null;
    const biome = nest ? BIOMES.find((b) => b.id === nest.biome) : null;
    return biome && me.speed < biome.speed ? biome : null;
  }

  bestBiome(me) {
    let best = 0;
    BIOMES.forEach((b, i) => { if (me.speed >= b.speed) best = i; });
    if (this.bestIndex !== undefined && best > this.bestIndex) this.game.toast(`You're fast enough for ${BIOMES[best].name}!`, '#ffd21f');
    this.bestIndex = best;
    return BIOMES[best];
  }

  isDone(key) {
    return this.done.has(key) || (this.game.meta?.guideDone || []).includes(key);
  }

  markDone(key) {
    if (this.isDone(key)) return;
    this.done.add(key);
    this.game.room.send('guideDone', { key });
  }

  advance(step) {
    if (this.sentStep === step) return;
    this.sentStep = step;
    this.game.room.send('tutorial', { step });
  }

  // ---------------------------------------------------------------- pads and shops

  walkOnPads(pos, meta) {
    const { game } = this;
    // The Invite Friend pad: going onto it (or just up to its edge) opens the invite popup, with the
    // friends list and an Invite button for each. Walking there is a clear wish, so it replaces any
    // other popup that was open (like the daily rewards shown on joining); and if a popup was opened
    // on top of it while standing there, the invite comes back once that one closes. Closing the
    // invite popup itself keeps it closed until you step off the pad and come back.
    const onInvite = distance(pos, SHOPS.invite.x, SHOPS.invite.z) < INVITE_RADIUS + INVITE_NEAR;
    const popup = game.store.get().popup;
    if (onInvite && !this.onInvite) {
      this.inviteClosed = false;
      if (popup !== 'invite') game.store.set({ popup: 'invite' });
    } else if (onInvite) {
      if (this.lastPopup === 'invite' && !popup) this.inviteClosed = true; // the player closed it
      if (!popup && !this.inviteClosed) game.store.set({ popup: 'invite' });
    }
    this.lastPopup = game.store.get().popup;
    this.onInvite = onInvite;

    const onFree = distance(pos, SHOPS.free.x, SHOPS.free.z) < FREE_PAD_RADIUS;
    if (onFree && !this.onFree) {
      const ui = game.store.get().meta;
      const left = ui ? ui.giftIn - (performance.now() - ui.at) : Infinity;
      if (!meta.speedGift || left <= 0) game.room.send('claimGift');
      else if (ui) game.toast(`Free gift in ${formatClock(left)}!`, '#ffd21f');
    }
    this.onFree = onFree;
  }

  autoOpenShop(pos) {
    const inside = SHOP_POPUPS.find(([id]) => distance(pos, SHOPS[id].x, SHOPS[id].z) < SHOP_OPEN_RANGE)?.[0] || null;
    if (inside === this.shopInside) return;
    const { store } = this.game;
    const open = store.get().popup;
    if (inside && !open) store.set({ popup: inside });
    else if (!inside && open === this.shopInside) store.set({ popup: null });
    this.shopInside = inside;
  }

  // ---------------------------------------------------------------- input

  interact() {
    if (this.action?.holdMs) return; // stealing / hatching needs E held down (updateHold)
    this.action?.run();
  }

  dropEggs() {
    this.game.room.send('drop');
  }

  // A click: the treadmill sign when you stand at it, otherwise a swing of the bat.
  click() {
    if (this.action?.kind === 'sign') return this.action.run();
    const now = performance.now();
    if (now - this.lastSwing < RULES.batCooldownMs) return;
    this.lastSwing = now;
    this.game.player.punch();
    this.game.audio.swing();
    this.game.room.send('swing');
  }

  // kept for the mobile / HUD buttons of the old auto-swing
  toggleAutoSwing() {}

  project(point) {
    const { camera, renderer } = this.game;
    _v.copy(point).project(camera);
    if (_v.z > 1) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: Math.round(((_v.x + 1) / 2) * rect.width / 4) * 4, y: Math.round(((1 - _v.y) / 2) * rect.height / 4) * 4 };
  }

  publish() {
    const { store } = this.game;
    const a = this.action;
    const at = a && this.project(a.at);
    const fill = a?.holdMs ? Math.round(this.holdFill * 50) / 50 : null;
    store.set({ prompt: a && at ? { verb: a.verb, title: a.title, x: at.x, y: at.y, fill, steal: a.kind === 'steal' } : null });
  }
}
