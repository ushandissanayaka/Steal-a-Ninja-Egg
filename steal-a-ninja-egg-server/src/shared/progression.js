// Shop, boosts, pet slots, the index and rebirths. Shared by client and server; keep both copies
// identical. Everything is bought with in-game cash.
//
// How the prices follow a player's progress (see TREADMILLS and BIOMES in gameData.js):
//   start      $0 - $1K        Brown Ninja's Dojo eggs, first pets earn ~$3-15/s, first training arena
//   early      $1K - $50K      Old Master's Garden / Graveyard, Bamboo and Purple Blossom arenas
//   mid        $50K - $5M      Graveyard / Carnival / Bog, first rebirths
//   late       $5M+            the scary biomes, event eggs (Mythic, Secret, Divine, Eternal)
// Passes are fixed, one-off prices spread over that path. Potions, the free gift and "grow now"
// cost (or give) a number of seconds of the player's own income, so they stay worth it at every
// stage. Speed packs and featured eggs come in sizes for every stage.

import { BIOMES, BIOME_ALIAS, EGGS, EGG_ORDER, PETS, PET_POOLS, PLOT, RULES } from './gameData.js';

const MINUTE = 60_000;

// ------------------------------------------------------------------ passes (permanent)

export const PASSES = {
  growth2: { name: 'x2 Growth', lines: ['Eggs grow', 'x2 faster!'], price: 2_500, theme: 'green', icon: 'clock' },
  steal2: { name: 'x2 Steal Speed', lines: ['Steal eggs', 'x2 faster!'], price: 6_000, theme: 'orange', icon: 'swing' },
  crate: { name: '+1 Egg Slot', lines: ['Grow', '+1 egg at once!'], price: 12_000, theme: 'brown', icon: 'crate' },
  cash2: { name: 'x2 Cash', lines: ['Earn', 'x2 money!'], price: 25_000, theme: 'gold', icon: 'cash' },
  tread2: { name: 'x2 Arena', lines: ['Arena gives', 'x2 speed!'], price: 50_000, theme: 'blue', icon: 'axe' },
  vip: { name: 'VIP', lines: ['Permanent +25% Cash', 'Permanent +25% Speed gain'], price: 120_000, theme: 'vip', icon: 'crown' },
  luck2: { name: 'x2 Luck', lines: ['Your eggs hatch', 'x2 luckier: bigger pets!'], price: 35_000, theme: 'lime', icon: 'luck' },
};
export const PASS_ORDER = ['vip', 'cash2', 'growth2', 'crate', 'tread2', 'steal2', 'luck2'];

// ------------------------------------------------------------------ potions (15 minutes each)

export const POTION_MS = 15 * MINUTE;
export const POTION_MAX_MS = 2 * 60 * MINUTE; // buying more adds time, up to this
// price = the bigger of base and `income` seconds of the player's current income
export const POTIONS = {
  cash: { name: 'x2 Cash', base: 300, income: 240, theme: 'green', color: '#3fcf4b' },
  treadmill: { name: 'x2 Arena Speed', base: 200, income: 150, theme: 'purple', color: '#35a8ff' },
  walk: { name: 'x1.25 Walk Speed', base: 120, income: 90, theme: 'sky', color: '#7fe8ff' },
  steal: { name: 'x2 Steal Speed', base: 250, income: 180, theme: 'orange', color: '#ff7a2a' },
  growth: { name: 'x2 Growing Speed', base: 100, income: 60, theme: 'pink', color: '#ff5fa8' },
};
export const POTION_ORDER = ['cash', 'treadmill', 'walk', 'steal', 'growth'];
export const BUNDLE_SAVE = 0.31;
export const potionPrice = (id, income) => Math.round(Math.max(POTIONS[id].base, (income || 0) * POTIONS[id].income));
export const bundlePrice = (income) => Math.round(POTION_ORDER.reduce((sum, id) => sum + potionPrice(id, income), 0) * (1 - BUNDLE_SAVE));

// ------------------------------------------------------------------ speed

