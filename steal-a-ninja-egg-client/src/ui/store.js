// UI state shared between the game loop and React.

import { useSyncExternalStore } from 'react';

const sameValue = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      if (Object.keys(patch).every((k) => sameValue(state[k], patch[k]))) return;
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const uiStore = createStore({
  phase: 'loading', // loading | playing | reconnecting | failed
  loading: { text: 'Starting', progress: 0.02 }, // the loading page: current stage and 0..1
  error: '',
  objective: '',
  carried: 0,
  prompt: null,     // { verb, title, x, y }
  announce: null,   // { text, color, big } a message for the whole server (night, event eggs)
  clock: null,      // { night, left } the day / night clock (seconds left)
  pen: [],          // the eggs growing in my pen
  onTreadmill: false,
  hidePets: false,  // hide other players' pets
  hideEggs: false,  // hide other players' growing eggs
  reveal: null,     // { name, rarity, cash, egg }
  stats: { cash: 0, income: 0, speed: 0, treadmill: 'none', axe: 'bat' },
  shop: false,
  chased: false,    // a guardian is charging at you
  zone: null,       // { name, difficulty, speed } shown for a few seconds on entering a forest
  toast: null,      // { text, color }
  perf: { tier: '', fps: 0, ping: null, network: 'good' },
  meta: null,       // passes, potions (ms left), slots, index, rebirths, timers; at = when it arrived
  allPets: [],      // [{ uid, id, cash, egg }]
  popup: null,      // 'shop' | 'index' | 'rebirth' | 'daily' | 'pets' | 'weapons' | 'offer' | ...
  others: [],       // [{ sid, name }] the other players in this server (gifts)
  giftFor: null,    // { kind, id, name } what is being gifted (the gift picker is open)
  confirm: null,    // { title, text, yes, onYes } an 'Are you sure?' box
  shopSection: null, // open the shop scrolled to this section ('speed')
  slowMode: false,  // walk at half speed
  panel: null,      // 'eggs' | 'pets' (side panels)
  opened: null,     // { pets } just hatched from featured eggs
  friends: [],     // [{ id, name, online, avatar }] the player's Bloxity friends
  friendsLoading: false, // the friends list is being fetched
  roomId: '',       // this server's room, for invites
  profile: null,    // { name, pfp, gems, muted } for the top-right card
  embedded: false,  // running inside Boxity (then Boxity draws invite / friends UI, not the game)
  offline: null,    // { amount, away, price } cash earned while away, shown on joining
});

export const useUi = () => useSyncExternalStore(uiStore.subscribe, uiStore.get);
