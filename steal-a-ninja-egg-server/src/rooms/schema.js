import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.userId = '';
    this.name = '';
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.ry = 0;
    this.anim = 'idle';
    this.avatar = '{}'; // JSON of Legion.SDK.avatar.getEquipped()
    this.props = '{}';  // JSON of Legion.SDK.avatar.getProportions()
    this.plot = -1;
    this.carried = '[]'; // JSON [{ type, rarity, kg, size, nest }] the egg in your hands
    this.pen = '[]';     // JSON [{ type, rarity, kg, size, left, grow }] eggs growing in your pen (left = ms)
    this.pets = '[]';    // JSON [{ id, cash }], the pets shown in the pen (and earning)
    this.cash = 0;
    this.income = 0;     // $ per second
    this.speed = 0;
    this.treadmill = 'none'; // the training arena by your pen
    this.penLevel = 1;   // Upgrade Pen level (shown on the board by the gate)
    this.axe = 'bat';    // what is in your hand
    this.swing = 0;      // +1 on every bat swing, so everyone sees it
    this.trail = '';      // the trail streaming behind the player
    this.spin = 'breeze'; // the spin style: the look (and size) of their whirlwind
    this.emote = '';      // 'emoteId:n' - a new value plays that emote on this player for everyone
    // (the player's own pets list and popup data are sent only to them: the 'mine' message)
  }
}
defineTypes(PlayerState, {
  userId: 'string',
  name: 'string',
  x: 'float32',
  y: 'float32',
  z: 'float32',
  ry: 'float32',
  anim: 'string',
  avatar: 'string',
  props: 'string',
  plot: 'int8',
  carried: 'string',
  pen: 'string',
  pets: 'string',
  cash: 'number',
  income: 'number',
  speed: 'number',
  treadmill: 'string',
  penLevel: 'uint8',
  axe: 'string',
  swing: 'uint16',
  trail: 'string',
  spin: 'string',
  emote: 'string',
});

// An egg in the world: on a nest (nest = 'n3:1', the nest and slot) or dropped on the ground (nest = '').
export class GroundEgg extends Schema {
  constructor({ type, rarity = 'Common', kg = 1, size = 1, x, z, ox = x, oz = z, nest = '', from = '' }) {
    super();
    this.type = type;     // the biome it comes from
    this.rarity = rarity;
    this.kg = kg;
    this.size = size;     // 1 normal, 2 Huge, 3 Giant
    this.x = x;
    this.z = z;
    this.ox = ox;         // where it flew from (dropped eggs fly out of the carrier's hands)
    this.oz = oz;
    this.nest = nest;
    this.from = from;     // a dropped egg remembers its nest, so its guardian still cares
  }
}
defineTypes(GroundEgg, {
  type: 'string', rarity: 'string', kg: 'float32', size: 'uint8', x: 'float32', z: 'float32', ox: 'float32', oz: 'float32', nest: 'string', from: 'string',
});

// A biome's guardian.
export class AnimalState extends Schema {
  constructor(type, x, z) {
    super();
    this.type = type;
    this.x = x;
    this.z = z;
    this.ry = 0;
    this.mood = 'sleep'; // sleep | alert | chase | return | stun
    this.target = '';    // sessionId being chased
    this.carrying = '';  // unused (kept for the shared animal view)
    this.owner = '';     // '' = a nest's sleeping guardian (everyone sees it); else the one player whose chaser this is (only they see it)
  }
}
defineTypes(AnimalState, {
  type: 'string', x: 'float32', z: 'float32', ry: 'float32', mood: 'string', target: 'string', carrying: 'string', owner: 'string',
});

export class StartingPlaceState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.eggs = new MapSchema();
    this.animals = new MapSchema();
    this.night = false;
    this.clock = 0;       // seconds left until night (by day) or until morning (at night)
    this.gate = 0;        // seconds the glass gate stays shut after the change (0 = open)
  }
}
defineTypes(StartingPlaceState, {
  players: { map: PlayerState },
  eggs: { map: GroundEgg },
  animals: { map: AnimalState },
  night: 'boolean',
  clock: 'uint16',
  gate: 'uint8',
});
