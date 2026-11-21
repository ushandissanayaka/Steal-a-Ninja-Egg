// Server rules for everything bought or claimed with cash: passes, potions, speed, featured eggs,
// pet slots and equipping, the index rewards, rebirths and the free gift. Each action checks the
// price against the player's own cash and returns { ok, text } for a message to the player.

import { BIOMES, EGGS, PETS, TREADMILLS, biomeIndex, petIncome, rollEgg, rollPet } from '../shared/gameData.js';
import {
  GIFT_MS, INDEX_AREAS, MAX_PETS, OFFLINE, offlineAmount, offlineTriplePrice, PASSES, POTIONS, POTION_MAX_MS, POTION_MS, POTION_ORDER, SLOTS, SPEED_PACKS,
  TRAILS, TUTORIAL_STEPS, petSellValue, trailById,
  areaById, areaPets, bundlePrice, doubleSpeedPrice, featuredEgg, featuredPrice, perks, petFromArea, potionPrice,
  rebirthNeed, slotPrice,
  DAILY, MONEY_PACKS, STARTER_PACK, WEAPONS, dailyState, dayNumber, indexPetReward, weaponById, SPIN_STYLES, spinById,
  COMMUNITY_EGG, INSTANT_HATCH_MAX_MS, INSTANT_HATCH_MS, instantHatchPrice } from '../shared/progression.js';

const fail = (text) => ({ ok: false, text });
const done = (text) => ({ ok: true, text });

// ------------------------------------------------------------------ achievements

// A player's achievements: records that only ever go up, saved with the profile (so selling a pet, a
// rebirth or a morning reset never takes one away) and shown on their Boxity profile (statReporter).
//   bestStage   the furthest stage they stole an egg from or hatched one of (1-10)
//   bestSpeed   the most Speed they ever had (a rebirth does not lower it)
//   bestArena   the best training arena they unlocked (1 Wooden .. 6 Ice Peak)
//   bestPen     the highest Upgrade Pen level
//   spinStyles  how many whirlwind styles they own
//   bestStreak  the longest daily-reward streak
//   escapes     how many times they got away from a guardian with its egg
//   kunoichi    female ninjas hatched
export const ACHIEVEMENT_KEYS = ['bestStage', 'bestSpeed', 'bestArena', 'bestPen', 'spinStyles', 'bestStreak', 'escapes', 'kunoichi'];
export function updateAchievements(profile) {
  const a = profile.achievements && typeof profile.achievements === 'object' && !Array.isArray(profile.achievements) ? profile.achievements : {};
  for (const k of ACHIEVEMENT_KEYS) a[k] = Number.isFinite(a[k]) && a[k] >= 0 ? Math.floor(a[k]) : 0;
  const up = (k, v) => { if (Number.isFinite(v) && v > a[k]) a[k] = Math.floor(v); };
  up('bestStage', (profile.pets || []).reduce((best, pet) => Math.max(best, biomeIndex(pet.egg || PETS[pet.id]?.biome) + 1), 0));
  up('bestSpeed', profile.speed);
  up('bestArena', TREADMILLS.findIndex((t) => t.id === profile.treadmill));
  up('bestPen', profile.penLevel || 1);
  up('spinStyles', Array.isArray(profile.spins) ? profile.spins.length : 0);
  up('bestStreak', profile.daily?.streak || 0);
  profile.achievements = a;
  return a;
}
// one more of a counting achievement (escapes, kunoichi), or a new best for a record (bestStage)
export function addAchievement(profile, key, amount = 1) {
  const a = updateAchievements(profile);
  a[key] = (a[key] || 0) + amount;
}
export function reachAchievement(profile, key, value) {
  const a = updateAchievements(profile);
  if (Number.isFinite(value) && value > a[key]) a[key] = Math.floor(value);
}