// Bigger packs are cheaper per point of speed (from $8 down to $4.80 a point).
export const SPEED_PACKS = [
  { id: 's1', amount: 5_000, price: 40_000 },
  { id: 's2', amount: 30_000, price: 220_000 },
  { id: 's3', amount: 150_000, price: 1_000_000 },
  { id: 's4', amount: 600_000, price: 3_600_000 },
  { id: 's5', amount: 2_500_000, price: 13_000_000 },
  { id: 's6', amount: 5_000_000, price: 24_000_000, best: true },
];
export const doubleSpeedPrice = (speed) => Math.max(300, Math.round(speed * 0.3));

// ------------------------------------------------------------------ money (paid with speed)

// Cash for some of your speed. Always under $0.12 a point, the cheapest speed in the shop, so
// buying speed to sell it back never makes money.
export const MONEY_PACKS = [
  { id: 'm1', cash: 2_400, speed: 24_000 },
  { id: 'm2', cash: 20_000, speed: 190_000 },
  { id: 'm3', cash: 80_000, speed: 740_000 },
  { id: 'm4', cash: 400_000, speed: 3_600_000 },
  { id: 'm5', cash: 800_000, speed: 7_000_000, best: true },
];

// ------------------------------------------------------------------ featured offers

// One time only: a Secret egg (hatched on the spot), speed, cash and three instant hatches (each
// finishes one egg growing in your pen).
export const STARTER_PACK = { price: 20_000, speed: 10_000, cash: 50_000, hatches: 3, rarity: 'Secret' };
// x2 Server Luck: for 15 minutes every nest in the server lays rarer eggs, for everyone.
export const SERVER_LUCK_MS = 15 * MINUTE;
export const serverLuckPrice = (income) => Math.round(Math.max(5_000, (income || 0) * 600));

// ------------------------------------------------------------------ featured egg (changes every week)

const WEEK = 7 * 24 * 60 * MINUTE;
const FEATURED_ROTATION = ['garden', 'fire', 'storm', 'earth', 'energy', 'ice', 'water', 'ghost', 'fortress'];
export const FEATURED_PACKS = [
  { count: 1, mult: 1 },
  { count: 3, mult: 2.8 },
  { count: 10, mult: 9 },
  { count: 50, mult: 42, best: true },
];
export function featuredEgg(now) {
  const week = Math.floor(now / WEEK);
  return { type: FEATURED_ROTATION[week % FEATURED_ROTATION.length], endsAt: (week + 1) * WEEK };
}
// One egg costs 300 seconds of what a Common pet from it earns.
export const featuredPrice = (type, count) => {
  const pack = FEATURED_PACKS.find((p) => p.count === count);
  return pack ? Math.round(EGGS[type].cash * 300 * pack.mult) : null;
};
// [[petId, percent]] chances for one egg at x1 Luck
export function eggRates(type) {
  const pool = PET_POOLS[type];
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  return pool.map(([id, w]) => [id, Math.round((w / total) * 1000) / 10]);
}

// ------------------------------------------------------------------ pets: slots and storage

export const SLOTS = { start: 3, step: 3, max: 15, prices: [2_000, 40_000, 800_000, 15_000_000] };
export const slotPrice = (slots) => SLOTS.prices[(slots - SLOTS.start) / SLOTS.step] ?? null;
export const MAX_PETS = 150; // past this, the weakest unequipped pet is let go

// ------------------------------------------------------------------ the index

