// The glass gate across the corridor mouth (the red line). For the last few seconds before day turns to
// night (or night to day) a huge pane of glass rises out of the ground and closes the way into the
// biomes. It is see-through, with a shine sweeping over it, and shows what is coming (a moon or a sun)
// and the seconds left. When the change comes it sinks back into the ground.
//
// It is one-way: it stops players walking from the lobby into the corridor, but anyone coming home
// (maybe carrying an egg) walks straight through it (see Game.blockAtGlass).
//
// Driven only by the server's clock (state.clock = seconds left in this day / night, state.night), so
// every player sees it close and open at the same moment.

import * as THREE from 'three';
import { CYCLE, WORLD } from '../../shared/gameData.js';
import { glowMap } from './Effects.js';
import { canvasTexture, drawOutlinedText, FONT_TITLE } from '../util/canvasText.js';

export const GATE_SECONDS = 5;       // closed for the last this-many seconds of each day and night
// The pane stands just SOUTH of the red line, in front of the first biome's arch (its beam and the
// "Pumpkin Patch" board, which reach 4 units either side of the line) and of the lobby's north wall,
// so nothing hides the sun / moon and the countdown from the lobby.
export const GATE_Z = WORLD.lineZ + 6;
const WIDTH = WORLD.openingHalf * 2 + 10; // a little wider than the opening: no gap at the wall ends
const HEIGHT = WORLD.corridorWallHeight;
const RISE = 2.2;                    // how fast it rises / sinks (1 / seconds)
const CANVAS_W = 1024, CANVAS_H = 400;

const glassVertex = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const glassFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uShow;
  uniform vec3 uTint;
  #include <fog_pars_fragment>
  void main() {
    // a pale see-through pane, a bit brighter at the top
    float alpha = 0.24 + vUv.y * 0.12; // a little see-through
    vec3 color = uTint;
    // a bright frame round the edge
    vec2 e = min(vUv, 1.0 - vUv) * vec2(${(WIDTH / HEIGHT).toFixed(3)}, 1.0);
    float frame = 1.0 - smoothstep(0.012, 0.02, min(e.x, e.y));
    // two diagonal shines sweeping across
    float d = vUv.x * ${(WIDTH / HEIGHT).toFixed(3)} + vUv.y * 0.6 - uTime * 0.5;
    float shine = smoothstep(0.1, 0.0, abs(fract(d * 0.25) - 0.5) - 0.02) * 0.35
                + smoothstep(0.04, 0.0, abs(fract(d * 0.25 + 0.08) - 0.5)) * 0.2;
    color = mix(color, vec3(1.0), clamp(shine + frame, 0.0, 1.0));
    alpha = clamp(alpha + shine * 0.5 + frame * 0.75, 0.0, 1.0) * uShow;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// a crescent moon with a little cloud, or a sun with rays, centred on (cx, cy)
function drawIcon(g, cx, cy, r, night) {
  g.save();
  g.lineJoin = 'round';
  if (night) {
    // the crescent: a disc with a bite out of it, drawn on its own canvas then outlined
    const s = Math.ceil(r * 2.6);
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const m = c.getContext('2d');
    m.fillStyle = '#fff1a8';
    m.beginPath(); m.arc(s / 2, s / 2, r, 0, Math.PI * 2); m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath(); m.arc(s / 2 + r * 0.55, s / 2 - r * 0.35, r * 0.85, 0, Math.PI * 2); m.fill();
    const x = cx - s / 2, y = cy - s / 2;
    g.filter = 'brightness(0)';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) g.drawImage(c, x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    g.filter = 'none';
    g.drawImage(c, x, y);
    // the cloud at its foot
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#1a1a2a';
    g.lineWidth = 9;
    const puffs = [[-0.15, 0.62, 0.36], [0.25, 0.55, 0.42], [0.62, 0.68, 0.3]];
    for (const pass of ['stroke', 'fill']) {
      for (const [px, py, pr] of puffs) {
        g.beginPath(); g.arc(cx + px * r, cy + py * r, pr * r, 0, Math.PI * 2); g[pass]();
      }
    }
  } else {
    g.fillStyle = '#ffb21f';
    g.strokeStyle = '#3a2000';
    g.lineWidth = 9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.14) * r * 0.95, cy + Math.sin(a - 0.14) * r * 0.95);
      g.lineTo(cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45);
      g.lineTo(cx + Math.cos(a + 0.14) * r * 0.95, cy + Math.sin(a + 0.14) * r * 0.95);
      g.closePath();
      g.stroke(); g.fill();
    }
    const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#fff6b0');
    grad.addColorStop(1, '#ffd21f');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); g.fill();
  }
  g.restore();
}

