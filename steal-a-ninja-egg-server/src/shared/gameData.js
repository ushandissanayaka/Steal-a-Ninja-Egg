// Game constants shared by client and server. Keep both copies of this file identical.

export const GAME_NAME = 'Steal a Ninja Egg';
export const ROOM_NAME = 'starting_place';

// North is -Z. South of lineZ is the lobby: a big lime-green field inside brown brick walls with
// grass on top, the player plots in two rows and the shops. That is the safe zone. The corridor
// starts at the dojo hall on the north wall (the "SAFE ZONE" line runs along its front). North of the red line a long walled corridor
// runs through the 10 stages (biomes), one after another, each with a sleeping guardian on its nest.
const LINE_Z = -20;
const LOBBY_SOUTH_Z = 520; // a row of five plots and two more in front (7 players a room)
export const BIOME_DEPTH = 420;
export const BIOME_COUNT = 10;

export const WORLD = {
  avatarScale: 0.78,
  halfX: 380,           // the lobby's half width
  corridorHalf: 90,     // the biome corridor's half width
  southZ: LOBBY_SOUTH_Z,
  lineZ: LINE_Z,
  northZ: LINE_Z - BIOME_DEPTH * BIOME_COUNT,
  openingHalf: 90,      // the gap in the lobby's north wall = the corridor
  wallHeight: 44,       // the lobby's brick walls (grass on top)
  corridorWallHeight: 70,
};

// A row of five long, narrow plots across the back of the lobby (square to the track, gates facing
// the dojo) and two more halfway up, one either side of the track with their gates facing it (and
// the spawn), like the video (one plot per player: 7 players a room). Each plot has its own local frame: +x points out of the
// gate (turned by rot, as three.js turns rotation.y), and everything in it is drawn PLOT_SCALE
// times its local size. plot.x / plot.z is the middle of the plot's front line.
export const PLOT_SCALE = 1.5;
const PLOT_ROW_Z = 378;   // the row's front (gate) line
const PLOT_COLUMNS = [-280, -140, 0, 140, 280];
const SIDE_PLOT_Z = 220;  // the two plots either side of the track
const SIDE_PLOT_X = 244;  // their gate lines
export const PLOTS = [
  ...PLOT_COLUMNS.map((x) => ({ x, z: PLOT_ROW_Z, rot: Math.PI / 2 })),
  ...[-1, 1].map((side) => ({ x: side * SIDE_PLOT_X, z: SIDE_PLOT_Z, rot: side < 0 ? 0 : Math.PI })),
];
export const MAX_CLIENTS = PLOTS.length;

export const PLOT = {
  penMinX: -84,         // long (gate to back)...
  penMaxX: -4,
  penHalfZ: 26,         // ...and narrow
  gateHalf: 9,          // the open gap in the front fence (local z)
  // where stolen eggs sit while they grow (local x/z); the first RULES.penSlots are open at the start
  eggSlots: [[-18, -14], [-18, 0], [-18, 14], [-32, -14], [-32, 0], [-32, 14]].map(([x, z]) => ({ x, z })),
  treadmill: { x: 15, z: 19 },         // outside the front fence, beside the gate
  treadmillSign: { x: 27, z: 10 },     // its Unlock / Upgrade board, outside too, facing the lobby
  petsMinX: -78,        // pets wander behind the eggs
  petsMaxX: -44,
  spawn: { x: 30, z: 0 },
};
// The belt of the treadmill, around PLOT.treadmill, in plot units.
export const TREADMILL_BELT = { halfX: 4.8, backZ: 4.6, frontZ: 6.5, height: 1.23 };

const plotTurn = (plot) => {
  if (!plot.turn) plot.turn = { c: Math.round(Math.cos(plot.rot) * 1e9) / 1e9, s: Math.round(Math.sin(plot.rot) * 1e9) / 1e9 };
  return plot.turn;
};