// one index page per biome: find all three of its pets to claim the reward
const INDEX_COLORS = {
  dojo: ['#c8874a', '#4a2a14'], garden: ['#7dff3f', '#2a6a2a'], fire: ['#ff4a2a', '#5a0a10'], storm: ['#4ab8ff', '#12286a'], earth: ['#e0b840', '#1e2238'], energy: ['#7dff4a', '#145a1e'], ice: ['#d8f4ff', '#2a5a9a'], water: ['#4ac8ff', '#0a3a8a'], ghost: ['#5aff9a', '#0a2a14'], fortress: ['#ff4ae0', '#1a0624'], pumpkin: ['#ff8a1a', '#7a3a12'], candy: ['#ff7ab8', '#a83aff'], haunted: ['#6a8a3a', '#2a2a1a'], graveyard: ['#9aa1a8', '#3a3f45'],
  carnival: ['#ff3a3a', '#ffd21f'], bog: ['#5fd68a', '#7a4aff'], frost: ['#bfe9ff', '#3a8ad6'], manor: ['#c8b8ff', '#4a2a7a'],
  inferno: ['#ff2a3a', '#3a0408'], nightmare: ['#e8d2a0', '#6a4a2a'], glitch: ['#3dffb0', '#ff2aff'], void: ['#9a5aff', '#12062a'],
  backrooms: ['#ecd77a', '#8a6a2a'],
};
export const INDEX_AREAS = BIOMES.map((b, i) => ({
  id: b.id, name: b.name, eggs: [b.id],
  reward: { speed: Math.round(300 * 2.25 ** i), cash: Math.round(2_000 * 7.5 ** i) }, // speed: about a third of the next stage's
  colors: INDEX_COLORS[b.id],
}));
export const areaPets = (area) => [...new Set(area.eggs.flatMap((egg) => PET_POOLS[egg].map(([id]) => id)))];
export const areaById = (id) => INDEX_AREAS.find((a) => a.id === id);
// Every pet found can be claimed once: a share of its area's reward (rarer species, bigger share).
const PET_SHARE = [0.25, 0.33, 0.42];
const tidy = (n) => { const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1); return Math.round(n / step) * step; };
export function indexPetReward(id) {
  const area = INDEX_AREAS.find((a) => areaPets(a).includes(id));
  if (!area) return { cash: 0, speed: 0 };
  const share = PET_SHARE[Math.max(0, areaPets(area).indexOf(id))] || 0.3;
  return { cash: tidy(area.reward.cash * share), speed: tidy(area.reward.speed * share) };
}

// The egg a pet came from (older saves have none: the first egg that hatches that pet).
export const petEgg = (pet) => {
  const egg = BIOME_ALIAS[pet.egg] || pet.egg;
  return egg && PET_POOLS[egg] ? egg : (EGG_ORDER.find((e) => PET_POOLS[e].some(([id]) => id === pet.id)) || PETS[pet.id]?.biome);
};
export const petFromArea = (pet, area) => area.eggs.includes(petEgg(pet));

// ------------------------------------------------------------------ rebirth

const REBIRTH_AREAS = BIOMES.slice(1).map((b) => b.id);
// Rebirth r -> r+1 costs this much cash and one pet from that area (both are lost).
export const rebirthNeed = (r) => ({ cash: 10_000 * 25 ** r, area: REBIRTH_AREAS[Math.min(r, REBIRTH_AREAS.length - 1)] });
export const rebirthCashMult = (r) => 1 + r;           // x2 after the first, x3 after the second...
export const rebirthPadBonus = (r) => Math.min(3, r);  // +1 egg slot in the pen per rebirth, up to +3

// ------------------------------------------------------------------ daily rewards

// Claim once a day (UTC days). Claiming the day after your last claim moves you on a day; missing a
// day starts again at Day 1; after Day 7 it starts again too. Eggs hatch on the spot, from the
// furthest biome you have a pet from.
export const DAY_MS = 24 * 60 * MINUTE;
export const DAILY = [
  { cash: 600 },
  { speed: 1_000 },
  { cash: 1_500 },
  { speed: 2_000 },
  { cash: 5_000, egg: 'Legendary' },
  { speed: 3_500, egg: 'Mythic' },
  { cash: 25_000, speed: 5_000, egg: 'Divine' },
];
export const dayNumber = (now) => Math.floor(now / DAY_MS);
// { index: which day (0-6) is next, ready: can it be claimed now, msLeft: until it can }
export function dailyState(daily, now) {
  const today = dayNumber(now);
  const last = Number.isInteger(daily?.last) ? daily.last : -10;
  const streak = Number.isInteger(daily?.streak) ? daily.streak : 0;
  const ready = last < today;
  const index = last === today ? (streak - 1 + DAILY.length) % DAILY.length // claimed today: show today's
    : last === today - 1 ? streak % DAILY.length : 0;
  return { index, ready, claimedToday: last === today, msLeft: ready ? 0 : (today + 1) * DAY_MS - now };
}

