// Pictures for the Shop, the Ninja Index and the right-hand Eggs / Active panels: thick dark outlines,
// bright fills and a light top edge (like the reference video's icons). All original SVG drawings.

import { useId } from 'react';

const OUT = '#14141a';
// an id that is unique per drawing (several of the same icon can be on screen at once)
const useUid = () => useId().replace(/:/g, '');

// The red sale tag with a % (the shop's Featured tab).
export function SaleTagArt({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M30 4 Q22 2 22 10" fill="none" stroke="#e8902a" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(-38 34 38)">
        <path d="M18 16 H44 L54 28 V58 H18 Z" fill="#e8202e" stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M21 19 H43 L50 28 V31 H21 Z" fill="#ff5a5a" />
        <circle cx="44" cy="24" r="3.4" fill="#fff" stroke={OUT} strokeWidth="2" />
        <circle cx="29" cy="35" r="4" fill="none" stroke="#fff" strokeWidth="3.2" />
        <circle cx="42" cy="50" r="4" fill="none" stroke="#fff" strokeWidth="3.2" />
        <path d="M44 32 L27 53" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// A whirlwind. tone: 'ice' (white and light blue, the Spin tab and speed packs), 'gold' (the Golden
// Dragon Spin), 'white' (the Spin slot). count: how many whirlwinds side by side (the speed packs).
const WHIRL = {
  ice: ['#ffffff', '#bfe8ff', '#3f8fe0', '#7fd0ff'],
  gold: ['#fff6c8', '#ffd23a', '#b8780a', '#ffe680'],
  white: ['#ffffff', '#e0e8f2', '#7e93b0', '#c8d6e6'],
};
function Whirl({ x = 0, y = 0, s = 1, tone = 'ice', uid }) {
  const [light, mid, dark, line] = WHIRL[tone];
  const rings = [[32, 9, 24, 6.5], [33, 18, 20, 5.8], [31, 26.5, 16, 5.1], [33, 34, 12.4, 4.4], [31.5, 41, 9.2, 3.6], [33, 47, 6.4, 2.9], [32, 52, 4, 2.2], [32.5, 56, 2.2, 1.6]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[...rings].reverse().map(([cx, cy, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy + ry * 0.3} rx={rx} ry={ry} fill={`url(#${uid}-side)`} stroke={OUT} strokeWidth="1.6" />
          <ellipse cx={cx} cy={cy - ry * 0.1} rx={rx * 0.84} ry={ry * 0.6} fill={light} />
          <path d={`M${cx - rx * 0.7} ${cy} Q${cx} ${cy + ry * 0.6} ${cx + rx * 0.75} ${cy - ry * 0.15}`} stroke={line} strokeWidth="1.3" fill="none" />
        </g>
      ))}
      {tone === 'ice' && <path d="M8 14 L4 8 L10 10 Z M56 22 L62 17 L58 25 Z M12 40 L6 38 L11 34 Z M54 44 L60 46 L55 50 Z" fill="#bfeaff" stroke={OUT} strokeWidth="1.4" />}
      {tone === 'gold' && <path d="M10 8 Q2 18 12 26 M54 14 Q63 26 52 34 M14 36 Q6 44 16 50" stroke="#ffb21f" strokeWidth="3" fill="none" strokeLinecap="round" />}
      <defs>
        <linearGradient id={`${uid}-side`} x1="0" x2="1">
          <stop offset="0" stopColor={mid} />
          <stop offset="0.45" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
    </g>
  );
}

export function WhirlArt({ size = 64, tone = 'ice', count = 1 }) {
  const uid = useUid();
  const spots = [[[0, 0, 1]], [[-14, 6, 0.85], [14, 4, 0.9]], [[-20, 10, 0.72], [20, 10, 0.72], [0, -2, 0.9]], [[-24, 12, 0.62], [24, 12, 0.62], [-9, 2, 0.78], [11, 0, 0.82]], [[-26, 14, 0.56], [26, 14, 0.56], [-13, 6, 0.7], [13, 6, 0.7], [0, -4, 0.86]]][Math.min(4, count - 1)];
  return (
    <svg width={size} height={size} viewBox="-8 -8 80 80" aria-hidden="true">
      {spots.map(([dx, dy, s], i) => <Whirl key={i} uid={uid} tone={tone} s={s} x={dx + 32 * (1 - s)} y={dy + 32 * (1 - s)} />)}
    </svg>
  );
}

// Green banknotes with a gold band. stacks: 1 to 6 stacks (the money packs get bigger).
function Stack({ x, y, s = 1, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${-i * 5})`}>
          <path d="M-18 -4 L4 -12 L20 -2 L-2 6 Z" fill={i === 2 ? '#4fdc4a' : '#2fae2f'} stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M-18 -4 L-2 6 L-2 9 L-18 -1 Z M-2 6 L20 -2 L20 1 L-2 9 Z" fill="#1f7a24" stroke={OUT} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      ))}
      <ellipse cx="1" cy="-13" rx="5" ry="2.6" fill="#2a9a2a" stroke="#1a5a1a" strokeWidth="1" />
      <path d="M-8 -17 L-4 -18 L12 -9 L12 -5 L8 -4 L-8 -13 Z" fill="#ffd21f" stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  );
}
export function CashStackArt({ size = 64, stacks = 1 }) {
  const spots = [
    [[32, 38, 1.3]],
    [[22, 40, 1], [42, 34, 1.05, -10]],
    [[18, 42, 0.95], [44, 42, 0.95, 8], [31, 28, 1.05, -6]],
    [[14, 44, 0.8], [50, 44, 0.8, 10], [24, 30, 0.9, -8], [42, 28, 0.9, 6]],
    [[12, 46, 0.75], [52, 46, 0.75, 10], [22, 34, 0.82, -8], [43, 32, 0.85, 6], [32, 22, 0.9]],
    [[10, 48, 0.7], [54, 48, 0.7, 10], [20, 36, 0.78, -8], [44, 36, 0.78, 6], [26, 22, 0.82, 4], [40, 20, 0.82, -6]],
  ][Math.max(0, Math.min(5, stacks - 1))];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {spots.map(([x, y, s, r = 0], i) => <Stack key={i} x={x} y={y} s={s} rot={r} />)}
    </svg>
  );
}

// A round potion flask with a cork. symbol: 'whirl' | 'cash' | 'bolt'.
export function FlaskArt({ size = 110, color = '#35a8ff', symbol = 'whirl' }) {
  const uid = useUid();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-l`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.35" stopColor={color} />
          <stop offset="1" stopColor={OUT} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect x="40" y="6" width="20" height="14" rx="3" fill="#c8884a" stroke={OUT} strokeWidth="3" />
      <rect x="36" y="18" width="28" height="8" rx="3" fill="#dfe9f2" stroke={OUT} strokeWidth="3" />
      <path d="M40 26 V36 A32 32 0 1 0 60 36 V26 Z" fill="#dff3ff" stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="50" cy="64" r="27" fill={`url(#${uid}-l)`} />
      {[[38, 52, 3], [60, 48, 2.4], [56, 78, 2.8], [40, 76, 2]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity="0.55" />)}
      {symbol === 'whirl' && <g stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round">
        <path d="M36 56 Q50 62 64 55" /><path d="M39 63 Q50 68 61 62" /><path d="M42 70 Q50 74 58 69" /><path d="M46 76 Q50 79 54 76" />
      </g>}
      {symbol === 'cash' && <g>
        <circle cx="50" cy="65" r="15" fill="#ffd21f" stroke={OUT} strokeWidth="3" />
        <text x="50" y="74" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="24" fill="#2fae2f" stroke={OUT} strokeWidth="1.2">$</text>
      </g>}
      {symbol === 'bolt' && <g>
        <path d="M36 52 L50 47 L64 52 V64 Q64 76 50 82 Q36 76 36 64 Z" fill="#ffd21f" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
        <path d="M53 52 L44 66 H51 L47 77 L57 61 H50 Z" fill="#ff3a2a" stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />
      </g>}
      <path d="M30 50 Q32 40 40 38" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

// x2 Growth: a rainbow stopwatch with fast-forward arrows.
export function StopwatchArt({ size = 110 }) {
  const uid = useUid();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-r`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ff4a4a" /><stop offset="0.25" stopColor="#ffd21f" /><stop offset="0.5" stopColor="#5ff04a" />
          <stop offset="0.75" stopColor="#35a8ff" /><stop offset="1" stopColor="#c46bff" />
        </linearGradient>
      </defs>
      <rect x="42" y="4" width="16" height="10" rx="2" fill="#ff7a2a" stroke={OUT} strokeWidth="3" />
      <rect x="47" y="12" width="6" height="8" fill="#ff7a2a" stroke={OUT} strokeWidth="2.5" />
      <circle cx="50" cy="54" r="36" fill={`url(#${uid}-r)`} stroke={OUT} strokeWidth="3.5" />
      <circle cx="50" cy="54" r="27" fill="#fff" stroke={OUT} strokeWidth="3" />
      <path d="M50 36 V54 H63" stroke={OUT} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#fff" stroke={OUT} strokeWidth="2.6" strokeLinejoin="round">
        <path d="M46 72 L60 80 L46 88 Z" /><path d="M58 72 L72 80 L58 88 Z" /><path d="M70 72 L84 80 L70 88 Z" />
      </g>
      <path d="M8 58 H22 M4 66 H20 M10 74 H24" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// x2 Money: a gold coin with banknotes and a big "x2".
export function CoinArt({ size = 110 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="#f2a01a" stroke={OUT} strokeWidth="3.5" />
      <circle cx="50" cy="48" r="37" fill="#ffd23a" stroke="#c87a0a" strokeWidth="3" />
      <g transform="translate(46 44) scale(1.25)"><Stack x={0} y={4} /></g>
      <text x="70" y="86" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="34" fill="#5ff04a" stroke={OUT} strokeWidth="2.5" paintOrder="stroke">x2</text>
    </svg>
  );
}

// The featured egg: a gold egg of facets with red gems and horn points.
export function DragonEggArt({ size = 160, color = '#ffd23a', gem = '#e0202e' }) {
  const uid = useUid();
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-g`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fffbe0" /><stop offset="0.35" stopColor={color} /><stop offset="1" stopColor="#a8620a" />
        </radialGradient>
      </defs>
      <path d="M14 40 L4 18 L22 32 Z M86 40 L96 18 L78 32 Z M16 74 L2 82 L18 86 Z M84 74 L98 82 L82 86 Z" fill={color} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 6 C24 6 12 44 12 66 A38 38 0 0 0 88 66 C88 44 76 6 50 6 Z" fill={`url(#${uid}-g)`} stroke={OUT} strokeWidth="3.5" />
      <g fill="none" stroke="#b8780a" strokeWidth="2" opacity="0.85">
        <path d="M30 22 L42 30 L50 18 L58 30 L70 22" /><path d="M18 46 L32 54 L42 42 L50 54 L58 42 L68 54 L82 46" />
        <path d="M14 72 L28 80 L40 68 L50 80 L60 68 L72 80 L86 72" /><path d="M24 94 L36 88 L50 96 L64 88 L76 94" />
      </g>
      <path d="M50 46 L60 60 L50 74 L40 60 Z" fill={gem} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M30 70 L36 78 L30 86 L24 78 Z M70 70 L76 78 L70 86 L64 78 Z" fill={gem} stroke={OUT} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 48 L55 58 L50 60 Z" fill="#fff" opacity="0.6" />
      <ellipse cx="34" cy="30" rx="6" ry="11" fill="#fff" opacity="0.45" transform="rotate(24 34 30)" />
    </svg>
  );
}

// The community egg: a blocky brown egg with a white band and a chevron mark.
export function BlockEggArt({ size = 150, color = '#8a5228' }) {
  const rows = [[3, 4], [2, 6], [1, 8], [1, 8], [0, 10], [0, 10], [0, 10], [0, 10], [1, 8], [2, 6]];
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" aria-hidden="true">
      {rows.map(([from, n], r) => Array.from({ length: n }, (_, c) => {
        const x = 2 + (from + c) * 9.6, y = 6 + r * 10;
        const shade = (r * 7 + c * 3) % 5;
        const band = r === 7;
        return <rect key={`${r}-${c}`} x={x} y={y} width="9.6" height="10" fill={band ? (shade > 2 ? '#e8e8ee' : '#ffffff') : ['#7a4520', color, '#9a6030', '#6a3a18', '#a86a38'][shade]} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />;
      }))}
      <path d="M2 46 V76 Q2 100 50 106 Q98 100 98 76 V46 Q98 4 50 4 Q2 4 2 46 Z" fill="none" stroke={OUT} strokeWidth="3.5" />
      <path d="M44 44 L56 56 L44 68 L38 62 L44 56 L38 50 Z" fill="#f0f0f4" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M58 44 L70 56 L58 68 L52 62 L58 56 L52 50 Z" fill="#ffc531" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

// The purple gift box (gift buttons).
export function GiftBoxArt({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="17" width="28" height="19" rx="2" fill="#f4e8ff" stroke={OUT} strokeWidth="2.4" />
      <rect x="4" y="11" width="32" height="8" rx="2" fill="#ffffff" stroke={OUT} strokeWidth="2.4" />
      <rect x="17" y="11" width="6" height="25" fill="#c46bff" stroke={OUT} strokeWidth="2" />
      <path d="M20 11 C14 2 7 5 12 11 M20 11 C26 2 33 5 28 11" fill="#c46bff" stroke={OUT} strokeWidth="2.2" />
      <path d="M8 22 V32 M32 22 V32" stroke="#c46bff" strokeWidth="2" />
    </svg>
  );
}

// The coin on price buttons: a white hexagon coin with a $ (cash) or a whirl (paid with speed).
export function PriceCoin({ kind = 'cash', size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="#ffffff" stroke={OUT} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16 7 L23.5 11.5 V20.5 L16 25 L8.5 20.5 V11.5 Z" fill="none" stroke={OUT} strokeWidth="2.2" strokeLinejoin="round" />
      {kind === 'cash'
        ? <text x="16" y="21" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="13" fill={OUT}>$</text>
        : <path d="M11 12 H21 M12 16 H20 M13.5 20 H18.5" stroke="#2f8fe0" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

// The Ninja Index's blue book.
export function IndexBookArt({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <path d="M10 22 L46 8 L70 24 L34 40 Z" fill="#e8f2ff" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 22 L34 40 V70 L10 52 Z" fill="#1f6ad6" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M34 40 L70 24 V54 L34 70 Z" fill="#3f9aff" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M52 40 Q44 38 46 46 Q48 54 56 50 Q62 46 58 40" fill="none" stroke="#bfe8ff" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M22 58 L22 70 L26 66 L30 72 V60" fill="#5ab4ff" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// The right-hand square buttons. Active: a ninja in a red hood with green "power up" arrows.
// Eggs: a ninja's masked face.
export function NinjaPowerArt({ size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 70 70" aria-hidden="true">
      <g fill="#5ff04a" stroke={OUT} strokeWidth="2.2" strokeLinejoin="round">
        <path d="M8 34 L16 22 L24 34 H19 V48 H13 V34 Z" /><path d="M46 30 L55 16 L64 30 H58 V46 H52 V30 Z" /><path d="M28 14 L35 4 L42 14 H38 V22 H32 V14 Z" />
      </g>
      <rect x="22" y="44" width="26" height="22" rx="3" fill="#b8101e" stroke={OUT} strokeWidth="2.6" />
      <path d="M28 52 H42" stroke="#ffd21f" strokeWidth="3" />
      <rect x="21" y="18" width="28" height="28" rx="5" fill="#e0202e" stroke={OUT} strokeWidth="2.8" />
      <rect x="24" y="27" width="22" height="8" rx="2" fill="#ffd8a8" stroke={OUT} strokeWidth="1.8" />
      <rect x="28" y="29" width="4" height="4" fill={OUT} /><rect x="38" y="29" width="4" height="4" fill={OUT} />
      <path d="M21 22 H49" stroke="#ffd21f" strokeWidth="3" />
    </svg>
  );
}

export function NinjaFaceArt({ size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 70 70" aria-hidden="true">
      <path d="M10 30 Q10 6 35 6 Q60 6 60 30 V50 Q60 64 35 64 Q10 64 10 50 Z" fill="#d81e2a" stroke={OUT} strokeWidth="3" />
      <path d="M14 14 Q35 2 56 14 L52 22 Q35 14 18 22 Z" fill="#ffd21f" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M30 12 L35 6 L40 12 L35 18 Z" fill="#e0202e" stroke={OUT} strokeWidth="1.8" />
      <path d="M14 30 H56 V42 Q35 46 14 42 Z" fill="#ffd8a8" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M18 34 L30 37 L28 40 L19 38 Z M52 34 L40 37 L42 40 L51 38 Z" fill={OUT} />
      <path d="M14 46 Q35 54 56 46" stroke="#a8101a" strokeWidth="3" fill="none" />
    </svg>
  );
}

// A temple scene behind the Starter Pack and the featured egg: mountains, a pagoda, lanterns.
export function TempleScene({ sky = ['#1a2a5a', '#3a3a7a'], ground = '#5a1a14', glow = '#ffb84a' }) {
  const uid = useUid();
  return (
    <svg className="sx-scene" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-s`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
      </defs>
      <rect width="400" height="160" fill={`url(#${uid}-s)`} />
      <path d="M0 100 L40 50 L80 90 L130 40 L180 95 L230 55 L280 92 L330 45 L400 90 V160 H0 Z" fill="#000" opacity="0.22" />
      <g fill="#2a0a0a" opacity="0.55">
        <path d="M150 120 V80 H250 V120 Z" /><path d="M130 82 Q200 58 270 82 L262 88 Q200 70 138 88 Z" /><path d="M160 64 V52 H240 V64 Z" /><path d="M146 54 Q200 34 254 54 L248 58 Q200 44 152 58 Z" />
      </g>
      {[[160, 100], [240, 100]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="12" fill={glow} opacity="0.16" />)}
      <rect y="122" width="400" height="38" fill={ground} />
      <path d="M170 160 L180 122 H220 L230 160 Z" fill="#000" opacity="0.2" />
    </svg>
  );
}