export function plotToWorld(plot, lx, lz) {
  const { c, s } = plotTurn(plot);
  return { x: plot.x + (lx * c + lz * s) * PLOT_SCALE, z: plot.z + (lz * c - lx * s) * PLOT_SCALE };
}

// World x/z to the plot's local frame (in plot units).
export function worldToPlot(plot, x, z) {
  const { c, s } = plotTurn(plot);
  const dx = (x - plot.x) / PLOT_SCALE, dz = (z - plot.z) / PLOT_SCALE;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

export function onTreadmill(plot, x, y, z) {
  const local = worldToPlot(plot, x, z);
  const lx = local.x - PLOT.treadmill.x;
  const lz = local.z - PLOT.treadmill.z;
  return Math.abs(lx) <= TREADMILL_BELT.halfX && lz >= -TREADMILL_BELT.backZ && lz <= TREADMILL_BELT.frontZ
    && y > TREADMILL_BELT.height * PLOT_SCALE * 0.5;
}

// Inside the pen's fence (local frame), where eggs are put down to grow.
export function inPen(plot, x, z) {
  const { x: lx, z: lz } = worldToPlot(plot, x, z);
  return lx > PLOT.penMinX - 2 && lx < PLOT.penMaxX + 6 && Math.abs(lz) < PLOT.penHalfZ + 2;
}

// Along the north wall either side of the dojo (like the video): the Trails (cosmetic) shop, Sell
// and the Invite Friend pad on the left; the Free Gift, the three arched leaderboards and the
// events board (the video's "ADMIN ABUSE" board) on the right.
export const SHOPS = {
  trails: { x: -258, z: 16 },
  sell: { x: -204, z: 16 },
  invite: { x: -166, z: 26 },
  free: { x: 158, z: 26 },
  events: { x: 364, z: 14 },
  spawn: { x: 0, z: 34, radius: 16 }, // where everyone appears: the open grass in front of the dojo
};

export const RULES = {
  carryCap: 1,            // eggs in the hands at once
  penSlots: 2,            // eggs growing in the pen at once (more with the Egg Slot pass and rebirths)
  stealHoldMs: 1100,      // hold E this long to steal an egg from a nest
  pickHoldMs: 500,        // ...or to pick one up off the ground
  placeHoldMs: 900,       // hold E in your pen this long to put the egg down to grow
  hatchHoldMs: 900,       // hold E this long to hatch a grown egg
  groundEggMs: 30_000,    // a dropped egg vanishes if nobody picks it up in time
  nestRespawnMs: 12_000,  // an empty nest slot gets a new egg after this
  batCooldownMs: 650,
  batRange: 10,
  stunMs: 1800,           // a guardian hit with the bat stands dazed this long
  shownPets: 12,
  treadmillStepMs: 400,   // one treadmill step: +the treadmill's gain to speed
};

export const RANGE = { pick: 10, steal: 11, slot: 9 * PLOT_SCALE, shop: 30, sign: 14 * PLOT_SCALE };

// The clock: a long day, then a short night. At night eggs grow 30x faster; when the night ends
// every nest gets fresh eggs ("ALL EGGS RESET!").
// The last freezeS seconds of each day / night everyone stands still; then everyone is sent back to the
// lobby and the glass gate stays shut for gateS seconds (counting down) before it opens.
export const CYCLE = { dayMs: 5 * 60_000, nightMs: 5 * 60_000, nightGrowth: 30, freezeS: 3, gateS: 10 };
export const frozenAt = (state) => state.gate === 0 && state.clock > 0 && state.clock <= CYCLE.freezeS;

// Speed comes from running (a little) and from your treadmill (a lot). Walk speed grows slowly with it.
export const walkSpeed = (speed) => 22 + 4 * Math.log2(1 + Math.max(0, speed));
export const RUN_PER_GAIN = 110;
export const runGain = (speed) => 1 + Math.floor(speed * 0.002);

export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Secret', 'Divine', 'Eternal'];
export const RARITY_COLOR = {
  Common: '#d7dde3', Uncommon: '#62e34b', Rare: '#49b8ff', Epic: '#c46bff', Legendary: '#ffc531', Mythic: '#ff4fd8',
  Secret: '#5a5e68', Divine: '#fff3b0', Eternal: '#7ff6ff',
};

// ------------------------------------------------------------------ treadmills (bought at your pen)

// gain = speed per step. Each one costs ~5-7x the last and gives ~4-5x more.
export const TREADMILLS = [
  { id: 'none', name: 'No Treadmill', gain: 0, price: 0 },
  { id: 'abandoned', name: 'Abandoned Treadmill', gain: 2, price: 800, color: '#8a6a4a' },
  { id: 'static', name: 'Static Treadmill', gain: 7, price: 5_000, color: '#5aa8ff' },
  { id: 'candy', name: 'Candy Treadmill', gain: 30, price: 35_000, color: '#ff7ab8' },
  { id: 'bone', name: 'Bone Treadmill', gain: 120, price: 220_000, color: '#f0ead8' },
  { id: 'carnival', name: 'Carnival Treadmill', gain: 400, price: 1_500_000, color: '#ff3a3a' },
  { id: 'frost', name: 'Frostbite Treadmill', gain: 1_000, price: 10_000_000, color: '#9be8ff' },
  { id: 'demon', name: 'Demon Treadmill', gain: 2_200, price: 70_000_000, color: '#ff5a1a' },
  { id: 'nightmare', name: 'Nightmare Treadmill', gain: 4_500, price: 500_000_000, color: '#8a5aff' },
  { id: 'glitch', name: 'Glitch Treadmill', gain: 10_000, price: 3_500_000_000, color: '#3dffb0' },
  { id: 'void', name: 'Void Treadmill', gain: 25_000, price: 25_000_000_000, color: '#1a1030' },
];
export const treadmillById = (id) => TREADMILLS.find((t) => t.id === id) || TREADMILLS[0];
export const nextTreadmill = (id) => TREADMILLS[TREADMILLS.indexOf(treadmillById(id)) + 1] || null;

// The bat in your hand (hotbar slot 1): knocks the egg out of a carrier's hands, dazes a guardian.
export const AXES = [{ id: 'bat', name: 'Bat', rarity: 'Common', power: 1, price: 0, head: '#a8743f', handle: '#6e4322' }];
export const axeById = () => AXES[0];

// ------------------------------------------------------------------ biomes

// speed = recommended speed (and the least speed to steal there): with it you just outrun the guardian.
// From the third stage on 1.5x what it once was. Gentle up to the eighth stage
// (each about 3x the one before), then a bigger step for the last two. cash = $/s of a Common pet
// from a Common egg of 1 kg. Each biome's three pets go from common to rare.
export const BIOMES = [
  { id: 'pumpkin', name: 'Pumpkin Patch', speed: 0, cash: 3, guardian: 'grinhound', pets: ['pumpkinCamel', 'sheetGhost', 'scarecrowCat'] },
  { id: 'candy', name: 'Candy Lane', speed: 640, cash: 20, guardian: 'sugarSpecter', pets: ['gummyBat', 'lollipopLlama', 'candyCornCrab'] },
  { id: 'graveyard', name: 'Graveyard', speed: 3_000, cash: 120, guardian: 'graveKnight', pets: ['boneDog', 'zombieBunny', 'tombBat'] },
  { id: 'bog', name: 'Witch Swamp', speed: 7_700, cash: 700, guardian: 'bogHorror', pets: ['bogFrog', 'slimeSnail', 'rainbowToad'] },
  { id: 'carnival', name: 'Creepy Carnival', speed: 22_500, cash: 4_200, guardian: 'bigTopBrute', pets: ['popcornPup', 'clownFish', 'circusElephant'] },
  { id: 'frost', name: 'Frostbite Hollow', speed: 68_000, cash: 26_000, guardian: 'frostbiteYeti', pets: ['snowWisp', 'icicleSwordfish', 'frostbiteBear'] },
  { id: 'backrooms', name: 'The Backrooms', speed: 180_000, cash: 160_000, guardian: 'grinner', pets: ['candleGhost', 'phantomCat', 'ghostPrince'] },
  { id: 'inferno', name: 'Blood Moon', speed: 375_000, cash: 950_000, guardian: 'emberFiend', pets: ['hellPup', 'magmaImp', 'demonCalf'] },
  { id: 'void', name: 'The Void', speed: 750_000, cash: 5_800_000, guardian: 'voidKraken', pets: ['voidEye', 'starEater', 'goldenAbomination'] },
  { id: 'nightmare', name: 'The Nightmare', speed: 4_500_000, cash: 35_000_000, guardian: 'skullAlien', pets: ['spikePuffer', 'nightmareRaven', 'shadowShark'] },
];
// Stages that were removed (older saves can still hold their eggs and pets): what they count as now.
export const BIOME_ALIAS = { haunted: 'graveyard', manor: 'backrooms', glitch: 'void' };
const LEGACY_PETS = { haunted: ['spookyOwl', 'twigSpider', 'ghostFox'], glitch: ['glitchCat', 'errorBlob', 'pixelDragon'] };
export const biomeById = (id) => BIOMES.find((b) => b.id === (BIOME_ALIAS[id] || id)) || BIOMES[0];
export const biomeIndex = (id) => Math.max(0, BIOMES.findIndex((b) => b.id === (BIOME_ALIAS[id] || id)));
BIOMES.forEach((b, i) => {
  b.maxZ = LINE_Z - i * BIOME_DEPTH;
  b.minZ = b.maxZ - BIOME_DEPTH;
});
export const biomeAt = (z) => (z > WORLD.lineZ ? null : BIOMES.find((b) => z > b.minZ) || BIOMES[BIOMES.length - 1]);
// kept for the HUD / guide code that still speaks of "zones"
export const ZONES = BIOMES;
export const zoneAt = biomeAt;

// How scary each biome is: shown on its arch and above its guardian.
export const DIFFICULTY = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Extra Hard', 'Insane', 'Nightmare', 'Impossible', 'Godly'];
BIOMES.forEach((b, i) => { b.difficulty = DIFFICULTY[i]; });
export const DIFFICULTY_COLOR = {
  Easy: '#5ff04a', Medium: '#ffc21f', Hard: '#ff3b3b', 'Extra Hard': '#ff4fe0', 'Super Hard': '#35c8ff', Insane: '#ff7a1a', Nightmare: '#f4f6ff',
  Impossible: '#c86aff', Mythical: '#2fe6b8', Godly: '#ffe14a',
};

// ------------------------------------------------------------------ guardians

// One per biome, asleep on its nest. Its speed is a little under walkSpeed(biome.speed): with the
// recommended speed you escape, with less it catches you somewhere on the run home.
export const GUARDIANS = {
  grinhound: { name: 'Grinhound', scale: 1.5, reach: 5 },
  sugarSpecter: { name: 'Sugar Specter', float: true, scale: 1.3, reach: 5.5 },
  hollowWatcher: { name: 'The Hollow Watcher', float: true, scale: 1.25, reach: 6 },
  graveKnight: { name: 'The Grave Knight', scale: 1.35, reach: 6 },
  bigTopBrute: { name: 'Big Top Brute', scale: 1.25, reach: 6.5 },
  bogHorror: { name: 'Bog Horror', scale: 1.6, reach: 6.5 },
  frostbiteYeti: { name: 'Frostbite Yeti', scale: 1.35, reach: 7 },
  ghostKing: { name: 'Ghost King', float: true, scale: 1.35, reach: 7 },
  emberFiend: { name: 'Ember Fiend', scale: 1.4, reach: 7.5 },
  nightVisitor: { name: 'Night Visitor', scale: 1.4, reach: 8 },
  glitchEntity: { name: 'Glitch Entity', float: true, scale: 1.4, reach: 8 },
  voidTitan: { name: 'Void Titan', scale: 1.45, reach: 8.5 },
  grinner: { name: 'The Grinner', scale: 1.35, reach: 7.5 },
  eyeKraken: { name: 'The Eye Kraken', float: true, scale: 1.45, reach: 9 },
  skullAlien: { name: 'The Skull Stalker', scale: 1.5, reach: 9 },
  voidKraken: { name: 'The Void Kraken', scale: 2.3, reach: 12 },
};
export const GUARDIAN_SPEED_K = 0.94;
export const guardianSpeed = (biome) => walkSpeed(biome.speed) * GUARDIAN_SPEED_K;
// The least speed that outruns this biome's guardian: from it on, walkSpeed(speed) >= its speed, so it
// can never close the gap however long the run home (shown on the board at each nest). Rounded up to
// two significant figures so the board shows a tidy number.
export const escapeSpeed = (biome) => {
  const even = 2 ** ((guardianSpeed(biome) - 22) / 4) - 1; // inverse of walkSpeed
  if (even <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(even)) - 1);
  return Math.ceil(even / step) * step;
};
// kept for code shared with the animal views
export const ANIMALS = Object.fromEntries(BIOMES.map((b) => [b.guardian, { ...GUARDIANS[b.guardian], speed: guardianSpeed(b) }]));
export const animalSize = () => 1;