// ------------------------------------------------------------------ weapons (Weapon Index)

// Your weapon dazes a guardian you hit: the better the weapon, the longer it stands dazed (stun, in
// seconds) and the further it reaches. Unlocked with cash, each costing ~4x the one before.
export const WEAPONS = [
  { id: 'bat', name: 'Bat', stun: 1.8, reach: 0, price: 0, kind: 'bat', blade: '#d89a58', hilt: '#2a2a30', bg: '#5a4632' },
  { id: 'cleaver', name: 'Rusty Cleaver', stun: 2.0, reach: 0.5, price: 3_000, kind: 'cleaver', blade: '#9a7a5a', hilt: '#4a3020', bg: '#6a6e76' },
  { id: 'longsword', name: 'Iron Longsword', stun: 2.2, reach: 1, price: 12_000, kind: 'sword', blade: '#c8ced6', hilt: '#3a3a44', bg: '#6a6e76' },
  { id: 'falchion', name: 'Bronze Falchion', stun: 2.4, reach: 1.5, price: 50_000, kind: 'sword', blade: '#d8a25a', hilt: '#5a2a14', bg: '#7a5a3a' },
  { id: 'bonesaber', name: 'Bone Saber', stun: 2.6, reach: 2, price: 200_000, kind: 'curved', blade: '#ece4cc', hilt: '#6a5a48', bg: '#6a6e76' },
  { id: 'candycane', name: 'Candy Cane Blade', stun: 2.8, reach: 2.5, price: 800_000, kind: 'sword', blade: '#ffffff', stripe: '#ff3a5a', hilt: '#ff7ab8', bg: '#8a4a6a' },
  { id: 'thorn', name: 'Thorn Rapier', stun: 3.0, reach: 3, price: 3_000_000, kind: 'rapier', blade: '#7acf4a', hilt: '#2a4a1a', bg: '#3a6a3a' },
  { id: 'glacier', name: 'Glacier Brand', stun: 3.3, reach: 3.5, price: 12_000_000, kind: 'great', blade: '#bfefff', hilt: '#2a5a8a', bg: '#3a5a7a', glow: true },
  { id: 'ember', name: 'Ember Edge', stun: 3.6, reach: 4, price: 50_000_000, kind: 'great', blade: '#ff7a2a', hilt: '#3a1a10', bg: '#7a4a2a', glow: true },
  { id: 'sunsteel', name: 'Sunsteel Saber', stun: 4.0, reach: 4.5, price: 200_000_000, kind: 'curved', blade: '#ffd84a', hilt: '#7a4a10', bg: '#7a6a2a', glow: true },
  { id: 'jade', name: 'Jade Warden', stun: 4.4, reach: 5, price: 800_000_000, kind: 'great', blade: '#3fdfa0', hilt: '#1a4a3a', bg: '#2a6a5a', glow: true },
  { id: 'moonlit', name: 'Moonlit Katana', stun: 4.8, reach: 5.5, price: 3_000_000_000, kind: 'katana', blade: '#d8e8ff', hilt: '#2a2a5a', bg: '#3a4a7a', glow: true },
  { id: 'reaper', name: 'Phantom Reaper', stun: 5.3, reach: 6, price: 12_000_000_000, kind: 'scythe', blade: '#b88aff', hilt: '#2a1a3a', bg: '#5a3a7a', glow: true },
  { id: 'inferno', name: 'Hellfire Greatsword', stun: 5.8, reach: 6.5, price: 50_000_000_000, kind: 'great', blade: '#ff3a1a', hilt: '#1a0a0a', bg: '#7a2a2a', glow: true },
  { id: 'glitchblade', name: 'Glitch Blade', stun: 6.4, reach: 7, price: 200_000_000_000, kind: 'sword', blade: '#3dffb0', stripe: '#ff2ad8', hilt: '#101018', bg: '#2a5a5a', glow: true },
  { id: 'voidcleaver', name: 'Void Cleaver', stun: 7.0, reach: 8, price: 800_000_000_000, kind: 'cleaver', blade: '#8a4aff', hilt: '#0a0614', bg: '#3a2a5a', glow: true },
];
export const weaponById = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];

