// Works out what the player can do right now, and turns E, Q and clicks into server messages.
// Stealing and hatching need E held down until the prompt fills; a click swings the bat.

import * as THREE from 'three';
import { INVITE_RADIUS } from '../entities/InviteSpot.js';

const INVITE_NEAR = 4; // the invite popup opens this far out from the pad's edge too
import {
  BIOMES, GUARDIANS, MAX_PEN_LEVEL, NESTS, PLOT, PLOTS, RANGE, RULES, SHOPS, WORLD, biomeAt, biomeById, eggName, formatClock, formatNumber, inPen, penSlotOf, nextPenLevel, nextTreadmill, plotToWorld,
} from '../../shared/gameData.js';
import { TUTORIAL_SHOPS, TUTORIAL_TREADMILL_SECONDS } from '../../shared/progression.js';

const NEAR_EGG_HINT = 30;
const SHOP_POPUPS = [['sell', 'Sell Shop'], ['trails', 'Trails Shop'], ['spin', 'Spin Shop']];
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
      const s = PLOT.eggSlots[penSlotOf(e, i)];
      const at = plotToWorld(plot, s.x, s.z);
      if (distance(pos, at.x, at.z) < RANGE.slot) readySlot = i;
    });
    const sign = plotToWorld(plot, PLOT.treadmillSign.x, PLOT.treadmillSign.z);
    const nextMill = nextTreadmill(me.treadmill);

    const cap = meta.padCap || RULES.penSlots;
    if (carried.length && inPen(plot, pos.x, pos.z) && pen.length < cap) {
      // in your own pen with an egg: click (or press E) and it goes down in a random free nest to grow
      const mid = plotToWorld(plot, (PLOT.penMinX + PLOT.penMaxX) / 2, 0);
      offer('place', 'Click to Place', eggName(carried[0]), mid.x, 6, mid.z, () => game.room.send('place'), { id: `place${pen.length}` });
    } else if (readySlot >= 0) {
      const rs = PLOT.eggSlots[penSlotOf(pen[readySlot], readySlot)];
      const at = plotToWorld(plot, rs.x, rs.z);
      offer('hatch', 'Hold to Hatch', eggName(pen[readySlot]), at.x, 8, at.z, () => game.room.send('hatch', { i: readySlot }), { id: `h${readySlot}`, holdMs: RULES.hatchHoldMs });
    } else if (nearestEgg && carried.length < RULES.carryCap && nearestDist < (nearestEgg.egg.nest ? RANGE.steal : RANGE.pick)) {
      const { id, egg } = nearestEgg;
      const steal = !!egg.nest;
      const holdMs = (steal ? RULES.stealHoldMs : RULES.pickHoldMs) / (meta.steal || 1);
      const locked = this.lockedStage(me, egg.nest || egg.from);
      if (locked) {
        // a stage your speed is not good for yet: its eggs stay put (the server says no too)
        offer('locked', `Need ⚡ ${formatNumber(locked.speed)} Speed`, `${eggName(egg)} · ${locked.name}`, egg.x, 5, egg.z,
          () => game.toast(`You need ${formatNumber(locked.speed)} Speed for ${locked.name}! Spin in your Arena ⚡`, '#ff5a5a'), { id });
      } else {
        offer(steal ? 'steal' : 'pick', steal ? 'STEAL' : 'Hold to Pick Up', `${eggName(egg)} · ${Number(egg.kg).toFixed(1)} kg`, egg.x, 5, egg.z,
          () => game.room.send('pick', { id }), { id, holdMs });
      }
    } else if (nextMill && distance(pos, sign.x, sign.z) < RANGE.sign) {
      offer('sign', me.treadmill === 'none' ? `Unlock $${formatNumber(nextMill.price)}` : `Upgrade $${formatNumber(nextMill.price)}`, nextMill.name, sign.x, 12, sign.z,
        () => game.room.send('buyTreadmill'));
    } else {
      // the Upgrade Pen board on the other side of the gate: one more egg slot
      const penSign = plotToWorld(plot, PLOT.penSign.x, PLOT.penSign.z);
      const nextPen = nextPenLevel(Math.min(MAX_PEN_LEVEL, me.penLevel || 1));
      if (nextPen && distance(pos, penSign.x, penSign.z) < RANGE.sign) {
        offer('sign', `Upgrade $${formatNumber(nextPen.price)}`, `Pen Lv. ${nextPen.level} · +1 Egg Slot`, penSign.x, 12, penSign.z,
          () => game.room.send('buyPen'));
      }
    }
    this.autoOpenShop(pos);
    this.walkOnPads(pos, meta);
    this.updateHold();
    this.updateGuide({ me, carried, pen, pos, plot, nearestEgg, nearestDist, sign, meta });
  }

  // ---------------------------------------------------------------- the guide (the line at the top)

  // The new-player guide (the line at the top + the arrows on the ground), five steps in order:
  //   1/5 steal an egg from the first stage   2/5 bring it to your pen and click to put it down
  //   3/5 while it grows: unlock your training arena and stay in it TUTORIAL_TREADMILL_SECONDS
  //   4/5 go back to the grown egg and hatch it   5/5 visit each lobby shop
  // then out on the track: the highest stage your speed is good for. The guide always shows the
  // first step not done yet, so whatever a player did before being told to (spun in the arena while
  // carrying, hatched early, walked past a shop) is never asked for again.
  updateGuide({ me, carried, pen, pos, plot, nearestEgg, nearestDist, sign, meta }) {
    if (carried.length) this.markDone('steal');
    if (pen.length) this.markDone('pen');
    const penMiddle = plotToWorld(plot, (PLOT.penMinX + PLOT.penMaxX) / 2, 0);
    const tutorial = meta.tutorial || 'done';
    const guiding = tutorial !== 'done';
    const pets = (this.game.store.get().allPets || []).length;
    if (pets > 0) this.markDone('hatch');
    this.countArenaTime(me);
    this.countShops();
    const placed = this.isDone('pen') || pets > 0;
    const num = (n, text) => (guiding && !placed ? `${n}/5 · ${text}` : text);
    let step;
    // carrying an egg: home first, whatever the step
    if (carried.length && pos.z <= WORLD.lineZ) step = { text: num(2, 'Run back to your Pen with the Egg! 🏃'), guide: penMiddle };
    else if (carried.length) {
      const inside = inPen(plot, pos.x, pos.z);
      step = inside && pen.length >= (meta.padCap || RULES.penSlots)
        ? { text: 'Your pen is full! Hatch an egg first', guide: null }
        : { text: num(2, inside ? 'Click to put the Egg in your Pen! 🥚' : 'Put the Egg in your Pen! 🥚'), guide: inside ? null : penMiddle };
    } else if (guiding) {
      step = this.tutorialStep(me, pos, plot, pen, sign, placed, pets);
    } else {
      step = this.freeStep(me, pos, plot, pen, nearestEgg, nearestDist);
    }
    this.guide = step.guide || null;
    // slot 2 of the hotbar shows the egg in your hands by its guardian ("Brown Ninja Egg")
    const held = carried[0] ? biomeById(carried[0].type) : null;
    this.game.store.set({ objective: step.text, carried: carried.length, carriedName: held ? `${GUARDIANS[held.guardian]?.name || held.name} Egg` : '' });
  }

  // The guide's first step that is not done yet.
  tutorialStep(me, pos, plot, pen, sign, placed, pets) {
    const { game } = this;
    // 1/5: steal an egg in the first stage (2/5, carrying it home, is handled by the caller)
    if (!placed) return this.stealStep(me, pos, BIOMES[0], '1/5 · Steal an Egg from the first stage! Hold E 🥚');
    // 3/5: the training arena, unlocked, and TUTORIAL_TREADMILL_SECONDS inside it
    if (!this.isDone('arena')) {
      const arena = plotToWorld(plot, PLOT.treadmill.x, PLOT.treadmill.z);
      if (me.treadmill === 'none') {
        const price = nextTreadmill('none')?.price || 0;
        const growing = pen.some((e) => e.left > 0) ? 'While your Egg grows, unlock' : 'Unlock';
        return { text: `3/5 · ${growing} your Training Arena! Click the green button ($${formatNumber(price)}) 🌀`, guide: sign };
      }
      const left = Math.max(1, Math.ceil(TUTORIAL_TREADMILL_SECONDS - (this.arenaTime || 0)));
      return game.player.onTreadmill
        ? { text: `3/5 · Stay in your Arena to get faster! ⚡ ${left}s`, guide: null }
        : { text: `3/5 · Go into your Training Arena and stay ${left}s to get faster! 🌀`, guide: arena };
    }
    // 4/5: back to the egg once it has grown, and hatch it
    if (pets === 0) {
      if (!pen.length) return this.stealStep(me, pos, BIOMES[0], '4/5 · Steal another Egg and hatch it! 🥚');
      const readyAt = pen.findIndex((e) => e.left <= 0);
      const i = readyAt >= 0 ? readyAt : pen.reduce((best, e, k) => (e.left < pen[best].left ? k : best), 0);
      const gs = PLOT.eggSlots[penSlotOf(pen[i], i)];
      const at = plotToWorld(plot, gs.x, gs.z);
      if (readyAt >= 0) return { text: '4/5 · Your Egg has grown! Go to it and hold E to hatch it 🐣', guide: at };
      return { text: `4/5 · Your Egg is growing! 🥚 Hatches in ${formatClock(pen[i].left)}`, guide: distance(pos, at.x, at.z) > 25 ? at : null };
    }
    // 5/5: each lobby shop, the nearest one not visited yet
    const left = TUTORIAL_SHOPS.filter(([id]) => !this.isDone(`shop:${id}`));
    if (left.length) {
      const [id, name, icon] = left.reduce((a, b) => (distance(pos, SHOPS[a[0]].x, SHOPS[a[0]].z) <= distance(pos, SHOPS[b[0]].x, SHOPS[b[0]].z) ? a : b));
      const seen = TUTORIAL_SHOPS.length - left.length;
      return { text: `5/5 · Visit the ${name}! ${icon} (${seen}/${TUTORIAL_SHOPS.length} shops)`, guide: SHOPS[id] };
    }
    // all done: out on the track
    this.advance('done');
    const best = this.bestBiome(me);
    return this.stealStep(me, pos, best, `Guide done! 🎉 Your speed is good for ${best.name}. Go steal! 🥚`);
  }

  // After the guide: hatch what has grown, else the highest stage your speed is good for.
  freeStep(me, pos, plot, pen, nearestEgg, nearestDist) {
    const readyAt = pen.findIndex((e) => e.left <= 0);
    if (readyAt >= 0) {
      const rs = PLOT.eggSlots[penSlotOf(pen[readyAt], readyAt)];
      return { text: 'Your Egg is ready! Hold E to open it 🐣', guide: plotToWorld(plot, rs.x, rs.z) };
    }
    if (pen.length && pos.z > WORLD.lineZ) {
      // back in the lobby: the countdown of the egg that hatches first (out on the track the line says where to steal)
      const i = pen.reduce((best, e, k) => (e.left < pen[best].left ? k : best), 0);
      const clock = formatClock(pen[i].left);
      const text = pen.length > 1 ? `${pen.length} Eggs growing! 🥚 Next hatches in ${clock}` : `Your Egg is growing! 🥚 Hatches in ${clock}`;
      return { text, guide: this.stealStep(me, pos).guide };
    }
    if (nearestEgg?.egg.nest && nearestDist < NEAR_EGG_HINT && this.lockedStage(me, nearestEgg.egg.nest)) {
      // too fast a stage for me: back to the one my speed is good for
      const locked = this.lockedStage(me, nearestEgg.egg.nest);
      return { text: `Too fast for you! Need ${formatNumber(locked.speed)} Speed ⚡ Go to ${this.bestBiome(me).name}`, guide: this.stealStep(me, pos).guide };
    }
    if (nearestEgg?.egg.nest && nearestDist < NEAR_EGG_HINT) return { text: 'Hold E to steal the Egg! 🥚', guide: null };
    const best = this.bestBiome(me);
    return this.stealStep(me, pos, best, best === BIOMES[0] ? 'Steal an Egg!' : `Your speed is good for ${best.name}! Steal an Egg there 🥚`);
  }

  // Time in the (unlocked) arena while the guide runs, whatever the step; done once it reaches
  // TUTORIAL_TREADMILL_SECONDS.
  countArenaTime(me) {
    const now = performance.now();
    const dt = Math.min(0.25, (now - (this.lastArenaAt || now)) / 1000);
    this.lastArenaAt = now;
    if (this.isDone('arena') || me.treadmill === 'none' || !this.game.player.onTreadmill) return;
    this.arenaTime = (this.arenaTime || 0) + dt;
    if (this.arenaTime >= TUTORIAL_TREADMILL_SECONDS) this.markDone('arena');
  }

  // A shop counts as visited once its popup has opened (walking up to it opens it), at any time.
  countShops() {
    const popup = this.game.store.get().popup;
    for (const [id] of TUTORIAL_SHOPS) if (popup === id) this.markDone(`shop:${id}`);
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

  // A click in the world: only a board (buy) or the egg into your pen. It never spins the player: the
  // whirlwind is only the Spin button (or 1).
  click() {
    if (this.action?.kind === 'sign' || this.action?.kind === 'place') this.action.run();
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