// ------------------------------------------------------------------ nests

// One nest per biome, on alternate sides of the corridor, three eggs on it, the guardian asleep
// beside them. Egg slots and the guardian are relative to the nest's middle.
export const NEST_RADIUS = 20;
export const NEST_EGGS = [[-8, 7], [0, -8], [8, 7]];
export const NESTS = BIOMES.map((b, i) => {
  const side = i % 2 ? -1 : 1;
  const x = side * 34, z = (b.minZ + b.maxZ) / 2;
  return {
    id: `n${i}`, biome: b.id, x, z, side,
    guardian: { x: x + side * 16, z: z - 2 },
    slots: NEST_EGGS.map(([dx, dz]) => ({ x: x + dx, z: z + dz })),
  };
});

// ------------------------------------------------------------------ eggs

// An egg: { type: biome id, rarity, kg, size: 1 | 2 (Huge) | 3 (Giant) }.
// grow = how long it takes to grow in the pen (by day; nights are CYCLE.nightGrowth times faster).
export const EGG_RARITY = {
  Common: { mult: 1, grow: 10_000, kg: [1, 3.2], weight: 60 },
  Uncommon: { mult: 2.2, grow: 25_000, kg: [1.8, 5], weight: 27 },
  Rare: { mult: 5, grow: 60_000, kg: [3, 40], weight: 10 },
  Epic: { mult: 12, grow: 120_000, kg: [6, 60], weight: 2.5 },
  Legendary: { mult: 30, grow: 240_000, kg: [10, 90], weight: 0.5 },
  Mythic: { mult: 80, grow: 360_000, kg: [15, 120], weight: 0 },
  Secret: { mult: 250, grow: 480_000, kg: [25, 180], weight: 0 },
  Divine: { mult: 700, grow: 600_000, kg: [40, 250], weight: 0 },
  Eternal: { mult: 2_000, grow: 900_000, kg: [60, 400], weight: 0 },
};
export const NEST_RARITIES = Object.entries(EGG_RARITY).filter(([, r]) => r.weight > 0).map(([id, r]) => [id, r.weight]);
export const EGG_SIZES = { 1: { word: '', kg: 1, cash: 1, scale: 1 }, 2: { word: 'Huge ', kg: 3, cash: 2.5, scale: 1.6 }, 3: { word: 'Giant ', kg: 8, cash: 6, scale: 2.3 } };

