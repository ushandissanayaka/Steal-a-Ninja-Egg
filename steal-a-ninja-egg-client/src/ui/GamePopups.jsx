// The main popups: Shop (Featured / Speed / Money), Pet Index, Daily Rewards, Your Pets, Weapon
// Index, the Special Offer, the gift picker and the "Are you sure?" box. Everything is live: it reads
// the player's cash, speed, pets and meta from the store, and every button sends an action to the
// server (act), which checks the price and answers.

import { useEffect, useRef, useState } from 'react';
import './gamepopups.css';
import { uiStore } from './store.js';
import { BIOMES, EGGS, EGG_COLOR, PETS, RARITIES, RARITY_COLOR, eggName, formatNumber, nextTreadmill, treadmillById } from '../shared/gameData.js';
import {
  DAILY, FEATURED_PACKS, INDEX_AREAS, MONEY_PACKS, PASSES, POTIONS, POTION_ORDER, BUNDLE_SAVE, SLOTS, SPEED_PACKS, STARTER_PACK, WEAPONS,
  areaPets, bundlePrice, doubleSpeedPrice, eggRates, featuredPrice, growNowPrice, indexPetReward, petSellValue, potionPrice, serverLuckPrice,
  slotPrice, weaponById,
} from '../shared/progression.js';
import { PetPic, baseIncome, clock, left, useNow } from './Popups.jsx';
import {
  CalendarArt, CashArt, ChestArt, ClockArt, CloverArt, CrateArt, CrownArt, EggArt, FastArt, GiftArt, LockArt, MoneyBagArt, PawArt, PotionArt,
  ShoeArt, StarArt, SwordArt, TreadmillArt, VaultArt, AxeArt,
} from './popupIcons.jsx';

const closePopup = () => uiStore.set({ popup: null });
const EGG_SPOTS = { dojo: '#7a4a26', garden: '#5fcf4a', fire: '#e0202e', storm: '#3aa8ff', earth: '#d8b030', energy: '#6aff3a', pumpkin: '#ff8a1a', candy: '#ff6ab0', haunted: '#5f7f34' };

// "x2 Money" -> a green "x2" and the rest in white
function Title({ text }) {
  const m = /^(x[\d.]+|\+\d+)\s(.*)$/.exec(text);
  return m ? <><em>{m[1]}</em> {m[2]}</> : text;
}

