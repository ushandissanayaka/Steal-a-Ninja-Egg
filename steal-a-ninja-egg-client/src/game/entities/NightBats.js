// Bats at night: a few flocks of black bat silhouettes circling high over the player, flapping, drifting
// round the sky. They come out as night falls (they grow in from nothing) and go away at morning.
//
// Cheap on purpose: every bat on every quality tier is one InstancedMesh (one draw call), the wing flap
// happens in the vertex shader, and only the instances' matrices are set each frame. They are not
// updated (or drawn) at all by day.

import * as THREE from 'three';

const MAX_BATS = 48;
const BATS_PER_TIER = { low: 12, medium: 24, high: 36, ultra: 48 };
const FLOCK_SIZE = 12;          // bats per flock (the last flock may be smaller)
const BAT_COLOR = '#0a0610';

// A bat seen from above: a small body and two wings with a scalloped trailing edge. x runs across the
// wings (the flap bends them by |x|), z points forward.
function batGeometry() {
  const tri = [];
  const add = (...pts) => tri.push(...pts.flat());
  // the body and head (with two little ears)
  add([0, 0, 0.55], [-0.14, 0, 0], [0.14, 0, 0]);
  add([-0.14, 0, 0], [0, 0, -0.45], [0.14, 0, 0]);
  add([-0.1, 0, 0.5], [-0.14, 0.02, 0.72], [-0.02, 0, 0.55]);
  add([0.1, 0, 0.5], [0.14, 0.02, 0.72], [0.02, 0, 0.55]);
  for (const s of [-1, 1]) {
    // the leading edge runs out to the wing tip; the back edge dips between three "fingers"
    const shoulder = [s * 0.12, 0, 0.3];
    const tip = [s * 1.3, 0, 0.05];
    const f1 = [s * 0.95, 0, -0.35], f2 = [s * 0.55, 0, -0.42];
    const dip1 = [s * 1.05, 0, -0.12], dip2 = [s * 0.72, 0, -0.18], dip3 = [s * 0.35, 0, -0.15];
    const hip = [s * 0.12, 0, -0.2];
    const elbow = [s * 0.6, 0, 0.32];
    const fan = [shoulder, elbow, tip, dip1, f1, dip2, f2, dip3, hip];
    for (let i = 1; i < fan.length - 1; i++) add(shoulder, fan[i], fan[i + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  return g;
}

const vertexShader = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float w = abs(p.x);
    float flap = sin(uTime * 13.0 + aPhase);
    // the wings swing up and down from the shoulders, the tips the most, and fold in a little at the top
    p.y += flap * w * 0.75;
    p.x *= 1.0 - max(flap, 0.0) * 0.18;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }
`;

const rand = (a, b) => a + Math.random() * (b - a);

export class NightBats {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(BAT_COLOR) } },
    });
    const geometry = batGeometry();
    const phase = new Float32Array(MAX_BATS);
    for (let i = 0; i < MAX_BATS; i++) phase[i] = Math.random() * Math.PI * 2;
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    this.mesh = new THREE.InstancedMesh(geometry, this.material, MAX_BATS);
    this.mesh.frustumCulled = false; // they fly all round the player; the bounds would always be stale
    this.mesh.visible = false;
    this.mesh.renderOrder = -5;      // in front of the sky, behind everything else that is transparent
    scene.add(this.mesh);

    // flocks circle a point that wanders round the player; each bat keeps its own place in the flock
    this.flocks = [];
    this.bats = [];
    for (let i = 0; i < MAX_BATS; i++) {
      const f = Math.floor(i / FLOCK_SIZE);
      if (!this.flocks[f]) {
        this.flocks[f] = {
          bearing: rand(0, Math.PI * 2),       // where the flock's circle is, seen from the player
          drift: rand(0.025, 0.06) * (Math.random() < 0.5 ? -1 : 1),
          distance: rand(70, 140),
          radius: rand(18, 34),
          height: rand(55, 95),
          spin: rand(0.35, 0.55) * (Math.random() < 0.5 ? -1 : 1),
          angle: rand(0, Math.PI * 2),
        };
      }
      this.bats.push({
        flock: f,
        angle: rand(-0.9, 0.9),     // how far ahead / behind in the circle
        dr: rand(-6, 6),
        dy: rand(-5, 5),
        bob: rand(0, Math.PI * 2),
        size: rand(2.2, 3.4),
      });
    }
    this.count = BATS_PER_TIER.high;
    this.dummy = new THREE.Object3D();
  }

  setQuality(tier) {
    this.count = BATS_PER_TIER[tier] ?? BATS_PER_TIER.medium;
    this.mesh.count = this.count;
  }

  // nightK: 0 = day, 1 = night (eased). around: the player's position.
  // extrasK: 1 = the game runs smoothly with a good connection (Game.extrasK, eased). Only then do the
  // bats fly; when the frame rate or the ping gets worse they shrink away (and come back later).
  update(dt, nightK, around, extrasK = 1) {
    const show = nightK > 0.02 && extrasK > 0.01;
    this.mesh.visible = show;
    if (!show) return;
    this.material.uniforms.uTime.value += dt;
    const grow = Math.min(1, (nightK - 0.02) / 0.6) * extrasK; // they appear as the dark comes in
    for (const f of this.flocks) {
      f.bearing += f.drift * dt;
      f.angle += f.spin * dt;
    }
    const t = this.material.uniforms.uTime.value;
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      const b = this.bats[i];
      const f = this.flocks[b.flock];
      const cx = around.x + Math.cos(f.bearing) * f.distance;
      const cz = around.z + Math.sin(f.bearing) * f.distance;
      const a = f.angle + b.angle;
      const r = f.radius + b.dr;
      d.position.set(cx + Math.cos(a) * r, f.height + b.dy + Math.sin(t * 1.4 + b.bob) * 2, cz + Math.sin(a) * r);
      // face along the circle (the tangent), banked a little into the turn
      d.rotation.set(0, -a + (f.spin > 0 ? 0 : Math.PI), Math.sign(f.spin) * 0.35, 'YXZ');
      d.scale.setScalar(b.size * grow);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