// Special eggs: every few minutes one spawns in a nest of one of the scarier biomes, for everyone to race to.
export const EVENT_EGGS = {
  everyMs: 150_000,
  fromBiome: 4,
  rarities: [['Mythic', 60], ['Secret', 25], ['Divine', 12], ['Eternal', 3]],
  sizes: [[1, 70], [2, 22], [3, 8]],
};

// Each biome's eggs have its colour as spots; the shell's colour is the egg's rarity.
export const BIOME_COLOR = {
  pumpkin: '#ff8a1a', candy: '#ff6ab0', haunted: '#5f7f34', graveyard: '#8a9198', carnival: '#ff3a3a', bog: '#3fcf8a',
  frost: '#6fd0ff', manor: '#a88aff', inferno: '#ff1a2a', nightmare: '#e8d2a0', glitch: '#20f0a0', void: '#7a3aff', backrooms: '#e8c84a',
};
export const EGG_COLOR = {
  Common: '#efe2c8', Uncommon: '#b8e88a', Rare: '#9cd0ff', Epic: '#cfa2ff', Legendary: '#ffd45a', Mythic: '#ff9fe6',
  Secret: '#3a3a46', Divine: '#fff6d6', Eternal: '#9ff8ff',
};
export const EGGS = Object.fromEntries(BIOMES.map((b, i) => [b.id, { name: `${b.name} Egg`, rarity: RARITIES[Math.min(5, Math.floor(i / 2))], cash: b.cash, biome: i, color: BIOME_COLOR[b.id] }]));
export const EGG_ORDER = BIOMES.map((b) => b.id);
for (const [old, now] of Object.entries(BIOME_ALIAS)) EGGS[old] = EGGS[now]; // old eggs hatch as the stage that replaced theirs
export const eggName = (egg) => `${EGG_SIZES[egg.size || 1]?.word || ''}${egg.rarity || 'Common'} Egg`;
export const eggGrowMs = (egg) => (EGG_RARITY[egg.rarity] || EGG_RARITY.Common).grow * (egg.size > 1 ? 1.5 : 1);

