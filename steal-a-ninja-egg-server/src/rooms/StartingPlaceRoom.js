// The main room. The server owns the nests and their eggs, the sleeping guardians, cash, speed,
// the eggs growing in each pen and the day / night clock. Clients only ask for an action, and every
// action is checked against the player's position.
//
// The loop: hold E on a nest egg -> its guardian wakes and chases you -> get back over the red line
// (the safe zone) -> walk into your pen and the egg is put down to grow -> hold E to hatch it -> a pet
// that earns cash every second (even offline).

import colyseus from 'colyseus';
import { authenticateClient } from '../auth/legionAuth.js';
import { loadProfile, getProfile, holdProfile, releaseProfile, carryGuestProgress, markDirty } from '../game/profiles.js';
import { eventEgg, hatchResult, nestEgg } from '../game/economy.js';
import {
  BIOMES, CYCLE, EGGS, EGG_RARITY, EVENT_EGGS, GUARDIANS, MAX_CLIENTS, NESTS, PETS, PLOT, PLOTS, RANGE, RARITIES, RULES, RUN_PER_GAIN, SHOPS, TREADMILLS, TREADMILL_ALIAS, WORLD,
  MAX_PEN_LEVEL, biomeById, biomeIndex, freePenSlot, penSlotOf, frozenAt, eggGrowMs, nextPenLevel, guardianSpeed, inPen, nextTreadmill, onTreadmill, petIncome, plotToWorld, runGain, treadmillById, walkSpeed,
} from '../shared/gameData.js';
import { AnimalState, GroundEgg, PlayerState, StartingPlaceState } from './schema.js';
import * as progress from '../game/progress.js';
import { SERVER_LUCK_MS, SPEED_GIFT, STARTER_BONUS, friendCashMult, giftAmount, growNowPrice, serverLuckPrice, weaponById } from '../shared/progression.js';
import { reportAdd, reportBest } from '../game/leaderboardReporter.js';

const { Room } = colyseus;
// local testing only: CYCLE_MS=20000 makes every day and night that long (never set on Boxity hosting)
const phaseMs = (night) => Number(process.env.CYCLE_MS) || (night ? CYCLE.nightMs : CYCLE.dayMs);
const TICK_MS = 100;
const MAX_AVATAR_JSON = 4096;
const MAX_GROUND_EGGS = 120;
const REACH_MARGIN = 4; // positions arrive 10x a second, so allow for a little lag
const GUARD = {
  alertMs: 1600,     // it roars first ("!"), then charges: the roar is your head start
  returnSpeed: 0.55, // of its own speed, walking back to its nest
  graceMs: 2500,     // after a catch, no guardian can catch the same player again for this long
  // Whatever the stage, a chaser keeps pace with its thief: its speed is the thief's own walk speed
  // times a factor that is above 1 while it is far behind (it catches up) and just under 1 up close
  // (you can only barely keep ahead). Never slower than the stage's own guardian speed.
  nearK: 0.96,       // up close: a little slower than you
  farK: 1.12,        // far behind: faster than you, so it always catches up
  nearGap: 18,       // from this gap (plus its reach) down it runs at nearK...
  farGap: 70,        // ...from this gap up at farK, in between a blend
  // Up close it lunges: a short burst at the spot you were in, so you have to dodge (or bat it).
  lungeK: 1.75,      // of your walk speed, while lunging
  lungeMs: 420,
  lungeEveryMs: 2200, // the least time between two lunges
  lungeGap: 0.45,    // it lunges once the gap is under its reach + this many seconds of your walking
};
const lerp = (a, b, t) => a + (b - a) * t;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const jsonField = (v) => {
  const text = JSON.stringify(v ?? {});
  return text.length <= MAX_AVATAR_JSON ? text : '{}';
};
const near = (p, x, z, range) => Math.hypot(p.x - x, p.z - z) <= range + REACH_MARGIN;
const parse = (json) => {
  try { return JSON.parse(json); } catch { return []; }
};
const cleanEgg = (e) => (e && EGGS[e.type] && EGG_RARITY[e.rarity]
  ? { type: e.type, rarity: e.rarity, kg: Number(e.kg) || 1, size: [1, 2, 3].includes(e.size) ? e.size : 1 }
  : null);
const nestOfKey = (key) => NESTS.find((n) => n.id === String(key).split(':')[0]) || null;

// Older or broken saves: fill in what is missing.
function normalizeProfile(profile) {
  profile.pets = (profile.pets || []).filter((p) => p && typeof p === 'object' && PETS[p.id]);
  if (!finite(profile.cash)) profile.cash = 0;
  if (!finite(profile.speed) || profile.speed < 0) profile.speed = 0;
  if (TREADMILL_ALIAS[profile.treadmill]) profile.treadmill = TREADMILL_ALIAS[profile.treadmill]; // a removed arena: the best one
  if (!TREADMILLS.some((t) => t.id === profile.treadmill)) profile.treadmill = 'none';
  progress.normalizeProgress(profile);
}

