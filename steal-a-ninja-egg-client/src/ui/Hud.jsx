import { useEffect } from 'react';
import './hud.css';
import { useUi, uiStore } from './store.js';
import { DifficultyFace } from './popupIcons.jsx';
import { InvitePopup, OfflinePopup, SellShopPopup, SpinShopPopup, TrailsShopPopup, OpenedReveal, PetPic, RebirthPopup, SideMenu } from './Popups.jsx';
import { ConfirmBox, DailyPopup, GiftPicker, WeaponIndexPopup, YourPetsPopup } from './GamePopups.jsx';
import { NinjaIndexPopup, RightPanels, ShopPopup, SpecialOfferPopup } from './ShopIndex.jsx';
import { weaponById } from '../shared/progression.js';
import { BIOMES, DIFFICULTY_COLOR, RARITY_COLOR, RULES, formatClock, formatNumber, treadmillById } from '../shared/gameData.js';

function EggIcon({ size = 44 }) {
  return (
    <svg width={size} height={size * 1.22} viewBox="0 0 40 49" aria-hidden="true">
      <path d="M20 2C10 2 2 18 2 30a18 17 0 0 0 36 0C38 18 30 2 20 2z" fill="#ffb27d" stroke="#14141a" strokeWidth="3" />
      <ellipse cx="13" cy="19" rx="4" ry="7" fill="#fff" opacity="0.65" transform="rotate(16 13 19)" />
    </svg>
  );
}

function BatIcon({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(40 32 32)">
        <rect x="27" y="4" width="11" height="34" rx="5.5" fill="#d89a58" stroke="#14141a" strokeWidth="2.5" />
        <rect x="29.5" y="36" width="6" height="20" rx="2" fill="#2a2a30" stroke="#14141a" strokeWidth="2" />
        <rect x="27" y="55" width="11" height="5" rx="2" fill="#3a2414" stroke="#14141a" strokeWidth="2" />
        <rect x="27" y="20" width="11" height="3" fill="#e8432f" />
      </g>
    </svg>
  );
}

function ShoeIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 22 L5 10 L13 12 L16 17 L28 19 C30 20 30 25 28 25 L4 25 Z" fill="#35a8ff" stroke="#14141a" strokeWidth="2" />
      <rect x="4" y="23" width="25" height="3" fill="#ffffff" stroke="#14141a" strokeWidth="1.5" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="9" width="28" height="15" rx="3" fill="#3fcf4b" stroke="#14141a" strokeWidth="2" />
      <circle cx="16" cy="16.5" r="4.2" fill="#a5f59c" stroke="#14141a" strokeWidth="1.6" />
    </svg>
  );
}

// A whirlwind: stacked swirls, wide at the top (the speed counter and the Spin slot).
function TornadoIcon({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {[[20, 7, 16, 4.6], [21, 14, 13, 4], [19, 20.5, 10, 3.6], [21, 26.5, 7.4, 3.1], [20, 32, 5, 2.6], [21, 36.5, 2.8, 2]].map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={i % 2 ? '#d8f0ff' : '#ffffff'} stroke="#3a6a9a" strokeWidth="1.6" />
      ))}
      <path d="M8 8 Q20 12 32 7 M11 15 Q21 18 31 14 M12 21 Q20 23 28 20" stroke="#7fb8e8" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

