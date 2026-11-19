// Keeps the game smooth on every device and connection.
//
// It measures frame times and the ping to the server, reads what the browser says about the device
// and network, and picks a quality tier. A drop happens fast (as soon as frames get slow), a rise
// only after a long smooth stretch, and a tier that caused a drop is not tried again for a while,
// so the quality never flip-flops. The player's Bloxity "graphics_quality" setting caps the tier.

export const TIERS = ['low', 'medium', 'high', 'ultra'];

// What each tier turns on. Game, Effects and the world read these.
// The game is never blurry: pixelRatio never goes BELOW 1 (the screen's own sharpness on a normal
// screen), and on sharp (high-DPI) screens the higher tiers use more of it. Weaker devices save their
// time on the expensive extras instead: shadows (drawn every frame a second time), how far you see,
// the sky decorations, sparkles and particles.
//   shadowEvery: redraw the shadows every N frames (2 = half the shadow cost; they are on the ground,
//                so the difference is hard to see)
//   floaters:    the candy islands and the sweets / rainbows in the sky
//   sparkles:    the magic dust around eggs on the ground and the giant trees
//   otherTrails: other players' trails (your own always shows)
//   maxPixels:   the most pixels drawn per frame from the extra sharpness of sharp screens (the game
//                never draws FEWER than the screen's own pixels, see Game.updateResolution)
export const QUALITY = {
  low: {
    label: 'Low', pixelRatio: 1, maxPixels: Infinity, shadows: false, shadowSize: 0, shadowRange: 0, shadowEvery: 1,
    drawDistance: 170, particles: 0.3, smoke: false, dust: false, floaters: false, cameraShake: false, petLabels: false,
    sparkles: false, otherTrails: false,
  },
  medium: {
    label: 'Medium', pixelRatio: 1.25, maxPixels: 3.2e6, shadows: true, shadowSize: 1024, shadowRange: 100, shadowEvery: 2,
    drawDistance: 360, particles: 0.6, smoke: true, dust: false, floaters: true, cameraShake: false, petLabels: true,
    sparkles: true, otherTrails: true,
  },
  high: {
    label: 'High', pixelRatio: 1.75, maxPixels: 4.6e6, shadows: true, shadowSize: 2048, shadowRange: 200, shadowEvery: 1,
    drawDistance: 560, particles: 1, smoke: true, dust: true, floaters: true, cameraShake: true, petLabels: true,
    sparkles: true, otherTrails: true,
  },
  ultra: {
    label: 'Ultra', pixelRatio: 2, maxPixels: 7.5e6, shadows: true, shadowSize: 4096, shadowRange: 280, shadowEvery: 1,
    drawDistance: Infinity, particles: 1.5, smoke: true, dust: true, floaters: true, cameraShake: true, petLabels: true,
    sparkles: true, otherTrails: true,
  },
};

// How often positions are sent, and how smoothly others move, for each network grade.
export const NETWORK = {
  good: { label: 'Good', sendInterval: 0.1, smoothing: 12 },
  fair: { label: 'Fair', sendInterval: 0.14, smoothing: 8 },
  poor: { label: 'Poor', sendInterval: 0.2, smoothing: 5 },
};

const WINDOW_SECONDS = 2;      // frame times looked at for each decision
const SLOW_FPS = 42;           // below this (or long frame spikes) the tier drops
const SMOOTH_FPS = 56;         // at or above this for a while the tier may rise
const SPIKE_MS = 45;           // the slowest 5% of frames must stay under this
const DROP_AFTER = 1.5;        // seconds of slow frames before dropping
const RISE_AFTER = 10;         // seconds of smooth frames before rising
const BLOCK_RISE_SECONDS = 90; // a tier that was too heavy is not retried for this long
const PING_EVERY = 2;          // seconds
const SETTING_CAP = { Low: 'low', Medium: 'medium', High: 'ultra' };

const clampTier = (i) => Math.max(0, Math.min(TIERS.length - 1, i));

// A first guess from the hardware, before any frame is measured.
export function guessTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  if (navigator.connection?.saveData) return 'low';
  if (mobile) return memory >= 6 && cores >= 8 ? 'medium' : 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}

export function connectionGrade() {
  const c = navigator.connection;
  if (!c) return null;
  if (c.saveData || c.effectiveType === 'slow-2g' || c.effectiveType === '2g') return 'poor';
  if (c.effectiveType === '3g' || (c.downlink && c.downlink < 1.5)) return 'fair';
  return null; // unknown or fine: let the ping decide
}