export class StartingPlaceRoom extends Room {
  onCreate() {
    this.maxClients = MAX_CLIENTS;
    this.setState(new StartingPlaceState());
    this.eggSeq = 0;
    this.emoteSeq = 0;
    this.eggExpiry = new Map();   // dropped egg id -> when it disappears
    this.nestRefill = new Map();  // 'n3:1' (nest:slot) -> when it gets a new egg
    this.grace = new Map();       // sessionId -> no catches before this time
    this.slow = new Map();        // sessionId -> true while their Slow Mode is on (their chasers slow down too)
    this.lastMove = new Map();    // sessionId -> time of the last position update
    this.runDistance = new Map(); // sessionId -> distance run towards the next speed gain
    this.treadStep = new Map();   // sessionId -> ms on the treadmill towards the next step
    this.lastSwing = new Map();   // sessionId -> time of the last bat swing
    // Every nest has a guardian asleep beside it, the same for everyone (g0, g1...). A thief does not
    // wake it: they get a chaser of their own (c<nest>.<sessionId>), a copy of it that only they see
    // (their client hides the sleeping one meanwhile). So while one thief is being chased, the nest
    // is still guarded for everyone else: stealing from it wakes their own chaser too.
    this.brains = new Map();      // guardian / chaser id -> { nest, biome, home, alertUntil, stunUntil }
    this.metaKeys = new Map();    // sessionId -> metaKey when meta was last sent
    this.sidOf = new Map();       // PlayerState -> sessionId (fast lookup)
    this.mineSent = new Map();    // sessionId -> { allPets, meta } last sent to that player (sendMine)
    this.friendIds = new Map();   // sessionId -> Set of the player's Bloxity friend ids (sent by their client)
    this.lastSecond = Date.now();
    this.lastTick = Date.now();

    for (const nest of NESTS) nest.slots.forEach((_, i) => this.fillSlot(nest, i));
    NESTS.forEach((nest, i) => {
      const biome = biomeById(nest.biome);
      const id = `g${i}`;
      const a = new AnimalState(biome.guardian, nest.guardian.x, nest.guardian.z);
      a.ry = nest.side > 0 ? -Math.PI / 2 : Math.PI / 2; // lying beside its eggs, facing them
      this.state.animals.set(id, a);
      this.brains.set(id, { nest, biome, home: { ...nest.guardian, ry: a.ry }, alertUntil: 0, stunUntil: 0 });
    });

    // the clock starts at the beginning of a day
    this.cycleEnds = Date.now() + phaseMs(false);
    this.nextEvent = Date.now() + EVENT_EGGS.everyMs;
    this.state.clock = Math.ceil(phaseMs(false) / 1000);

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.setPatchRate(TICK_MS);

    const on = (type, fn) => this.onMessage(type, (client, m = {}) => {
      const p = this.state.players.get(client.sessionId);
      if (p) fn(client, p, m || {});
    });

    this.onMessage('ping', (client, m = {}) => client.send('pong', { t: m?.t }));

    on('move', (client, p, m) => {
      if (![m.x, m.y, m.z, m.ry].every(finite)) return;
      if (frozenAt(this.state)) return; // the last seconds of the day / night: everyone stands still
      const x = clamp(m.x, -WORLD.halfX, WORLD.halfX);
      const z = clamp(m.z, this.state.gate > 0 ? WORLD.lineZ + 2 : WORLD.northZ, WORLD.southZ);
      this.countRun(client.sessionId, p, x, z);
      p.x = x;
      p.y = clamp(m.y, 0, 200);
      p.z = z;
      p.ry = m.ry;
      if (typeof m.anim === 'string') p.anim = m.anim.slice(0, 24);
    });
    on('pick', (client, p, m) => { if (!frozenAt(this.state)) this.pick(client, p, String(m.id || '')); });
    on('slowMode', (client, _p, m) => { this.slow.set(client.sessionId, !!m.on); });
    on('drop', (_client, p) => this.dropCarried(p));
    on('place', (client, p) => this.autoPlace(client, p)); // E held in your own pen: the egg goes down to grow
    on('hatch', (client, p, m) => this.hatch(client, p, Number(m.i)));
    on('swing', (client, p) => this.swing(client, p));
    on('buyTreadmill', (client, p) => this.buyTreadmill(client, p));
    on('buyPen', (client, p) => this.buyPen(client, p));

    // shop, pets, index, rebirth and the free gift: all paid with (or paying out) cash
    const str = (v) => (typeof v === 'string' ? v.slice(0, 24) : '');
    on('buyPass', (client, p, m) => this.act(client, p, (pr) => progress.buyPass(pr, str(m.id))));
    on('buyPotion', (client, p, m) => this.act(client, p, (pr, now) => progress.buyPotion(pr, str(m.id), now)));
    on('buyBundle', (client, p) => this.act(client, p, (pr, now) => progress.buyBundle(pr, now)));
    on('buySpeed', (client, p, m) => this.act(client, p, (pr) => progress.buySpeedPack(pr, str(m.id))));
    on('doubleSpeed', (client, p) => this.act(client, p, (pr) => progress.doubleSpeed(pr)));
    on('buyEggs', (client, p, m) => {
      const result = this.act(client, p, (pr, now) => progress.buyFeatured(pr, Number(m.count), now));
      if (result.ok) client.send('opened', { pets: result.pets.map(({ id, cash }) => ({ id, cash })) });
    });
    on('equipPet', (client, p, m) => this.act(client, p, (pr) => progress.equipPet(pr, Number(m.uid))));
    on('unequipPet', (client, p, m) => this.act(client, p, (pr) => progress.unequipPet(pr, Number(m.uid))));
    on('equipBest', (client, p) => this.act(client, p, (pr) => progress.equipBest(pr)));
    on('buySlots', (client, p) => this.act(client, p, (pr) => progress.buySlots(pr)));
    on('claimIndex', (client, p, m) => this.act(client, p, (pr) => progress.claimIndex(pr, str(m.id))));
    on('rebirth', (client, p) => this.act(client, p, (pr) => progress.rebirth(pr)));
    on('claimGift', (client, p) => this.claimGift(client, p));
    on('friends', (_client, p, m) => {
      const ids = (Array.isArray(m.ids) ? m.ids : []).slice(0, 500).filter((id) => typeof id === 'string' || typeof id === 'number').map(String);
      this.friendIds.set(this.sessionOf(p), new Set(ids));
      this.refreshAll();
    });

    // an emote from Boxity's picker: replicated so everyone sees it (ids are 24-char catalogue ids)
    on('emote', (_client, p, m) => {
      if (typeof m.id !== 'string' || !/^[a-f0-9]{24}$/.test(m.id)) return;
      p.emote = `${m.id}:${++this.emoteSeq}`;
    });

    // the client is listening now: send it its own private data again, in full
    on('mine', (client) => { const last = this.mineSent.get(client.sessionId); if (last) this.sendMine(client.sessionId, last, true); });
    on('tutorial', (client, p, m) => this.act(client, p, (pr) => progress.advanceTutorial(pr, str(m.step))));
    on('guideDone', (client, p, m) => this.act(client, p, (pr) => progress.markGuideDone(pr, typeof m.key === 'string' ? m.key.slice(0, 40) : '')));

    on('buyTrail', (client, p, m) => this.act(client, p, (pr) => progress.buyTrail(pr, str(m.id))));
    on('equipTrail', (client, p, m) => this.act(client, p, (pr) => progress.equipTrail(pr, str(m.id))));
    on('buySpin', (client, p, m) => this.act(client, p, (pr) => progress.buySpin(pr, str(m.id))));
    on('equipSpin', (client, p, m) => this.act(client, p, (pr) => progress.equipSpin(pr, str(m.id))));
    on('lockPet', (client, p, m) => this.act(client, p, (pr) => progress.toggleLock(pr, Number(m.uid))));
    on('sellPets', (client, p, m) => {
      const uids = Array.isArray(m.uids) ? m.uids.map(Number).filter(Number.isInteger) : [];
      const result = this.act(client, p, (pr) => progress.sellPets(pr, uids));
      if (result.ok) client.send('gift', { amount: result.amount });
    });

    // the new popups: index per pet, daily rewards, money and starter pack, gifts, weapons, server luck
    on('claimIndexPet', (client, p, m) => this.act(client, p, (pr) => progress.claimIndexPet(pr, str(m.id))));
    on('claimIndexAll', (client, p) => this.act(client, p, (pr) => progress.claimIndexAll(pr)));
    on('claimDaily', (client, p) => {
      const result = this.act(client, p, (pr, now) => progress.claimDaily(pr, now));
      if (result.ok && result.pets.length) client.send('opened', { pets: result.pets.map(({ id, cash }) => ({ id, cash })) });
    });
    on('buyMoney', (client, p, m) => this.act(client, p, (pr) => progress.buyMoneyPack(pr, str(m.id))));
    on('buyStarter', (client, p) => {
      const result = this.act(client, p, (pr, now) => progress.buyStarterPack(pr, now));
      if (result.ok) client.send('opened', { pets: result.pets.map(({ id, cash }) => ({ id, cash })) });
    });
    on('buyWeapon', (client, p, m) => this.act(client, p, (pr) => progress.buyWeapon(pr, str(m.id))));
    on('equipWeapon', (client, p, m) => this.act(client, p, (pr) => progress.equipWeapon(pr, str(m.id))));
    on('buyTreadmillShop', (client, p) => this.buyTreadmill(client, p, true));
    on('buyServerLuck', (client, p) => this.buyServerLuck(client, p));
    on('instantHatch', (client, p, m) => this.instantHatch(client, p, Number(m.i)));
    on('gift', (client, p, m) => this.gift(client, p, str(m.kind), str(m.id), String(m.to || '').slice(0, 40)));

    on('offlineCheck', (client, p) => {
      const info = progress.offlineInfo(getProfile(p.userId));
      if (info) client.send('offline', info);
    });
    on('claimOffline', (client, p, m) => {
      const result = this.act(client, p, (pr) => progress.claimOffline(pr, !!m.triple));
      if (result.ok) client.send('gift', { amount: result.amount });
    });
    // pay to finish every egg growing in your pen right now
    on('growNow', (client, p) => this.act(client, p, (pr) => {
      const pen = parse(p.pen);
      if (!pen.some((e) => e.left > 0)) return { ok: false, text: 'No egg is growing' };
      const price = growNowPrice(progress.baseIncome(pr)) * pen.filter((e) => e.left > 0).length;
      if (pr.cash < price) return { ok: false, text: 'Not enough cash' };
      pr.cash -= price;
      for (const e of pen) e.left = 0;
      p.pen = JSON.stringify(pen);
      return { ok: true, text: 'Your eggs are ready to hatch!' };
    }));
  }