// ------------------------------------------------------------------ free gift

export const GIFT_MS = 15 * MINUTE;
export const giftAmount = (income) => Math.round(Math.max(250, (income || 0) * 90));

// ------------------------------------------------------------------ "grow now" on the egg machine

export const growNowPrice = (income) => Math.round(Math.max(50, (income || 0) * 20));

// ------------------------------------------------------------------ what everything adds up to

// passes: list of pass ids; active(id): is that potion running; rebirths: count; penLevel: Upgrade Pen level
export function perks(passes, active, rebirths = 0, trail = '', penLevel = 1, spin = 'breeze') {
  const spinMult = spinById(spin).mult; // the spin style: on the arena's speed
  const has = (id) => passes.includes(id);
  const trailMult = TRAILS.find((t) => t.id === trail)?.mult || 1;
  return {
    cash: rebirthCashMult(rebirths) * (has('vip') ? 1.25 : 1) * (has('cash2') ? 2 : 1) * (active('cash') ? 2 : 1),
    treadmill: (has('vip') ? 1.25 : 1) * (active('treadmill') ? 2 : 1) * (has('tread2') ? 2 : 1) * trailMult * spinMult,
    run: (has('vip') ? 1.25 : 1) * trailMult,
    walk: active('walk') ? 1.25 : 1,
    steal: (has('steal2') ? 2 : 1) * (active('steal') ? 2 : 1),
    growth: (has('growth2') ? 2 : 1) * (active('growth') ? 2 : 1),
    luck: has('luck2') ? 2 : 1, // hatching: this many tries, the best pet is kept
    // eggs growing in the pen at once (never more than the pen has nests for)
    padCap: Math.min(PLOT.eggSlots.length, RULES.penSlots + (has('crate') ? 1 : 0) + rebirthPadBonus(rebirths) + Math.max(0, (penLevel || 1) - 1)),
  };
}

export const petName = (id) => PETS[id]?.name || id;


// ------------------------------------------------------------------ spin styles (the Spin Shop)