// Fills in the progress fields on older saves.
export function normalizeProgress(profile, now = Date.now()) {
  updateAchievements(profile); // the records (older saves get them from what they have now)
  if (!profile.passes || typeof profile.passes !== 'object' || Array.isArray(profile.passes)) profile.passes = {};
  if (!profile.boosts || typeof profile.boosts !== 'object') profile.boosts = {};
  profile.rebirths = Number.isInteger(profile.rebirths) ? profile.rebirths : 0;
  profile.slots = Number.isInteger(profile.slots) ? Math.min(SLOTS.max, Math.max(SLOTS.start, profile.slots)) : SLOTS.start;
  profile.claimed = Array.isArray(profile.claimed) ? profile.claimed : [];
  profile.petSeq = Number.isInteger(profile.petSeq) ? profile.petSeq : 0;
  profile.giftAt = Number.isFinite(profile.giftAt) ? profile.giftAt : now + GIFT_MS;
  profile.trails = (Array.isArray(profile.trails) ? profile.trails : []).filter((id) => trailById(id));
  if (!profile.trails.includes(profile.trail)) profile.trail = '';
  // spin styles: the starter one is always owned
  // (passes that come with a spin style, like the Golden Dragon Spin, always keep it)
  const passSpins = Object.keys(PASSES).filter((id) => PASSES[id].spin && profile.passes?.[id]).map((id) => PASSES[id].spin);
  profile.spins = [...new Set(['breeze', ...(Array.isArray(profile.spins) ? profile.spins : []), ...passSpins])].filter((id) => SPIN_STYLES.some((s) => s.id === id));
  profile.community = !!profile.community;
  if (!profile.spins.includes(profile.spin)) profile.spin = 'breeze';
  profile.locked = Array.isArray(profile.locked) ? profile.locked : [];
  // the index pays per pet found; areas claimed before that count as all their pets claimed
  if (!Array.isArray(profile.claimedPets)) {
    profile.claimedPets = profile.claimed.flatMap((a) => (areaById(a) ? areaPets(areaById(a)) : []));
  }
  profile.claimedPets = profile.claimedPets.filter((id) => PETS[id]);
  if (!profile.daily || typeof profile.daily !== 'object') profile.daily = { last: -10, streak: 0 };
  profile.weapons = (Array.isArray(profile.weapons) ? profile.weapons : []).filter((id) => WEAPONS.some((w) => w.id === id));
  if (!profile.weapons.includes('bat')) profile.weapons.unshift('bat');
  if (!profile.weapons.includes(profile.weapon)) profile.weapon = 'bat';
  profile.instantHatches = Number.isInteger(profile.instantHatches) ? Math.max(0, profile.instantHatches) : 0;
  profile.starterPack = !!profile.starterPack;
  // the new-player guide: players who already have pets have done it
  if (!TUTORIAL_STEPS.includes(profile.tutorial)) profile.tutorial = profile.pets.length ? 'done' : 'basics';
  // guide steps already done once (they are not shown again): 'steal', 'pen', 'zone:candy'...
  profile.guideDone = (Array.isArray(profile.guideDone) ? profile.guideDone : []).filter((k) => typeof k === 'string').slice(0, 200);
  if (profile.pets.length) for (const k of ['steal', 'pen', 'hatch']) if (!profile.guideDone.includes(k)) profile.guideDone.push(k);
  for (const pet of profile.pets) if (!Number.isInteger(pet.uid)) pet.uid = ++profile.petSeq;
  const discovered = new Set(Array.isArray(profile.discovered) ? profile.discovered : []);
  for (const pet of profile.pets) discovered.add(pet.id);
  profile.discovered = [...discovered].filter((id) => PETS[id]);
  const uids = new Set(profile.pets.map((p) => p.uid));
  profile.equipped = (Array.isArray(profile.equipped) ? profile.equipped : []).filter((uid) => uids.has(uid)).slice(0, profile.slots);
  if (!profile.equipped.length && profile.pets.length) equipBest(profile);
}

export const passList = (profile) => Object.keys(profile.passes).filter((id) => profile.passes[id] && PASSES[id]);
const boostActive = (profile, now) => (id) => (profile.boosts[id] || 0) > now;
export const perksOf = (profile, now = Date.now()) => perks(passList(profile), boostActive(profile, now), profile.rebirths, profile.trail, profile.penLevel, profile.spin);

export const equippedPets = (profile) => {
  const on = new Set(profile.equipped);
  return profile.pets.filter((p) => on.has(p.uid));
};
export const baseIncome = (profile) => petIncome(equippedPets(profile));

