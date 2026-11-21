// The background music: the game's own two tunes (songs.js), played live with the Web Audio API.
// "Bamboo Breeze" in the lobby, "Shadow Run" on the track; going from one to the other fades the
// first out and the second in (setSong). Notes are scheduled a little ahead on the audio clock, so
// the beat stays steady even when a frame is slow.
//
// The instruments (a tune's `sound` picks them):
//   lead   koto:     a plucked string (a bright twang that bends into the note and rings away)
//          musicBox: a tinkly bell (a sine with a glassy octave, dying away like a music-box tine)
//          square:   a bright chip lead
//   bass   pluck: a soft plucked bass on the beat; drive: a growly eighth-note bass
//   pad    choir: a ghostly "ooh" (two slightly out-of-tune voices, slow to swell)
//          flute: a breathy bamboo flute playing the tune's `flute` line (vibrato + air)
//   drums  soft: a soft kick, a rim click and a shaker; hard: kick, snare, hats and a tom fill
//          taiko / taikoHard: deep festival drums, a woody clack and a shaker (hard: louder, hats)
// Every other loop a quiet bell doubles the lead an octave up, for variety.

import { SONGS } from './songs.js';
import { midiHz } from './AudioManager.js';

const LOOKAHEAD = 0.15;  // seconds scheduled ahead
const TICK_MS = 30;
const FADE_OUT = 0.7;    // seconds, when the tune changes
const FADE_IN = 1.2;

export class MusicPlayer {
  constructor(audio) {
    this.audio = audio;
    this.key = 'lobby';
    this.song = SONGS.lobby;
    this.pending = null;
    this.step = 0;        // step within the whole loop (bars * 16)
    this.loop = 0;
    this.timer = null;
  }

