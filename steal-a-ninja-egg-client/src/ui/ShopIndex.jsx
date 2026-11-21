// The Shop, the Ninja Index and the right-hand Eggs / Active panels, laid out like the reference
// video. Everything is bought with in-game cash (money packs with speed): each button sends an
// action to the server (act), which checks the price and answers with a notice.

import { useEffect, useRef, useState } from 'react';
import './shopindex.css';
import './responsive.css'; // every screen size (loaded last)
import { uiStore } from './store.js';
import { BIOMES, EGGS, EGG_COLOR, PETS, RARITY_COLOR, eggName, formatNumber } from '../shared/gameData.js';
import {
  FEATURED_PACKS, INDEX_AREAS, MONEY_PACKS, PASSES, POTIONS, SHOP_POTIONS, SLOTS, SPEED_PACKS, STARTER_PACK,
  areaPets, doubleSpeedPrice, eggRates, featuredPrice, indexPetReward, instantHatchPrice, potionPrice, slotPrice, spinById,
} from '../shared/progression.js';
import { PetPic, baseIncome, clock, left, useNow } from './Popups.jsx';
import {
  BlockEggArt, CashStackArt, CoinArt, DragonEggArt, FlaskArt, GiftBoxArt, IndexBookArt, NinjaFaceArt, NinjaPowerArt, PriceCoin,
  SaleTagArt, StopwatchArt, TempleScene, WhirlArt,
} from './shopArt.jsx';

const closePopup = () => uiStore.set({ popup: null });

// ------------------------------------------------------------------ small parts

// The green price button: a white coin and the price ($ cash, or speed for the money packs).
// Greyed out when you cannot afford it.
function Price({ price, have, onClick, unit = 'cash', label = null, className = '' }) {
  const poor = have < price;
  return (
    <button type="button" className={`sx-price${poor ? ' poor' : ''} ${className}`} disabled={poor} onClick={onClick}>
      <PriceCoin kind={unit} size={26} />
      <span>{label || (unit === 'cash' ? `$${formatNumber(price)}` : formatNumber(price))}</span>
    </button>
  );
}

// The purple gift button: buy it for someone else in this server.
function Gift({ kind, id, name }) {
  return (
    <button type="button" className="sx-gift" aria-label={`Gift ${name}`} onClick={() => uiStore.set({ giftFor: { kind, id: String(id), name } })}>
      <GiftBoxArt size={30} />
    </button>
  );
}

function Owned({ text = 'OWNED' }) {
  return <div className="sx-owned">{text}</div>;
}

// ------------------------------------------------------------------ the shop

const TABS = [
  { id: 'featured', label: 'Featured', art: <SaleTagArt size={58} /> },
  { id: 'spin', label: 'Spin', art: <WhirlArt size={58} /> },
  { id: 'money', label: 'Money', art: <CashStackArt size={58} stacks={2} /> },
  { id: 'potions', label: 'Potions', art: <WhirlArt size={58} /> },
];

