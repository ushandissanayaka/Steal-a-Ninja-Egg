// Sends leaderboard scores to Boxity from server-owned state (never from client packets).
//   POST {BLOXITY_API_URL}/v1/leaderboards/hosted/{BLOXITY_GAME_ID}/report
//   Authorization: Bearer {BLOXITY_REPORT_TOKEN}
//   { boards: [...declarations], scores: [{ board, userId: 'legion_<id>', score }] }  (max 200 per call)
// Boxity hosting injects BLOXITY_REPORT_TOKEN and BLOXITY_GAME_ID; without them (local dev) this does nothing.
// The same declarations are made by the client (Legion.SDK.leaderboard.define) so the trophy button shows.

const API = process.env.BLOXITY_API_URL || 'https://api.bloxity.io';
const TOKEN = process.env.BLOXITY_REPORT_TOKEN || '';
const GAME_ID = process.env.BLOXITY_GAME_ID || '';
const ENABLED = !!(TOKEN && GAME_ID);
const FLUSH_MS = 20_000;
const MAX_PER_CALL = 200;

export const BOARDS = [
  { id: 'cash_per_sec', label: 'Most Cash/s', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'top_speed', label: 'Top Speed', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'eggs_stolen', label: 'Eggs Stolen', order: 'desc', mode: 'sum', format: 'number', reset: 'weekly' },
];

const best = new Map(); // 'board|userId' -> highest score since the last flush
const sums = new Map(); // 'board|userId' -> amount gained since the last flush

// only signed-in Boxity players rank (guests' saves are separate); strip any '#m...' mode suffix
const accountOf = (userId) => (typeof userId === 'string' && userId.startsWith('legion_') ? userId.split('#')[0] : null);

// for 'best' boards: the player's current value (only the highest one is sent)
export function reportBest(board, userId, score) {
  const id = ENABLED && accountOf(userId);
  if (!id || !Number.isFinite(score) || score <= 0) return;
  const key = `${board}|${id}`;
  if ((best.get(key) || 0) < score) best.set(key, Math.floor(score));
}

// for 'sum' boards: what was just gained (e.g. 1 egg)
export function reportAdd(board, userId, amount = 1) {
  const id = ENABLED && accountOf(userId);
  if (!id || !Number.isFinite(amount) || amount <= 0) return;
  const key = `${board}|${id}`;
  sums.set(key, (sums.get(key) || 0) + amount);
}

let sending = false;
async function flush() {
  if (!ENABLED || sending || (!best.size && !sums.size)) return;
  sending = true;
  const entries = [...best, ...sums].map(([key, score]) => {
    const [board, userId] = key.split('|');
    return { board, userId, score };
  });
  const takenBest = new Map(best);
  const takenSums = new Map(sums);
  best.clear();
  sums.clear();
  try {
    for (let i = 0; i < entries.length; i += MAX_PER_CALL) {
      const res = await fetch(`${API}/v1/leaderboards/hosted/${encodeURIComponent(GAME_ID)}/report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ boards: BOARDS, scores: entries.slice(i, i + MAX_PER_CALL) }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dropped = Object.entries(data.dropped || {}).filter(([, n]) => n > 0);
      if (dropped.length) console.warn('[leaderboards] dropped:', Object.fromEntries(dropped));
    }
  } catch (err) {
    console.warn('[leaderboards] report failed, will retry:', err.message);
    // put them back for the next try (sums add up, bests keep the higher)
    for (const [k, v] of takenSums) sums.set(k, (sums.get(k) || 0) + v);
    for (const [k, v] of takenBest) if ((best.get(k) || 0) < v) best.set(k, v);
  } finally {
    sending = false;
  }
}

export function installLeaderboardReporter() {
  if (!ENABLED) {
    console.log('[leaderboards] BLOXITY_REPORT_TOKEN / BLOXITY_GAME_ID not set: not reporting (local dev)');
    return { flush: async () => {} };
  }
  setInterval(flush, FLUSH_MS).unref();
  return { flush };
}
