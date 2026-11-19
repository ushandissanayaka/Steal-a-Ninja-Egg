// Connects to the Colyseus room.
// Hosted on Boxity: ALWAYS resolve through the matchmaker (Legion.SDK.net.resolveEndpoint) and build
// a NEW Client from every resolve. Never open a socket to <id>.host.bloxity.io.
// Self-hosted / local: VITE_SERVER_URL.

import { Client } from 'colyseus.js';
import { bloxity } from '../bloxity/bloxity.js';
import { boxityEnv } from '../bloxity/boxityEnv.js';
import { ROOM_NAME } from '../shared/gameData.js';

const HOSTING_ID = import.meta.env.VITE_BLOXITY_HOSTING_ID || '';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const isHosted = () => !!HOSTING_ID && bloxity.available;

async function endpoint() {
  if (isHosted()) return bloxity.resolveEndpoint(HOSTING_ID);
  return SERVER_URL;
}

// ?roomId= from Boxity's "Join" button or a friend invite.
async function joinRequestedRoom(roomId, options) {
  if (isHosted()) {
    // resolve the room's pod first, a bare joinById can land on another pod
    const res = await fetch(`${boxityEnv().playUrl}/v1/dir/${HOSTING_ID}/list`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.rooms || [];
    const hit = list.find((r) => r.roomId === roomId || r.id === roomId);
    if (!hit?.joinUrl) throw new Error('room not found');
    return new Client(hit.joinUrl).joinById(roomId, options);
  }
  return new Client(SERVER_URL).joinById(roomId, options);
}

export async function connect(options, { maxWaitMs } = {}) {
  const wait = maxWaitMs ?? (isHosted() ? 60_000 : 8_000);
  const roomId = new URLSearchParams(location.search).get('roomId');
  if (roomId) {
    try {
      return await joinRequestedRoom(roomId, options);
    } catch (err) {
      console.warn('[net] requested room unavailable, falling back to matchmaking', err?.message);
    }
  }
  const deadline = Date.now() + wait;
  let delay = 1000;
  for (;;) {
    try {
      const client = new Client(await endpoint());
      return await client.joinOrCreate(ROOM_NAME, options);
    } catch (err) {
      if (Date.now() + delay > deadline) throw err;
      console.warn(`[net] connect failed (${err?.message || err}), retrying in ${delay}ms`);
      await sleep(delay);
      delay = Math.min(delay * 1.7, 8000);
    }
  }
}

// Loads the game again (after the connection dropped, or a start that failed). With a roomId the
// player goes back into the same room, so friends are still there; connect() falls back to any room
// if it is gone. A failed start waits longer each time it is retried, so a server that is down is
// not hammered.
const RETRY_KEY = 'cse_retries';
export function reloadGame(roomId) {
  const url = new URL(location.href);
  if (roomId) url.searchParams.set('roomId', roomId);
  location.replace(url.toString());
}
export function retryDelayMs() {
  let n = 0;
  try { n = Number(sessionStorage.getItem(RETRY_KEY)) || 0; sessionStorage.setItem(RETRY_KEY, String(n + 1)); } catch {}
  return Math.min(30_000, 4000 * 2 ** n);
}
export function startedFine() {
  try { sessionStorage.removeItem(RETRY_KEY); } catch {}
}
