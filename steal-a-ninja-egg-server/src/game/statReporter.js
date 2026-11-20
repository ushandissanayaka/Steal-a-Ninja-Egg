// Reports per-player stats to the Boxity profile ("Only in this game").
// Values always come from server-owned profiles, never from client packets.

import { allProfiles } from './profiles.js';
import { updateAchievements } from './progress.js';

const DEFINITIONS = [
  { key: 'eggs_stolen', label: 'Eggs Stolen', type: 'number', sortOrder: 1 },
  { key: 'eggs_hatched', label: 'Eggs Hatched', type: 'number', sortOrder: 2 },
  { key: 'speed', label: 'Speed', type: 'number', sortOrder: 3 },
  { key: 'pets', label: 'Pets Hatched', type: 'number', sortOrder: 4 },
  { key: 'rebirths', label: 'Rebirths', type: 'number', sortOrder: 5 },
  { key: 'pets_found', label: 'Index Pets Found', type: 'number', sortOrder: 6 },
  // achievements: saved records that never go down (progress.updateAchievements)
  { key: 'best_stage', label: 'Furthest Stage Reached', type: 'number', sortOrder: 7 },
  { key: 'escapes', label: 'Guardian Escapes', type: 'number', sortOrder: 8 },
  { key: 'treadmill', label: 'Best Training Arena', type: 'number', sortOrder: 9 },
  { key: 'pen_level', label: 'Pen Level', type: 'number', sortOrder: 10 },
  { key: 'spin_styles', label: 'Spin Styles Owned', type: 'number', sortOrder: 11 },
  { key: 'kunoichi', label: 'Kunoichi Hatched', type: 'number', sortOrder: 12 },
  { key: 'weapons', label: 'Weapons Unlocked', type: 'number', sortOrder: 13 },
  { key: 'daily_streak', label: 'Best Daily Streak', type: 'number', sortOrder: 14 },
];
const LIMIT = 1_000_000_000;

function valuesFor(p) {
  const a = updateAchievements(p);
  const raw = {
    eggs_stolen: p.eggsStolen,
    eggs_hatched: p.eggsHatched,
    speed: a.bestSpeed, // the most Speed ever (a rebirth does not lower it)
    pets: p.petsHatched ?? p.pets?.length ?? 0, // every pet ever hatched (selling does not lower it)
    rebirths: p.rebirths || 0,
    pets_found: p.discovered?.length || 0,
    best_stage: a.bestStage,
    escapes: a.escapes,
    treadmill: a.bestArena,
    pen_level: a.bestPen,
    spin_styles: a.spinStyles,
    kunoichi: a.kunoichi,
    weapons: Math.max(0, (p.weapons?.length || 1) - 1), // the starter weapon does not count
    daily_streak: a.bestStreak,
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