// ------------------------------------------------------------------ pets

const SPECIES_MULT = [1, 1.7, 2.8];
const SPECIES_WEIGHT = [62, 29, 9];
// From the fifth stage on the third animal of each stage is a giant (taller than the walls), and
// about one egg in three hatches one (a Common egg 33%; rarer eggs even more often).
export const GIANTS_FROM = 4; // stage index (0 = the first stage)
const GIANT_STAGE_WEIGHT = [42, 25, 33];
export const PETS = {};
export const PET_POOLS = {};
const PET_NAMES = {
  pumpkinCamel: 'Pumpkin Camel', sheetGhost: 'Harvest Fox', scarecrowCat: 'Scarecrow Cat',
  gummyBat: 'Gummy Scorpion', lollipopLlama: 'Lollipop Llama', candyCornCrab: 'Candy Corn Crab',
  spookyOwl: 'Spooky Owl', twigSpider: 'Twig Spider', ghostFox: 'Ghost Fox',
  boneDog: 'Wolf Man', zombieBunny: 'Grave Spider', tombBat: 'Vampire Man',
  popcornPup: 'Popcorn Pup', clownFish: 'Clown Shark', circusElephant: 'Giant Circus Elephant',
  bogFrog: 'Bog Frog', slimeSnail: 'Swamp Croc', rainbowToad: 'Witch Octopus',
  snowWisp: 'Snow Owl', icicleSwordfish: 'Icicle Swordfish', frostbiteBear: 'Giant Frostbite Bear',
  candleGhost: 'Lamp Moth', phantomCat: 'Phantom Panther', ghostPrince: 'Giant Hallway Mantis',
  hellPup: 'Hell Hound', magmaImp: 'Magma Scorpion', demonCalf: 'Giant Blood Dragon',
  spikePuffer: 'Spike Puffer', nightmareRaven: 'Nightmare Raven', shadowShark: 'Giant Shadow Megalodon',
  glitchCat: 'Glitch Cat', errorBlob: 'Error Blob', pixelDragon: 'Pixel Dragon',
  voidEye: 'Void Jelly', starEater: 'Star Shark', goldenAbomination: 'Giant Void Octopus',
};
BIOMES.forEach((b, i) => {
  b.pets.forEach((id, slot) => {
    PETS[id] = { name: PET_NAMES[id] || id, rarity: RARITIES[Math.min(5, Math.floor(i / 2) + slot)], biome: b.id, mult: SPECIES_MULT[slot] };
  });
  PET_POOLS[b.id] = b.pets.map((id, slot) => [id, (i >= GIANTS_FROM ? GIANT_STAGE_WEIGHT : SPECIES_WEIGHT)[slot]]);
});
// pets of removed stages: still owned by older saves (not found in any egg any more)
for (const [old, ids] of Object.entries(LEGACY_PETS)) {
  const b = biomeById(old), i = biomeIndex(old);
  ids.forEach((id, slot) => { PETS[id] = { name: PET_NAMES[id] || id, rarity: RARITIES[Math.min(5, Math.floor(i / 2) + slot)], biome: b.id, mult: SPECIES_MULT[slot] }; });
}
// the guardians can be shown as pets too (the index art, the fusion machine)
export const GUARDIAN_IDS = BIOMES.map((b) => b.guardian);