export function ShopPopup({ ui }) {
  const now = useNow(1000);
  const body = useRef(null);
  const [tab, setTab] = useState('featured');
  const jump = (id) => {
    const el = body.current?.querySelector(`#sx-${id}`);
    if (el) body.current.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' });
    setTab(id);
  };
  // the HUD's speed "+" opens the shop on the speed packs
  useEffect(() => {
    if (!ui.shopSection || !body.current) return;
    jump(ui.shopSection === 'speed' ? 'spin' : ui.shopSection);
    uiStore.set({ shopSection: null });
  }, [ui.shopSection]);
  const { meta, stats, act } = ui;
  if (!meta) return null;
  const onScroll = () => {
    const b = body.current;
    if (!b) return;
    let current = 'featured';
    for (const t of TABS) {
      const el = b.querySelector(`#sx-${t.id}`);
      if (el && el.offsetTop - 60 <= b.scrollTop) current = t.id;
    }
    if (current !== tab) setTab(current);
  };
  const cash = stats.cash;
  const income = baseIncome(ui);
  return (
    <div className="sx-backdrop" onPointerDown={(e) => e.target === e.currentTarget && closePopup()}>
      <div className="sx-wrap">
        <div className="sx-frame sx-shop">
          <div className="sx-head"><h2>Shop</h2><button type="button" className="sx-x" onClick={closePopup} aria-label="Close">X</button></div>
          <div className="sx-body" ref={body} onScroll={onScroll}>
            <h3 className="sx-section gold" id="sx-featured">~ Featured ~</h3>
            <StarterPack meta={meta} cash={cash} act={act} />
            <FeaturedEgg meta={meta} cash={cash} act={act} now={now} />

            <h3 className="sx-section green">~ Game Passes ~</h3>
            <div className="sx-row2">
              <PassCard id="growth2" theme="rainbow" art={<StopwatchArt size={120} />} title={<><em>x2</em> Growth</>} text={<>Eggs Grow <em>x2</em><br />faster!</>} meta={meta} cash={cash} act={act} />
              <PassCard id="cash2" theme="gold" art={<CoinArt size={120} />} title={<><em>x2</em> Money</>} text={<>Get <em>x2</em><br />Money!</>} meta={meta} cash={cash} act={act} />
            </div>
            <GoldSpinCard meta={meta} cash={cash} act={act} />

            <h3 className="sx-section cyan" id="sx-spin">~ Spin ~</h3>
            <div className="sx-wide sx-burst theme-yellow sx-double">
              <div className="sx-wide-art"><WhirlArt size={150} /></div>
              <div className="sx-wide-info">
                <b className="sx-title"><em>DOUBLE</em> Your Spin Speed</b>
                <b className="sx-change">x1 <i>▸</i> <em>x2</em></b>
                <small className="sx-sub">{formatNumber(stats.speed)} ▸ {formatNumber(stats.speed * 2)} Speed</small>
                <div className="sx-buyrow">
                  <Price price={doubleSpeedPrice(stats.speed)} have={cash} onClick={() => act('doubleSpeed')} className="wide" />
                </div>
              </div>
            </div>
            <div className="sx-grid3">
              {SPEED_PACKS.slice(0, 3).map((pack, i) => <SpeedCard key={pack.id} pack={pack} count={i + 1} cash={cash} act={act} />)}
            </div>
            <div className="sx-grid2">
              {SPEED_PACKS.slice(3).map((pack, i) => <SpeedCard key={pack.id} pack={pack} count={i + 4} cash={cash} act={act} big />)}
            </div>

            <h3 className="sx-section green" id="sx-money">~ Money ~</h3>
            <p className="sx-note">Trade some of your speed for cash.</p>
            <div className="sx-grid3">
              {MONEY_PACKS.slice(0, 3).map((pack, i) => <MoneyCard key={pack.id} pack={pack} stacks={i + 1} speed={stats.speed} act={act} />)}
            </div>
            <div className="sx-grid2">
              {MONEY_PACKS.slice(3).map((pack, i) => <MoneyCard key={pack.id} pack={pack} stacks={i + 5} speed={stats.speed} act={act} big />)}
            </div>

            <h3 className="sx-section red" id="sx-potions">~ Potions ~</h3>
            <div className="sx-grid3">
              {SHOP_POTIONS.map((id) => {
                const potion = POTIONS[id];
                const look = POTION_LOOK[id];
                const ms = left(meta, meta.boosts[id], now);
                const [mult, ...rest] = potion.name.split(' ');
                return (
                  <div key={id} className={`sx-card sx-burst theme-${look.theme} sx-potion`}>
                    <span className="sx-pill">{ms > 0 ? <>Active <em>{clock(ms)}</em></> : <>Lasts <em className="gold">15m</em></>}</span>
                    <FlaskArt size={130} color={look.color} symbol={look.symbol} />
                    <b className="sx-mult">{mult}</b>
                    <b className="sx-name">{rest.join(' ')}</b>
                    <div className="sx-buyrow">
                      <Gift kind="potion" id={id} name={`${potion.name} potion`} />
                      <Price price={potionPrice(id, income)} have={cash} onClick={() => act('buyPotion', { id })} />
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="sx-section purple">~ Community Rewards ~</h3>
            <CommunityCard meta={meta} act={act} />
          </div>
        </div>
        <div className="sx-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`sx-tab${tab === t.id ? ' on' : ''}`} onClick={() => jump(t.id)}>
              {t.art}<span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const POTION_LOOK = {
  walk: { theme: 'blue', color: '#35a8ff', symbol: 'whirl' },
  cash: { theme: 'green', color: '#3fcf4b', symbol: 'cash' },
  treadmill: { theme: 'red', color: '#ff3a3a', symbol: 'bolt' },
};

// Shown once after joining, while the Starter Pack has not been bought: the shop's own banner.
export function SpecialOfferPopup({ ui }) {
  if (!ui.meta || ui.meta.starterPack) return null;
  return (
    <div className="sx-backdrop" onPointerDown={(e) => e.target === e.currentTarget && closePopup()}>
      <div className="sx-wrap">
        <div className="sx-frame sx-shop sx-offer">
          <div className="sx-head"><h2>Special Offer!</h2><button type="button" className="sx-x" onClick={closePopup} aria-label="Close">X</button></div>
          <div className="sx-body"><StarterPack meta={ui.meta} cash={ui.stats.cash} act={ui.act} /></div>
        </div>
      </div>
    </div>
  );
}

function StarterPack({ meta, cash, act }) {
  const best = spinById(STARTER_PACK.spins[0]);
  const second = spinById(STARTER_PACK.spins[1]);
  const eggs = STARTER_PACK.eggs.reduce((n, [, c]) => n + c, 0);
  const items = [
    [<DragonEggArt key="e" size={62} color={EGG_COLOR.Legendary} />, `${eggs} Ninja Eggs`],
    [<WhirlArt key="w" size={70} tone="ice" />, best.name],
    [<span key="h" className="sx-bolt">⚡</span>, `${STARTER_PACK.hatches} Instant Hatches`],
    [<WhirlArt key="f" size={70} tone="gold" />, second.name],
    [<CashStackArt key="c" size={70} stacks={2} />, `$${formatNumber(STARTER_PACK.cash)} + ${formatNumber(STARTER_PACK.speed)} Speed`],
  ];
  return (
    <div className="sx-banner sx-starter">
      <TempleScene sky={['#14204a', '#5a2a5a']} ground="#4a1410" />
      <div className="sx-banner-left">
        <span className="sx-tag">ONE TIME!</span>
        <b className="sx-big gold">STARTER PACK</b>
        <span className="sx-sub">Everything a new ninja needs!</span>
        <div className="sx-buyrow">
          {meta.starterPack ? <Owned /> : <>
            <Gift kind="starter" id="starter" name="the Starter Pack" />
            <Price price={STARTER_PACK.price} have={cash} onClick={() => act('buyStarter')} className="big" />
            <s className="sx-was">${formatNumber(STARTER_PACK.was)}</s>
          </>}
        </div>
      </div>
      <div className="sx-banner-right">
        <div className="sx-items">
          {items.map(([art, label], i) => <div key={i} className="sx-item">{art}<small>{label}</small></div>)}
        </div>
        <b className="sx-eggline">
          {STARTER_PACK.eggs.map(([rarity, n], i) => (
            <span key={rarity}>{i > 0 && ' + '}{n} <span style={{ color: RARITY_COLOR[rarity] }}>{rarity}</span></span>
          ))} Eggs
        </b>
        <small className="sx-sub">From the furthest stage you have reached, every ninja equally likely</small>
      </div>
    </div>
  );
}

function FeaturedEgg({ meta, cash, act, now }) {
  const featured = meta.featured;
  const egg = EGGS[featured.type];
  const biome = BIOMES.find((b) => b.id === featured.type);
  const rates = eggRates(featured.type);
  const last = rates.length - 1;
  return (
    <div className="sx-banner sx-feat">
      <TempleScene sky={['#ffe2a8', '#8fd0f0']} ground="#3a6a2a" glow="#ffd84a" />
      <div className="sx-feat-top">
        <span className="sx-tag">NEW!</span>
        <div>
          <b className="sx-big goldtext">{egg.name.toUpperCase()}</b>
          <span className="sx-sub">{biome?.name.replace(/'s .*/, '')} Ninjas! · ends in {clock(left(meta, featured.endsIn, now))}</span>
        </div>
      </div>
      <div className="sx-feat-mid">
        <DragonEggArt size={150} color="#ffd23a" gem={egg.color} />
        <div className="sx-rates">
          {rates.map(([id, pct], i) => (
            <div key={id} className={`sx-rate${i === last ? ' ultimate' : ''}`} style={{ '--rar': RARITY_COLOR[PETS[id].rarity] }}>
              {i === last && <b className="sx-ult">ULTIMATE</b>}
              <PetPic id={id} size={i === last ? 110 : 76} hidden={!meta.discovered.includes(id)} />
              <b className="sx-pct">{pct}%</b>
            </div>
          ))}
        </div>
      </div>
      <div className="sx-packs">
        {[...FEATURED_PACKS].reverse().map((pack) => (
          <div key={pack.count} className={`sx-pack${pack.best ? ' sx-top' : ''}`}>
            <Gift kind="eggs" id={pack.count} name={`${pack.count} ${egg.name}${pack.count > 1 ? 's' : ''}`} />
            <div className="sx-pack-buy">
              <Price price={featuredPrice(featured.type, pack.count)} have={cash} onClick={() => act('buyEggs', { count: pack.count })} />
              <small>{pack.count} Egg{pack.count > 1 ? 's' : ''}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PassCard({ id, theme, art, title, text, meta, cash, act }) {
  const pass = PASSES[id];
  const owned = meta.passes.includes(id);
  return (
    <div className={`sx-pass sx-burst theme-${theme}`}>
      <div className="sx-pass-top">
        {art}
        <div className="sx-pass-text"><b className="sx-big">{title}</b><b className="sx-pass-line">{text}</b></div>
      </div>
      <div className="sx-buyrow">
        {owned ? <Owned /> : <><Gift kind="pass" id={id} name={pass.name} /><Price price={pass.price} have={cash} onClick={() => act('buyPass', { id })} className="wide" /></>}
      </div>
    </div>
  );
}

function GoldSpinCard({ meta, cash, act }) {
  const pass = PASSES.goldSpin;
  const owned = meta.passes.includes('goldSpin') || (meta.spins || []).includes(pass.spin);
  return (
    <div className="sx-wide sx-burst theme-orange sx-goldspin">
      <div className="sx-wide-art"><WhirlArt size={150} tone="gold" /></div>
      <div className="sx-wide-info left">
        <b className="sx-title goldtext">GOLDEN DRAGON SPIN</b>
        <b className="sx-line"><em>x{spinById(pass.spin).mult}</em> Speed while you spin!</b>
        <div className="sx-buyrow">
          {owned ? <Owned /> : <><Gift kind="pass" id="goldSpin" name={pass.name} /><Price price={pass.price} have={cash} onClick={() => act('buyPass', { id: 'goldSpin' })} className="wide" /></>}
        </div>
      </div>
    </div>
  );
}

function SpeedCard({ pack, count, cash, act, big = false }) {
  return (
    <div className={`sx-card sx-speed${big ? ' big' : ''}`}>
      {pack.tag && <span className="sx-ribbon">{pack.tag}</span>}
      <div className="sx-speed-art"><WhirlArt size={big ? 170 : 120} count={count} /></div>
      <b className="sx-amount"><em className={count === 5 ? 'rainbow' : 'gold'}>+{formatNumber(pack.amount)}</em> SPEED</b>
      <div className="sx-buyrow">
        <Gift kind="speed" id={pack.id} name={`+${formatNumber(pack.amount)} Speed`} />
        <Price price={pack.price} have={cash} onClick={() => act('buySpeed', { id: pack.id })} />
      </div>
    </div>
  );
}

function MoneyCard({ pack, stacks, speed, act, big = false }) {
  return (
    <div className={`sx-card sx-burst theme-cash sx-money${big ? ' big' : ''}`}>
      <CashStackArt size={big ? 150 : 110} stacks={stacks} />
      <b className="sx-amount">${formatNumber(pack.cash)}</b>
      <div className="sx-buyrow">
        <Gift kind="money" id={pack.id} name={`$${formatNumber(pack.cash)}`} />
        <Price price={pack.speed} have={speed} unit="speed" onClick={() => act('buyMoney', { id: pack.id })} />
      </div>
    </div>
  );
}

function CommunityCard({ meta, act }) {
  const [name, setName] = useState('');
  return (
    <div className="sx-wide sx-burst theme-purple sx-community">
      <div className="sx-wide-art"><BlockEggArt size={140} /></div>
      <div className="sx-wide-info">
        <b className="sx-line big">Join our <span className="blue">Community</span> through the game page to claim this egg</b>
        {meta.community ? <Owned text="CLAIMED!" /> : (
          <div className="sx-verify">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="@Username" maxLength={21} onKeyDown={(e) => e.stopPropagation()} />
            <button type="button" disabled={name.replace(/^@/, '').trim().length < 3} onClick={() => act('claimCommunity', { name })}>Verify</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Ninja Index

// the card colours behind each rarity (dark while not found, light once found)
const RARITY_BG = { Common: '#6a6e74', Uncommon: '#3a7a1a', Rare: '#1a6a8a', Epic: '#5a1a8a', Legendary: '#8a6a10', Mythic: '#8a1a5a' };

export function NinjaIndexPopup({ ui }) {
  const now = useNow(1000);
  const { meta, act } = ui;
  const [picked, setPicked] = useState(null);
  const [view, setView] = useState('world');
  if (!meta) return null;
  const has = (id) => meta.discovered.includes(id);
  const claimed = (id) => (meta.claimedPets || []).includes(id);
  const all = INDEX_AREAS.flatMap(areaPets);
  const found = all.filter(has).length;
  const ready = meta.discovered.filter((id) => PETS[id] && !claimed(id));
  const sel = picked || meta.discovered.find((id) => PETS[id]) || all[0];
  const def = PETS[sel];
  const known = has(sel);
  const reward = indexPetReward(sel);
  const biome = BIOMES.find((b) => b.id === def.biome);
  // Limited: the featured egg of the week (it changes every week)
  const areas = view === 'world' ? INDEX_AREAS
    : [{ ...INDEX_AREAS.find((a) => a.id === meta.featured.type), limited: true }];
  return (
    <div className="sx-backdrop" onPointerDown={(e) => e.target === e.currentTarget && closePopup()}>
      <div className="sx-wrap">
        <div className="sx-frame sx-index">
          <div className="sx-head"><h2>Ninja Index</h2><button type="button" className="sx-x" onClick={closePopup} aria-label="Close">X</button></div>
          <div className="sx-index-body">
            <div className="sx-index-main">
              <div className="sx-index-list">
                {areas.map((area) => {
                  const ids = areaPets(area);
                  const n = ids.filter(has).length;
                  const guardian = BIOMES.find((b) => b.id === area.id)?.guardian;
                  return (
                    <div key={area.id} className="sx-area">
                      <div className="sx-area-art" style={{ background: `linear-gradient(170deg, ${area.colors[0]}, ${area.colors[1]})` }}>
                        <b>{area.limited ? 'Limited' : BIOMES.find((b) => b.id === area.id)?.name.replace(/'s .*/, '')}</b>
                        {guardian && <PetPic id={guardian} size={120} />}
                        {area.limited && <small>{clock(left(meta, meta.featured.endsIn, now))}</small>}
                      </div>
                      <div className="sx-area-right">
                        <div className="sx-area-grid">
                          {ids.map((id) => (
                            <button key={id} type="button" className={`sx-ninja${has(id) ? ' found' : ''}${sel === id ? ' sel' : ''}`}
                              style={{ '--bg': RARITY_BG[PETS[id].rarity] || '#6a6e74', '--rar': RARITY_COLOR[PETS[id].rarity] }} onClick={() => setPicked(id)}>
                              <small>{has(id) ? PETS[id].name : '???'}</small>
                              <PetPic id={id} size={84} hidden={!has(id)} />
                              {has(id) && !claimed(id) && <i className="sx-dot">!</i>}
                            </button>
                          ))}
                        </div>
                        <div className="sx-bar"><i style={{ width: `${(n / ids.length) * 100}%` }} /><span>{n}/{ids.length}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="sx-index-foot">
                <div className="sx-unlocked"><IndexBookArt size={64} /><b>Unlocked: {found}/{all.length}</b></div>
                <button type="button" className="sx-claimall" disabled={!ready.length} onClick={() => act('claimIndexAll')}>CLAIM ALL{ready.length ? ` (${ready.length})` : ''}</button>
              </div>
            </div>
            <div className="sx-index-side">
              <div className="sx-detail">
                <div className="sx-detail-pic"><PetPic id={sel} size={150} hidden={!known} /></div>
                <b>{known ? def.name : '???'}</b>
                <b className="rar" style={{ color: RARITY_COLOR[def.rarity] }}>{def.rarity}</b>
                <em>${formatNumber(Math.round((biome?.cash || 1) * def.mult))}/s+</em>
              </div>
              <div className="sx-reward">
                <b>Rewards:</b>
                <div className="sx-reward-row">
                  <div><CashStackArt size={52} /><span>${formatNumber(reward.cash)}</span></div>
                  <div><WhirlArt size={52} /><span>+{formatNumber(reward.speed)}</span></div>
                </div>
                {claimed(sel) ? <div className="sx-claim done">CLAIMED!</div>
                  : <button type="button" className="sx-claim" disabled={!known} onClick={() => act('claimIndexPet', { id: sel })}>{known ? 'CLAIM!' : 'FIND IT!'}</button>}
              </div>
            </div>
          </div>
        </div>
        <div className="sx-index-tabs">
          <button type="button" className={`sx-itab world${view === 'world' ? ' on' : ''}`} onClick={() => setView('world')}>World 🌍</button>
          <button type="button" className={`sx-itab limited${view === 'limited' ? ' on' : ''}`} onClick={() => setView('limited')}>Limited ⭐</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ right-hand tiles and panels

// Two square picture buttons on the right edge: Active (your earning ninjas) and Eggs (your pen).
// Each opens its panel; the red ">" closes it again.
export function RightPanels({ ui }) {
  const open = ui.panel === 'active' || ui.panel === 'eggs' ? ui.panel : null;
  const eggReady = ui.pen.some((e) => e.left <= 0);
  if (!ui.meta) return null;
  if (!open) {
    return (
      <div className="sx-tiles">
        <button type="button" className="sx-tile active" aria-label="Active ninjas" onClick={() => uiStore.set({ panel: 'active' })}><NinjaPowerArt size={64} /></button>
        <button type="button" className="sx-tile eggs" aria-label="Eggs" onClick={() => uiStore.set({ panel: 'eggs' })}>
          <NinjaFaceArt size={60} />{eggReady && <i className="sx-dot">!</i>}
        </button>
      </div>
    );
  }
  return (
    <div className="sx-panel-wrap">
      <button type="button" className="sx-collapse" aria-label="Close" onClick={() => uiStore.set({ panel: null })}>&gt;</button>
      {open === 'eggs' ? <EggsPanel ui={ui} /> : <ActivePanel ui={ui} />}
    </div>
  );
}

function EggsPanel({ ui }) {
  const now = useNow(1000);
  const { meta, stats, act, pen } = ui;
  const instantMs = left(meta, meta.boosts.instant, now);
  const ready = pen.filter((e) => e.left <= 0).length;
  const price = instantHatchPrice(baseIncome(ui));
  return (
    <div className="sx-panel-col">
      <div className="sx-panel">
        <div className="sx-panel-head"><b>Eggs {pen.length}/{meta.padCap}</b></div>
        <div className="sx-panel-body">
          {!pen.length && <p className="sx-empty">No eggs growing.<br />Hold an egg and<br />click inside your pen!</p>}
          {pen.map((e, i) => (
            <div key={i} className={`sx-row egg${e.left <= 0 ? ' ready' : ''}`}>
              <DragonEggArt size={40} color={EGG_COLOR[e.rarity]} gem={EGGS[e.type]?.color} />
              <div className="sx-row-text">
                <b style={{ color: RARITY_COLOR[e.rarity] }}>{eggName(e)}</b>
                <small>{e.left > 0 ? `Growing… ${clock(e.left)}` : 'Ready to hatch!'}</small>
              </div>
              {e.left > 0 && meta.instantHatches > 0 && (
                <button type="button" className="sx-rowbtn green" onClick={() => act('instantHatch', { i })}>⚡ {meta.instantHatches}</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="sx-panel-btns">
        <button type="button" className="sx-instant" disabled={stats.cash < price} onClick={() => act('buyInstant')}>
          {instantMs > 0 ? <>Instant {clock(instantMs).replace(/ \d+s$/, '')}</> : '24h Instant Hatch'} <span><PriceCoin size={20} />${formatNumber(price)}</span>
        </button>
        <button type="button" className="sx-hatchall" disabled={!ready} onClick={() => act('hatchAll')}>Hatch All</button>
      </div>
    </div>
  );
}

function ActivePanel({ ui }) {
  const { meta, stats, act, allPets } = ui;
  const on = new Set(meta.equipped);
  const list = [...allPets].sort((a, b) => (on.has(b.uid) - on.has(a.uid)) || b.cash - a.cash);
  const price = slotPrice(meta.slots);
  const full = meta.equipped.length >= meta.slots;
  return (
    <div className="sx-panel-col">
      <div className="sx-panel">
        <div className="sx-panel-head">
          <b>{meta.equipped.length}/{meta.slots} Active</b>
          {price !== null && meta.slots < SLOTS.max && (
            <button type="button" className="sx-plus" disabled={stats.cash < price} onClick={() => act('buySlots')}>+1 Equip <span><PriceCoin size={18} />${formatNumber(price)}</span></button>
          )}
        </div>
        <div className="sx-panel-body">
          {!list.length && <p className="sx-empty">No ninjas yet!<br />Steal an egg and hatch it.</p>}
          {list.map((pet) => {
            const inPen = on.has(pet.uid);
            return (
              <div key={pet.uid} className={`sx-row ninja${inPen ? ' on' : ''}`}>
                <PetPic id={pet.id} size={52} />
                <div className="sx-row-text">
                  <b>{PETS[pet.id]?.name || pet.id}</b>
                  <small className="cash">(${formatNumber(pet.cash)}/s)</small>
                </div>
                {inPen
                  ? <button type="button" className="sx-rowbtn red" onClick={() => act('unequipPet', { uid: pet.uid })}>Unequip</button>
                  : <button type="button" className="sx-rowbtn green" disabled={full} onClick={() => act('equipPet', { uid: pet.uid })}>Equip</button>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="sx-panel-btns right">
        <button type="button" className="sx-hatchall" disabled={!allPets.length} onClick={() => act('equipBest')}>Equip Best</button>
      </div>
    </div>
  );
}
