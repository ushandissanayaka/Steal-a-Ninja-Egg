import { useEffect } from 'react';
import './hud.css';
import { useUi, uiStore } from './store.js';
import { DifficultyFace } from './popupIcons.jsx';
import { InvitePopup, OfflinePopup, SellShopPopup, TrailsShopPopup, OpenedReveal, PetPic, RebirthPopup, SideMenu } from './Popups.jsx';
import { ConfirmBox, DailyPopup, GiftPicker, PetIndexPopup, ShopPopup, SpecialOfferPopup, WeaponIndexPopup, YourPetsPopup } from './GamePopups.jsx';
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

// The hotbar: 1 = your weapon (the bat, or a sword from the Weapon Index). Click (or press 1) to swing it.
function Hotbar({ onSwing, axe }) {
  const weapon = weaponById(axe);
  return (
    <div className="hotbar">
      <button type="button" className="hot-slot on" onClick={onSwing}>
        <i>1</i>
        {weapon.id === 'bat' ? <BatIcon size={54} /> : <PetPic id={`weapon:${weapon.id}`} size={62} />}
        <span>{weapon.name.split(' ').pop()}</span>
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
      <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><path d="M20 3a13 13 0 1 0 9 22A11 11 0 0 1 20 3z" fill="#ffe27a" stroke="#14141a" strokeWidth="2" /></svg>
      <b>{clock.night ? `NIGHT ${formatClock(clock.left * 1000).replace(/m /, ':').replace(/s$/, '')}` : `in ${formatClock(clock.left * 1000)}`}</b>
    </div>
  );
}

// On your treadmill: how far you are towards the next biome's recommended speed, and the multiplier.
function TreadmillBar({ stats, meta }) {
  const next = BIOMES.find((b) => b.speed > stats.speed) || BIOMES[BIOMES.length - 1];
  const prev = [...BIOMES].reverse().find((b) => b.speed <= stats.speed && b !== next)?.speed || 0;
  const k = Math.max(0, Math.min(1, (stats.speed - prev) / Math.max(1, next.speed - prev)));
  const mill = treadmillById(stats.treadmill);
  return (
    <div className="mill-bar">
      <div className="mill-hint">🏃 Running makes you faster! Jump to stop</div>
      <div className="mill-row">
        <span>{next.name.toUpperCase()}</span>
        <span>{formatNumber(stats.speed)} / {formatNumber(next.speed)}</span>
      </div>
      <div className="mill-track"><i style={{ width: `${k * 100}%` }} /></div>
      <div className="mill-mult">+{formatNumber(mill.gain)}/step · x{Number(meta?.treadMult || 1).toFixed(2)}</div>
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

// Top right: who you are playing as (your Boxity account, or your Boxity guest name and picture),
// the sound on/off (Boxity's synced master volume) and your Gems. The game draws no Log in / Log out:
// Boxity's toolbar does that.
function ProfileCard({ profile, onMute }) {
  if (!profile) return null;
  return (
    <div className="profile-card">
      <img className="profile-pfp" src={profile.pfp} alt="" width="44" height="44" />
      <b className="profile-name">{profile.name}</b>
      <button type="button" className="profile-sound" aria-label={profile.muted ? "Sound on" : "Sound off"} onClick={() => onMute(!profile.muted)}>
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9h4l5-4v14l-5-4H3z" fill="#c8ccd4" />
          {profile.muted
            ? <path d="M16 9l6 6M22 9l-6 6" stroke="#ff6a6a" strokeWidth="2.4" strokeLinecap="round" />
            : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#c8ccd4" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        </svg>
      </button>
      <i className="profile-split" />
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" fill="#35a8ff" stroke="#1f6ad6" strokeWidth="1.5" />
        <path d="M12 6l5.2 3v6L12 18l-5.2-3V9z" fill="#7fd0ff" />
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
    <div className={`hud${ui.popup ? ' popup-open' : ''}`}>
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
            <ShoeIcon />
            <button type="button" className="stat-plus" aria-label="Buy speed" onClick={() => uiStore.set({ popup: 'shop', shopSection: 'speed' })}>+</button>
          </span>
          <span>{formatNumber(stats.speed)}</span>
        </div>
        <div className="stat cash"><CashIcon /><span>${formatNumber(stats.cash)}</span><small>+${formatNumber(stats.income)}/s</small></div>
      </div>

      {ui.perf.tier && (
        <div className={`perf perf-${ui.perf.network}`} title="Graphics quality adjusts automatically to keep the game smooth">
          <b>{ui.perf.tier}</b>
          <span>{ui.perf.fps} FPS</span>
          <span>{ui.perf.ping === null ? '-- ms' : `${ui.perf.ping} ms`}</span>
        </div>
      )}

      <Hotbar onSwing={onSwing} axe={stats.axe} />
      <div className="toggles">
        {[['slowMode', 'Slow Mode'], ['hidePets', 'Hide Pets'], ['hideEggs', 'Hide Eggs']].map(([key, label]) => (
          <button key={key} type="button" className={`toggle${ui[key] ? ' on' : ''}`} onClick={() => uiStore.set({ [key]: !ui[key] })}>
            <i /><span>{label}</span>
          </button>
        ))}
      </div>
      <NightClock clock={ui.clock} />
      {ui.onTreadmill && <TreadmillBar stats={stats} meta={ui.meta} />}

      {ui.carried > 0 && (
        <button type="button" className="drop-btn" onClick={onDrop} aria-label="Drop the egg">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M5 7h14l-1.2 13H6.2zM9 4h6v2H9z" fill="#fff" /></svg>
          <span>Drop</span>
          <kbd>Q</kbd>
        </button>
      )}

      <SideMenu ui={ui} />
      {ui.popup === 'shop' && <ShopPopup ui={ui} />}
      {ui.popup === 'index' && <PetIndexPopup ui={ui} />}
      {ui.popup === 'daily' && <DailyPopup ui={ui} />}
      {ui.popup === 'pets' && <YourPetsPopup ui={ui} />}
      {ui.popup === 'weapons' && <WeaponIndexPopup ui={ui} />}
      {ui.popup === 'offer' && <SpecialOfferPopup ui={ui} />}
      {ui.popup === 'rebirth' && <RebirthPopup ui={ui} />}
      {ui.popup === 'trails' && <TrailsShopPopup ui={ui} />}
      {ui.popup === 'sell' && <SellShopPopup ui={ui} />}
      {ui.popup === 'invite' && <InvitePopup ui={ui} />}
      {ui.opened && <OpenedReveal opened={ui.opened} />}
      {ui.offline && <OfflinePopup ui={ui} />}
      <ProfileCard profile={ui.profile} onMute={onMute} />
      <GiftPicker ui={ui} />
      <ConfirmBox confirm={ui.confirm} />
    </div>
  );
}
