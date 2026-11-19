// The side buttons, popups (Shop, Index, Rebirth) and side panels (Growing Eggs, Pets).
// Everything here is live: it reads the player's cash, pets and meta from the store, and every
// button sends an action to the server (act), which checks the price and answers.

import { useEffect, useState } from 'react';
import './popups.css';
import { uiStore } from './store.js';
import { EGGS, EGG_COLOR, PETS, RARITIES, RARITY_COLOR, eggName, formatNumber, petSize } from '../shared/gameData.js';
import {
  EXTRA_RARITY_COLOR, FRIEND_BOOST, FRIEND_MAX, MAX_PETS, TRAILS, friendCashMult, petSellValue,
  FEATURED_PACKS, INDEX_AREAS, PASSES, PASS_ORDER, POTIONS, POTION_ORDER, SLOTS, SPEED_PACKS, BUNDLE_SAVE,
  areaPets, bundlePrice, doubleSpeedPrice, eggRates, featuredPrice, giftAmount, growNowPrice, petFromArea,
  potionPrice, rebirthCashMult, rebirthNeed, rebirthPadBonus, slotPrice, areaById,
} from '../shared/progression.js';
import { onThumbReady, petThumb } from '../game/util/petArt.js';
import { bloxity } from '../bloxity/bloxity.js';
import {
  AxeArt, BoltArt, BookArt, CartArt, CashArt, ClockArt, CrateArt, CrownArt, EggArt, GiftArt, PawArt, PotionArt,
  RebirthArt, ShoeArt, CalendarArt, SwordArt,
} from './popupIcons.jsx';

// ------------------------------------------------------------------ helpers

// re-render every `ms` (for countdowns)
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// meta times are "ms left when it arrived"
export const left = (meta, ms, now) => Math.max(0, (ms || 0) - (now - (meta?.at || now)));

export function clock(ms) {
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  if (d) return `${d}d ${two(h)}h ${two(m)}m ${two(sec)}s`;
  if (h) return `${h}h ${two(m)}m ${two(sec)}s`;
  return `${m}m ${two(sec)}s`;
}

const close = () => uiStore.set({ popup: null });
export const baseIncome = (ui) => (ui.stats.income || 0) / (ui.meta?.cashMult || 1);
const EGG_SPOTS = { chicken: '#d9b48a', stone: '#6c7176', maple: '#c8411f', sakura: '#ff5fa8', frost: '#4aa6d6', golden: '#d89a10' };

function Price({ price, cash, onClick, label = null, wide = false }) {
  const poor = cash < price;
  return (
    <button type="button" className={`buy${poor ? ' poor' : ''}${wide ? ' wide' : ''}`} disabled={poor} onClick={onClick}>
      {label || `$${formatNumber(price)}`}
    </button>
  );
}

// A pet's picture; a paw placeholder until it has been drawn (pictures are drawn in idle time, so
// opening a popup never stalls the game), then it redraws itself.
export function PetPic({ id, hidden = false, size = 72 }) {
  const [, redraw] = useState(0);
  const url = petThumb(id);
  useEffect(() => (url ? undefined : onThumbReady((ready) => { if (ready === id) redraw((n) => n + 1); })), [id, url]);
  return url
    ? <img className={`pet-pic${hidden ? ' hidden' : ''}`} src={url} width={size} height={size} alt="" draggable="false" />
    : <PawArt size={size * 0.7} />;
}