export class GlassGate {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, GATE_Z);
    this.group.visible = false;
    scene.add(this.group);

    this.uniforms = {
      uTime: { value: 0 }, uShow: { value: 0 }, uTint: { value: new THREE.Color('#bfe4ff') },
      ...THREE.UniformsLib.fog,
    };
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH, HEIGHT).translate(0, HEIGHT / 2, 0),
      new THREE.ShaderMaterial({
        vertexShader: glassVertex, fragmentShader: glassFragment, uniforms: this.uniforms,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      }),
    );
    glass.renderOrder = 8;
    this.group.add(glass);

    // the moon / sun and the countdown, one face each way so it reads the right way round from both sides
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = canvasTexture(this.canvas);
    this.signMaterial = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, opacity: 0 });
    const signW = 110, signH = signW * (CANVAS_H / CANVAS_W);
    for (const s of [1, -1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), this.signMaterial);
      sign.position.set(0, HEIGHT * 0.66, s * 0.4); // high up on the glass
      sign.rotation.y = s > 0 ? 0 : Math.PI;
      sign.renderOrder = 9;
      this.group.add(sign);
    }

    this.dust = null;   // the magic dust the glass turns into when it opens (see dissolve)
    this.show = 0;      // 0 = down in the ground, 1 = fully up
    this.closed = false;
    this.drawn = '';
  }

  // gate: true = the countdown after the change (the new day / night is here), false = the last
  // seconds before it (what is coming)
  draw(seconds, night, gate) {
    const key = `${seconds}|${night}|${gate}`;
    if (key === this.drawn) return false;
    this.drawn = key;
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const showNight = gate ? night : !night;
    drawIcon(g, 340, 175, 105, showNight);
    drawOutlinedText(g, `${seconds}S`, 690, 180, { size: 190, fill: '#ffffff', stroke: '#1a1a2a', strokeWidth: 22, font: FONT_TITLE, weight: 400, glow: false });
    const text = gate ? (night ? 'NIGHT! GATE OPENS IN' : 'MORNING! GATE OPENS IN') : (night ? 'MORNING IS COMING!' : 'NIGHT IS COMING!');
    drawOutlinedText(g, text, CANVAS_W / 2, 350, {
      size: 58, fill: showNight ? '#c89bff' : '#ffd21f', stroke: '#1a1a2a', strokeWidth: 12, font: FONT_TITLE, weight: 400, glow: false,
    });
    this.texture.needsUpdate = true;
    return true;
  }

  // Shut for the last CYCLE.freezeS seconds of a day / night (it rises while everyone stands still) and
  // the CYCLE.gateS seconds after it, counting down on the glass. When it opens: with fancy on (a
  // smooth frame rate and a good connection) it bursts into magic dust that spirals up and away,
  // otherwise it just sinks into the ground. Returns true when the number changed (a tick sound).
  update(dt, state, fancy = false) {
    const clock = Math.max(0, state.clock | 0), gate = state.gate | 0;
    const wasClosed = this.closed;
    this.closed = gate > 0 || clock <= CYCLE.freezeS;
    if (wasClosed && !this.closed && this.show > 0.5 && fancy) this.dissolve();
    this.updateDust(dt);
    if (this.dissolving) {
      // the pane fades out fast while the dust takes over
      this.show = Math.max(0, this.show - dt * 4);
      if (this.show <= 0) this.dissolving = false;
    } else {
      const goal = this.closed ? 1 : 0;
      this.show = goal > this.show ? Math.min(1, this.show + dt * RISE) : Math.max(0, this.show - dt * RISE);
    }
    this.group.visible = this.show > 0.001;
    if (!this.group.visible) {
      this.drawn = '';
      return false;
    }
    const k = this.show;
    const ease = this.dissolving ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
    this.group.scale.y = Math.max(0.001, ease);
    this.uniforms.uShow.value = Math.min(1, k * 1.5);
    this.uniforms.uTime.value += dt;
    this.signMaterial.opacity = Math.min(1, k * 1.5);
    if (!this.closed) return false;
    return gate > 0 ? this.draw(gate, state.night, true) : this.draw(Math.max(1, clock), state.night, false);
  }

  // The glass becomes a whirl of magic dust: every grain starts on the pane and spirals in round the
  // gate's middle as it rises, fading out.
  dissolve() {
    this.dissolving = true;
    const N = 700;
    if (!this.dust) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const col = new Float32Array(N * 3);
      const palette = ['#bfe4ff', '#e0a8ff', '#ffe27a', '#7fffe0', '#ffffff'].map((c) => new THREE.Color(c));
      for (let i = 0; i < N; i++) { const c = palette[i % palette.length]; col.set([c.r, c.g, c.b], i * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: 3.2, map: glowMap(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.dust = new THREE.Points(geo, mat);
      this.dust.frustumCulled = false;
      this.dust.position.set(0, 0, GATE_Z);
      this.group.parent.add(this.dust);
      this.grains = Array.from({ length: N }, () => ({}));
    }
    for (const g of this.grains) {
      const x = (Math.random() - 0.5) * WIDTH, y = Math.random() * HEIGHT;
      g.r = Math.abs(x) + 2; g.a = x < 0 ? Math.PI : 0; g.y = y;
      g.spin = (1.6 + Math.random() * 1.6) * (Math.random() < 0.5 ? 1 : 1);
      g.rise = 14 + Math.random() * 22;
      g.delay = Math.random() * 0.35;
    }
    this.dustT = 0;
    this.dust.visible = true;
  }

  updateDust(dt) {
    if (!this.dust?.visible) return;
    this.dustT += dt;
    const LIFE = 2.6;
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < this.grains.length; i++) {
      const g = this.grains[i];
      const t = Math.max(0, this.dustT - g.delay);
      const k = Math.min(1, t / LIFE);
      const a = g.a + g.spin * t * (1 + k * 2);         // spinning faster as it closes in
      const r = g.r * (1 - k * 0.85);                   // drawn in towards the middle
      pos.setXYZ(i, Math.cos(a) * r, g.y + g.rise * t + k * k * 30, Math.sin(a) * r * 0.5);
    }
    pos.needsUpdate = true;
    this.dust.material.opacity = Math.max(0, 1 - Math.max(0, this.dustT - LIFE * 0.45) / (LIFE * 0.55));
    if (this.dustT > LIFE + 0.4) this.dust.visible = false;
  }
}