// What the client needs for the popups. Times are sent as "ms left" so clocks do not have to agree.
export function metaOf(profile, now, stageLeft = 0, extra = {}) {
  const boosts = {};
  for (const id of [...POTION_ORDER, 'instant']) if ((profile.boosts[id] || 0) > now) boosts[id] = profile.boosts[id] - now;
  const featured = featuredEgg(now);
  const k = perksOf(profile, now);
  return JSON.stringify({
    passes: passList(profile),
    boosts,
    rebirths: profile.rebirths,
    padCap: k.padCap,
    walk: k.walk,
    steal: k.steal,
    cashMult: k.cash,
    slots: profile.slots,
    equipped: profile.equipped,
    discovered: profile.discovered,
    claimed: profile.claimed,
    claimedPets: profile.claimedPets,
    daily: dailyState(profile.daily, now),
    weapons: profile.weapons,
    weapon: profile.weapon,
    instantHatches: profile.instantHatches,
    starterPack: profile.starterPack,
    community: profile.community,
    luck: perksOf(profile, now).luck,
    giftIn: Math.max(0, profile.giftAt - now),
    featured: { type: featured.type, endsIn: featured.endsAt - now },
    stageLeft,
    trails: profile.trails,
    trail: profile.trail,
    spins: profile.spins,
    spin: profile.spin,
    locked: profile.locked,
    tutorial: profile.tutorial,
    guideDone: profile.guideDone,
    ...extra,
  });
}

// The full pet list for the pets panel, compact.
export const allPetsJson = (profile) => JSON.stringify(profile.pets.map(({ uid, id, cash, egg, rarity, kg }) => ({ uid, id, cash, egg, rarity, kg })));

// A new pet: numbered, recorded in the index, equipped if there is a free slot. Past MAX_PETS the
// weakest unequipped pet goes.
export function addPet(profile, pet) {
  pet.uid = ++profile.petSeq;
  profile.petsHatched = (profile.petsHatched ?? profile.pets.length) + 1; // lifetime count, for the Boxity profile
  profile.pets.push(pet);
  if (/Kunoichi/.test(PETS[pet.id]?.name || '')) addAchievement(profile, 'kunoichi');
  updateAchievements(profile);
  if (!profile.discovered.includes(pet.id)) profile.discovered.push(pet.id);
  if (profile.equipped.length < profile.slots) profile.equipped.push(pet.uid);
  else {
    // swap it in for the weakest equipped pet if it is better
    const equipped = equippedPets(profile).sort((a, b) => a.cash - b.cash);
    if (equipped.length && equipped[0].cash < pet.cash) profile.equipped[profile.equipped.indexOf(equipped[0].uid)] = pet.uid;
  }
  if (profile.pets.length > MAX_PETS) {
    const on = new Set(profile.equipped);
    const weakest = profile.pets.filter((p) => !on.has(p.uid)).sort((a, b) => a.cash - b.cash)[0];
    if (weakest) profile.pets.splice(profile.pets.indexOf(weakest), 1);
  }
  return pet;
}

// Hatching with the x2 Luck pass: that many tries, the best pet is kept. noDup: never an animal the
// player already has (an egg from the nests); null when they have every animal of that stage.
export function luckyPet(profile, egg, now = Date.now(), noDup = false) {
  const skip = noDup ? new Set(profile.pets.map((p) => p.id)) : null;
  let best = rollPet(egg, Math.random, skip);
  if (!best) return null;
  for (let i = 1; i < perksOf(profile, now).luck; i++) {
    const other = rollPet(egg, Math.random, skip);
    if (other.cash > best.cash) best = other;
  }
  return best;
}

// An egg of this rarity from the furthest biome the player has a pet from (for gifts and rewards).
function bestBiomeEgg(profile, rarity) {
  const furthest = profile.pets.reduce((i, p) => Math.max(i, biomeIndex(p.egg || PETS[p.id]?.biome)), 0);
  return rollEgg(BIOMES[furthest].id, rarity);
}

const spend = (profile, price) => {
  if (!Number.isFinite(price) || price < 0 || profile.cash < price) return false;
  profile.cash -= price;
  return true;
};

// ------------------------------------------------------------------ shop

export function buyPass(profile, id) {
  const pass = PASSES[id];
  if (!pass) return fail('Unknown pass');
  if (profile.passes[id] || (pass.spin && profile.spins.includes(pass.spin))) return fail('You already own it');
  if (!spend(profile, pass.price)) return fail('Not enough cash');
  profile.passes[id] = true;
  givePassSpin(profile, pass, true);
  return done(`You got ${pass.name}!`);
}