// The whirlwind you turn into. Each style multiplies the speed your arena gives (spin) and makes your
// whirlwind bigger and fancier. colors: the funnel's bands; ring: the darker spinning disc on the
// ground under it; extra: what flies round it (shards, bubbles, flames, sparks, orbs, gems).
export const SPIN_STYLES = [
  { id: 'breeze', name: 'Breeze Spin', tag: 'Starter', mult: 1.25, price: 0, colors: ['#ffffff', '#e4eef8', '#c8d6e6'], glow: '#ffffff', ring: '#8a9ab0', extra: null, card: ['#eef2f8', '#b4bfcd'] },
  { id: 'dawn', name: 'Dawn Spin', tag: 'Light', mult: 1.5, price: 8_000, colors: ['#fffaf0', '#ffe08a', '#f2c24a'], glow: '#fff0b0', ring: '#b08a2a', extra: 'sparks', card: ['#fff2c8', '#e8b85a'] },
  { id: 'flame', name: 'Flame Spin', tag: 'Fire', mult: 1.75, price: 90_000, colors: ['#ff3a1a', '#ff8a1a', '#ffd23a'], glow: '#ff6a1a', ring: '#8a1a0a', extra: 'flames', card: ['#ffb070', '#e8601a'] },
  { id: 'thunder', name: 'Thunder Spin', tag: 'Lightning', mult: 2, price: 900_000, colors: ['#3aa8ff', '#bfeaff', '#ffd84a'], glow: '#7fd8ff', ring: '#1a4a8a', extra: 'sparks', card: ['#a8e4ff', '#3a9ae0'] },
  { id: 'stone', name: 'Stone Spin', tag: 'Earth', mult: 2.25, price: 8_000_000, colors: ['#c8902a', '#e8c070', '#7a5a2a'], glow: '#ffcf6a', ring: '#4a3418', extra: 'gems', card: ['#e8c070', '#a8742a'] },
  { id: 'spirit', name: 'Spirit Spin', tag: 'Energy', mult: 2.5, price: 70_000_000, colors: ['#3aff6a', '#b8ff6a', '#ffffff'], glow: '#7aff7a', ring: '#146a24', extra: 'orbs', card: ['#b8ff9a', '#3ac83a'] },
  { id: 'frost', name: 'Frost Spin', tag: 'Ice', mult: 2.75, price: 500_000_000, colors: ['#ffffff', '#bfeaff', '#7fc8f0'], glow: '#d8f4ff', ring: '#3a7aa8', extra: 'shards', card: ['#e0f6ff', '#7fc8f0'] },
  { id: 'tide', name: 'Tide Spin', tag: 'Water', mult: 3, price: 3_000_000_000, colors: ['#1a6ae0', '#4ab8ff', '#bff0ff'], glow: '#4ab8ff', ring: '#0a3070', extra: 'bubbles', card: ['#7fd0ff', '#1a7ae0'] },
  { id: 'gale', name: 'Gale Spin', tag: 'Wind', mult: 3.25, price: 8_000_000_000, colors: ['#d8f4ea', '#8adcc0', '#ffffff'], glow: '#bff4e0', ring: '#2a7a5e', extra: 'sparks', card: ['#a8ecd4', '#3ab48a'] },
  { id: 'shadow', name: 'Shadow Spin', tag: 'Destruction', mult: 3.5, price: 25_000_000_000, colors: ['#8a3aff', '#d87aff', '#3a1a7a'], glow: '#b86aff', ring: '#2a0a5a', extra: 'orbs', card: ['#c89aff', '#6a2ad6'] },
  { id: 'sunburst', name: 'Sunburst Spin', tag: 'Golden', mult: 4, price: 40_000_000_000, colors: ['#ffd23a', '#fff4a0', '#ff9a1a'], glow: '#ffe06a', ring: '#8a5a0a', extra: 'gems', card: ['#ffe48a', '#f0a21a'] },
  { id: 'serpent', name: 'Serpent Spin', tag: 'Serpent', mult: 4.5, price: 150_000_000_000, colors: ['#6a2ac8', '#a86aff', '#ffd84a'], glow: '#a86aff', ring: '#2a0a5a', extra: 'orbs', card: ['#b88aff', '#5a2ab4'] },
  { id: 'demon', name: 'Demon Spin', tag: 'Rare', mult: 5.5, price: 1_500_000_000_000, colors: ['#e0102a', '#ff5a6a', '#2a0408'], glow: '#ff3a4a', ring: '#3a0408', extra: 'flames', card: ['#ff7a8a', '#b4101e'] },
  { id: 'rainbow', name: 'Rainbow Spin', tag: 'Ultimate', mult: 6, price: 15_000_000_000_000, colors: ['#ff4a4a', '#ffd23a', '#4aff6a', '#3ab8ff', '#c86aff'], glow: '#ffffff', ring: '#5a3a8a', extra: 'gems', card: ['#ffd0f0', '#8ad0ff'] },
  { id: 'goldDragon', name: 'Golden Dragon Spin', tag: 'Legendary', mult: 10, price: 150_000_000_000_000, colors: ['#ffd23a', '#fffbe0', '#e0901a'], glow: '#ffe880', ring: '#7a4a0a', extra: 'flames', card: ['#fff0a0', '#e8a21a'] },
];
export const spinById = (id) => SPIN_STYLES.find((s) => s.id === id) || SPIN_STYLES[0];
export const spinTier = (id) => Math.max(0, SPIN_STYLES.indexOf(spinById(id)));

// ------------------------------------------------------------------ trails (Trails Shop)