  start() {
    const { audio } = this;
    if (this.timer || !audio.ctx) return;
    const ctx = audio.ctx;
    this.bus = ctx.createGain(); // this tune's level (for the fades)
    this.bus.connect(audio.music);
    // the lead's echo
    this.delay = ctx.createDelay(1);
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.3;
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.bus);
    this.setEcho();
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // 'lobby' or 'raid': the new tune fades in after the old one fades out
  setSong(key) {
    if (!SONGS[key]) return;
    const ctx = this.audio.ctx;
    if (key === this.key) {
      // changed our mind before the fade finished: bring the same tune back up
      if (this.pending && ctx && this.bus) this.bus.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
      this.pending = null;
      return;
    }
    if (this.pending === key) return;
    this.pending = key;
    if (!ctx || !this.bus) return; // not started yet: switched at once in schedule()
    this.switchAt = ctx.currentTime + FADE_OUT;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_OUT / 4);
  }

  setEcho() {
    this.delay.delayTime.value = Math.min(0.95, (60 / this.song.bpm) * (this.song.sound.echo || 0.75));
  }

  schedule() {
    const ctx = this.audio.ctx;
    if (!ctx || ctx.state !== 'running') {
      if (ctx) this.nextTime = ctx.currentTime + 0.1;
      return;
    }
    // the fade-out is over: the new tune starts from its top and fades in
    if (this.pending && (!this.switchAt || ctx.currentTime >= this.switchAt)) {
      this.key = this.pending;
      this.song = SONGS[this.key];
      this.pending = null;
      this.switchAt = 0;
      this.step = 0;
      this.loop = 0;
      this.setEcho();
      this.nextTime = ctx.currentTime + 0.05;
      this.bus.gain.cancelScheduledValues(ctx.currentTime);
      this.bus.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.bus.gain.setTargetAtTime(1, ctx.currentTime, FADE_IN / 4);
    }
    const stepDur = 60 / this.song.bpm / 4;
    const bars = this.song.chords.length;
    // after a stall (tab hidden), restart cleanly instead of playing everything missed at once
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % (bars * 16);
      if (this.step === 0) this.loop++;
    }
  }

  playStep(step, t0, stepDur) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const { chords, melody, drums, sound, swing = 0 } = this.song;
    const chord = chords[bar];
    const lastBar = bar === chords.length - 1;
    // swing: the off-beats come a little late
    const t = t0 + (s % 4 === 2 ? swing * stepDur : s % 2 === 1 ? swing * 0.5 * stepDur : 0);

    // drums
    const soft = sound.drums === 'soft' || sound.drums === 'taiko';
    const taiko = sound.drums === 'taiko' || sound.drums === 'taikoHard';
    if (drums.k.includes(s)) (taiko ? this.taiko(t, sound.drums === 'taikoHard' ? 0.8 : 0.55, s === 0 ? 1 : 0.8) : this.kick(t, soft ? 0.55 : 0.9));
    if (drums.s.includes(s)) (taiko ? this.clack(t, sound.drums === 'taikoHard' ? 0.22 : 0.14) : soft ? this.rim(t) : this.snare(t));
    if (drums.h.includes(s)) (soft ? this.noiseHit(t, 0.05, 'highpass', 6500, 0.028) : this.noiseHit(t, 0.035, 'highpass', 7500, 0.05));
    if (drums.o.includes(s)) this.noiseHit(t, 0.12, 'highpass', 7000, 0.035);
    if (lastBar) for (const [at, m] of drums.fill || []) if (at === s) (taiko ? this.taiko(t, 0.45, 0.9, midiHz(m)) : this.tom(t, midiHz(m)));

    // bass
    if (sound.bass === 'drive') {
      if (s % 2 === 0) this.note(midiHz(chord.root + (s % 8 === 6 ? 12 : 0)), t, stepDur * 1.7, 'sawtooth', 0.14, 520);
    } else if (s === 0 || s === 6 || s === 8 || s === 14) {
      this.note(midiHz(chord.root + (s === 6 || s === 14 ? 12 : 0)), t, stepDur * 2.4, 'triangle', 0.3, 0, false, 0.25);
    }

    // the pad: the chord swelling in at the top of each bar
    if (sound.pad === 'choir' && s === 0) for (const m of chord.tones) this.choir(midiHz(m), t, stepDur * 16);
    // the bamboo flute's own line
    if (sound.pad === 'flute') for (const [at, m, len] of this.song.flute?.[bar] || []) if (at === s) this.flute(midiHz(m), t, stepDur * len);
    // chord stabs on the offbeats
    if (sound.stabs && s % 4 === 2) for (const m of chord.tones) this.note(midiHz(m), t, stepDur * 0.8, 'square', 0.028, 1600);

    // the lead melody (with echo)
    for (const [at, m, len] of melody[bar]) {
      if (at !== s) continue;
      if (sound.lead === 'koto') this.koto(midiHz(m), t, Math.max(0.35, stepDur * len * 1.8));
      else if (sound.lead === 'musicBox') this.musicBox(midiHz(m), t, Math.max(0.5, stepDur * len * 1.6));
      else this.note(midiHz(m), t, stepDur * len * 0.92, 'square', 0.065, 2400, true);
      // every other loop: a bell an octave up joins in
      if (this.loop % 2 === 1) this.note(midiHz(m + 12), t, stepDur * len * 0.8, 'sine', 0.03);
    }
  }

  // a held note. decay: 0 = held then released; > 0 = a pluck dying away over that many seconds
  note(freq, t, dur, type, vol, lowpass = 0, echo = false, decay = 0) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    if (decay) g.gain.setTargetAtTime(0.0001, t + 0.01, decay);
    else g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    node.connect(g);
    g.connect(this.bus);
    if (echo) g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // a music-box tine: a bright ping that rings and dies away, with a glassy overtone
  musicBox(freq, t, dur) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.006, dur / 4);
    g.connect(this.bus);
    g.connect(this.delay);
    const tine = ctx.createOscillator();
    tine.type = 'sine';
    tine.frequency.setValueAtTime(freq, t);
    tine.connect(g);
    // the overtone: quieter and gone faster (the "glassy" ting at the start)
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
    og.gain.setTargetAtTime(0.0001, t + 0.004, dur / 12);
    const over = ctx.createOscillator();
    over.type = 'triangle';
    over.frequency.setValueAtTime(freq * 4.02, t); // a little off the exact octave, like metal
    over.connect(og).connect(g);
    for (const o of [tine, over]) { o.start(t); o.stop(t + dur + 0.05); }
  }

  // a koto string: a bright pluck that bends up into the note and rings away, through the echo
  koto(freq, t, dur) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.01, dur / 3.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 9, t);
    f.frequency.exponentialRampToValueAtTime(freq * 2.2, t + 0.25);
    f.connect(g);
    g.connect(this.bus);
    g.connect(this.delay);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(freq * 0.985, t); // the player's finger bends it up into tune
    body.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    body.connect(f);
    const twang = ctx.createOscillator();
    twang.type = 'sawtooth';
    twang.frequency.setValueAtTime(freq * 0.985, t);
    twang.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.4, t);
    tg.gain.setTargetAtTime(0.0001, t + 0.005, 0.05);
    twang.connect(tg).connect(f);
    for (const o of [body, twang]) { o.start(t); o.stop(t + dur + 0.05); }
  }

  // a bamboo flute: a soft sine with a slow vibrato and a puff of air at the start
  flute(freq, t, dur) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + Math.min(0.25, dur * 0.3));
    g.gain.setValueAtTime(0.045, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.bus);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.5); // the vibrato grows into the note
    vib.connect(vg).connect(o.frequency);
    o.connect(g);
    for (const n of [o, vib]) { n.start(t); n.stop(t + dur + 0.05); }
    this.noiseHit(t, Math.min(0.2, dur * 0.4), 'bandpass', freq * 2, 0.018); // breath
  }

  // a taiko drum: a deep, round boom with a skin slap on top. freq: its pitch (fills go down)
  taiko(t, vol, accent = 1, freq = 95) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.3);
    g.gain.setValueAtTime(vol * accent, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.4);
    this.noiseHit(t, 0.05, 'lowpass', 900, 0.12 * vol * accent);
  }

  // a woody clack (the drum's rim / wooden blocks)
  clack(t, vol) {
    this.tom(t, 1150, vol, 0.05);
    this.noiseHit(t, 0.025, 'bandpass', 2600, vol * 0.8);
  }

  // a ghostly "ooh": two voices a hair out of tune, slow to swell, dark (low-passed)
  choir(freq, t, dur) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.022, t + dur * 0.35);
    g.gain.setValueAtTime(0.022, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    f.connect(g).connect(this.bus);
    for (const cents of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(cents, t);
      o.connect(f);
      o.start(t);
      o.stop(t + dur * 1.05 + 0.05);
    }
  }

  kick(t, vol) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.18);
  }

  snare(t) {
    this.noiseHit(t, 0.14, 'bandpass', 1900, 0.32);
    this.tom(t, 200, 0.16, 0.08);
  }

  // a rim click: a tiny woody knock
  rim(t) {
    this.noiseHit(t, 0.03, 'bandpass', 3200, 0.12);
    this.tom(t, 820, 0.06, 0.03);
  }

  tom(t, freq, vol = 0.32, dur = 0.22) {
    const ctx = this.audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseHit(t, dur, type, freq, vol) {
    const ctx = this.audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
