// Touch controls for phones and tablets:
//   bottom left   a joystick to walk
//   bottom right  Jump (big), Spin (turn into a whirlwind, like key 1) and E (hold it to pick up an
//                 egg; tap it to put eggs in your pen, hatch and everything else E does)
// Turning the camera is a one-finger drag on the screen, zoom is a pinch, a tap clicks.
// Shown only on touch screens. Jump / Spin / E step aside while an Eggs / Active panel is open
// (the panel sits on that side of the screen), and popups cover everything anyway.

import { useRef, useState } from 'react';
import './mobile.css';
import { useUi } from './store.js';

const RADIUS = 52; // how far the knob can move from the centre (CSS px)

export const isTouchDevice = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

// keep getting this finger's moves even when it slides off the button (never fatal if refused)
const capture = (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ } };

function Joystick({ input }) {
  const base = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(null);

  const move = (e) => {
    const r = base.current.getBoundingClientRect();
    // the joystick may be scaled down on small screens: work in its own (unscaled) units
    const k = base.current.offsetWidth ? r.width / base.current.offsetWidth : 1;
    let x = (e.clientX - (r.left + r.width / 2)) / k;
    let y = (e.clientY - (r.top + r.height / 2)) / k;
    const d = Math.hypot(x, y);
    if (d > RADIUS) { x = (x / d) * RADIUS; y = (y / d) * RADIUS; }
    setKnob({ x, y });
    if (input()) input().joy.set(x / RADIUS, -y / RADIUS); // y up = forward
  };
  const stop = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    input()?.joy.set(0, 0);
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => { active.current = e.pointerId; capture(e); move(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) move(e); }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <i className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

// a little whirlwind for the Spin button
function SpinIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" aria-hidden="true">
      {[[20, 8, 15, 4.2], [21, 15, 12, 3.7], [19.5, 21.5, 9, 3.2], [20.5, 27, 6.4, 2.7], [20, 32, 4, 2.2], [20.5, 36, 2.2, 1.6]].map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={i % 2 ? '#d8f0ff' : '#ffffff'} stroke="#14141a" strokeWidth="1.8" />
      ))}
    </svg>
  );
}

export default function MobileControls({ game }) {
  const [touch] = useState(isTouchDevice);
  const ui = useUi();
  if (!touch || ui.phase !== 'playing') return null;

  const input = () => game.current?.input;
  const action = (down) => {
    const i = input();
    if (!i) return;
    i.touchHold = down;                                   // held like E (picking up an egg fills while held)
    if (down) game.current?.interaction?.interact();      // and tapped like E for everything else
  };
  const aside = ui.panel === 'eggs' || ui.panel === 'active';
  const covered = !!(ui.popup || ui.offline || ui.opened || ui.confirm || ui.giftFor); // a popup is open: no controls

  return (
    <div className={`mobile-controls${aside ? ' aside' : ''}${covered ? ' covered' : ''}`}>
      <Joystick input={input} />
      <button
        type="button" className="touch-btn action" aria-label="Action (E)"
        onPointerDown={(e) => { capture(e); action(true); }}
        onPointerUp={() => action(false)} onPointerCancel={() => action(false)}
      >
        <span>E</span>
      </button>
      <button type="button" className={`touch-btn spin${ui.tornado ? ' on' : ''}`} aria-label="Spin" onPointerDown={() => game.current?.toggleTornado()}>
        <SpinIcon />
      </button>
      <button type="button" className="touch-btn jump" aria-label="Jump" onPointerDown={() => input()?.jump()}>
        <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 8h-4v8H9v-8H5z" fill="#fff" stroke="#14141a" strokeWidth="1.2" /></svg>
      </button>
    </div>
  );
}