  async onAuth(client, options) {
    const auth = await authenticateClient(client, options);
    await loadProfile(auth.userId, auth.displayName);
    holdProfile(auth.userId);
    if (!auth.guest) await carryGuestProgress(auth.userId, auth.carriedFrom, auth.localGuestId);
    return auth;
  }

  onJoin(client, options = {}, auth) {
    const profile = getProfile(auth.userId, auth.displayName);
    normalizeProfile(profile);
    progress.startOffline(profile, Date.now());
    const used = new Set([...this.state.players.values()].map((p) => p.plot));
    const plot = PLOTS.findIndex((_, i) => !used.has(i));
    const p = new PlayerState();
    p.userId = auth.userId;
    p.name = auth.displayName;
    p.avatar = jsonField(options.avatar);
    p.props = jsonField(options.props);
    p.plot = plot;
    // you appear on the round spawn pad in the middle of the lobby (a random spot on it, so players
    // joining together do not stand inside each other)
    const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * SHOPS.spawn.radius * 0.55;
    p.x = SHOPS.spawn.x + Math.cos(angle) * r;
    p.z = SHOPS.spawn.z + Math.sin(angle) * r;
    p.cash = profile.cash;
    p.speed = profile.speed;
    p.treadmill = profile.treadmill;
    p.penLevel = Math.min(MAX_PEN_LEVEL, profile.penLevel || 1);
    this.state.players.set(client.sessionId, p);
    this.sidOf.set(p, client.sessionId);
    this.restoreEggs(p, profile);
    this.refreshAll();
  }

