// Reports this pod's live rooms to Boxity, so they show under "Open Rooms" on the game page with a
// Join button (docs.bloxity.io "Show your live rooms").
//   POST {MATCHMAKER_REPORT_URL}/{BLOXITY_GAME_ID}/rooms   Authorization: Bearer {BLOXITY_REPORT_TOKEN}
//   { podName, players, rooms: [{ colyseusRoomId, name, clients, maxClients, locked, private, started, metadata }] }
// every 2 s. Boxity hosting injects the variables; without them (local dev) this does nothing.

import colyseus from 'colyseus';

const { matchMaker } = colyseus;
const BASE = (process.env.MATCHMAKER_REPORT_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.BLOXITY_REPORT_TOKEN || '';
const GAME_ID = process.env.BLOXITY_GAME_ID || '';
const POD = process.env.POD_NAME || process.env.HOSTNAME || 'local';
const EVERY_MS = 2000;

export function installRoomReporter() {
  if (!BASE || !TOKEN || !GAME_ID) return { stop() {} };
  const tick = async () => {
    try {
      const list = await matchMaker.query({});
      const rooms = list.map((r) => ({
        colyseusRoomId: r.roomId,
        name: r.name,
        clients: r.clients,
        maxClients: r.maxClients,
        locked: !!r.locked,
        private: !!r.private,
        started: true, // the lobby is always running: anyone can walk in
        metadata: r.metadata || {},
      }));
      await fetch(`${BASE}/${GAME_ID}/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ podName: POD, players: rooms.reduce((n, r) => n + r.clients, 0), rooms }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // the next tick tries again
    }
  };
  tick();
  const id = setInterval(tick, EVERY_MS);
  return { stop() { clearInterval(id); } };
}
