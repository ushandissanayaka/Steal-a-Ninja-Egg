// Reports per-player stats to the Boxity profile ("Only in this game").
// Values always come from server-owned profiles, never from client packets.

import { allProfiles } from './profiles.js';
import { BIOMES, PETS, TREADMILLS, biomeIndex } from '../shared/gameData.js';

// the rarest animal of every stage from the fifth on is a giant (taller than the walls)
const GIANTS = new Set(BIOMES.slice(4).map((b) => b.pets[2]));

const DEFINITIONS = [
  { key: 'eggs_stolen', label: 'Eggs Stolen', type: 'number', sortOrder: 1 },
  { key: 'eggs_hatched', label: 'Eggs Hatched', type: 'number', sortOrder: 2 },
  { key: 'speed', label: 'Speed', type: 'number', sortOrder: 3 },
  { key: 'pets', label: 'Pets Hatched', type: 'number', sortOrder: 4 },
  { key: 'rebirths', label: 'Rebirths', type: 'number', sortOrder: 5 },
  { key: 'pets_found', label: 'Index Pets Found', type: 'number', sortOrder: 6 },
  // achievements
  { key: 'best_stage', label: 'Furthest Stage Reached', type: 'number', sortOrder: 7 },
  { key: 'giants', label: 'Giant Animals Owned', type: 'number', sortOrder: 8 },
  { key: 'weapons', label: 'Weapons Unlocked', type: 'number', sortOrder: 9 },
  { key: 'treadmill', label: 'Treadmill Level', type: 'number', sortOrder: 10 },
  { key: 'daily_streak', label: 'Daily Reward Streak', type: 'number', sortOrder: 11 },
];
const LIMIT = 1_000_000_000;

function valuesFor(p) {
  const raw = {
    eggs_stolen: p.eggsStolen,
    eggs_hatched: p.eggsHatched,
    speed: p.speed,
    pets: p.petsHatched ?? p.pets?.length ?? 0, // every pet ever hatched (selling does not lower it)
    rebirths: p.rebirths || 0,
    pets_found: p.discovered?.length || 0,
    // the furthest stage the player has a pet from (1-10)
    best_stage: (p.pets || []).reduce((best, pet) => Math.max(best, biomeIndex(pet.egg || PETS[pet.id]?.biome) + 1), 0),
    giants: (p.pets || []).filter((pet) => GIANTS.has(pet.id)).length,
    weapons: Math.max(0, (p.weapons?.length || 1) - 1), // the starter bat does not count
    treadmill: Math.max(0, TREADMILLS.findIndex((t) => t.id === p.treadmill)),
    daily_streak: p.daily?.streak || 0,
  };
  const values = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= LIMIT) values[k] = Math.floor(v);
  }
  return values;
}

async function flush() {
  const token = process.env.BLOXITY_REPORT_TOKEN;
  const gameId = process.env.BLOXITY_GAME_ID;
  if (!token || !gameId) return;
  const api = process.env.BLOXITY_API_URL || 'https://api.bloxity.io';

  const players = allProfiles()
    .filter((p) => String(p.userId).startsWith('legion_'))
    .map((p) => ({ userId: String(p.userId).replace(/#m.*$/, ''), values: valuesFor(p) }))
    .filter((p) => Object.keys(p.values).length > 0);

  for (let i = 0; i < Math.max(players.length, 1); i += 200) {
    try {
      const res = await fetch(`${api}/v1/games/${gameId}/stats`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ definitions: DEFINITIONS, players: players.slice(i, i + 200) }),
        signal: AbortSignal.timeout(8000),
      });
      console.log('[stats]', res.status, await res.text());
    } catch (err) {
      console.warn('[stats] report failed:', err.message);
    }
  }
}

export function installStatReporter() {
  if (!process.env.BLOXITY_REPORT_TOKEN || !process.env.BLOXITY_GAME_ID) return { flush: async () => {} };
  const timer = setInterval(() => flush().catch(() => {}), 60_000);
  timer.unref();
  return { flush: () => flush().catch(() => {}) };
}
