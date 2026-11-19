// The loading page: the game's art blurred in the background, its icon in the middle, the name, and
// the real loading progress (fonts, world, avatar, joining a server). When the game has loaded it
// fades away by itself and the player is in the game.
//
// It is also the only screen for trouble, so there is never a dead end: when the connection drops it
// comes back ("Reconnecting"), and when the game could not start it says so and tries again by
// itself (with a button to try right away).

import { useEffect, useState } from 'react';
import { useUi } from './store.js';
import { GAME_NAME } from '../shared/gameData.js';
import { reloadGame } from '../net/connection.js';
import { guessTier, connectionGrade } from '../game/systems/QualityManager.js';
import './loading.css';

// The moving loading page (the drifting background, the bobbing icon, the twinkling sparks) only
// when the device and the connection are good; otherwise a still page, so the loading itself (and
// the first frames of the game behind it) gets all the device's time.
// Good = not a weak device by its hardware, no slow connection, no "reduce motion" wish, the frames
// of the page itself coming smoothly, and not reconnecting after a dropped connection.
const SLOW_FRAME_MS = 28; // the page's own frames slower than ~36 FPS on average: a busy device
function startsLite() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  return guessTier() === 'low' || !!connectionGrade();
}

function useLite(showing, troubled) {
  const [slow, setSlow] = useState(startsLite);
  // watch the page's own first frames once: the middle (median) frame time, so the odd long frame
  // from the game loading behind the page does not count, only a device that is slow all the time
  useEffect(() => {
    if (!showing || slow) return undefined;
    let raf = 0, last = 0;
    const times = [];
    const tick = (t) => {
      if (last) times.push(t - last);
      last = t;
      if (times.length >= 40) {
        times.sort((a, b) => a - b);
        if (times[times.length >> 1] > SLOW_FRAME_MS) setSlow(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showing, slow]);
  // reconnecting / could not connect: the connection is the trouble, so the still page
  return slow || troubled;
}

const BG = './loading/background.jpg';
const ICON = './loading/icon.jpg';
const FADE_MS = 700;

// seconds until the next automatic try, counting down
function useCountdown(at) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!at) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [at]);
  return at ? Math.max(0, Math.ceil((at - now) / 1000)) : 0;
}

export default function LoadingScreen() {
  const { phase, loading, retryAt } = useUi();
  const showing = phase === 'loading' || phase === 'reconnecting' || phase === 'failed';
  const [gone, setGone] = useState(false);
  const lite = useLite(showing, phase === 'reconnecting' || phase === 'failed');
  const left = useCountdown(phase === 'failed' ? retryAt : 0);

  useEffect(() => {
    if (showing) { setGone(false); return undefined; }
    const t = setTimeout(() => setGone(true), FADE_MS); // fade into the game
    return () => clearTimeout(t);
  }, [showing]);
  if (gone && !showing) return null;

  const failed = phase === 'failed';
  const pct = failed ? 0 : Math.round(Math.min(1, loading?.progress ?? 0) * 100);
  const text = failed ? 'Could not reach the game server' : loading?.text || 'Loading';
  return (
    <div className={`loading-page${showing ? '' : ' leaving'}${lite ? ' lite' : ''}`} aria-busy={showing}>
      <div className="loading-bg" style={{ backgroundImage: `url(${BG})` }} />
      <div className="loading-shade" />
      <div className="loading-center">
        <div className="loading-icon-wrap">
          <i className="spark s1" /><i className="spark s2" /><i className="spark s3" />
          <img className="loading-icon" src={ICON} alt="" width="150" height="150" />
        </div>
        <h1 className="loading-title">
          {GAME_NAME}
          <svg className="loading-check" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="#22c55e" />
            <path d="M7 12.4l3.2 3.2L17.2 8.6" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </h1>
        <p className="loading-sub">User Created Game</p>
        <p className="loading-step">{text}{failed ? '' : '…'}</p>
        {failed ? (
          <>
            <p className="loading-note">Trying again in {left}s</p>
            <button type="button" className="loading-retry" onClick={() => reloadGame()}>Try again now</button>
          </>
        ) : (
          <>
            <div className="loading-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="loading-dots"><i /><i /><i /></div>
          </>
        )}
      </div>
    </div>
  );
}