// A trail streams behind you and multiplies all the speed you gain (treadmill and running).
// Each one costs ~8x the one before and gives ~1.7x more, so the next trail is always the goal.
export const TRAILS = [
  { id: 'white', name: 'White Trail', rarity: 'Common', mult: 2, price: 75, colors: ['#ffffff', '#c8ccd4'] },
  { id: 'green', name: 'Green Trail', rarity: 'Uncommon', mult: 4, price: 600, colors: ['#7dff3f', '#2fbf2a'] },
  { id: 'blue', name: 'Blue Trail', rarity: 'Rare', mult: 7, price: 5_000, colors: ['#5fd0ff', '#1f6ad6'] },
  { id: 'purple', name: 'Purple Trail', rarity: 'Epic', mult: 12, price: 40_000, colors: ['#d98cff', '#7a2fd6'] },
  { id: 'fire', name: 'Fire Trail', rarity: 'Legendary', mult: 20, price: 320_000, colors: ['#ffd21f', '#ff3a1a'] },
  { id: 'rainbow', name: 'Rainbow Trail', rarity: 'Mythic', mult: 35, price: 2_500_000, colors: ['#ff5fa8', '#ffd21f', '#5ff04a', '#35a8ff', '#a86aff'] },
  { id: 'zebra', name: 'Zebra Trail', rarity: 'Secret', mult: 60, price: 20_000_000, colors: ['#ffffff', '#14141a'] },
  { id: 'crystal', name: 'Crystal Trail', rarity: 'Celestial', mult: 100, price: 160_000_000, colors: ['#ff8fd0', '#e0207a'] },
  { id: 'moonlight', name: 'Moonlight Trail', rarity: 'Celestial', mult: 170, price: 1_200_000_000, colors: ['#c8fff4', '#5fd6c8'] },
];
export const trailById = (id) => TRAILS.find((t) => t.id === id) || null;
// rarity colours for the two trail-only rarities
export const EXTRA_RARITY_COLOR = { Secret: '#5a5e68', Celestial: '#ffc531' };

// ------------------------------------------------------------------ selling pets (Sell Shop)

export const SELL_SECONDS = 25; // a pet sells for 25 seconds of what it earns
export const petSellValue = (pet) => Math.max(5, Math.round((pet.cash || 0) * SELL_SECONDS));

// ------------------------------------------------------------------ offline cash

// While away, equipped pets keep earning at half rate (passes and rebirths count, potions do not),
// for up to 8 hours. On return: claim it, or pay the same amount again to claim it 3 times over.
export const OFFLINE = { minMs: 60_000, maxMs: 8 * 60 * MINUTE, rate: 0.5, triple: 3 };
export const offlineAmount = (incomePerSecond, ms) =>
  Math.round(incomePerSecond * OFFLINE.rate * Math.min(ms, OFFLINE.maxMs) / 1000);
export const offlineTriplePrice = (amount) => amount;

// ------------------------------------------------------------------ friends

// Each friend playing in the same server adds 10% cash (pets), up to 5 friends.
export const FRIEND_BOOST = 0.1;
export const FRIEND_MAX = 5;
export const friendCashMult = (friendsHere) => 1 + FRIEND_BOOST * Math.min(FRIEND_MAX, friendsHere);

// ------------------------------------------------------------------ the new-player guide

// The client works out the step (InteractionSystem.updateGuide): the first one not done yet of
//   1 steal a first-stage egg, 2 put it in your pen (+$1K starter bonus), 3 unlock the training arena
//   and stay in it TUTORIAL_TREADMILL_SECONDS while the egg grows, 4 hatch the grown egg, 5 visit each
//   lobby shop. Then 'done': the guide points at the highest stage your speed is good for.
// The server only keeps 'done' or not (the older steps stay in the list so old saves still load).
export const TUTORIAL_STEPS = ['basics', 'shops', 'buyTreadmill', 'treadmill', 'loop', 'stage2', 'done'];
export const TUTORIAL_PETS = 3;
export const TUTORIAL_SHOPS = [['sell', 'Sell Shop', '💰'], ['trails', 'Trails Shop', '✨'], ['spin', 'Spin Shop', '🌀']];
export const TUTORIAL_TREADMILL_SECONDS = 20;
export const STARTER_BONUS = 1_000;   // cash on the first hatch: enough for the first treadmill
export const SPEED_GIFT = 2_000;       // the free speed (the first Free Gift): enough for the second stage