// Pets from later biomes are bigger.
export const PET_SIZE = Object.fromEntries(BIOMES.map((b, i) => [b.id, 1 + i * 0.16]));
export function petSize(pet) {
  const egg = PET_SIZE[BIOME_ALIAS[pet.egg] || pet.egg] ? BIOME_ALIAS[pet.egg] || pet.egg : PETS[pet.id]?.biome;
  return PET_SIZE[egg] || 1;
}

export const round2 = (v) => Math.round(v * 100) / 100;

export function pickWeighted(list, rnd = Math.random) {
  let roll = rnd() * list.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of list) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return list[0][0];
}

export function rollEgg(biomeId, rarity = null, size = 1, rnd = Math.random) {
  const r = rarity || pickWeighted(NEST_RARITIES, rnd);
  const [lo, hi] = EGG_RARITY[r].kg;
  const kg = round2((lo + (hi - lo) * rnd() ** 2) * (EGG_SIZES[size]?.kg || 1));
  return { type: biomeId, rarity: r, kg, size };
}

// What a pet from this egg earns: the biome's cash x the egg's rarity x its size x how heavy it is.
// Rarer eggs also make the biome's rarer species likelier.
// skip: pet ids it must not be (the ones the player already has); null when every one is skipped.
export function rollPet(egg, rnd = Math.random, skip = null) {
  const biome = biomeById(egg.type);
  const rarity = EGG_RARITY[egg.rarity] || EGG_RARITY.Common;
  const tier = RARITIES.indexOf(egg.rarity || 'Common');
  const pool = PET_POOLS[biome.id].map(([id, w], slot) => [id, w * (1 + tier * 0.6) ** slot]).filter(([id]) => !skip?.has(id));
  if (!pool.length) return null;
  const id = pickWeighted(pool, rnd);
  const kgK = Math.sqrt(Math.max(0.5, egg.kg || 1) / ((rarity.kg[0] + rarity.kg[1]) / 2 * (EGG_SIZES[egg.size || 1]?.kg || 1)));
  const cash = Math.max(1, Math.round(biome.cash * rarity.mult * (EGG_SIZES[egg.size || 1]?.cash || 1) * PETS[id].mult * kgK * (0.9 + rnd() * 0.2)));
  return { id, cash, egg: biome.id, rarity: egg.rarity || 'Common', kg: egg.kg || 1 };
}

export const petIncome = (pets) => pets.reduce((sum, p) => sum + (p.cash || 0), 0);

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 1000) return String(Math.floor(n));
  let i = 0;
  let v = n;
  while (Math.abs(v) >= 1000 && i < UNITS.length - 1) {
    v /= 1000;
    i++;
  }
  const digits = Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0;
  return `${Number(v.toFixed(digits))}${UNITS[i]}`;
}

export const formatClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};
