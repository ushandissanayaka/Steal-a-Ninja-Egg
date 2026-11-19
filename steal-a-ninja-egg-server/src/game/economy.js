// Server-owned rules for what the nests hold and what hatching produces.

import { BIOMES, EGGS, EVENT_EGGS, eggName, pickWeighted, rollEgg, rollPet } from '../shared/gameData.js';

// A fresh egg for a nest of this biome (mostly Common, sometimes rarer).
export const nestEgg = (biomeId) => rollEgg(biomeId);

// A special event egg in one of the scarier biomes, with the announcement everyone sees.
export function eventEgg(rnd = Math.random) {
  const from = EVENT_EGGS.fromBiome;
  const biome = BIOMES[from + Math.floor(rnd() * (BIOMES.length - from))];
  const rarity = pickWeighted(EVENT_EGGS.rarities, rnd);
  const size = Number(pickWeighted(EVENT_EGGS.sizes, rnd));
  const egg = rollEgg(biome.id, rarity, size, rnd);
  return { egg, biome, text: `A ${eggName(egg).replace(/ Egg$/, '').toUpperCase()} EGG spawned in ${biome.name}!` };
}

export function hatchResult(egg) {
  return { pet: rollPet(egg), egg: eggName(egg), biome: EGGS[egg.type]?.name || '' };
}
