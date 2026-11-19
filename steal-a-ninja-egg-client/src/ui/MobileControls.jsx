// Touch controls for phones and tablets: a joystick to walk (bottom left), Jump, and an Action button
// that does what E does (hold it to pick up an egg; tap it to drop eggs in, pull the lever, hatch).
// Turning the camera is a one-finger drag on the screen, zoom is a pinch, and a tap chops.
// Shown only on touch screens.

import { useRef, useState } from 'react';
import './mobile.css';

const RADIUS = 52; // how far the knob can move from the centre (CSS px)

export const isTouchDevice = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

function Joystick({ input }) {
  const base = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(null);

  const move = (e) => {
    const r = base.current.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
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
      onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) move(e); }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <i className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export default function MobileControls({ game }) {
  const [touch] = useState(isTouchDevice);
  if (!touch) return null;

  const input = () => game.current?.input;
  const action = (down) => {
    const i = input();
    if (!i) return;
    i.touchHold = down;                                   // held like E (picking up an egg fills while held)
    if (down) game.current?.interaction?.interact();      // and tapped like E for everything else
  };

  return (
    <div className="mobile-controls">
      <Joystick input={input} />
      <button
        type="button" className="touch-btn action" aria-label="Action"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); action(true); }}
        onPointerUp={() => action(false)} onPointerCancel={() => action(false)}
      >
        <span>E</span>
      </button>
      <button type="button" className="touch-btn jump" aria-label="Jump" onPointerDown={() => input()?.jump()}>
        <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 8h-4v8H9v-8H5z" fill="#fff" /></svg>
      </button>
    </div>
  );
}