export class QualityManager {
  constructor({ onTier, onNetwork }) {
    this.onTier = onTier;
    this.onNetwork = onNetwork;
    this.cap = TIERS.length - 1;
    this.tierIndex = TIERS.indexOf(guessTier());
    this.frames = [];          // recent frame times in ms
    this.slowFor = 0;
    this.smoothFor = 0;
    this.blockedAbove = {};    // tier index -> time until which rising into it is blocked
    this.clock = 0;
    this.fps = 60;
    this.ping = null;
    this.network = 'good';
    this.pingTimer = 0;
    this.decideTimer = 0;
    this.onConnection = () => this.updateNetwork();
    navigator.connection?.addEventListener?.('change', this.onConnection);
  }

  get tier() {
    return TIERS[this.tierIndex];
  }

  get settings() {
    return QUALITY[this.tier];
  }

  start() {
    this.onTier(this.tier, QUALITY[this.tier]);
    this.updateNetwork();
  }

  // The Bloxity graphics setting is the most the auto quality may use.
  setCap(setting) {
    this.cap = TIERS.indexOf(SETTING_CAP[setting] || 'ultra');
    if (this.tierIndex > this.cap) this.setTier(this.cap);
  }

  setTier(index) {
    index = clampTier(Math.min(index, this.cap));
    if (index === this.tierIndex) return;
    this.tierIndex = index;
    this.slowFor = 0;
    this.smoothFor = 0;
    this.frames.length = 0;
    this.onTier(this.tier, QUALITY[this.tier]);
  }

  // Call every frame with the real (unclamped) frame time in seconds.
  frame(dt, sendPing) {
    this.clock += dt;
    if (dt > 1) return; // the tab was hidden or the game was loading: not a real frame
    if (this.clock < (this.settleUntil || 0)) return; // just resized: those frames say nothing
    this.frames.push(Math.min(250, dt * 1000));
    const keep = Math.max(30, Math.round(WINDOW_SECONDS * 60));
    if (this.frames.length > keep) this.frames.splice(0, this.frames.length - keep);

    this.pingTimer += dt;
    if (this.pingTimer >= PING_EVERY) {
      this.pingTimer = 0;
      sendPing(performance.now());
    }

    this.decideTimer += dt;
    if (this.decideTimer < 0.5 || this.frames.length < 20) return;
    const step = this.decideTimer;
    this.decideTimer = 0;

    const sorted = [...this.frames].sort((a, b) => a - b);
    const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const spike = sorted[Math.floor(sorted.length * 0.95)];
    this.fps = 1000 / average;

    const slow = this.fps < SLOW_FPS || spike > SPIKE_MS;
    const smooth = this.fps >= SMOOTH_FPS && spike < SPIKE_MS * 0.6;
    this.slowFor = slow ? this.slowFor + step : 0;
    this.smoothFor = smooth ? this.smoothFor + step : 0;

    if (this.slowFor >= DROP_AFTER && this.tierIndex > 0) {
      this.blockedAbove[this.tierIndex] = this.clock + BLOCK_RISE_SECONDS;
      this.setTier(this.tierIndex - 1);
    } else if (this.smoothFor >= RISE_AFTER && this.tierIndex < this.cap) {
      const next = this.tierIndex + 1;
      if ((this.blockedAbove[next] || 0) < this.clock && this.network !== 'poor') this.setTier(next);
      else this.smoothFor = 0;
    }
  }

  // The picture was just rebuilt (new size or sharpness): ignore the next second of frames, so one
  // slow frame from the resize does not lower the quality (and block it from coming back).
  settle() {
    this.frames.length = 0;
    this.slowFor = 0;
    this.smoothFor = 0;
    this.settleUntil = this.clock + 1;
  }

  // The server answered our ping.
  pong(sentAt) {
    const rtt = performance.now() - sentAt;
    this.ping = this.ping === null ? rtt : this.ping * 0.7 + rtt * 0.3;
    this.updateNetwork();
  }

  updateNetwork() {
    // getting worse happens at 130 / 260 ms; getting better only once the ping is well under that
    // again, so a ping hovering round a line does not switch the extras on and off every few seconds
    const was = this.network;
    const fairAt = was === 'good' ? 130 : 105;
    const poorAt = was === 'poor' ? 215 : 260;
    const byPing = this.ping === null ? 'good' : this.ping > poorAt ? 'poor' : this.ping > fairAt ? 'fair' : 'good';
    const byConnection = connectionGrade();
    const order = ['good', 'fair', 'poor'];
    const grade = order[Math.max(order.indexOf(byPing), byConnection ? order.indexOf(byConnection) : 0)];
    if (grade !== this.network) {
      this.network = grade;
      // a bad connection also lowers the graphics, so the device has more time for the network
      if (grade === 'poor' && this.tierIndex > 1) this.setTier(1);
    }
    this.onNetwork(this.network, NETWORK[this.network]);
  }

  dispose() {
    navigator.connection?.removeEventListener?.('change', this.onConnection);
  }
}