function Popup({ title, theme = 'green', children, wide = false }) {
  return (
    <div className="pop-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`pop pop-${theme}${wide ? ' wide' : ''}`}>
        <div className="pop-head">
          <h2>{title}</h2>
          <button type="button" className="pop-x" onClick={close} aria-label="Close">X</button>
        </div>
        <div className="pop-body">{children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ side buttons, gift, boosts

export function SideMenu({ ui }) {
  const now = useNow(1000);
  const meta = ui.meta;
  const indexReady = meta && meta.discovered.some((id) => PETS[id] && !(meta.claimedPets || []).includes(id));
  const need = meta && rebirthNeed(meta.rebirths);
  const rebirthReady = meta && ui.stats.cash >= need.cash && ui.allPets.some((p) => petFromArea(p, areaById(need.area)));
  const giftReady = meta && left(meta, meta.giftIn, now) <= 0;
  const dailyReady = meta?.daily && (meta.daily.ready || left(meta, meta.daily.msLeft, now) <= 0);
  const eggReady = ui.pen.some((e) => e.left <= 0);
  const open = (popup) => uiStore.set({ popup, panel: null });
  return (
    <>
      <div className="side-menu">
        <button type="button" className="side-btn shop" onClick={() => open('shop')}><CartArt /><span>Shop</span>{giftReady && <i className="dot">!</i>}</button>
        <button type="button" className="side-btn index-btn" onClick={() => open('index')}><BookArt /><span>Index</span>{indexReady && <i className="dot">!</i>}</button>
        <button type="button" className="side-btn daily-btn" onClick={() => open('daily')}><CalendarArt /><span>Daily</span>{dailyReady && <i className="dot">!</i>}</button>
        <button type="button" className="side-btn rebirth" onClick={() => open('rebirth')}><RebirthArt /><span>Rebirth</span>{rebirthReady && <i className="dot">!</i>}</button>
      </div>
      <div className="side-tabs">
        <button type="button" className={`side-tab pets${ui.popup === 'pets' ? ' on' : ''}`} onClick={() => open('pets')} aria-label="Your pets">
          <PawArt size={36} />
          {eggReady && <i className="dot">!</i>}
        </button>
        <button type="button" className={`side-tab weapons${ui.popup === 'weapons' ? ' on' : ''}`} onClick={() => open('weapons')} aria-label="Weapons"><SwordArt size={46} /></button>
      </div>
      {meta && <GiftButton ui={ui} now={now} />}
      {meta && <BoostBar meta={meta} now={now} />}
    </>
  );
}

function GiftButton({ ui, now }) {
  const ms = left(ui.meta, ui.meta.giftIn, now);
  const ready = ms <= 0;
  return (
    <button type="button" className={`gift-btn${ready ? ' ready' : ''}`} disabled={!ready} onClick={() => ui.act('claimGift')}>
      <GiftArt size={42} />
      <span>{ready ? <>CLAIM <b>${formatNumber(giftAmount(ui.stats.income))}</b></> : <>Free gift in: <b>{clock(ms)}</b></>}</span>
    </button>
  );
}

function BoostBar({ meta, now }) {
  const active = POTION_ORDER.filter((id) => left(meta, meta.boosts[id], now) > 0);
  if (!active.length && !meta.passes.length && !meta.rebirths) return null;
  return (
    <div className="boost-bar">
      {meta.rebirths > 0 && <div className="boost rebirth-chip" title="Rebirth cash bonus"><RebirthArt size={22} /><b>x{rebirthCashMult(meta.rebirths)}</b></div>}
      {active.map((id) => (
        <div key={id} className="boost" title={POTIONS[id].name}>
          <PotionArt color={POTIONS[id].color} size={30} />
          <span>{clock(left(meta, meta.boosts[id], now))}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ shop

const PASS_ART = { crown: <CrownArt size={150} />, cash: <CashArt size={96} />, clock: <ClockArt size={96} />, crate: <CrateArt size={96} />, axe: <AxeArt size={110} />, swing: <AxeArt size={110} spin head="#ffd85c" /> };

export function ShopPopup({ ui }) {
  const now = useNow(1000);
  // opened from the speed "+": jump to the speed section
  useEffect(() => {
    if (!ui.shopSection) return;
    document.getElementById(`shop-${ui.shopSection}`)?.scrollIntoView({ block: 'start' });
    uiStore.set({ shopSection: null });
  }, [ui.shopSection]);
  const { meta, stats, act } = ui;
  if (!meta) return null;
  const income = baseIncome(ui);
  const featured = meta.featured;
  const egg = EGGS[featured.type];
  return (
    <Popup title="Shop" wide>
      <h3 className="section gold">-- FEATURED --</h3>
      <div className={`featured egg-${featured.type}`}>
        <div className="featured-top">
          <span className="tag">New!</span>
          <div className="featured-title">
            <b>{egg.name.toUpperCase()}</b>
            <small>Limited time! Hatches right away.</small>
          </div>
          <div className="featured-time">{clock(left(meta, featured.endsIn, now))}</div>
        </div>
        <div className="featured-egg"><EggArt size={110} color={egg.color} spots={EGG_SPOTS[featured.type]} /></div>
        <div className="rates">
          {eggRates(featured.type).map(([id, pct]) => (
            <div key={id} className="rate" style={{ '--rar': RARITY_COLOR[PETS[id].rarity] }}>
              <PetPic id={id} size={84} hidden={!meta.discovered.includes(id)} />
              <small>{meta.discovered.includes(id) ? PETS[id].name : '???'}</small>
              <b>{pct}%</b>
            </div>
          ))}
        </div>
        <div className="packs">
          {[...FEATURED_PACKS].reverse().map((pack) => (
            <div key={pack.count} className="pack">
              <Price price={featuredPrice(featured.type, pack.count)} cash={stats.cash} onClick={() => act('buyEggs', { count: pack.count })} />
              <small>{pack.count} Egg{pack.count > 1 ? 's' : ''}{pack.best ? ' · BEST' : ''}</small>
            </div>
          ))}
        </div>
      </div>

      <h3 className="section green">-- PASSES --</h3>
      <div className="passes">
        {PASS_ORDER.map((id) => {
          const pass = PASSES[id];
          const owned = meta.passes.includes(id);
          return (
            <div key={id} className={`card pass theme-${pass.theme}${id === 'vip' ? ' big' : ''}`}>
              <div className="card-art">{PASS_ART[pass.icon]}</div>
              <div className="card-info">
                <b className="card-name">{pass.name}</b>
                {pass.lines.map((line) => <span key={line}>{line}</span>)}
                {owned ? <div className="owned">OWNED</div> : <Price price={pass.price} cash={stats.cash} onClick={() => act('buyPass', { id })} wide />}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="section yellow" id="shop-speed">⚡ SPEED ⚡</h3>
      <div className="card double theme-yellow">
        <div className="card-art"><BoltArt size={110} /></div>
        <div className="card-info">
          <b className="card-name"><em>DOUBLE</em> Your Speed</b>
          <span className="speed-change">{formatNumber(stats.speed)} ▸ <em>{formatNumber(stats.speed * 2)}</em></span>
          <Price price={doubleSpeedPrice(stats.speed)} cash={stats.cash} onClick={() => act('doubleSpeed')} wide />
        </div>
      </div>
      <div className="grid3">
        {SPEED_PACKS.map((pack, i) => (
          <div key={pack.id} className="card small theme-blue">
            {pack.best && <span className="best">BEST OFFER!</span>}
            <ShoeArt size={78} count={i + 1} />
            <b className="amount"><em>+{formatNumber(pack.amount)}</em> SPEED</b>
            <Price price={pack.price} cash={stats.cash} onClick={() => act('buySpeed', { id: pack.id })} wide />
          </div>
        ))}
      </div>

      <h3 className="section red">-- POTIONS --</h3>
      <div className="grid3">
        {POTION_ORDER.map((id) => {
          const potion = POTIONS[id];
          const ms = left(meta, meta.boosts[id], now);
          return (
            <div key={id} className={`card small theme-${potion.theme}`}>
              <b className="card-name">{potion.name}</b>
              <PotionArt color={potion.color} size={70} />
              <small className="lasts">{ms > 0 ? <>Active: <b>{clock(ms)}</b></> : 'Lasts 15m'}</small>
              <Price price={potionPrice(id, income)} cash={stats.cash} onClick={() => act('buyPotion', { id })} wide />
            </div>
          );
        })}
        <div className="card small theme-gold">
          <span className="save">SAVE {Math.round(BUNDLE_SAVE * 100)}%</span>
          <b className="card-name">Potion Bundle</b>
          <div className="bundle-art">{POTION_ORDER.map((id) => <PotionArt key={id} color={POTIONS[id].color} size={34} />)}</div>
          <small className="lasts">+15m each</small>
          <Price price={bundlePrice(income)} cash={stats.cash} onClick={() => act('buyBundle')} wide />
        </div>
      </div>
      <p className="note">Potion prices follow your income, so they are always worth it.</p>
    </Popup>
  );
}

// ------------------------------------------------------------------ index

export function IndexPopup({ ui }) {
  const { meta, act } = ui;
  const [tab, setTab] = useState('areas');
  const [picked, setPicked] = useState(null); // { pet, area }
  if (!meta) return null;
  const areas = INDEX_AREAS.filter((a) => (tab === 'areas' ? !a.limited : a.limited));
  const allIds = [...new Set(INDEX_AREAS.flatMap(areaPets))];
  const total = allIds.length;
  const found = allIds.filter((id) => meta.discovered.includes(id)).length;
  const sel = picked && areas.some((a) => a.id === picked.area.id) ? picked : { pet: areaPets(areas[0])[0], area: areas[0] };
  const known = meta.discovered.includes(sel.pet);
  const areaIds = areaPets(sel.area);
  const areaFound = areaIds.filter((id) => meta.discovered.includes(id)).length;
  const complete = areaFound === areaIds.length;
  const claimed = meta.claimed.includes(sel.area.id);
  const rarity = PETS[sel.pet].rarity;
  return (
    <Popup title="Index" theme="purple" wide>
      <div className="index">
        <div className="index-tabs">
          <button type="button" className={tab === 'areas' ? 'on' : ''} onClick={() => setTab('areas')}>AREAS</button>
          <button type="button" className={tab === 'limited' ? 'on' : ''} onClick={() => setTab('limited')}>SHOP EGGS</button>
        </div>
        <div className="index-list">
          {areas.map((area) => {
            const ids = areaPets(area);
            const n = ids.filter((id) => meta.discovered.includes(id)).length;
            return (
              <div key={area.id} className="index-area">
                <div className="area-tile" style={{ background: `linear-gradient(160deg, ${area.colors[0]}, ${area.colors[1]})` }}>{area.name}</div>
                <div className="area-pets">
                  {ids.map((id) => {
                    const has = meta.discovered.includes(id);
                    return (
                      <button
                        key={id} type="button"
                        className={`index-pet${sel.pet === id && sel.area.id === area.id ? ' sel' : ''}`}
                        style={{ '--rar': RARITY_COLOR[PETS[id].rarity] }}
                        onClick={() => setPicked({ pet: id, area })}
                      >
                        <small>{has ? PETS[id].name : '???'}</small>
                        <PetPic id={id} size={64} hidden={!has} />
                      </button>
                    );
                  })}
                  <div className="area-bar"><i style={{ width: `${(n / ids.length) * 100}%` }} /><span>{n}/{ids.length}</span>{meta.claimed.includes(area.id) && <em>✓</em>}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="index-side">
          <div className="index-detail">
            <PetPic id={sel.pet} size={130} hidden={!known} />
            <b>{known ? PETS[sel.pet].name : '???'}</b>
            <span style={{ color: RARITY_COLOR[rarity] }}>{rarity}</span>
            <small>Size x{petSize({ id: sel.pet })} · from {sel.area.eggs.map((e) => EGGS[e].name).join(' / ')}</small>
          </div>
          <div className="index-reward">
            <b>Rewards: {sel.area.name}</b>
            <div className="reward-row">
              <div><ShoeArt size={44} /><span>+{formatNumber(sel.area.reward.speed)}</span></div>
              <div><CashArt size={44} /><span>${formatNumber(sel.area.reward.cash)}</span></div>
            </div>
            {claimed ? <div className="owned">CLAIMED</div> : (
              <button type="button" className={`buy wide${complete ? '' : ' poor'}`} disabled={!complete} onClick={() => act('claimIndex', { id: sel.area.id })}>
                {complete ? 'CLAIM!' : `${areaFound}/${areaIds.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="index-total"><BookArt size={40} /><span>Unlocked: {found}/{total}</span></div>
    </Popup>
  );
}

// ------------------------------------------------------------------ rebirth

export function RebirthPopup({ ui }) {
  const { meta, stats, act, allPets } = ui;
  if (!meta) return null;
  const r = meta.rebirths;
  const need = rebirthNeed(r);
  const area = areaById(need.area);
  const have = allPets.filter((p) => petFromArea(p, area)).length;
  const hasPet = have > 0;
  const hasCash = stats.cash >= need.cash;
  const padNow = meta.padCap;
  const padNext = padNow + (rebirthPadBonus(r + 1) - rebirthPadBonus(r));
  return (
    <Popup title={<><RebirthArt size={40} /> REBIRTH <em>{r} ➜ {r + 1}</em></>} theme="purple">
      <p className="rebirth-sub">Start again, but stronger: earn more cash and grow more eggs at once!</p>
      <div className="rebirth-up">
        <b>UPGRADES</b>
        <div className="reward-row big">
          <div><CashArt size={84} /><span>x{rebirthCashMult(r)} ➜ x{rebirthCashMult(r + 1)} CASH</span></div>
          <div><EggArt size={70} /><span>{padNow} ➜ {padNext} EGGS</span></div>
        </div>
      </div>
      <div className="rebirth-need">
        <div className={`need${hasPet ? ' met' : ''}`}><PawArt size={44} /><span>{Math.min(1, have)} / 1 {area.name.toUpperCase()} PET</span></div>
        <div className={`need${hasCash ? ' met' : ''}`}>
          <CashArt size={44} />
          <div className="need-bar"><i style={{ width: `${Math.min(1, stats.cash / need.cash) * 100}%` }} /><span>${formatNumber(Math.min(stats.cash, need.cash))} / ${formatNumber(need.cash)}</span></div>
        </div>
      </div>
      <button type="button" className={`rebirth-go${hasPet && hasCash ? '' : ' poor'}`} disabled={!hasPet || !hasCash} onClick={() => act('rebirth')}>
        REBIRTH!
        <small>You lose your cash + the required pet. Your treadmill, speed and other pets stay.</small>
      </button>
    </Popup>
  );
}

// ------------------------------------------------------------------ side panels

const growClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The eggs growing in your pen, with their timers.
export function EggsPanel({ ui }) {
  const { meta, stats, act, pen } = ui;
  if (!meta) return null;
  const growing = pen.filter((e) => e.left > 0).length;
  const price = growNowPrice(baseIncome(ui)) * growing;
  return (
    <div className="panel">
      <div className="panel-head red">
        <b>Growing Eggs</b>
        {growing > 0 && (
          <button type="button" className="buy" disabled={stats.cash < price} onClick={() => act('growNow')}>
            Grow now ${formatNumber(price)}
          </button>
        )}
      </div>
      <div className="panel-body">
        {pen.length ? pen.map((e, i) => (
          <div className="egg-row" key={i}>
            <EggArt size={56} color={EGG_COLOR[e.rarity]} spots={EGGS[e.type]?.color} />
            <div>
              <b style={{ color: RARITY_COLOR[e.rarity] }}>{eggName(e)}</b>
              <small>{EGGS[e.type]?.name.replace(/ Egg$/, '')} · {Number(e.kg).toFixed(1)} kg</small>
              <span>{e.left > 0 ? `Growing… ${growClock(e.left)}` : 'Ready! Hold E at your pen to hatch'}</span>
            </div>
          </div>
        )) : <p className="empty">No growing eggs! Steal one!</p>}
        <p className="pad-info">Egg slots: <b>{pen.length}/{meta.padCap}</b></p>
      </div>
    </div>
  );
}

export function PetsPanel({ ui }) {
  const { meta, stats, act, allPets } = ui;
  if (!meta) return null;
  const on = new Set(meta.equipped);
  const list = [...allPets].sort((a, b) => (on.has(b.uid) - on.has(a.uid)) || b.cash - a.cash);
  const price = slotPrice(meta.slots);
  return (
    <div className="panel">
      <div className="panel-head blue">
        <b>{meta.equipped.length}/{meta.slots} Active</b>
        {price !== null && meta.slots < SLOTS.max && (
          <button type="button" className="buy" disabled={stats.cash < price} onClick={() => act('buySlots')}>+{SLOTS.step} Equip [${formatNumber(price)}]</button>
        )}
      </div>
      <div className="panel-body list">
        {!list.length && <p className="empty">No pets yet! Hatch an egg.</p>}
        {list.map((pet) => {
          const def = PETS[pet.id];
          const equipped = on.has(pet.uid);
          return (
            <div key={pet.uid} className={`pet-row${equipped ? ' on' : ''}`}>
              <PetPic id={pet.id} size={52} />
              <div className="pet-row-text">
                <b style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</b>
                <small>(${formatNumber(pet.cash)}/s)</small>
              </div>
              <button type="button" className={equipped ? 'unequip' : 'equip'} onClick={() => act(equipped ? 'unequipPet' : 'equipPet', { uid: pet.uid })}>
                {equipped ? 'Unequip' : 'Equip'}
              </button>
            </div>
          );
        })}
      </div>
      {list.length > 0 && <button type="button" className="equip-best" onClick={() => act('equipBest')}>Equip Best</button>}
    </div>
  );
}

// ------------------------------------------------------------------ what came out of the featured eggs

export function OpenedReveal({ opened }) {
  const shown = opened.pets.slice(0, 24);
  return (
    <div className="pop-backdrop" onPointerDown={(e) => e.target === e.currentTarget && uiStore.set({ opened: null })}>
      <div className="opened">
        <h2>You hatched {opened.pets.length} pet{opened.pets.length > 1 ? 's' : ''}!</h2>
        <div className="opened-grid">
          {shown.map((pet, i) => (
            <div key={i} className="opened-pet" style={{ '--rar': RARITY_COLOR[PETS[pet.id].rarity], animationDelay: `${i * 0.06}s` }}>
              <PetPic id={pet.id} size={72} />
              <b>{PETS[pet.id].name}</b>
              <small>${formatNumber(pet.cash)}/s</small>
            </div>
          ))}
        </div>
        {opened.pets.length > shown.length && <p>+{opened.pets.length - shown.length} more in your pets</p>}
        <button type="button" className="buy wide" onClick={() => uiStore.set({ opened: null })}>Awesome!</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Starting Place shops (open on walking up)

// A row of big cards that scrolls sideways.
function CardRow({ children }) {
  return <div className="card-row" onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>{children}</div>;
}

const RARITY_THEME = { Common: 'white', Uncommon: 'lime', Rare: 'blue', Epic: 'purple', Legendary: 'red', Mythic: 'gold', Secret: 'grey', Celestial: 'pink' };
const rarityColor = (r) => RARITY_COLOR[r] || EXTRA_RARITY_COLOR[r] || '#fff';

function RunnerArt({ trail, size = 190 }) {
  const id = `tr-${trail.id}`;
  const stripes = trail.id === 'zebra';
  const [a, b] = [trail.colors[0], trail.colors[trail.colors.length - 1]];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {trail.colors.map((c, i) => <stop key={i} offset={i / Math.max(1, trail.colors.length - 1)} stopColor={c} />)}
        </linearGradient>
        <pattern id={`${id}-z`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="8" height="8" fill="#fff" /><rect width="4" height="8" fill="#14141a" />
        </pattern>
      </defs>
      <path d="M44 30 C26 16 10 22 4 14 C8 30 2 36 10 46 C4 50 6 60 16 62 C22 52 34 46 44 44 Z" fill={stripes ? `url(#${id}-z)` : `url(#${id})`} stroke="#14141a" strokeWidth="2" opacity="0.9" />
      <g fill={stripes ? `url(#${id}-z)` : `url(#${id})`} stroke="#14141a" strokeWidth="2.2" strokeLinejoin="round">
        <rect x="52" y="8" width="20" height="18" rx="2" transform="rotate(8 62 17)" />
        <rect x="44" y="28" width="22" height="26" rx="2" transform="rotate(14 55 41)" />
        <rect x="30" y="32" width="10" height="20" rx="2" transform="rotate(-50 35 42)" />
        <rect x="66" y="34" width="9" height="20" rx="2" transform="rotate(40 70 44)" />
        <rect x="38" y="54" width="11" height="26" rx="2" transform="rotate(35 43 67)" />
        <rect x="56" y="56" width="11" height="26" rx="2" transform="rotate(-20 61 69)" />
        <rect x="26" y="74" width="16" height="9" rx="2" transform="rotate(35 34 78)" />
        <rect x="58" y="80" width="16" height="9" rx="2" />
      </g>
      <path d="M56 12 L60 22" stroke="#fff" strokeWidth="2.4" opacity="0.7" strokeLinecap="round" />
      {!stripes && <circle cx="80" cy="18" r="2" fill={b} opacity="0.9" />}
      {!stripes && <circle cx="22" cy="30" r="1.6" fill={a} opacity="0.9" />}
    </svg>
  );
}

export function TrailsShopPopup({ ui }) {
  const { meta, stats, act } = ui;
  if (!meta) return null;
  return (
    <Popup title="Trails Shop" theme="sky" wide>
      <div className="shop-sub">Trails multiply all the speed you gain (treadmill and running) · ${formatNumber(stats.cash)}</div>
      <CardRow>
        {TRAILS.map((trail) => {
          const has = meta.trails.includes(trail.id);
          const on = meta.trail === trail.id;
          return (
            <div key={trail.id} className={`item-card theme-${RARITY_THEME[trail.rarity]}`}>
              <b className="item-name">{trail.name}</b>
              <span className="item-rarity" style={{ color: rarityColor(trail.rarity) }}>{trail.rarity}</span>
              <div className="item-art"><RunnerArt trail={trail} /></div>
              <div className="item-stat"><em>x{formatNumber(trail.mult)}</em> Speed</div>
              {on ? <button type="button" className="buy wide" onClick={() => act('equipTrail', { id: '' })}>Unequip</button>
                : has ? <button type="button" className="buy wide" onClick={() => act('equipTrail', { id: trail.id })}>Equip</button>
                  : <Price price={trail.price} cash={stats.cash} onClick={() => act('buyTrail', { id: trail.id })} wide />}
            </div>
          );
        })}
      </CardRow>
    </Popup>
  );
}

const SORTS = {
  Rarity: (a, b) => RARITIES.indexOf(PETS[b.id].rarity) - RARITIES.indexOf(PETS[a.id].rarity) || b.cash - a.cash,
  'Cash/s': (a, b) => b.cash - a.cash,
  Value: (a, b) => petSellValue(b) - petSellValue(a),
  Newest: (a, b) => b.uid - a.uid,
};

export function SellShopPopup({ ui }) {
  const { meta, act, allPets } = ui;
  const [sort, setSort] = useState('Rarity');
  const [picked, setPicked] = useState(() => new Set());
  if (!meta) return null;
  const locked = new Set(meta.locked);
  const equipped = new Set(meta.equipped);
  const pets = [...allPets].sort(SORTS[sort]);
  const chosen = pets.filter((p) => picked.has(p.uid) && !locked.has(p.uid));
  const total = chosen.reduce((sum, p) => sum + petSellValue(p), 0);
  const toggle = (uid) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });
  // everything that is not locked or equipped (equipped pets can still be picked one by one)
  const selectAll = () => setPicked(new Set(pets.filter((p) => !locked.has(p.uid) && !equipped.has(p.uid)).map((p) => p.uid)));
  const sell = () => {
    act('sellPets', { uids: chosen.map((p) => p.uid) });
    setPicked(new Set());
  };
  return (
    <div className="pop-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sell">
        <div className="sell-head">
          <h2>SELL SHOP</h2>
          <button type="button" className="pop-x small" onClick={close} aria-label="Close">X</button>
        </div>
        <div className="sell-sort">
          <b>SORT:</b>
          {Object.keys(SORTS).map((name) => (
            <button key={name} type="button" className={sort === name ? 'on' : ''} onClick={() => setSort(name)}>{name}</button>
          ))}
          <span className="sell-count">{pets.length}/{MAX_PETS} Pets</span>
        </div>
        <div className="sell-grid">
          {!pets.length && <p className="empty">No pets to sell yet!</p>}
          {pets.map((pet) => {
            const def = PETS[pet.id];
            const isLocked = locked.has(pet.uid);
            return (
              <div key={pet.uid} className={`sell-pet${picked.has(pet.uid) && !isLocked ? ' sel' : ''}${isLocked ? ' locked' : ''}`} onClick={() => !isLocked && toggle(pet.uid)}>
                <button type="button" className="lock" title={isLocked ? 'Unlock' : 'Lock (never sold)'} onClick={(e) => { e.stopPropagation(); act('lockPet', { uid: pet.uid }); }}>
                  {isLocked ? '🔒' : '🔓'}
                </button>
                {equipped.has(pet.uid) && <span className="eq">EQUIPPED</span>}
                <PetPic id={pet.id} size={86} />
                <b>{def.name}</b>
                <span className="rar" style={{ color: RARITY_COLOR[def.rarity] }}>{def.rarity.toUpperCase()}</span>
                <small>${formatNumber(pet.cash)}/s</small>
                <em>${formatNumber(petSellValue(pet))}</em>
              </div>
            );
          })}
        </div>
        <div className="sell-foot">
          <button type="button" className="sel-all" onClick={selectAll}>SELECT ALL</button>
          <div className="sell-total"><CashArt size={52} /><span>${formatNumber(total)}</span></div>
          <button type="button" className="sell-go" disabled={!chosen.length} onClick={sell}>SELL</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ invite friends (the Invite Friend pad)

export function InvitePopup({ ui }) {
  const friends = ui.friends || [];
  const [sent, setSent] = useState(() => new Set());
  const [copied, setCopied] = useState(false);
  const here = ui.meta?.friendsHere || 0;
  const invite = async (id) => {
    const ok = await bloxity.inviteFriend(id, ui.roomId);
    if (ok) setSent((s) => new Set(s).add(id));
    else uiStore.set({ toast: { text: 'Could not send the invite', color: '#ff5a5a', at: performance.now() } });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bloxity.inviteLink(ui.roomId));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const sorted = [...friends].sort((a, b) => b.online - a.online || a.name.localeCompare(b.name));
  return (
    <Popup title="Invite Friends" theme="lime">
      <div className="invite-boost">
        <CashArt size={64} />
        <div>
          <b>Each Friend = <em>+{Math.round(FRIEND_BOOST * 100)}%</em> Cash Boost</b>
          <span>Friends here now: <em>{here}</em> → <em>x{friendCashMult(here).toFixed(1)}</em> cash (up to {FRIEND_MAX} friends)</span>
        </div>
      </div>
      <div className="invite-list">
        {!bloxity.user ? (
          <div className="invite-signin">
            <p className="empty small">Sign in to Bloxity to see your friends and invite them!</p>
            <button type="button" className="buy" onClick={() => bloxity.login()}>Sign in</button>
          </div>
        ) : ui.friendsLoading && !sorted.length ? (
          <p className="empty small">Loading friends...</p>
        ) : !sorted.length ? (
          <p className="empty small">No Bloxity friends yet. Share the link below!</p>
        ) : null}
        {sorted.map((f) => (
          <div key={f.id} className="invite-row">
            {f.avatar ? <img src={f.avatar} alt="" width="48" height="48" /> : <span className="invite-face">{f.name[0]?.toUpperCase()}</span>}
            <div className="invite-name"><b>{f.name}</b><small className={f.online ? 'on' : ''}>{f.online ? 'Online' : 'Offline'}</small></div>
            <button type="button" className="buy" disabled={sent.has(f.id)} onClick={() => invite(f.id)}>{sent.has(f.id) ? 'Sent!' : 'Invite'}</button>
          </div>
        ))}
      </div>
      <button type="button" className="buy wide invite-link" onClick={copyLink}>{copied ? 'Link copied!' : 'Copy invite link'}</button>
    </Popup>
  );
}

// ------------------------------------------------------------------ offline cash (shown on joining)

function awayText(ms) {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function OfflinePopup({ ui }) {
  const { offline, stats, act } = ui;
  const claim = (triple) => {
    act('claimOffline', { triple });
    uiStore.set({ offline: null });
  };
  const canTriple = stats.cash >= offline.price;
  return (
    <div className="pop-backdrop">
      <div className="pop pop-lime offline">
        <div className="pop-head"><h2>Offline Cash</h2></div>
        <div className="pop-body offline-body">
          <b className="offline-title">You earned:</b>
          <small className="offline-away">Your pets worked for {awayText(offline.away)} while you were away</small>
          <div className="offline-cash">
            <div className="rays" />
            <CashArt size={230} />
            <span>${formatNumber(offline.amount)}</span>
          </div>
          <div className="offline-btns">
            <button type="button" className="claim" onClick={() => claim(false)}>Claim</button>
            <button type="button" className={`triple${canTriple ? '' : ' poor'}`} disabled={!canTriple} onClick={() => claim(true)}>
              <i>3x</i>
              <span>${formatNumber(offline.price)}</span>
              <small>{canTriple ? `pay it, get $${formatNumber(offline.amount * 3)}` : 'not enough cash'}</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