  async onLeave(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) this.saveEggs(p);
    if (p) {
      // their chasers go; a stolen egg in their hands goes back to its nest
      this.state.animals.forEach((a, id) => { if (a.owner === client.sessionId) this.removeChaser(id); });
      this.sidOf.delete(p);
    }
    this.state.players.delete(client.sessionId);
    for (const map of [this.grace, this.lastMove, this.runDistance, this.treadStep, this.lastSwing, this.metaKeys, this.friendIds, this.slow, this.mineSent]) map.delete(client.sessionId);
    this.refreshAll();
    if (p) {
      const profile = getProfile(p.userId);
      profile.lastSeen = Date.now(); // offline cash counts from here
      progress.updateAchievements(profile); // the latest records go into the save
      markDirty();
      await releaseProfile(p.userId);
    }
  }

  // The egg in your hands and the eggs growing in your pen are part of the save.
  saveEggs(p) {
    const profile = getProfile(p.userId);
    profile.machine = { carried: parse(p.carried).map(cleanEgg).filter(Boolean), pen: parse(p.pen) };
    markDirty();
  }

  restoreEggs(p, profile) {
    const m = profile.machine;
    delete profile.machine;
    if (!m || typeof m !== 'object') return;
    const cap = progress.perksOf(profile).padCap;
    p.carried = JSON.stringify((Array.isArray(m.carried) ? m.carried : []).map(cleanEgg).filter(Boolean).slice(0, RULES.carryCap));
    p.pen = JSON.stringify((Array.isArray(m.pen) ? m.pen : []).map((e) => {
      const egg = cleanEgg(e);
      if (!egg) return null;
      const grow = eggGrowMs(egg);
      return { ...egg, grow, left: clamp(Number(e.left) || 0, 0, grow), ...(Number.isInteger(e.s) ? { s: e.s } : {}) };
    }).filter(Boolean).slice(0, cap));
  }

  // The equipped pets walk in the pen and earn; boosts multiply what they earn. Also refreshes
  // everything the popups show (meta).
  refreshPets(p, profile) {
    const now = Date.now();
    const equipped = progress.equippedPets(profile);
    p.pets = JSON.stringify(equipped.map(({ id, cash, egg, rarity }) => ({ id, cash, egg, rarity })));
    const friends = this.friendsHere(p);
    p.income = Math.round(petIncome(equipped) * progress.perksOf(profile, now).cash * friendCashMult(friends));
    progress.updateAchievements(profile); // new records (speed, arena, pen, spin styles...) are kept
    p.cash = profile.cash;
    p.speed = profile.speed;
    p.treadmill = profile.treadmill;
    p.penLevel = Math.min(MAX_PEN_LEVEL, profile.penLevel || 1);
    p.trail = profile.trail || '';
    p.spin = profile.spin || 'breeze';
    p.axe = profile.weapon || 'bat';
    const sessionId = this.sessionOf(p);
    // the pets list and the popups' data (meta) only matter to the player themself: they go to that
    // one client (and only when they changed), not through the room state to everyone in the room
    this.sendMine(sessionId, {
      allPets: progress.allPetsJson(profile),
      meta: progress.metaOf(profile, now, 0, {
        friendsHere: friends, speedGift: !!profile.speedGift, starterBonus: !!profile.starterBonus,
        serverLuck: Math.max(0, (this.luckUntil || 0) - now), serverLuckBy: this.luckBy || '',
      }),
    });
    this.metaKeys.set(sessionId, this.metaKey(profile, now));
  }

  // Sends a player their own private data ({ allPets, meta } as JSON strings), only the parts that
  // changed since the last time. force: everything again (the client asks once it is listening).
  sendMine(sessionId, data, force = false) {
    const last = force ? {} : (this.mineSent.get(sessionId) || {});
    const changed = {};
    for (const [k, v] of Object.entries(data)) if (v !== last[k]) changed[k] = v;
    if (!Object.keys(changed).length) return;
    this.mineSent.set(sessionId, { ...last, ...changed });
    this.clients.getById(sessionId)?.send('mine', changed);
  }

  friendsHere(p) {
    const ids = this.friendIds.get(this.sessionOf(p));
    if (!ids?.size) return 0;
    let n = 0;
    this.state.players.forEach((other) => {
      if (other !== p && (ids.has(other.userId) || ids.has(other.userId.replace(/^[a-z]+_/, '')))) n++;
    });
    return n;
  }

  refreshAll() {
    this.state.players.forEach((p) => this.refreshPets(p, getProfile(p.userId)));
  }

  metaKey(profile, now) {
    return `${Object.keys(profile.boosts).filter((id) => profile.boosts[id] > now).join()}|${now >= profile.giftAt}`;
  }

  act(client, p, run) {
    const profile = getProfile(p.userId);
    const result = run(profile, Date.now());
    if (result.text) client.send('notice', { text: result.text, ok: result.ok });
    if (!result.ok) return result;
    markDirty();
    this.refreshPets(p, profile);
    return result;
  }

  sessionOf(p) {
    const id = this.sidOf.get(p);
    if (id) return id;
    for (const [sessionId, other] of this.state.players) if (other === p) return sessionId;
    return '';
  }

  // ------------------------------------------------------------------ the clock

  tick() {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;

    for (const [id, at] of this.eggExpiry) {
      if (now < at) continue;
      this.eggExpiry.delete(id);
      this.state.eggs.delete(id);
    }
    for (const [key, at] of this.nestRefill) {
      if (now < at) continue;
      this.nestRefill.delete(key);
      const nest = nestOfKey(key);
      if (nest) this.fillSlot(nest, Number(key.split(':')[1]));
    }
    this.updateTreadmills(now, dt);
    this.updateGuardians(now, dt);
    if (now >= this.cycleEnds) this.nextPhase(now);
    if (now >= this.nextEvent) this.spawnEventEgg(now);
    if (now - this.lastSecond >= 1000) {
      this.lastSecond += 1000;
      if (now - this.lastSecond > 3000) this.lastSecond = now;
      this.everySecond(now);
    }
  }

  // Day -> night: eggs grow much faster. Night -> day: every nest gets fresh eggs.
  nextPhase(now) {
    const night = !this.state.night;
    this.state.night = night;
    this.cycleEnds = now + phaseMs(night);
    this.sendEveryoneToLobby(now);
    if (night) {
      this.broadcast('announce', { text: `Night! Eggs grow ${CYCLE.nightGrowth}x faster!`, color: '#c89bff', big: true });
      return;
    }
    // morning: all nest eggs are replaced (eggs in hands and pens are kept)
    this.state.eggs.forEach((egg, id) => { if (egg.nest) this.state.eggs.delete(id); });
    this.nestRefill.clear();
    for (const nest of NESTS) nest.slots.forEach((_, i) => this.fillSlot(nest, i));
    this.broadcast('announce', { text: 'ALL EGGS RESET!', color: '#ffd21f', big: true });
  }

  // At the change of day / night: every egg in a player's hands goes back to its nest, the chasers
  // are gone, everyone is put back on the spawn pad in the lobby, and the glass gate stays shut for
  // CYCLE.gateS seconds (the clients count it down on the glass).
  sendEveryoneToLobby(now) {
    this.state.animals.forEach((a, id) => { if (a.owner) this.removeChaser(id); });
    this.state.players.forEach((p, sessionId) => {
      for (const egg of parse(p.carried)) if (egg.nest) this.returnToNest(egg);
      p.carried = '[]';
      const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * SHOPS.spawn.radius * 0.8;
      p.x = SHOPS.spawn.x + Math.cos(angle) * r;
      p.z = SHOPS.spawn.z + Math.sin(angle) * r;
      p.y = 0;
      this.clients.getById(sessionId)?.send('teleport', { x: p.x, z: p.z });
    });
    this.gateUntil = now + CYCLE.gateS * 1000;
    this.state.gate = CYCLE.gateS;
  }

  // Every few minutes a special egg lands in a nest in one of the scarier biomes.
  spawnEventEgg(now) {
    this.nextEvent = now + EVENT_EGGS.everyMs;
    const { egg, biome, text } = eventEgg();
    const nest = NESTS.find((n) => n.biome === biome.id);
    const slot = Math.floor(Math.random() * nest.slots.length);
    const key = `${nest.id}:${slot}`;
    this.state.eggs.forEach((e, id) => { if (e.nest === key) this.state.eggs.delete(id); });
    this.nestRefill.delete(key);
    this.fillSlot(nest, slot, egg);
    this.broadcast('announce', { text, color: '#ffd21f', rarity: egg.rarity });
  }

  // Pets earn cash; eggs in pens grow; the clock ticks down.
  everySecond(now) {
    this.state.clock = Math.max(0, Math.ceil((this.cycleEnds - now) / 1000));
    this.state.gate = Math.max(0, Math.ceil(((this.gateUntil || 0) - now) / 1000));
    const nightK = this.state.night ? CYCLE.nightGrowth : 1;
    this.state.players.forEach((p, sessionId) => {
      const profile = getProfile(p.userId);
      profile.lastSeen = now;
      reportBest('cash_per_sec', p.userId, p.income);
      reportBest('top_speed', p.userId, profile.speed);
      if (this.metaKeys.get(sessionId) !== this.metaKey(profile, now)) this.refreshPets(p, profile);
      if (p.income > 0) {
        profile.cash += p.income;
        p.cash = profile.cash;
        markDirty();
      }
      if (p.pen !== '[]') {
        const pen = parse(p.pen);
        const k = 1000 * nightK * progress.perksOf(profile, now).growth;
        let changed = false;
        for (const e of pen) {
          if (e.left <= 0) continue;
          e.left = Math.max(0, Math.round(e.left - k));
          changed = true;
        }
        if (changed) p.pen = JSON.stringify(pen);
      }
    });
  }

  // Standing on your own treadmill: +its gain to speed every step.
  updateTreadmills(now, dt) {
    this.state.players.forEach((p, sessionId) => {
      const mill = treadmillById(p.treadmill);
      if (!mill.gain || !onTreadmill(PLOTS[p.plot], p.x, p.y, p.z)) return void this.treadStep.set(sessionId, 0);
      let acc = (this.treadStep.get(sessionId) || 0) + dt * 1000;
      if (acc < RULES.treadmillStepMs) return void this.treadStep.set(sessionId, acc);
      const profile = getProfile(p.userId);
      const k = progress.perksOf(profile, now).treadmill;
      while (acc >= RULES.treadmillStepMs) {
        acc -= RULES.treadmillStepMs;
        profile.speed += Math.round(mill.gain * k);
      }
      this.treadStep.set(sessionId, acc);
      p.speed = profile.speed;
      markDirty();
    });
  }

  // Running anywhere (off the treadmill) slowly earns speed. Each step counts at most as far as
  // the player could really walk since their last update, so teleports or fake moves earn nothing extra.
  countRun(sessionId, p, x, z) {
    const now = Date.now();
    const last = this.lastMove.get(sessionId) || now;
    this.lastMove.set(sessionId, now);
    if (onTreadmill(PLOTS[p.plot], p.x, p.y, p.z)) return;
    const seconds = Math.min(0.5, (now - last) / 1000);
    const profile = getProfile(p.userId);
    const k = progress.perksOf(profile, now);
    const step = Math.min(Math.hypot(x - p.x, z - p.z), walkSpeed(p.speed) * k.walk * seconds * 1.3 + 0.5);
    if (step < 0.05) return;
    const run = (this.runDistance.get(sessionId) || 0) + step;
    if (run < RUN_PER_GAIN) return void this.runDistance.set(sessionId, run);
    this.runDistance.set(sessionId, run - RUN_PER_GAIN);
    profile.speed += Math.round(runGain(profile.speed) * k.run);
    p.speed = profile.speed;
    markDirty();
  }

  // ------------------------------------------------------------------ guardians

  updateGuardians(now, dt) {
    this.state.animals.forEach((a, id) => {
      const brain = this.brains.get(id);
      if (a.mood === 'sleep' || !a.owner) return; // the nests' own guardians never leave them
      const target = a.target ? this.state.players.get(a.target) : null;
      // in Slow Mode the thief walks at half speed, and so does everything chasing them
      const speed = guardianSpeed(brain.biome) * this.slowK(a.target || a.owner);

      if (a.mood === 'stun') {
        if (now < brain.stunUntil) return;
        a.mood = this.isThief(target) ? 'chase' : 'return';
        if (a.mood === 'return') a.target = '';
        return;
      }
      if (a.mood === 'alert') {
        if (!this.isThief(target)) return this.calmDown(a);
        a.ry = Math.atan2(target.x - a.x, target.z - a.z);
        if (now >= brain.alertUntil) a.mood = 'chase';
        return;
      }
      if (a.mood === 'chase') {
        if (!this.isThief(target)) {
          // made it over the red line (or dropped the egg): it gives up and goes home
          if (target && target.z > WORLD.lineZ && target.carried !== '[]') {
            this.clients.getById(a.target)?.send('escaped', { name: GUARDIANS[a.type].name });
            progress.addAchievement(getProfile(target.userId), 'escapes'); // an achievement: got away with the egg
            markDirty();
          }
          return this.calmDown(a);
        }
        const reach = GUARDIANS[a.type].reach;
        const thiefSpeed = this.walkOf(target, now);
        const gap = Math.hypot(target.x - a.x, target.z - a.z) - reach;
        let d;
        if (now < brain.lungeUntil) {
          // mid-lunge: straight at where the thief was when it leapt (step aside and it misses)
          d = this.moveToward(a, brain.lungeX, brain.lungeZ, Math.max(speed, thiefSpeed) * GUARD.lungeK, dt);
          d = Math.hypot(target.x - a.x, target.z - a.z);
        } else {
          if (gap < thiefSpeed * GUARD.lungeGap && now >= brain.nextLunge) {
            brain.lungeUntil = now + GUARD.lungeMs;
            brain.nextLunge = now + GUARD.lungeEveryMs;
            brain.lungeX = target.x;
            brain.lungeZ = target.z;
            this.clients.getById(a.target)?.send('lunge', { id });
          }
          const k = lerp(GUARD.nearK, GUARD.farK, clamp((gap - GUARD.nearGap) / (GUARD.farGap - GUARD.nearGap), 0, 1));
          d = this.moveToward(a, target.x, target.z, Math.max(speed, thiefSpeed * k), dt);
        }
        if (d <= reach && now >= (this.grace.get(a.target) || 0)) this.catchThief(a, id, target, now);
        return;
      }
      // return: walk back to the nest, where it is the sleeping guardian again (the chaser goes)
      const d = this.moveToward(a, brain.home.x, brain.home.z, speed * GUARD.returnSpeed, dt);
      if (d > 1) return;
      this.removeChaser(id);
    });
  }

  // How fast this player really walks (their speed, walk-speed perks and Slow Mode), as their client does.
  walkOf(p, now) {
    const profile = getProfile(p.userId);
    const perk = profile ? progress.perksOf(profile, now).walk || 1 : 1;
    return walkSpeed(p.speed) * perk * this.slowK(this.sidOf.get(p));
  }

  slowK(sessionId) {
    return sessionId && this.slow.get(sessionId) ? 0.5 : 1;
  }

  removeChaser(id) {
    this.state.animals.delete(id);
    this.brains.delete(id);
  }

  // Still worth chasing: in the game, outside the safe zone and holding an egg.
  isThief(p) {
    return !!p && p.z <= WORLD.lineZ && p.carried !== '[]';
  }

  // The guardian of this nest wakes up and goes after the player: their own chaser, a copy of it
  // that only they see, so the nest stays guarded for everyone else.
  wake(nestId, sessionId, now) {
    const i = NESTS.findIndex((n) => n.id === nestId);
    if (i < 0) return;
    const home = this.brains.get(`g${i}`);
    const id = `c${i}.${sessionId}`;
    let a = this.state.animals.get(id);
    if (a && (a.mood === 'chase' || a.mood === 'alert')) return;
    if (!a) {
      a = new AnimalState(home.biome.guardian, home.home.x, home.home.z);
      a.ry = home.home.ry;
      a.owner = sessionId;
      this.state.animals.set(id, a);
      this.brains.set(id, { ...home, alertUntil: 0, stunUntil: 0 });
    }
    a.mood = 'alert';
    a.target = sessionId;
    const brain = this.brains.get(id);
    brain.alertUntil = now + GUARD.alertMs;
    brain.lungeUntil = 0;
    brain.nextLunge = now + GUARD.alertMs + GUARD.lungeEveryMs; // no lunge straight out of the roar
    this.clients.getById(sessionId)?.send('woke', { id, by: sessionId });
  }

  calmDown(a) {
    a.mood = 'return';
    a.target = '';
  }

  moveToward(a, x, z, speed, dt) {
    const dx = x - a.x, dz = z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return 0;
    const step = Math.min(d, speed * dt);
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    a.ry = Math.atan2(dx, dz);
    return d - step;
  }

  // Caught! The egg goes back to its nest and the thief is knocked back.
  catchThief(a, id, p, now) {
    const sessionId = a.target;
    const carried = parse(p.carried);
    const egg = carried.pop();
    p.carried = JSON.stringify(carried);
    if (egg) this.returnToNest(egg);
    this.grace.set(sessionId, now + GUARD.graceMs);
    const profile = getProfile(p.userId);
    profile.timesCaught = (profile.timesCaught || 0) + 1;
    markDirty();
    this.calmDown(a);
    this.broadcast('caught', { guardian: id, from: sessionId, name: GUARDIANS[a.type].name, x: a.x, z: a.z });
  }

  // ------------------------------------------------------------------ eggs

  // x2 Server Luck: two eggs are rolled and the rarer one goes in the nest
  luckyNestEgg(biome) {
    const egg = nestEgg(biome);
    if (Date.now() >= (this.luckUntil || 0)) return egg;
    const other = nestEgg(biome);
    return RARITIES.indexOf(other.rarity) > RARITIES.indexOf(egg.rarity) ? other : egg;
  }

  fillSlot(nest, slot, egg = this.luckyNestEgg(nest.biome)) {
    const at = nest.slots[slot];
    const id = `e${++this.eggSeq}`;
    this.state.eggs.set(id, new GroundEgg({ ...egg, x: at.x, z: at.z, nest: `${nest.id}:${slot}` }));
  }

  // A stolen egg that was taken back: into its old slot if that is still empty, else gone.
  returnToNest(egg) {
    const key = egg.nest;
    const nest = key ? nestOfKey(key) : null;
    if (!nest || !this.nestRefill.has(key)) return;
    this.nestRefill.delete(key);
    this.fillSlot(nest, Number(key.split(':')[1]), cleanEgg(egg));
  }

  spawnGroundEgg(egg, x, z, from) {
    if (!cleanEgg(egg) || this.state.eggs.size >= MAX_GROUND_EGGS + NESTS.length * 3) return;
    const id = `e${++this.eggSeq}`;
    this.state.eggs.set(id, new GroundEgg({ ...cleanEgg(egg), x, z, ox: from?.x ?? x, oz: from?.z ?? z, nest: '', from: egg.nest || '' }));
    this.eggExpiry.set(id, Date.now() + RULES.groundEggMs);
  }

  // Hold E on an egg (the client times the hold): a nest egg is stolen and wakes its guardian;
  // a dropped egg is simply picked up (its guardian, if still around, notices too).
  pick(client, p, id) {
    const egg = this.state.eggs.get(id);
    if (!egg || !near(p, egg.x, egg.z, egg.nest ? RANGE.steal : RANGE.pick)) return;
    const carried = parse(p.carried);
    if (carried.length >= RULES.carryCap) return;
    const now = Date.now();
    const origin = egg.nest || egg.from;
    // only the stages your speed is good for: a stage that needs more speed keeps its eggs
    const biome = origin ? biomeById(nestOfKey(origin)?.biome) : null;
    if (origin && biome && p.speed < biome.speed) {
      client.send('notice', { text: `You need ${biome.speed.toLocaleString('en-US')} Speed to steal from ${biome.name}!`, ok: false });
      return;
    }
    carried.push({ type: egg.type, rarity: egg.rarity, kg: egg.kg, size: egg.size, nest: origin });
    p.carried = JSON.stringify(carried);
    this.state.eggs.delete(id);
    this.eggExpiry.delete(id);
    if (egg.nest) {
      this.nestRefill.set(egg.nest, now + RULES.nestRespawnMs);
      const profile = getProfile(p.userId);
      profile.eggsStolen = (profile.eggsStolen || 0) + 1;
      if (biome) progress.reachAchievement(profile, 'bestStage', biomeIndex(biome.id) + 1); // the furthest stage reached
      reportAdd('eggs_stolen', p.userId, 1);
      markDirty();
    }
    if (origin && p.z <= WORLD.lineZ) this.wake(origin.split(':')[0], client.sessionId, now);
  }

  dropCarried(p) {
    const carried = parse(p.carried);
    if (!carried.length) return;
    carried.forEach((egg) => this.spawnGroundEgg(egg, p.x + (Math.random() - 0.5) * 3, p.z + 3, { x: p.x, z: p.z }));
    p.carried = '[]';
  }

  // Inside your own pen with an egg in your hands: it is put down in a free slot to grow.
  autoPlace(client, p) {
    if (p.carried === '[]' || !inPen(PLOTS[p.plot], p.x, p.z)) return;
    const profile = getProfile(p.userId);
    const pen = parse(p.pen);
    const cap = progress.perksOf(profile).padCap;
    if (pen.length >= cap) {
      const now = Date.now();
      if (now - (this.fullNotice || 0) > 3000) {
        this.fullNotice = now;
        client.send('notice', { text: 'Your pen is full! Hatch an egg first', ok: false });
      }
      return;
    }
    const carried = parse(p.carried);
    const egg = cleanEgg(carried.shift());
    p.carried = JSON.stringify(carried);
    if (!egg) return;
    const grow = eggGrowMs(egg);
    // it goes down in a random free nest of the pen
    const s = freePenSlot(pen, cap) ?? pen.length;
    pen.push({ ...egg, grow, left: grow, s });
    p.pen = JSON.stringify(pen);
    // the first egg put down pays enough to unlock the training arena (the guide sends you there next)
    let bonus = 0;
    if (!profile.starterBonus) {
      bonus = STARTER_BONUS;
      profile.cash += bonus;
      profile.starterBonus = true;
      this.refreshPets(p, profile);
      markDirty();
    }
    client.send('placed', { slot: s, rarity: egg.rarity, bonus });
  }

  hatch(client, p, i) {
    const pen = parse(p.pen);
    const e = pen[i];
    if (!e || e.left > 0) return;
    const plot = PLOTS[p.plot];
    const s = penSlotOf(e, i);
    const slot = PLOT.eggSlots[s];
    const at = plotToWorld(plot, slot.x, slot.z);
    if (!near(p, at.x, at.z, RANGE.slot)) return;
    pen.splice(i, 1);
    p.pen = JSON.stringify(pen);
    const { egg, biome } = hatchResult(e);
    const profile = getProfile(p.userId);
    // any of this stage's animals, even one they already have (duplicates are allowed)
    const pet = progress.luckyPet(profile, e, Date.now()); // x2 Luck pass: the best of two
    profile.eggsHatched = (profile.eggsHatched || 0) + 1;
    if (!pet) {
      markDirty();
      client.send('duplicate', { egg, biome, slot: s });
      return;
    }
    progress.addPet(profile, pet);
    // (older saves that never put an egg down still get the starter cash on their first hatch)
    let bonus = 0;
    if (!profile.starterBonus) {
      bonus = STARTER_BONUS;
      profile.cash += bonus;
      profile.starterBonus = true;
    }
    markDirty();
    this.refreshPets(p, profile);
    const def = PETS[pet.id];
    client.send('hatched', { pet: pet.id, cash: pet.cash, name: def.name, rarity: pet.rarity, species: def.rarity, kg: pet.kg, egg, bonus, slot: s });
  }

  // ------------------------------------------------------------------ the bat

  // Swing: knocks the egg out of the hands of the nearest other player in reach, or dazes the
  // nearest awake guardian.
  swing(client, p) {
    const now = Date.now();
    if (now - (this.lastSwing.get(client.sessionId) || 0) < RULES.batCooldownMs) return;
    this.lastSwing.set(client.sessionId, now);
    p.swing = (p.swing + 1) % 60000;
    let best = null;
    let bestDist = RULES.batRange + REACH_MARGIN;
    this.state.players.forEach((other, sid) => {
      if (other === p || other.carried === '[]') return;
      const d = Math.hypot(other.x - p.x, other.z - p.z);
      if (d < bestDist) { best = { other, sid }; bestDist = d; }
    });
    if (best) {
      this.dropCarried(best.other);
      this.broadcast('bonked', { by: client.sessionId, target: best.sid, x: best.other.x, z: best.other.z });
      return;
    }
    this.state.animals.forEach((a, id) => {
      if (a.owner !== client.sessionId || (a.mood !== 'chase' && a.mood !== 'alert')) return; // only your own chaser (the only one you see)
      const weapon = weaponById(p.axe);
      if (Math.hypot(a.x - p.x, a.z - p.z) > RULES.batRange + weapon.reach + GUARDIANS[a.type].reach) return;
      a.mood = 'stun';
      this.brains.get(id).stunUntil = now + weapon.stun * 1000; // a better weapon dazes it longer
      client.send('stunned', { id, x: a.x, z: a.z });
    });
  }

  // ------------------------------------------------------------------ treadmills and the free gift

  buyTreadmill(client, p, fromShop = false) {
    const profile = getProfile(p.userId);
    const next = nextTreadmill(profile.treadmill);
    if (!next) return client.send('notice', { text: 'You have the best arena!', ok: false });
    const sign = plotToWorld(PLOTS[p.plot], PLOT.treadmillSign.x, PLOT.treadmillSign.z);
    if (!fromShop && !near(p, sign.x, sign.z, RANGE.sign * 8)) return;
    if (profile.cash < next.price) return client.send('notice', { text: `You need $${next.price.toLocaleString('en-US')}`, ok: false });
    profile.cash -= next.price;
    profile.treadmill = next.id;
    markDirty();
    this.refreshPets(p, profile);
    client.send('bought', { id: next.id, name: next.name });
  }

  // Upgrade Pen (the board by the gate): one more egg slot in the pen.
  buyPen(client, p) {
    const profile = getProfile(p.userId);
    const next = nextPenLevel(Math.min(MAX_PEN_LEVEL, profile.penLevel || 1));
    if (!next) return client.send('notice', { text: 'Your pen is fully upgraded!', ok: false });
    const sign = plotToWorld(PLOTS[p.plot], PLOT.penSign.x, PLOT.penSign.z);
    if (!near(p, sign.x, sign.z, RANGE.sign * 8)) return;
    if (profile.cash < next.price) return client.send('notice', { text: `You need $${next.price.toLocaleString('en-US')}`, ok: false });
    profile.cash -= next.price;
    profile.penLevel = next.level;
    markDirty();
    this.refreshPets(p, profile);
    client.send('notice', { text: `Pen upgraded to Level ${next.level}! +1 egg slot`, ok: true });
  }

  // x2 Server Luck for 15 minutes (adds up), for everyone in the server.
  buyServerLuck(client, p) {
    const profile = getProfile(p.userId);
    const price = serverLuckPrice(progress.baseIncome(profile));
    if (profile.cash < price) return client.send('notice', { text: 'Not enough cash', ok: false });
    profile.cash -= price;
    const now = Date.now();
    this.luckUntil = Math.max(now, this.luckUntil || 0) + SERVER_LUCK_MS;
    this.luckBy = p.name;
    markDirty();
    this.refreshAll();
    this.broadcast('announce', { text: `${p.name} started x2 SERVER LUCK! Rarer eggs for everyone!`, color: '#5ff04a', big: true });
  }

  // An instant hatch (from the Starter Pack): one growing egg in your pen is ready right now.
  instantHatch(client, p, i) {
    const profile = getProfile(p.userId);
    const pen = parse(p.pen);
    const e = pen[i];
    if (!e || e.left <= 0) return;
    if (profile.instantHatches <= 0) return client.send('notice', { text: 'No instant hatches left', ok: false });
    profile.instantHatches -= 1;
    e.left = 0;
    p.pen = JSON.stringify(pen);
    markDirty();
    this.refreshPets(p, profile);
    client.send('notice', { text: 'Your egg is ready to hatch!', ok: true });
  }

  // A pass or a speed pack bought for another player in this server.
  gift(client, p, kind, id, to) {
    const target = this.state.players.get(to);
    if (!target || target === p) return client.send('notice', { text: 'That player is not here', ok: false });
    const payer = getProfile(p.userId);
    const receiver = getProfile(target.userId);
    const result = kind === 'pass' ? progress.giftPass(payer, receiver, id) : kind === 'speed' ? progress.giftSpeedPack(payer, receiver, id) : null;
    if (!result) return;
    client.send('notice', { text: result.text, ok: result.ok });
    if (!result.ok) return;
    markDirty();
    this.refreshPets(p, payer);
    this.refreshPets(target, receiver);
    this.clients.getById(to)?.send('notice', { text: `${p.name} sent you a gift! ${result.text.replace(/^You gifted /, '')}`, ok: true });
  }

  // The FREE gift chest: the first time it gives the tutorial's 10,000 Speed, then cash on a timer.
  claimGift(client, p) {
    if (!near(p, SHOPS.free.x, SHOPS.free.z, 20)) return;
    const profile = getProfile(p.userId);
    if (!profile.speedGift) {
      profile.speedGift = true;
      profile.speed += SPEED_GIFT;
      markDirty();
      this.refreshPets(p, profile);
      client.send('speedGift', { amount: SPEED_GIFT });
      return;
    }
    const result = this.act(client, p, (pr, now) => progress.claimGift(pr, now, giftAmount(p.income)));
    if (result.ok) client.send('gift', { amount: result.amount });
  }
}