// The popup frame: a coloured header with the title and the close button, a dark tiled body.
// side: the tabs standing outside it on the left (the shop's Featured / Speed / Money).
function Frame({ title, theme = 'green', children, className = '', side = null, onClose = closePopup, bodyRef = null, onScroll = null }) {
  return (
    <div className="gp-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gp-wrap">
        {side}
        <div className={`gp gp-${theme} ${className}`}>
          <div className="gp-head">
            <h2>{title}</h2>
            <button type="button" className="gp-x" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="gp-body" ref={bodyRef} onScroll={onScroll}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// A green price button ($ cash, or ⚡ speed for the money packs); grey when you cannot afford it.
function Buy({ price, have, onClick, label = null, unit = '$', big = false }) {
  const poor = have < price;
  return (
    <button type="button" className={`gp-buy${poor ? ' poor' : ''}${big ? ' big' : ''}`} disabled={poor} onClick={onClick}>
      {label || (unit === '$' ? `$${formatNumber(price)}` : `⚡${formatNumber(price)}`)}
    </button>
  );
}

// The purple gift button next to a price: buy it for another player in this server.
function Gift({ kind, id, name }) {
  return (
    <button type="button" className="gp-gift" aria-label={`Gift ${name}`} onClick={() => uiStore.set({ giftFor: { kind, id, name } })}>
      <GiftArt size={26} />
    </button>
  );
}

// ------------------------------------------------------------------ shop

const SHOP_TABS = [
  { id: 'featured', label: 'Featured', art: <StarArt size={54} /> },
  { id: 'speed', label: 'Speed', art: <ShoeArt size={58} count={2} /> },
  { id: 'money', label: 'Money', art: <CashArt size={56} /> },
];

const PASS_LOOK = {
  cash2: { art: <CashArt size={130} />, text: <>Get <em>x2</em> Money!</>, theme: 'gold', title: 'x2 Money' },
  growth2: { art: <ClockArt size={86} />, text: <>Eggs Grow <em>x2</em> faster!</>, theme: 'rainbow' },
  tread2: { art: <ShoeArt size={86} count={2} />, text: <>Get <em>x2</em> Speed from every treadmill step!</>, theme: 'blue', title: 'x2 Speed' },
  luck2: { art: <PotionArt size={80} color="#ff4fa8" />, text: <>Your eggs hatch <em>x2</em> luckier: bigger pets!</>, theme: 'lime' },
  vip: { art: <CrownArt size={96} />, text: <>+25% Money and +25% Speed, forever!</>, theme: 'purple' },
  crate: { art: <CrateArt size={80} />, text: <>Grow <em>+1</em> egg at once!</>, theme: 'brown' },
  steal2: { art: <AxeArt size={80} spin head="#ffd85c" />, text: <>Steal eggs <em>x2</em> faster!</>, theme: 'orange' },
};

function PassCard({ id, meta, cash, act, tall = false }) {
  const pass = PASSES[id];
  const look = PASS_LOOK[id];
  const owned = meta.passes.includes(id);
  return (
    <div className={`gp-card burst theme-${look.theme}${tall ? ' tall' : ''}`}>
      <b className="gp-card-title"><Title text={look.title || pass.name} /></b>
      <div className="gp-card-art">{look.art}</div>
      <span className="gp-card-text">{look.text}</span>
      <div className="gp-price-row">
        <Gift kind="pass" id={id} name={look.title || pass.name} />
        {owned ? <div className="gp-owned">OWNED</div> : <Buy price={pass.price} have={cash} onClick={() => act('buyPass', { id })} />}
      </div>
    </div>
  );
}

export function ShopPopup({ ui }) {
  const now = useNow(1000);
  const body = useRef(null);
  const [tab, setTab] = useState('featured');
  const { meta, stats, act, pen } = ui;
  const jump = (id) => {
    const el = body.current?.querySelector(`#shop-${id}`);
    if (el) body.current.scrollTo({ top: el.offsetTop - 6, behavior: 'smooth' });
    setTab(id);
  };
  // opened from the speed "+": jump to the speed section
  useEffect(() => {
    if (!ui.shopSection || !body.current) return;
    jump(ui.shopSection);
    uiStore.set({ shopSection: null });
  }, [ui.shopSection]);
  if (!meta) return null;
  // the tab follows the scroll
  const onScroll = () => {
    const b = body.current;
    if (!b) return;
    let current = 'featured';
    for (const t of SHOP_TABS) {
      const el = b.querySelector(`#shop-${t.id}`);
      if (el && el.offsetTop - 40 <= b.scrollTop) current = t.id;
    }
    if (current !== tab) setTab(current);
  };
  const income = baseIncome(ui);
  const cash = stats.cash;
  const mill = treadmillById(stats.treadmill);
  const next = nextTreadmill(stats.treadmill);
  const luckMs = left(meta, meta.serverLuck, now);
  const growing = pen.filter((e) => e.left > 0).length;
  const growPrice = growNowPrice(income) * Math.max(1, growing);
  const featured = meta.featured;
  const fegg = EGGS[featured.type];
  const best = SPEED_PACKS.find((s) => s.best);
  const bestMoney = MONEY_PACKS.find((m) => m.best);
  const side = (
    <div className="gp-side">
      {SHOP_TABS.map((t) => (
        <button key={t.id} type="button" className={`gp-side-tab${tab === t.id ? ' on' : ''}`} onClick={() => jump(t.id)}>
          {t.art}<span>{t.label}</span>
        </button>
      ))}
    </div>
  );
  return (
    <Frame title="Shop" theme="green" className="shop2" side={side} bodyRef={body} onScroll={onScroll}>
      <h3 className="gp-section gold" id="shop-featured">-- FEATURED --</h3>
      <div className="gp-row3">
        <div className="gp-card burst theme-blue featured-pick">
          <b className="gp-card-title big"><em>DOUBLE</em> Your SPEED</b>
          <div className="gp-card-art"><ShoeArt size={120} count={2} /></div>
          <b className="gp-change">x1 ▶ <em>x2</em></b>
          <small className="gp-card-text">⚡{formatNumber(stats.speed)} ▶ ⚡{formatNumber(stats.speed * 2)}</small>
          <Buy price={doubleSpeedPrice(stats.speed)} have={cash} onClick={() => act('doubleSpeed')} />
        </div>
        <div className="gp-card burst theme-silver">
          <b className="gp-card-title big">ARENA</b>
          <div className="gp-card-art"><TreadmillArt size={130} color={next?.color || mill.color || '#35a8ff'} /></div>
          {next ? <>
            <span className="gp-card-text">{next.name}</span>
            <b className="gp-change small"><em>+{formatNumber(mill.gain)}</em> ▶ <em>+{formatNumber(next.gain)}</em> /step</b>
            <Buy price={next.price} have={cash} onClick={() => act('buyTreadmillShop')} />
          </> : <><span className="gp-card-text">{mill.name}</span><div className="gp-owned">MAX LEVEL!</div></>}
        </div>
        <div className="gp-card burst theme-green">
          <b className="gp-card-title big"><em>x2</em> SERVER LUCK</b>
          <div className="gp-card-art"><CloverArt size={118} /></div>
          <span className="gp-card-text">{luckMs > 0 ? <>Active: <b>{clock(luckMs)}</b>{meta.serverLuckBy ? ` (by ${meta.serverLuckBy})` : ''}</> : 'Rarer eggs for everyone, 15 min!'}</span>
          <Buy price={serverLuckPrice(income)} have={cash} onClick={() => act('buyServerLuck')} label={luckMs > 0 ? `+15 min $${formatNumber(serverLuckPrice(income))}` : null} />
        </div>
      </div>

      {!meta.starterPack && <StarterPackCard ui={ui} />}

      <div className="gp-wide theme-orange burst">
        <div className="gp-wide-art"><EggArt size={62} /><EggArt size={70} /><EggArt size={58} /></div>
        <div className="gp-wide-info">
          <b className="gp-wide-title">GROW ALL EGGS</b>
          <span>{growing ? `Every egg growing in your pen (${growing}) hatches right now!` : 'Every egg in your pen hatches right now!'}</span>
        </div>
        <Buy price={growPrice} have={growing ? cash : -1} onClick={() => act('growNow')} big />
      </div>

      <div className={`gp-wide gp-feat feat-${featured.type}`}>
        <div className="gp-wide-art"><EggArt size={86} color={fegg.color} spots={EGG_SPOTS[featured.type] || '#fff'} /></div>
        <div className="gp-wide-info">
          <b className="gp-wide-title">{fegg.name.toUpperCase()} <small>{clock(left(meta, featured.endsIn, now))}</small></b>
          <span>Limited time egg! Hatches right away.</span>
          <div className="gp-rates">
            {eggRates(featured.type).map(([id, pct]) => (
              <div key={id} className="gp-rate" style={{ '--rar': RARITY_COLOR[PETS[id].rarity] }}>
                <PetPic id={id} size={50} hidden={!meta.discovered.includes(id)} />
                <b>{pct}%</b>
              </div>
            ))}
          </div>
        </div>
        <div className="gp-packs">
          {[...FEATURED_PACKS].reverse().map((pack) => (
            <div key={pack.count}>
              <Buy price={featuredPrice(featured.type, pack.count)} have={cash} onClick={() => act('buyEggs', { count: pack.count })} />
              <small>{pack.count} Egg{pack.count > 1 ? 's' : ''}{pack.best ? ' · BEST' : ''}</small>
            </div>
          ))}
        </div>
      </div>

      <h3 className="gp-section gold">-- PASSES --</h3>
      <div className="gp-passes">
        <PassCard id="cash2" meta={meta} cash={cash} act={act} tall />
        <PassCard id="growth2" meta={meta} cash={cash} act={act} />
        <PassCard id="tread2" meta={meta} cash={cash} act={act} />
        <PassCard id="luck2" meta={meta} cash={cash} act={act} />
        <PassCard id="vip" meta={meta} cash={cash} act={act} />
      </div>
      <div className="gp-row2">
        <PassCard id="crate" meta={meta} cash={cash} act={act} />
        <PassCard id="steal2" meta={meta} cash={cash} act={act} />
      </div>

      <h3 className="gp-section pink">-- POTIONS --</h3>
      <div className="gp-potions">
        {POTION_ORDER.map((id) => {
          const potion = POTIONS[id];
          const ms = left(meta, meta.boosts[id], now);
          return (
            <div key={id} className={`gp-card small burst theme-${potion.theme}`}>
              <b className="gp-card-title"><Title text={potion.name} /></b>
              <PotionArt color={potion.color} size={58} />
              <small className="gp-card-text">{ms > 0 ? <>Active: <b>{clock(ms)}</b></> : 'Lasts 15 min'}</small>
              <Buy price={potionPrice(id, income)} have={cash} onClick={() => act('buyPotion', { id })} />
            </div>
          );
        })}
        <div className="gp-card small burst theme-gold">
          <span className="gp-save">SAVE {Math.round(BUNDLE_SAVE * 100)}%</span>
          <b className="gp-card-title">All Potions</b>
          <div className="gp-bundle">{POTION_ORDER.map((id) => <PotionArt key={id} color={POTIONS[id].color} size={26} />)}</div>
          <small className="gp-card-text">+15 min each</small>
          <Buy price={bundlePrice(income)} have={cash} onClick={() => act('buyBundle')} />
        </div>
      </div>

      <h3 className="gp-section blue" id="shop-speed">-- SPEED --</h3>
      <div className="gp-packs-grid">
        <div className="gp-card burst theme-blue tall best-card">
          <span className="gp-ribbon">BEST VALUE!</span>
          <b className="gp-card-title huge"><em className="gold">+{formatNumber(best.amount)}</em> SPEED</b>
          <div className="gp-card-art"><ChestArt size={150} /></div>
          <div className="gp-price-row">
            <Gift kind="speed" id={best.id} name={`+${formatNumber(best.amount)} Speed`} />
            <Buy price={best.price} have={cash} onClick={() => act('buySpeed', { id: best.id })} />
          </div>
        </div>
        {SPEED_PACKS.filter((s) => !s.best).map((pack, i) => (
          <div key={pack.id} className="gp-card burst theme-blue pack">
            <b className="gp-card-title gold">+{formatNumber(pack.amount)}</b>
            <ShoeArt size={78} count={i + 1} />
            <b className="gp-card-label">SPEED</b>
            <div className="gp-price-row">
              <Gift kind="speed" id={pack.id} name={`+${formatNumber(pack.amount)} Speed`} />
              <Buy price={pack.price} have={cash} onClick={() => act('buySpeed', { id: pack.id })} />
            </div>
          </div>
        ))}
      </div>

      <h3 className="gp-section green" id="shop-money">-- MONEY --</h3>
      <p className="gp-note">Trade some of your speed for cash.</p>
      <div className="gp-packs-grid">
        <div className="gp-card burst theme-green tall best-card">
          <span className="gp-ribbon">BEST VALUE!</span>
          <b className="gp-card-title huge"><em>${formatNumber(bestMoney.cash)}</em> CASH</b>
          <div className="gp-card-art"><VaultArt size={150} /></div>
          <Buy price={bestMoney.speed} have={stats.speed} unit="⚡" onClick={() => act('buyMoney', { id: bestMoney.id })} />
        </div>
        {MONEY_PACKS.filter((m) => !m.best).map((pack, i) => (
          <div key={pack.id} className="gp-card burst theme-green pack">
            <b className="gp-card-title green">${formatNumber(pack.cash)}</b>
            {[<CashArt key="a" size={74} />, <CashArt key="b" size={84} />, <MoneyBagArt key="c" size={78} />, <VaultArt key="d" size={78} />][i]}
            <b className="gp-card-label">CASH</b>
            <Buy price={pack.speed} have={stats.speed} unit="⚡" onClick={() => act('buyMoney', { id: pack.id })} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

function StarterPackCard({ ui }) {
  const { stats, act } = ui;
  return (
    <div className="gp-wide theme-purple burst rainbow-edge starter">
      <div className="gp-wide-art"><EggArt size={96} color={EGG_COLOR.Secret} spots="#ff4fd8" /></div>
      <div className="gp-wide-info">
        <b className="gp-wide-title gold">STARTER PACK</b>
        <ul className="gp-perks">
          <li><EggArt size={18} color={EGG_COLOR.Secret} /> <em className="purple">Secret Egg</em> (hatches now)</li>
          <li>⚡ <em className="gold">+{formatNumber(STARTER_PACK.speed)}</em> Speed</li>
          <li>💵 <em>+${formatNumber(STARTER_PACK.cash)}</em> Cash</li>
          <li><FastArt size={18} /> <em className="purple">{STARTER_PACK.hatches}</em> Instant Hatches</li>
        </ul>
      </div>
      <div className="gp-wide-buy">
        <span className="gp-once">ONE TIME ONLY!</span>
        <Buy price={STARTER_PACK.price} have={stats.cash} onClick={() => act('buyStarter')} big />
      </div>
    </div>
  );
}

// Shown once after joining, while the Starter Pack has not been bought.
export function SpecialOfferPopup({ ui }) {
  if (!ui.meta || ui.meta.starterPack) return null;
  return (
    <Frame title="Special Offer!" theme="purple" className="offer">
      <StarterPackCard ui={ui} />
    </Frame>
  );
}

// ------------------------------------------------------------------ pet index

export function PetIndexPopup({ ui }) {
  const { meta, act } = ui;
  const [picked, setPicked] = useState(null);
  if (!meta) return null;
  const has = (id) => meta.discovered.includes(id);
  const claimed = (id) => (meta.claimedPets || []).includes(id);
  const ready = meta.discovered.filter((id) => PETS[id] && !claimed(id));
  const sel = picked || meta.discovered.find((id) => PETS[id]) || areaPets(INDEX_AREAS[0])[0];
  const def = PETS[sel];
  const known = has(sel);
  const reward = indexPetReward(sel);
  const biome = BIOMES.find((b) => b.id === def.biome);
  return (
    <Frame title="Pet Index" theme="blue" className="pet-index">
      <div className="pi">
        <div className="pi-left">
          <div className="pi-list">
            {INDEX_AREAS.map((area) => {
              const ids = areaPets(area);
              const n = ids.filter(has).length;
              const guardian = BIOMES.find((b) => b.id === area.id)?.guardian;
              return (
                <div key={area.id} className="pi-area">
                  <div className="pi-tile" style={{ background: `linear-gradient(170deg, ${area.colors[0]}, ${area.colors[1]})` }}>
                    <b>{area.name}</b>
                    {guardian && <PetPic id={guardian} size={86} />}
                  </div>
                  <div className="pi-grid-wrap">
                    <div className="pi-grid">
                      {ids.map((id) => (
                        <button key={id} type="button" className={`pi-pet rar-${PETS[id].rarity}${sel === id ? ' sel' : ''}`} onClick={() => setPicked(id)}>
                          <small>{has(id) ? PETS[id].name : '???'}</small>
                          <PetPic id={id} size={70} hidden={!has(id)} />
                          {has(id) && !claimed(id) && <i className="dot">!</i>}
                        </button>
                      ))}
                    </div>
                    <div className="pi-bar"><i className="pi-bar-fill" style={{ width: `${(n / ids.length) * 100}%` }} /><span>{n}/{ids.length}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className={`pi-claim-all${ready.length ? '' : ' done'}`} disabled={!ready.length} onClick={() => act('claimIndexAll')}>
            <span className="pi-book">📗</span>{ready.length ? `CLAIM ALL (${ready.length})!` : 'ALL CLAIMED!'}
          </button>
        </div>
        <div className="pi-side">
          <div className="pi-detail">
            <PetPic id={sel} size={150} hidden={!known} />
            <b>{known ? def.name : '???'}</b>
            <span style={{ color: RARITY_COLOR[def.rarity] }}>{def.rarity}</span>
            <em>${formatNumber(Math.round((biome?.cash || 1) * def.mult))}/s</em>
          </div>
          <div className="pi-reward">
            <b>Rewards:</b>
            <div className="pi-reward-row">
              <div><CashArt size={44} /><span>${formatNumber(reward.cash)}</span></div>
              <div><ShoeArt size={44} /><span>+{formatNumber(reward.speed)}</span></div>
            </div>
            {claimed(sel) ? <div className="gp-owned">CLAIMED!</div>
              : known ? <button type="button" className="gp-buy" onClick={() => act('claimIndexPet', { id: sel })}>CLAIM!</button>
                : <div className="gp-owned locked">FIND IT FIRST</div>}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ daily rewards

function DailyArt({ reward }) {
  return (
    <div className="dr-art">
      {reward.cash && <CashArt size={reward.egg || reward.speed ? 38 : 54} />}
      {reward.speed && <ShoeArt size={reward.egg || reward.cash ? 38 : 56} />}
      {reward.egg && <EggArt size={reward.cash && reward.speed ? 30 : 38} color={EGG_COLOR[reward.egg]} />}
    </div>
  );
}

export function DailyPopup({ ui }) {
  const now = useNow(1000);
  const { meta, act } = ui;
  if (!meta?.daily) return null;
  const d = meta.daily;
  const msLeft = left(meta, d.msLeft, now);
  const ready = d.ready || msLeft <= 0;
  // after midnight while the popup is open: the next day is claimable (the server checks)
  const todayIndex = d.claimedToday && msLeft <= 0 ? (d.index + 1) % DAILY.length : d.index;
  return (
    <Frame title="Daily Rewards" theme="orange" className="daily">
      <p className="dr-sub">{ready ? 'Your daily reward is ready! Come back every day for bigger rewards.' : 'Come back tomorrow for a bigger reward! Miss a day and you start again at Day 1.'}</p>
      <div className="dr-days">
        {DAILY.map((reward, i) => {
          const done = i < todayIndex || (i === todayIndex && d.claimedToday && !ready);
          const today = i === todayIndex && ready;
          return (
            <div key={i} className={`dr-day${done ? ' done' : ''}${today ? ' today' : ''}${i === DAILY.length - 1 ? ' last' : ''}`}>
              <b className="dr-title">DAY {i + 1}</b>
              <DailyArt reward={reward} />
              {done && <span className="dr-check">✓</span>}
              <div className="dr-values">
                {reward.cash && <span className="cash">${formatNumber(reward.cash)}</span>}
                {reward.speed && <span className="speed">+{formatNumber(reward.speed)} ⚡</span>}
                {reward.egg && <span className="egg" style={{ color: RARITY_COLOR[reward.egg] }}>{reward.egg.toUpperCase()} EGG</span>}
              </div>
              <small className="dr-state">{done ? 'CLAIMED' : today ? 'TODAY!' : ''}</small>
            </div>
          );
        })}
      </div>
      <button type="button" className={`dr-claim${ready ? '' : ' wait'}`} disabled={!ready} onClick={() => act('claimDaily')}>
        {ready ? `CLAIM DAY ${todayIndex + 1}!` : `Next reward in ${clock(msLeft)}`}
      </button>
    </Frame>
  );
}

// ------------------------------------------------------------------ your pets

const sellLimit = RARITIES.indexOf('Epic');

export function YourPetsPopup({ ui }) {
  const { meta, stats, act, allPets, pen } = ui;
  const [tab, setTab] = useState('pets');
  if (!meta) return null;
  const on = new Set(meta.equipped);
  const locked = new Set(meta.locked || []);
  const list = [...allPets].sort((a, b) => (on.has(b.uid) - on.has(a.uid)) || b.cash - a.cash);
  const cheap = allPets.filter((p) => !on.has(p.uid) && !locked.has(p.uid) && RARITIES.indexOf(p.rarity || 'Common') <= sellLimit);
  const cheapValue = cheap.reduce((sum, p) => sum + petSellValue(p), 0);
  const slot = slotPrice(meta.slots);
  const confirm = (title, text, yes, onYes) => uiStore.set({ confirm: { title, text, yes, onYes } });
  const growing = pen.filter((e) => e.left > 0).length;
  const growPrice = growNowPrice(baseIncome(ui)) * growing;
  return (
    <Frame title="Your Pets" theme="orange" className="your-pets">
      <div className="yp-bar">
        <button type="button" className={`yp-tab${tab === 'pets' ? ' on' : ''}`} onClick={() => setTab('pets')}>PETS</button>
        <button type="button" className={`yp-tab${tab === 'eggs' ? ' on' : ''}`} onClick={() => setTab('eggs')}>
          EGGS{pen.some((e) => e.left <= 0) && <i className="dot">!</i>}
        </button>
        <span className="yp-info">{tab === 'pets' ? `${allPets.length} pets · pen ${meta.equipped.length}/${meta.slots} slots` : `${pen.length}/${meta.padCap} eggs growing`}</span>
        {tab === 'pets' ? <>
          {slot !== null && meta.slots < SLOTS.max && <button type="button" className="yp-btn blue" disabled={stats.cash < slot} onClick={() => act('buySlots')}>+{SLOTS.step} SLOTS ${formatNumber(slot)}</button>}
          <button type="button" className="yp-btn green" disabled={!allPets.length} onClick={() => act('equipBest')}>EQUIP BEST</button>
          <button type="button" className="yp-btn red" disabled={!cheap.length}
            onClick={() => confirm('Are you sure?', `Sell ${cheap.length} pet${cheap.length > 1 ? 's' : ''} (Epic and below, not in your pen) for $${formatNumber(cheapValue)}?`, 'SELL', () => act('sellPets', { uids: cheap.map((p) => p.uid) }))}
          >SELL ≤ EPIC</button>
        </> : (
          <button type="button" className="yp-btn green" disabled={!growing || stats.cash < growPrice} onClick={() => act('growNow')}>GROW ALL ${formatNumber(growPrice)}</button>
        )}
      </div>
      {tab === 'pets' ? (
        <div className="yp-grid">
          {!list.length && <p className="gp-empty">No pets yet! Steal an egg and hatch it.</p>}
          {list.map((pet) => {
            const def = PETS[pet.id];
            const inPen = on.has(pet.uid);
            const lock = locked.has(pet.uid);
            const value = petSellValue(pet);
            return (
              <div key={pet.uid} className={`yp-pet${inPen ? ' in' : ''}`}>
                <div className="yp-pic">
                  <PetPic id={pet.id} size={110} />
                  {inPen && <span className="yp-badge">IN PEN</span>}
                  <button type="button" className={`yp-lock${lock ? ' on' : ''}`} onClick={() => act('lockPet', { uid: pet.uid })} aria-label={lock ? 'Unlock' : 'Lock'}><LockArt size={18} /></button>
                </div>
                <b>{def.name}</b>
                <small><span style={{ color: RARITY_COLOR[pet.rarity || def.rarity] }}>{pet.rarity || def.rarity}</span> · {Number(pet.kg || 1).toFixed(1)} kg</small>
                <em>${formatNumber(pet.cash)}/s</em>
                <div className="yp-actions">
                  <button type="button" className={inPen ? 'grey' : 'green'} onClick={() => act(inPen ? 'unequipPet' : 'equipPet', { uid: pet.uid })}>{inPen ? 'STORE' : 'EQUIP'}</button>
                  <button type="button" className="red" disabled={lock}
                    onClick={() => confirm('Are you sure?', `Sell your ${def.name} for $${formatNumber(value)}?`, 'SELL', () => act('sellPets', { uids: [pet.uid] }))}
                  >SELL</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="yp-eggs">
          {!pen.length && <p className="gp-empty">No eggs growing! Steal one from a nest and walk it into your pen.</p>}
          {pen.map((e, i) => {
            const ms = e.left;
            return (
              <div key={i} className="yp-egg">
                <EggArt size={64} color={EGG_COLOR[e.rarity]} spots={EGGS[e.type]?.color} />
                <b style={{ color: RARITY_COLOR[e.rarity] }}>{eggName(e)}</b>
                <small>{EGGS[e.type]?.name.replace(/ Egg$/, '')} · {Number(e.kg).toFixed(1)} kg</small>
                <em>{ms > 0 ? `Growing… ${clock(ms)}` : 'Ready! Hatch it at your pen'}</em>
                {ms > 0 && meta.instantHatches > 0 && (
                  <button type="button" className="yp-instant" onClick={() => act('instantHatch', { i })}><FastArt size={16} /> INSTANT ({meta.instantHatches})</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ weapon index

export function WeaponIndexPopup({ ui }) {
  const { meta, stats, act } = ui;
  const [picked, setPicked] = useState(null);
  if (!meta) return null;
  const owned = new Set(meta.weapons || ['bat']);
  const sel = weaponById(picked || meta.weapon || 'bat');
  const i = WEAPONS.indexOf(sel);
  const prev = WEAPONS[i - 1];
  const canBuy = i === 0 || owned.has(prev.id);
  return (
    <Frame title="Weapon Index" theme="purple" className="weapons">
      <div className="wi">
        <div className="wi-grid">
          {WEAPONS.map((w, n) => {
            const has = owned.has(w.id);
            return (
              <button key={w.id} type="button" className={`wi-card${sel.id === w.id ? ' sel' : ''}${meta.weapon === w.id ? ' equipped' : ''}`} style={{ '--bg': w.bg }} onClick={() => setPicked(w.id)}>
                <small>{w.name}</small>
                <PetPic id={`weapon:${w.id}`} size={96} hidden={!has} />
                {n > 0 && <i className="wi-num">#{n}</i>}
                {!has && <span className="wi-lock"><LockArt size={24} /></span>}
              </button>
            );
          })}
        </div>
        <div className="wi-side">
          <PetPic id={`weapon:${sel.id}`} size={150} hidden={!owned.has(sel.id)} />
          <b className="wi-name">{sel.name}</b>
          <small>{i === 0 ? 'Starter weapon' : `Weapon #${i}`}</small>
          <span className="wi-stat"><SwordArt size={22} /> Dazes guardians <b>{sel.stun}s</b></span>
          {sel.reach > 0 && <span className="wi-stat small">+{sel.reach} reach</span>}
          {owned.has(sel.id) ? <>
            <b className="wi-unlocked">Unlocked!</b>
            {meta.weapon === sel.id
              ? <div className="gp-owned">EQUIPPED</div>
              : <button type="button" className="gp-buy" onClick={() => act('equipWeapon', { id: sel.id })}>EQUIP</button>}
          </> : canBuy ? <>
            <b className="wi-locked">Locked</b>
            <Buy price={sel.price} have={stats.cash} onClick={() => act('buyWeapon', { id: sel.id })} label={`UNLOCK $${formatNumber(sel.price)}`} />
          </> : <>
            <b className="wi-locked">Locked</b>
            <div className="gp-owned locked">Unlock #{i - 1} first</div>
          </>}
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ gift picker and "are you sure?"

export function GiftPicker({ ui }) {
  const gift = ui.giftFor;
  if (!gift) return null;
  const close = () => uiStore.set({ giftFor: null });
  return (
    <Frame title="Send a Gift" theme="purple" className="gift-pick" onClose={close}>
      <p className="gp-note">Buy <b>{gift.name}</b> for someone in this server. You pay; they get it.</p>
      {!ui.others.length && <p className="gp-empty">Nobody else is in this server right now.</p>}
      <div className="gift-list">
        {ui.others.map((o) => (
          <button key={o.sid} type="button" className="gift-player" onClick={() => { ui.act('gift', { kind: gift.kind, id: gift.id, to: o.sid }); close(); }}>
            <GiftArt size={30} /><span>{o.name}</span>
          </button>
        ))}
      </div>
    </Frame>
  );
}

export function ConfirmBox({ confirm }) {
  if (!confirm) return null;
  const close = () => uiStore.set({ confirm: null });
  return (
    <div className="gp-backdrop confirm-back" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="gp-confirm">
        <b>{confirm.title}</b>
        <p>{confirm.text}</p>
        <div>
          <button type="button" className="red" onClick={() => { confirm.onYes(); close(); }}>{confirm.yes}</button>
          <button type="button" className="grey" onClick={close}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// the HUD's icons for these popups
export { CalendarArt, PawArt, SwordArt };