// A stack of green banknotes with a gold band (the cash counter).
function MoneyIcon({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 1.5} ${18 - i * 6}) rotate(-8 18 10)`}>
          <rect x="3" y="4" width="30" height="13" rx="2" fill={i === 2 ? '#5fe05a' : '#3fbf3a'} stroke="#14141a" strokeWidth="2" />
          <circle cx="18" cy="10.5" r="3.4" fill="#2a9a2a" stroke="#14141a" strokeWidth="1.2" />
        </g>
      ))}
      <rect x="15" y="8" width="7" height="24" rx="1.5" fill="#ffd21f" stroke="#14141a" strokeWidth="1.6" transform="rotate(-8 18 20)" />
    </svg>
  );
}

function Prompt({ prompt }) {
  return (
    <div className={`prompt${prompt.fill !== null && prompt.fill !== undefined ? ' hold' : ''}`} style={{ left: prompt.x, top: prompt.y }}>
      <span className="prompt-key">
        {prompt.fill > 0 && <i className="prompt-key-fill" style={{ height: `${prompt.fill * 100}%` }} />}
        <em>E</em>
      </span>
      <span className="prompt-text">
        <small>{prompt.title}</small>
        <b>{prompt.verb}</b>
        {prompt.fill !== null && prompt.fill !== undefined && (
          <span className="prompt-bar"><i style={{ width: `${prompt.fill * 100}%` }} /></span>
        )}
      </span>
    </div>
  );
}

// The hotbar (like the video): 1 = Spin (click or press 1: a quick spin that dazes a guardian next to
// you), 2 = the egg in your hands (empty while you carry none).
// A whirlwind drawn to look solid (3D): stacked swirl rings shaded light to dark round each one,
// a highlight on top, a shadow under it and streaks of wind round the rings.
function Tornado3DIcon({ size = 58, on = false }) {
  const rings = [[20, 6.5, 15, 4.4], [21, 12.6, 12.4, 3.9], [19.4, 18.4, 9.8, 3.4], [20.6, 23.6, 7.4, 2.9], [19.8, 28.2, 5.2, 2.4], [20.4, 32.2, 3.2, 1.9], [20, 35.4, 1.8, 1.4]];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="tw-side" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={on ? '#9fd8ff' : '#b8c8dc'} />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor={on ? '#4aa0f0' : '#7e93b0'} />
        </linearGradient>
        <linearGradient id="tw-top" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={on ? '#c8ecff' : '#dfe8f2'} />
        </linearGradient>
        <radialGradient id="tw-shadow">
          <stop offset="0" stopColor="rgba(0,0,0,0.45)" />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="37.6" rx="6" ry="1.6" fill="url(#tw-shadow)" />
      {[...rings].reverse().map(([cx, cy, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy + ry * 0.35} rx={rx} ry={ry} fill="url(#tw-side)" stroke="#2c4a70" strokeWidth="0.9" />
          <ellipse cx={cx} cy={cy - ry * 0.12} rx={rx * 0.86} ry={ry * 0.62} fill="url(#tw-top)" />
          <path d={`M${cx - rx * 0.7} ${cy - ry * 0.1} Q${cx} ${cy + ry * 0.55} ${cx + rx * 0.75} ${cy - ry * 0.2}`} stroke={on ? '#5ab4ff' : '#9fb4cc'} strokeWidth="0.8" fill="none" />
        </g>
      ))}
      <path d="M6 9 Q2 15 7 20" stroke="#ffffff" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M34 15 Q38 20 33 25" stroke="#ffffff" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function Hotbar({ onSwing, egg, tornado }) {
  return (
    <div className="hotbar">
      <button type="button" className={`hot-slot spin-slot${tornado ? ' on' : ''}`} onClick={onSwing} title="Turn into a whirlwind (1)">
        <i>1</i>
        <Tornado3DIcon size={56} on={tornado} />
        <span>Spin</span>
      </button>
      <button type="button" tabIndex={-1} className={`hot-slot${egg ? '' : ' hot-empty'}`}>
        <i>2</i>
        {egg && <EggIcon size={36} />}
        {egg && <span>{egg}</span>}
      </button>
    </div>
  );
}

// The Starter Pack offer: once per visit, a few seconds after joining, while it has not been bought.
let offerShown = false;
// It waits for the screen to be free (the Daily Rewards popup first, then any other), then shows.
function useSpecialOffer(ui) {
  const ready = ui.phase === 'playing' && ui.meta && !ui.meta.starterPack;
  useEffect(() => {
    if (!ready || offerShown) return undefined;
    let id = null;
    const check = (delay) => {
      id = setTimeout(() => {
        const now = uiStore.get();
        if (offerShown || now.meta?.starterPack) return;
        if (now.popup || now.offline || now.opened || now.confirm) return check(4000); // something is open: try again later
        offerShown = true;
        uiStore.set({ popup: 'offer' });
      }, delay);
    };
    check(6000);
    return () => clearTimeout(id);
  }, [ready]);
}

// The Daily Rewards popup is open when the game opens (once per visit), while today's reward is waiting.
let dailyShown = false;
function useDailyOnOpen(ui) {
  const daily = ui.phase === 'playing' ? ui.meta?.daily : null;
  const offline = !!ui.offline;
  useEffect(() => {
    if (!daily || dailyShown || offline) return undefined; // the offline-cash popup first, if there is one
    // a moment after joining, so the offline-cash message (which comes just after) can arrive first
    const id = setTimeout(() => {
      const now = uiStore.get();
      if (dailyShown || now.offline) return;
      dailyShown = true;
      if (daily.ready && !now.popup) uiStore.set({ popup: 'daily' });
    }, 1200);
    return () => clearTimeout(id);
  }, [daily, offline]);
}

// Bottom right: the moon and how long until night (or how long the night still lasts).
function NightClock({ clock }) {
  if (!clock) return null;
  return (
    <div className={`night-clock${clock.night ? ' night' : ''}`}>
      <svg width="58" height="58" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M20 3a13 13 0 1 0 9 22A11 11 0 0 1 20 3z" fill="#5fb8ff" stroke="#14141a" strokeWidth="2" />
        <path d="M24 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1z M27 14l.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z" fill="#ffffff" />
      </svg>
      <b>{clock.night ? `NIGHT ${formatClock(clock.left * 1000).replace(/m /, ':').replace(/s$/, '')}` : `in ${formatClock(clock.left * 1000)}`}</b>
    </div>
  );
}

// Spinning in your training arena: how far you are towards the next biome's recommended speed, the
// multiplier, and the "Exit Arena" button (like the video).
function TreadmillBar({ stats, meta, onExit }) {
  const next = BIOMES.find((b) => b.speed > stats.speed) || BIOMES[BIOMES.length - 1];
  const prev = [...BIOMES].reverse().find((b) => b.speed <= stats.speed && b !== next)?.speed || 0;
  const k = Math.max(0, Math.min(1, (stats.speed - prev) / Math.max(1, next.speed - prev)));
  const mill = treadmillById(stats.treadmill);
  return (
    <div className="mill-bar">
      <div className="mill-hint">🌀 Spinning makes you faster! +{formatNumber(Math.round(mill.gain * (meta?.treadMult || 1) * (1000 / RULES.treadmillStepMs)))} Speed/s</div>
      <div className="mill-row">
        <span>{next.name.toUpperCase()}</span>
        <span>{formatNumber(stats.speed)} / {formatNumber(next.speed)}</span>
      </div>
      <div className="mill-track"><i style={{ width: `${k * 100}%` }} /></div>
      <div className="mill-mult">{mill.name} · +{formatNumber(mill.gain)}/step · x{Number(meta?.treadMult || 1).toFixed(2)}</div>
      <button type="button" className="exit-arena" onClick={onExit}>Exit Arena</button>
    </div>
  );
}

function Reveal({ reveal }) {
  return (
    <div className="reveal">
      <small>{reveal.egg} hatched! {reveal.kg ? `(${Number(reveal.kg).toFixed(1)} kg)` : ''}</small>
      <b style={{ color: RARITY_COLOR[reveal.rarity] }}>{reveal.name}</b>
      <span style={{ color: RARITY_COLOR[reveal.rarity] }}>{reveal.rarity}</span>
      <em>${formatNumber(reveal.cash)}/s</em>
    </div>
  );
}

// The connection as signal bars and a number (the ping in ms, or the frame rate until the first
// ping is back): 4 green bars on a good connection, 3 orange on a fair one, 1 red on a poor one.
const SIGNAL = { good: [4, '#5ff04a'], fair: [3, '#ffb21f'], poor: [1, '#ff4a4a'] };
function Signal({ perf }) {
  const [bars, color] = SIGNAL[perf?.network || 'good'] || SIGNAL.good;
  const value = perf?.ping ?? perf?.fps;
  return (
    <span className="profile-signal" title={perf?.ping != null ? `Ping ${perf.ping} ms` : 'Connection'}>
      <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 5.5} y={14 - i * 4} width="4" height={4 + i * 4} rx="1" fill={i < bars ? color : '#5a5d66'} />)}
      </svg>
      {value != null && <em>{value}</em>}
    </span>
  );
}

// Top right: who you are playing as (your Boxity account's picture and name, or the Bloxity base
// character and a random guest name when you are not signed in), the connection, the sound on/off
// (Boxity's synced master volume) and your Gems. The game draws no Log in / Log out: Boxity's
// toolbar does that.
function ProfileCard({ profile, perf, onMute }) {
  if (!profile) return null;
  return (
    <div className="profile-card">
      <img className="profile-pfp" src={profile.pfp} alt="" width="44" height="44" />
      <b className="profile-name">{profile.name}</b>
      <Signal perf={perf} />
      <button type="button" className="profile-sound" aria-label={profile.muted ? "Sound on" : "Sound off"} onClick={() => onMute(!profile.muted)}>
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9h4l5-4v14l-5-4H3z" fill="#c8ccd4" />
          {profile.muted
            ? <path d="M16 9l6 6M22 9l-6 6" stroke="#ff6a6a" strokeWidth="2.4" strokeLinecap="round" />
            : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#c8ccd4" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        </svg>
      </button>
      <i className="profile-split" />
      {/* the Boxity Gem: a purple cut diamond */}
      <svg width="28" height="26" viewBox="0 0 28 26" aria-hidden="true">
        <path d="M7 2h14l6 7-13 15L1 9z" fill="#9a4aff" stroke="#5a1aa8" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M1 9h26M7 2l3 7 4-7 4 7 3-7M10 9l4 15 4-15" fill="none" stroke="#e8c8ff" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M7 2h14l-3 7h-8z" fill="#c890ff" opacity="0.7" />
      </svg>
      <b className="profile-gems">{formatNumber(profile.gems || 0)}</b>
    </div>
  );
}

export default function Hud({ onDrop, onSwing, onAction, onMute }) {
  const store = useUi();
  const ui = { ...store, act: (type, payload = {}) => onAction?.(type, payload) };
  useDailyOnOpen(ui);
  useSpecialOffer(ui);

  if (ui.phase !== 'playing') return null; // loading, reconnecting or retrying: the loading page shows

  const { stats } = ui;
  return (
    <div className={`hud${ui.popup ? ' popup-open' : ''}${ui.panel === 'eggs' || ui.panel === 'active' ? ' panel-open' : ''}`}>
      {/* carrying a stolen egg is dangerous: the screen's edges glow red, stronger while a guardian chases you */}
      <div className={`danger-vignette${ui.carried > 0 ? ' on' : ''}${ui.chased ? ' chased' : ''}`} aria-hidden="true" />
      {ui.objective && (
        <div className="objective">
          <span>{ui.objective}</span>
        </div>
      )}

      {/* the messages at the top, stacked so they never overlap (and kept clear of the corners) */}
      <div className="top-stack">
        {ui.zone && (
          <div className="zone-banner" key={ui.zone.name}>
            <div className="zone-title" style={{ '--zc': DIFFICULTY_COLOR[ui.zone.difficulty] }}>
              <b>{ui.zone.name}</b>
              <DifficultyFace difficulty={ui.zone.difficulty} size={92} />
            </div>
            <div className="zone-rec">
              <span>Recommended:</span>
              <ShoeIcon />
              <em>{formatNumber(ui.zone.speed)} Speed</em>
            </div>
          </div>
        )}
        {ui.announce && <div className={`announce${ui.announce.big ? ' big' : ''}`} style={{ color: ui.announce.color }} key={ui.announce.at}>✨ {ui.announce.text}</div>}
        {ui.chased && <div className="run-banner">RUN!!</div>}
        {ui.reveal && <Reveal reveal={ui.reveal} />}
        {ui.toast && <div className="toast" style={{ color: ui.toast.color }} key={ui.toast.at}>{ui.toast.text}</div>}
      </div>

      {ui.prompt && <Prompt prompt={ui.prompt} />}

      <div className="stats">
        <div className="stat speed">
          <span className="stat-icon">
            <TornadoIcon size={74} />
            <button type="button" className="stat-plus" aria-label="Buy speed" onClick={() => uiStore.set({ popup: 'shop', shopSection: 'speed' })}>+</button>
          </span>
          <span>{formatNumber(stats.speed)}</span>
        </div>
        <div className="stat cash"><MoneyIcon size={74} /><span>${formatNumber(stats.cash)}</span><small>+${formatNumber(stats.income)}/s</small></div>
      </div>

      {ui.tip && <div className="tip-banner" key={ui.tip.at}>{ui.tip.text}</div>}
      <Hotbar onSwing={onSwing} egg={ui.carriedName || null} tornado={!!ui.tornado} />
      <NightClock clock={ui.clock} />
      {ui.onTreadmill && <TreadmillBar stats={stats} meta={ui.meta} onExit={() => ui.act('exitArena')} />}

      <ProfileCard profile={ui.profile} perf={ui.perf} onMute={onMute} />
      <SideMenu ui={ui} />
      <RightPanels ui={ui} />
      {ui.popup === 'shop' && <ShopPopup ui={ui} />}
      {ui.popup === 'index' && <NinjaIndexPopup ui={ui} />}
      {ui.popup === 'daily' && <DailyPopup ui={ui} />}
      {ui.popup === 'pets' && <YourPetsPopup ui={ui} />}
      {ui.popup === 'weapons' && <WeaponIndexPopup ui={ui} />}
      {ui.popup === 'offer' && <SpecialOfferPopup ui={ui} />}
      {ui.popup === 'rebirth' && <RebirthPopup ui={ui} />}
      {ui.popup === 'trails' && <TrailsShopPopup ui={ui} />}
      {ui.popup === 'spin' && <SpinShopPopup ui={ui} />}
      {ui.popup === 'sell' && <SellShopPopup ui={ui} />}
      {ui.popup === 'invite' && <InvitePopup ui={ui} />}
      {ui.opened && <OpenedReveal opened={ui.opened} />}
      {ui.offline && <OfflinePopup ui={ui} />}
      <GiftPicker ui={ui} />
      <ConfirmBox confirm={ui.confirm} />
    </div>
  );
}
