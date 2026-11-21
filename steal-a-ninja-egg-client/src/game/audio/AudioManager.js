// All the game's sound, made live with the Web Audio API (no sound files): sound effects here, the
// background music in MusicPlayer. Volumes follow Boxity's synced settings (master_volume,
// music_volume, the profile card's speaker), and everything goes quiet during an ad break.
// Browsers only allow sound after the player touches the page, so it starts on the first input.

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = 1;
    this.musicLevel = 1;
    this.unlocked = false;
    const unlock = () => {
      this.start();
      if (this.ctx?.state === 'running') {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    // every button (and tab, link, toggle...) in the UI makes a little water-drop sound
    this.onButton = (e) => {
      const el = e.target.closest?.('button, [role="button"], [role="tab"], a[href], summary, select, input[type="checkbox"], input[type="radio"], input[type="range"]');
      if (el && !el.disabled) this.drop();
    };
    window.addEventListener('pointerdown', this.onButton, true);
  }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();            // master volume
      this.out.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();            // sound effects
      this.sfx.gain.value = 0.8;
      this.sfx.connect(this.out);
      this.music = this.ctx.createGain();          // music bus (MusicPlayer plays into it)
      this.music.connect(this.out);
      const n = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, n, n); // one second of white noise, reused
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.onStart?.();
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  // Boxity settings are strings "0".."100"
  setVolumes(settings) {
    this.master = Math.max(0, Math.min(1, Number(settings.master_volume ?? 80) / 100));
    this.musicLevel = Math.max(0, Math.min(1, Number(settings.music_volume ?? 80) / 100));
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.musicLevel * 0.42, t, 0.05);
  }

  // ad breaks: silence everything until they end
  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  // ---------------------------------------------------------------- building blocks

  // a tone gliding from f to f2 with a quick attack and a decay
  tone(f, dur, { type = 'sine', vol = 0.3, f2 = f, at = 0, attack = 0.005, out = this.sfx, curve = 'exp' } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 !== f) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      else o.frequency.linearRampToValueAtTime(f2, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // filtered noise: crunches, whooshes, crashes
  noise(dur, { vol = 0.3, type = 'bandpass', freq = 1000, freq2 = freq, q = 1, at = 0, attack = 0.003, out = this.sfx } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (freq2 !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------------------------------------------------------------- the game's sounds

  // a water drop falling into still water (every button click): the tiny "tik" of it touching the
  // surface, then the "bloop" of the air bubble it traps, whose note rises fast as the bubble
  // closes; and now and then a second, smaller drip after it. A little different every time.
  drop() {
    if (!this.ready) return;
    const f = 520 + Math.random() * 160;
    this.noise(0.01, { type: 'highpass', freq: 6000, vol: 0.035 });                         // the touch
    this.tone(f, 0.11, { f2: f * 2.6, vol: 0.32, attack: 0.002, at: 0.003 });             // the bloop
    this.tone(f * 2.01, 0.06, { f2: f * 4.4, vol: 0.05, attack: 0.001, at: 0.005 });
    this.tone(f * 2.6, 0.25, { type: 'sine', vol: 0.025, attack: 0.01, at: 0.06 });        // the ring left in the water
    // a smaller drip and its ripple, a moment later (most clicks)
    if (Math.random() < 0.6) {
      const at = 0.12 + Math.random() * 0.06, f2 = f * (1.3 + Math.random() * 0.3);
      this.tone(f2, 0.07, { f2: f2 * 2.8, vol: 0.09, attack: 0.001, at });
    }
  }

  // a purchase that went through: a cash-register "cha", two coins and a rising sparkle
  buy() {
    if (!this.ready) return;
    this.noise(0.08, { type: 'bandpass', freq: 3200, q: 1.2, vol: 0.12 });
    this.tone(1319, 0.09, { type: 'square', vol: 0.06, at: 0.03 });
    this.tone(1760, 0.3, { type: 'square', vol: 0.06, at: 0.1 });
    [76, 79, 83, 88, 91].forEach((m, i) => this.tone(midiHz(m), 0.32, { type: 'triangle', vol: 0.1, at: 0.16 + i * 0.05 }));
    [88, 95].forEach((m) => this.tone(midiHz(m), 0.8, { type: 'sine', vol: 0.05, at: 0.42 }));
    for (let i = 0; i < 6; i++) this.tone(2400 + Math.random() * 2600, 0.1, { vol: 0.025, at: 0.35 + i * 0.06 });
  }

  // claiming a reward (index, daily, gifts): a soft bell chord with sparkles
  claim() {
    if (!this.ready) return;
    [72, 76, 79].forEach((m, i) => this.tone(midiHz(m), 0.6, { type: 'triangle', vol: 0.09, at: i * 0.04 }));
    this.tone(midiHz(84), 0.9, { type: 'sine', vol: 0.07, at: 0.14 });
    for (let i = 0; i < 4; i++) this.tone(2600 + Math.random() * 2000, 0.09, { vol: 0.025, at: 0.2 + i * 0.07 });
  }

  // turning into a whirlwind: a soft gust that swirls up, with a little airy chime on top
  spinUp() {
    if (!this.ready) return;
    this.noise(0.55, { type: 'bandpass', freq: 300, freq2: 1800, q: 1.8, vol: 0.16, attack: 0.12 });
    this.noise(0.4, { type: 'bandpass', freq: 900, freq2: 3200, q: 4, vol: 0.06, attack: 0.1, at: 0.15 });
    this.tone(660, 0.4, { type: 'sine', f2: 1320, vol: 0.035, attack: 0.08, at: 0.12 });
  }

  // the quiet wind that goes on while you spin (level 0..1; 0 fades it out). A looped soft noise
  // through a band filter that wavers slowly, so it sounds like air swirling round you.
  setWind(level) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (!this.wind) {
      if (level <= 0) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 2.2;
      f.frequency.value = 650;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain();
      lg.gain.value = 320;
      lfo.connect(lg).connect(f.frequency);
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(f).connect(g).connect(this.sfx);
      src.start();
      lfo.start();
      this.wind = { src, lfo, g, level: 0 };
    }
    if (Math.abs(this.wind.level - level) < 0.01) return;
    this.wind.level = level;
    this.wind.g.gain.setTargetAtTime(Math.max(0.0001, 0.075 * level), t, 0.25);
  }

  // caught and knocked out: a soft "poof", a falling slide and a gentle, sad little bell tune
  defeat() {
    if (!this.ready) return;
    this.noise(0.35, { type: 'lowpass', freq: 1800, freq2: 200, vol: 0.3 });              // poof
    this.tone(110, 0.3, { f2: 45, vol: 0.45 });                                            // thump
    this.tone(880, 0.6, { type: 'triangle', f2: 220, vol: 0.08, at: 0.05 });              // the slide down
    [79, 76, 72, 67].forEach((m, i) => this.tone(midiHz(m), 0.45, { type: 'sine', vol: 0.12, at: 0.35 + i * 0.16 }));
    this.tone(midiHz(60), 1.1, { type: 'triangle', vol: 0.07, at: 0.99 });
    this.tone(midiHz(64), 1.1, { type: 'sine', vol: 0.05, at: 0.99 });
  }

  // a growl: a low, rough voice (a sawtooth shaken fast by a second oscillator, so it rasps), from
  // pitch f to f2, through a dark filter, with a breathy hiss on top
  growl(f, f2, dur, { vol = 0.3, rasp = 32, depth = 0.35, at = 0, bright = 900 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rasp;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f * depth;
    lfo.connect(lfoGain).connect(o.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(bright, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, bright * 0.4), t + dur);
    filter.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.06, dur * 0.2));
    g.gain.setValueAtTime(vol, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(filter).connect(g).connect(this.sfx);
    for (const n of [o, lfo]) { n.start(t); n.stop(t + dur + 0.05); }
    this.noise(dur * 0.8, { type: 'bandpass', freq: bright * 1.3, freq2: bright * 0.6, q: 0.8, vol: vol * 0.25, at });
  }

  // swinging the bat: a short airy swish
  swing(level = 1) {
    if (level <= 0.03) return;
    const k = 0.9 + Math.random() * 0.2;
    this.noise(0.2, { type: 'bandpass', freq: 600 * k, freq2: 2600 * k, q: 2.5, vol: 0.22 * level, attack: 0.04 });
  }

  // the bat landing: a hard wooden THWACK (a crack, a thud under it and a little ring of the wood)
  batHit(level = 1) {
    if (level <= 0.03) return;
    const k = 0.92 + Math.random() * 0.16;
    this.noise(0.05, { type: 'highpass', freq: 2200 * k, vol: 0.32 * level });
    this.noise(0.12, { type: 'bandpass', freq: 750 * k, q: 1.6, vol: 0.4 * level });
    this.tone(170 * k, 0.18, { f2: 55, vol: 0.55 * level });
    this.tone(1250 * k, 0.09, { type: 'triangle', f2: 1100 * k, vol: 0.05 * level, at: 0.01 });
  }

  // a guardian hit by the bat: a pained, rasping howl that falls away, then a dazed groan
  monsterPain(level = 1) {
    if (level <= 0.03) return;
    const k = 0.85 + Math.random() * 0.3;
    this.growl(330 * k, 140 * k, 0.45, { vol: 0.24 * level, rasp: 38, depth: 0.25, bright: 1700, at: 0.05 });
    this.growl(120 * k, 70 * k, 0.7, { vol: 0.2 * level, rasp: 24, depth: 0.4, bright: 600, at: 0.45 });
  }

  // a guardian waking up and coming for you: a deep roar that swells and falls
  roar(level = 1) {
    if (level <= 0.03) return;
    const k = 0.85 + Math.random() * 0.25;
    this.growl(85 * k, 140 * k, 0.35, { vol: 0.3 * level, rasp: 30, depth: 0.45, bright: 700 });
    this.growl(140 * k, 60 * k, 0.9, { vol: 0.34 * level, rasp: 27, depth: 0.5, bright: 1100, at: 0.3 });
    // a long rumbling tail under it, so the roar fills the whole wind-up before the charge
    this.growl(60 * k, 45 * k, 1.1, { vol: 0.26 * level, rasp: 20, depth: 0.55, bright: 500, at: 0.45 });
    this.noise(1.2, { type: 'lowpass', freq: 380, freq2: 120, vol: 0.18 * level, at: 0.2, attack: 0.15 });
  }

  // a guardian leaping at you: a short snarl and a rush of air
  lunge(level = 1) {
    if (level <= 0.03) return;
    const k = 0.9 + Math.random() * 0.2;
    this.growl(180 * k, 90 * k, 0.32, { vol: 0.3 * level, rasp: 34, depth: 0.4, bright: 1300 });
    this.noise(0.3, { type: 'bandpass', freq: 600, freq2: 1800, q: 0.8, vol: 0.14 * level });
  }

  // a guardian catching you: a snapping bite with a growl
  chomp() {
    this.noise(0.06, { type: 'bandpass', freq: 1400, q: 1.5, vol: 0.4 });
    this.tone(260, 0.08, { type: 'square', f2: 90, vol: 0.12 });
    this.growl(110, 60, 0.5, { vol: 0.28, rasp: 30, depth: 0.45, bright: 800, at: 0.05 });
  }

  // a teleport: you dissolve with a rising magic shimmer and land with a soft bell
  teleport() {
    this.noise(0.5, { type: 'bandpass', freq: 400, freq2: 5000, q: 3, vol: 0.16, attack: 0.08 });
    this.tone(260, 0.45, { type: 'triangle', f2: 1560, vol: 0.12, attack: 0.03 });
    this.tone(390, 0.45, { type: 'sine', f2: 2340, vol: 0.07, attack: 0.03, at: 0.03 });
    [76, 83, 88, 95].forEach((m, i) => this.tone(midiHz(m), 0.35, { type: 'sine', vol: 0.06, at: 0.42 + i * 0.05 }));
    this.tone(midiHz(64), 0.8, { type: 'sine', vol: 0.12, at: 0.45 });
    this.tone(midiHz(76), 0.8, { type: 'triangle', vol: 0.05, at: 0.45 });
  }

  // made it back past the red line with an egg: a short winning run of notes
  escape() {
    [67, 71, 74, 79].forEach((m, i) => this.tone(midiHz(m), 0.16, { type: 'square', vol: 0.11, at: i * 0.07 }));
    this.tone(midiHz(83), 0.5, { type: 'triangle', vol: 0.24, at: 0.28 });
    this.tone(midiHz(79), 0.5, { type: 'sine', vol: 0.16, at: 0.28 });
  }

  // your egg knocked out of your hands: a falling "bwomp" and the thud of it on the ground
  loseEgg() {
    this.tone(520, 0.3, { type: 'triangle', f2: 160, vol: 0.18 });
    this.tone(110, 0.18, { f2: 50, vol: 0.4, at: 0.25 });
    this.noise(0.08, { type: 'lowpass', freq: 600, vol: 0.2, at: 0.25 });
  }

  // an axe (or fist) biting into wood: a woody thunk with a crunch
  chop() {
    const k = 0.9 + Math.random() * 0.2;
    this.noise(0.09, { type: 'bandpass', freq: 900 * k, q: 2.2, vol: 0.45 });
    this.tone(150 * k, 0.13, { f2: 70, vol: 0.45 });
    this.tone(1800 * k, 0.03, { type: 'triangle', vol: 0.06 });
  }

  // a tree cracking and crashing down (quieter the further away it is)
  timber(level = 1) {
    if (level <= 0.03) return;
    this.noise(0.55, { type: 'lowpass', freq: 2400, freq2: 250, vol: 0.35 * level });
    this.tone(220, 0.25, { type: 'sawtooth', f2: 90, vol: 0.06 * level });
    this.noise(0.4, { type: 'lowpass', freq: 400, freq2: 80, vol: 0.55 * level, at: 0.55 });
    this.tone(95, 0.45, { f2: 38, vol: 0.7 * level, at: 0.55 });
  }

  // grabbing an egg: a bright little rising sparkle
  pickup() {
    [784, 988, 1319].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.18, at: i * 0.06 }));
    this.tone(2637, 0.22, { vol: 0.05, at: 0.18 });
  }

  // an egg landing on the drop pad: a soft pop
  plop() {
    this.tone(520, 0.14, { f2: 240, vol: 0.32 });
    this.noise(0.05, { type: 'highpass', freq: 3000, vol: 0.06 });
  }

  // pulling the lever: a clunk, then the machine whirring up
  lever() {
    this.tone(120, 0.07, { type: 'square', vol: 0.14 });
    this.noise(0.06, { type: 'bandpass', freq: 600, vol: 0.25 });
    this.tone(70, 0.9, { type: 'sawtooth', f2: 190, vol: 0.07, at: 0.08, curve: 'lin' });
  }

  // the new egg flying out of the machine
  whoosh() {
    this.noise(0.6, { type: 'bandpass', freq: 350, freq2: 2600, q: 1.4, vol: 0.28 });
  }

  // an egg hatching: a happy little fanfare with sparkles
  hatch() {
    [72, 76, 79, 84].forEach((m, i) => this.tone(midiHz(m), 0.22, { type: 'triangle', vol: 0.2, at: i * 0.09 }));
    [72, 76, 79].forEach((m) => this.tone(midiHz(m + 12), 0.7, { type: 'sine', vol: 0.08, at: 0.38 }));
    for (let i = 0; i < 5; i++) this.tone(2000 + Math.random() * 2000, 0.12, { vol: 0.04, at: 0.4 + i * 0.07 });
  }

  // an animal has spotted you: two sharp alarm beeps
  alert() {
    this.tone(880, 0.09, { type: 'square', vol: 0.1 });
    this.tone(1175, 0.12, { type: 'square', vol: 0.1, at: 0.11 });
  }

  // caught: you burst into pieces
  shatter() {
    this.noise(0.4, { type: 'lowpass', freq: 3500, freq2: 300, vol: 0.55 });
    this.tone(620, 0.45, { type: 'square', f2: 110, vol: 0.1 });
    this.tone(110, 0.35, { f2: 40, vol: 0.6 });
  }

  // money: a coin ding (big = a fuller jingle)
  coin(big = false) {
    this.tone(988, 0.07, { type: 'square', vol: 0.08 });
    this.tone(1319, 0.25, { type: 'square', vol: 0.08, at: 0.07 });
    if (big) [1568, 2093].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.07, at: 0.16 + i * 0.07 }));
  }

  // something did not work (not enough cash...)
  error() {
    this.tone(196, 0.12, { type: 'square', vol: 0.07 });
    this.tone(165, 0.16, { type: 'square', vol: 0.07, at: 0.13 });
  }

  jump() {
    this.tone(280, 0.16, { f2: 640, vol: 0.12 });
  }

  // entering a new forest: a short bright chime
  zone() {
    [67, 72, 76].forEach((m, i) => this.tone(midiHz(m), 0.3, { type: 'triangle', vol: 0.12, at: i * 0.07 }));
  }

  // a popup opening: a soft bubbly swoosh
  pop() {
    this.noise(0.12, { type: 'bandpass', freq: 800, freq2: 2400, q: 2, vol: 0.06, attack: 0.03 });
    this.tone(560, 0.12, { f2: 1120, vol: 0.09 });
    this.tone(1120, 0.18, { type: 'sine', vol: 0.03, at: 0.08 });
  }

  dispose() {
    try { this.wind?.src.stop(); this.wind?.lfo.stop(); } catch { /* already stopped */ }
    window.removeEventListener('pointerdown', this.onButton, true);
    this.ctx?.close().catch(() => {});
  }
}

export { midiHz };