// a pass that is a spin style (Golden Dragon Spin): owned, and worn straight away when bought
function givePassSpin(profile, pass, wear) {
  if (!pass.spin) return;
  if (!profile.spins.includes(pass.spin)) profile.spins.push(pass.spin);
  if (wear) profile.spin = pass.spin;
}

// ------------------------------------------------------------------ 24h Instant Hatch and Community Rewards

export function buyInstantHatch(profile, now) {
  const until = profile.boosts.instant || 0;
  if (until - now > INSTANT_HATCH_MAX_MS - INSTANT_HATCH_MS) return fail('Instant Hatch is already full');
  if (!spend(profile, instantHatchPrice(baseIncome(profile)))) return fail('Not enough cash');
  profile.boosts.instant = Math.max(now, until) + INSTANT_HATCH_MS;
  return done('Instant Hatch for 24 hours: every egg is ready right away!');
}

// The community egg: once per player, hatched on the spot. name: the @username they typed.
export function claimCommunity(profile, name, now) {
  if (profile.community) return fail('You already claimed this egg');
  const clean = String(name || '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_.]{3,20}$/.test(clean)) return fail('Type your @username first');
  profile.community = true;
  profile.communityName = clean;
  const pets = [addPet(profile, luckyPet(profile, bestBiomeEgg(profile, COMMUNITY_EGG.rarity), now))];
  return { ...done('Community egg claimed!'), pets };
}

function addPotion(profile, id, now) {
  const from = Math.max(now, profile.boosts[id] || 0);
  profile.boosts[id] = Math.min(now + POTION_MAX_MS, from + POTION_MS);
}

export function buyPotion(profile, id, now) {
  if (!POTIONS[id]) return fail('Unknown potion');
  if ((profile.boosts[id] || 0) - now > POTION_MAX_MS - POTION_MS) return fail('That potion is already full');
  if (!spend(profile, potionPrice(id, baseIncome(profile)))) return fail('Not enough cash');
  addPotion(profile, id, now);
  return done(`${POTIONS[id].name} potion: 15 minutes!`);
}

export function buyBundle(profile, now) {
  if (!spend(profile, bundlePrice(baseIncome(profile)))) return fail('Not enough cash');
  for (const id of POTION_ORDER) addPotion(profile, id, now);
  return done('All potions: +15 minutes each!');
}

export function buySpeedPack(profile, id) {
  const pack = SPEED_PACKS.find((s) => s.id === id);
  if (!pack) return fail('Unknown pack');
  if (!spend(profile, pack.price)) return fail('Not enough cash');
  profile.speed += pack.amount;
  return done('Speed added!');
}

export function doubleSpeed(profile) {
  if (!spend(profile, doubleSpeedPrice(profile.speed))) return fail('Not enough cash');
  profile.speed *= 2;
  return done('Your speed is doubled!');
}

// Featured eggs hatch straight away (no growing). Returns the pets too.
// payer: who pays (another player when it is a gift)
export function buyFeatured(profile, count, now, payer = profile) {
  const { type } = featuredEgg(now);
  const price = featuredPrice(type, count);
  if (price === null) return fail('Unknown pack');
  if (!spend(payer, price)) return fail('Not enough cash');
  const pets = [];
  for (let i = 0; i < count; i++) pets.push(addPet(profile, luckyPet(profile, rollEgg(type))));
  const best = pets.reduce((a, b) => (b.cash > a.cash ? b : a));
  return { ...done(`${count} ${EGGS[type].name}${count > 1 ? 's' : ''} hatched! Best: ${PETS[best.id].name}`), pets };
}

// ------------------------------------------------------------------ pets

export function equipPet(profile, uid) {
  if (!profile.pets.some((p) => p.uid === uid)) return fail('No such pet');
  if (profile.equipped.includes(uid)) return fail('Already equipped');
  if (profile.equipped.length >= profile.slots) return fail('No free slot: unequip one or buy more slots');
  profile.equipped.push(uid);
  return done('Equipped!');
}

export function unequipPet(profile, uid) {
  const i = profile.equipped.indexOf(uid);
  if (i < 0) return fail('Not equipped');
  profile.equipped.splice(i, 1);
  return done('Unequipped');
}

export function equipBest(profile) {
  profile.equipped = [...profile.pets].sort((a, b) => b.cash - a.cash).slice(0, profile.slots).map((p) => p.uid);
  return done('Best pets equipped!');
}

export function buySlots(profile) {
  const price = slotPrice(profile.slots);
  if (price === null || profile.slots >= SLOTS.max) return fail('All slots unlocked');
  if (!spend(profile, price)) return fail('Not enough cash');
  profile.slots = Math.min(SLOTS.max, profile.slots + SLOTS.step);
  return done(`+${SLOTS.step} Equip! ${profile.slots} ninjas can earn now`);
}

// ------------------------------------------------------------------ index

export function claimIndex(profile, areaId) {
  const area = areaById(areaId);
  if (!area) return fail('Unknown area');
  if (profile.claimed.includes(areaId)) return fail('Already claimed');
  const missing = areaPets(area).filter((id) => !profile.discovered.includes(id));
  if (missing.length) return fail(`Find ${missing.length} more pet${missing.length > 1 ? 's' : ''} first`);
  profile.claimed.push(areaId);
  profile.speed += area.reward.speed;
  profile.cash += area.reward.cash;
  return done(`${area.name} complete! Reward claimed!`);
}

// Each pet found pays its reward once.
export function claimIndexPet(profile, id) {
  if (!PETS[id]) return fail('Unknown pet');
  if (!profile.discovered.includes(id)) return fail('Find this pet first');
  if (profile.claimedPets.includes(id)) return fail('Already claimed');
  const reward = indexPetReward(id);
  profile.claimedPets.push(id);
  profile.cash += reward.cash;
  profile.speed += reward.speed;
  return done(`${PETS[id].name}: +${reward.cash.toLocaleString('en-US')} and +${reward.speed.toLocaleString('en-US')} Speed!`);
}

export function claimIndexAll(profile) {
  const ready = profile.discovered.filter((id) => PETS[id] && !profile.claimedPets.includes(id));
  if (!ready.length) return fail('Nothing to claim: find more pets!');
  let cash = 0, speed = 0;
  for (const id of ready) {
    const reward = indexPetReward(id);
    cash += reward.cash;
    speed += reward.speed;
    profile.claimedPets.push(id);
  }
  profile.cash += cash;
  profile.speed += speed;
  return done(`Claimed ${ready.length} pet${ready.length > 1 ? 's' : ''}: +${cash.toLocaleString('en-US')} and +${speed.toLocaleString('en-US')} Speed!`);
}

// ------------------------------------------------------------------ daily rewards

export function claimDaily(profile, now) {
  const state = dailyState(profile.daily, now);
  if (!state.ready) return fail('Come back tomorrow!');
  const reward = DAILY[state.index];
  profile.daily = { last: dayNumber(now), streak: state.index + 1 };
  if (reward.cash) profile.cash += reward.cash;
  if (reward.speed) profile.speed += reward.speed;
  const pets = reward.egg ? [addPet(profile, luckyPet(profile, bestBiomeEgg(profile, reward.egg), now))] : [];
  return { ...done(`Day ${state.index + 1} reward claimed!`), pets };
}

// ------------------------------------------------------------------ shop: money, starter pack

export function buyMoneyPack(profile, id) {
  const pack = MONEY_PACKS.find((m) => m.id === id);
  if (!pack) return fail('Unknown pack');
  if (profile.speed < pack.speed) return fail('Not enough speed');
  profile.speed -= pack.speed;
  profile.cash += pack.cash;
  return done(`+${pack.cash.toLocaleString('en-US')} cash!`);
}

export function buyStarterPack(profile, now, payer = profile) {
  if (profile.starterPack) return fail(payer === profile ? 'You already have it' : 'They already have it');
  if (!spend(payer, STARTER_PACK.price)) return fail('Not enough cash');
  profile.starterPack = true;
  profile.speed += STARTER_PACK.speed;
  profile.cash += STARTER_PACK.cash;
  profile.instantHatches += STARTER_PACK.hatches;
  for (const id of STARTER_PACK.spins) if (!profile.spins.includes(id)) profile.spins.push(id);
  // wear the best spin style you own now
  profile.spin = profile.spins.reduce((best, id) => (spinById(id).mult > spinById(best).mult ? id : best), profile.spin);
  const pets = STARTER_PACK.eggs.flatMap(([rarity, count]) => Array.from({ length: count }, () => addPet(profile, luckyPet(profile, bestBiomeEgg(profile, rarity), now))));
  return { ...done('Starter Pack unlocked!'), pets };
}

// ------------------------------------------------------------------ gifts (a pass or speed for another player)

export function giftPass(payer, target, id) {
  const pass = PASSES[id];
  if (!pass) return fail('Unknown pass');
  if (target.passes[id] || (pass.spin && target.spins.includes(pass.spin))) return fail('They already own it');
  if (!spend(payer, pass.price)) return fail('Not enough cash');
  target.passes[id] = true;
  givePassSpin(target, pass, false);
  return done(`You gifted ${pass.name}!`);
}

export function giftPotion(payer, target, id, now) {
  if (!POTIONS[id]) return fail('Unknown potion');
  if ((target.boosts[id] || 0) - now > POTION_MAX_MS - POTION_MS) return fail('Their potion is already full');
  if (!spend(payer, potionPrice(id, baseIncome(payer)))) return fail('Not enough cash');
  addPotion(target, id, now);
  return done(`You gifted a ${POTIONS[id].name} potion!`);
}

// money packs are paid with the giver's speed
export function giftMoneyPack(payer, target, id) {
  const pack = MONEY_PACKS.find((m) => m.id === id);
  if (!pack) return fail('Unknown pack');
  if (payer.speed < pack.speed) return fail('Not enough speed');
  payer.speed -= pack.speed;
  target.cash += pack.cash;
  return done(`You gifted $${pack.cash.toLocaleString('en-US')}!`);
}

export function giftSpeedPack(payer, target, id) {
  const pack = SPEED_PACKS.find((s) => s.id === id);
  if (!pack) return fail('Unknown pack');
  if (!spend(payer, pack.price)) return fail('Not enough cash');
  target.speed += pack.amount;
  return done(`You gifted +${pack.amount.toLocaleString('en-US')} Speed!`);
}

// ------------------------------------------------------------------ weapons

export function buyWeapon(profile, id) {
  const weapon = WEAPONS.find((w) => w.id === id);
  if (!weapon) return fail('Unknown weapon');
  if (profile.weapons.includes(id)) return fail('You already own it');
  const i = WEAPONS.indexOf(weapon);
  if (i > 0 && !profile.weapons.includes(WEAPONS[i - 1].id)) return fail(`Unlock the ${WEAPONS[i - 1].name} first`);
  if (!spend(profile, weapon.price)) return fail('Not enough cash');
  profile.weapons.push(id);
  profile.weapon = id;
  return done(`${weapon.name} unlocked and equipped!`);
}

export function equipWeapon(profile, id) {
  if (!profile.weapons.includes(id)) return fail('Unlock it first');
  profile.weapon = id;
  return done(`${weaponById(id).name} equipped!`);
}

// ------------------------------------------------------------------ rebirth

// Costs the cash and one pet from the required area (the weakest one, unequipped first). Gives a
// cash multiplier and one more egg slot in the pen; treadmill, speed and other pets stay.
export function rebirth(profile) {
  const need = rebirthNeed(profile.rebirths);
  const area = areaById(need.area);
  if (profile.cash < need.cash) return fail('Not enough cash');
  const on = new Set(profile.equipped);
  const candidates = profile.pets.filter((p) => petFromArea(p, area))
    .sort((a, b) => (on.has(a.uid) - on.has(b.uid)) || a.cash - b.cash);
  if (!candidates.length) return fail(`You need a pet from ${area.name}`);
  const pet = candidates[0];
  updateAchievements(profile); // keep the records the rebirth is about to reset
  profile.pets.splice(profile.pets.indexOf(pet), 1);
  profile.equipped = profile.equipped.filter((uid) => uid !== pet.uid);
  profile.cash = 0;
  profile.rebirths += 1;
  if (!profile.equipped.length && profile.pets.length) equipBest(profile);
  return done(`Rebirth ${profile.rebirths}! Cash x${profile.rebirths + 1}!`);
}

// ------------------------------------------------------------------ free gift

export function claimGift(profile, now, giftAmount) {
  if (now < profile.giftAt) return fail('Not ready yet');
  const amount = giftAmount;
  profile.cash += amount;
  profile.giftAt = now + GIFT_MS;
  return { ...done('Free gift claimed!'), amount };
}

// ------------------------------------------------------------------ the new-player guide

// Moves the guide on (never back). The first hatch moves 'basics' on by itself (see the room).
export function advanceTutorial(profile, step) {
  const to = TUTORIAL_STEPS.indexOf(step);
  if (to < 0 || to <= TUTORIAL_STEPS.indexOf(profile.tutorial)) return { ok: false, text: '' };
  profile.tutorial = step;
  return { ok: true, text: '' };
}

// A guide step done once: never guided again.
export function markGuideDone(profile, key) {
  if (typeof key !== 'string' || !key || key.length > 40 || profile.guideDone.includes(key) || profile.guideDone.length >= 200) return { ok: false, text: '' };
  profile.guideDone.push(key);
  return { ok: true, text: '' };
}

// ------------------------------------------------------------------ spin styles

export function buySpin(profile, id) {
  const style = SPIN_STYLES.find((s) => s.id === id);
  if (!style) return fail('Unknown spin');
  if (profile.spins.includes(id)) return fail('You already own it');
  if (!spend(profile, style.price)) return fail('Not enough cash');
  profile.spins.push(id);
  profile.spin = id;
  return done(`${style.name} equipped! x${style.mult} Spin Speed`);
}

export function equipSpin(profile, id) {
  if (!profile.spins.includes(id)) return fail('You do not own it');
  profile.spin = id;
  return done(`${spinById(id).name} equipped!`);
}

// ------------------------------------------------------------------ trails

export function buyTrail(profile, id) {
  const trail = trailById(id);
  if (!trail) return fail('Unknown trail');
  if (profile.trails.includes(id)) return fail('You already own it');
  if (!spend(profile, trail.price)) return fail('Not enough cash');
  profile.trails.push(id);
  profile.trail = id;
  return done(`${trail.name} equipped! x${trail.mult} Speed`);
}

// Equip an owned trail, or take it off (id = '').
export function equipTrail(profile, id) {
  if (id && !profile.trails.includes(id)) return fail('You do not own it');
  profile.trail = id;
  return done(id ? `${trailById(id).name} equipped!` : 'Trail unequipped');
}

// ------------------------------------------------------------------ selling pets

export function toggleLock(profile, uid) {
  if (!profile.pets.some((p) => p.uid === uid)) return fail('No such pet');
  const i = profile.locked.indexOf(uid);
  if (i >= 0) profile.locked.splice(i, 1);
  else profile.locked.push(uid);
  return { ok: true, text: '' };
}

// Sells the given pets (locked ones are skipped; equipped ones are unequipped first).
export function sellPets(profile, uids) {
  const wanted = new Set(Array.isArray(uids) ? uids.slice(0, 500) : []);
  const locked = new Set(profile.locked);
  const sold = profile.pets.filter((p) => wanted.has(p.uid) && !locked.has(p.uid));
  if (!sold.length) return fail('Pick some pets to sell');
  const total = sold.reduce((sum, p) => sum + petSellValue(p), 0);
  const gone = new Set(sold.map((p) => p.uid));
  profile.pets = profile.pets.filter((p) => !gone.has(p.uid));
  profile.equipped = profile.equipped.filter((uid) => !gone.has(uid));
  profile.cash += total;
  return { ...done(`Sold ${sold.length} pet${sold.length > 1 ? 's' : ''} for $${total.toLocaleString('en-US')}!`), amount: total };
}

// ------------------------------------------------------------------ offline cash

// On joining: what the equipped pets earned while the player was away (kept until claimed).
export function startOffline(profile, now) {
  const away = profile.lastSeen ? now - profile.lastSeen : 0;
  profile.lastSeen = now;
  if (away < OFFLINE.minMs || profile.offlinePending > 0) return;
  const rate = baseIncome(profile) * perks(passList(profile), () => false, profile.rebirths).cash;
  const amount = offlineAmount(rate, away);
  if (amount > 0) {
    profile.offlinePending = amount;
    profile.offlineAway = Math.min(away, OFFLINE.maxMs);
  }
}

export const offlineInfo = (profile) => (profile.offlinePending > 0
  ? { amount: profile.offlinePending, away: profile.offlineAway || 0, price: offlineTriplePrice(profile.offlinePending) }
  : null);

export function claimOffline(profile, triple) {
  const amount = profile.offlinePending || 0;
  if (amount <= 0) return fail('Nothing to claim');
  if (triple && !spend(profile, offlineTriplePrice(amount))) return fail('Not enough cash for 3x');
  const got = triple ? amount * OFFLINE.triple : amount;
  profile.cash += got;
  profile.offlinePending = 0;
  return { ...done(`+$${got.toLocaleString('en-US')} offline cash!`), amount: got };
}

export { INDEX_AREAS };
