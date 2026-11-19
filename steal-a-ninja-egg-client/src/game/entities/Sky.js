// Blue sky to the north, pink candy sky to the south, with soft drifting clouds. By day a sun, by
// night a big cratered moon, stars and green aurora curtains. The sun and moon cross the sky with the
// server's day / night clock (see setCelestial). All of it is drawn in the dome's own shader, so it
// adds no meshes and no draw calls.
//
// Each stage of the corridor can paint its own sky over that (setStageAt): a starry aurora night over
// Frostbite Hollow, a black-red sky with a huge blood moon over Blood Moon, swirling violet nebulae
// over The Void, a dusty dark over The Nightmare... blended as you run from one to the next.
// (The 3D things up there, dragons, magic orbs, the giant skull, are in StageSkies.js.)

import * as THREE from 'three';
import { BIOMES } from '../../shared/gameData.js';

// k: how much of the stage sky covers the normal one; top / horizon colours; stars, aurora, the blood
// moon and the nebula (0..1); dim: how much the stage darkens the light (tint: the light's colour there)
const STAGE_SKY = {
  graveyard: { k: 0.55, top: '#141c2e', horizon: '#46566a', stars: 0.7, dim: 0.35, tint: '#a8b8d8' },
  bog: { k: 0.6, top: '#0c2416', horizon: '#56803a', stars: 0.5, nebula: 0.35, nebulaColor: '#7aff5a', dim: 0.3, tint: '#b8e0a0' },
  carnival: { k: 0.8, top: '#100828', horizon: '#5a2a6a', stars: 1, nebula: 0.5, nebulaColor: '#ff4a9a', dim: 0.3, tint: '#e8b8ff' },
  frost: { k: 0.9, top: '#040c24', horizon: '#1c3a62', stars: 1, aurora: 1, dim: 0.25, tint: '#bfe0ff' },
  backrooms: { k: 0.5, top: '#3a3018', horizon: '#c8b070', dim: 0.1, tint: '#fff0c0' },
  inferno: { k: 1, top: '#0e0103', horizon: '#4a060a', stars: 0.35, bloodMoon: 1, dim: 0.5, tint: '#ff6a5a' },
  void: { k: 1, top: '#06021a', horizon: '#24084e', stars: 1, nebula: 1, nebulaColor: '#c03aff', dim: 0.45, tint: '#b88aff' },
  nightmare: { k: 1, top: '#060404', horizon: '#3a2a1c', stars: 0.6, nebula: 0.45, nebulaColor: '#ff7a2a', dim: 0.4, tint: '#ffcf9a' },
};
const NO_STAGE = { k: 0, top: '#000000', horizon: '#000000', stars: 0, aurora: 0, bloodMoon: 0, nebula: 0, nebulaColor: '#000000', dim: 0, tint: '#ffffff' };
const stageOf = (id) => ({ ...NO_STAGE, ...(STAGE_SKY[id] || {}) });
const BLEND = 60; // units over which one stage's sky turns into the next at the arch

const fragment = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;
  uniform float uFog;      // 0 = clear, 1 = thick mist
  uniform vec3 uFogColor;
  uniform float uNight;    // 0 = day, 1 = night
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uAurora;   // 0 on Low quality (skips the aurora's noise)
  uniform float uStageK;
  uniform vec3 uStageTop;
  uniform vec3 uStageHorizon;
  uniform float uStageStars;
  uniform float uStageAurora;
  uniform float uBloodMoon;
  uniform float uNebula;
  uniform vec3 uNebulaColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
    return v;
  }

  float starAt(vec3 dir) {
    vec2 sp = vec2(atan(dir.x, dir.z) * 70.0, asin(clamp(dir.y, -1.0, 1.0)) * 70.0);
    vec2 cell = floor(sp);
    float h = hash(cell);
    vec2 off = vec2(hash(cell + 7.3), hash(cell + 3.1)) * 0.6 + 0.2;
    float star = step(0.93, h) * smoothstep(0.16, 0.0, length(fract(sp) - off)) * smoothstep(0.03, 0.2, dir.y);
    return star * (0.55 + 0.45 * sin(uTime * 2.5 + h * 60.0));
  }
  vec3 auroraAt(vec3 dir, float lift) {
    vec2 hz = normalize(dir.xz + vec2(1e-4));
    float aband = smoothstep(0.06 + lift, 0.2 + lift, dir.y) * smoothstep(0.62 + lift * 1.4, 0.28 + lift, dir.y);
    float shape = smoothstep(0.35, 0.8, noise(hz * 2.4 + vec2(uTime * 0.03, uTime * 0.02)));
    float rays = 0.45 + 0.55 * noise(hz * 16.0 + vec2(0.0, uTime * 0.25));
    float ah = smoothstep(0.06, 0.55, dir.y);
    return mix(vec3(0.15, 1.0, 0.45), vec3(0.55, 0.25, 1.0), ah) * aband * shape * rays;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, 0.0, 1.0);
    float pink = smoothstep(-0.35, 0.3, dir.z);
    vec3 horizon = mix(vec3(0.72, 0.87, 1.0), vec3(1.0, 0.72, 0.9), pink);
    vec3 zenith = mix(vec3(0.20, 0.50, 0.92), vec3(1.0, 0.33, 0.78), pink);
    vec3 color = mix(horizon, zenith, pow(up, 0.55));

    // the sun: a bright disc with a warm halo (drawn before the clouds, so they pass in front of it)
    float sd = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
    vec3 sun = vec3(1.0, 0.96, 0.78) * smoothstep(0.048, 0.042, sd)
      + vec3(1.0, 0.86, 0.55) * (exp(-sd * 9.0) * 0.55 + exp(-sd * 3.0) * 0.18);
    color += sun * (1.0 - uNight);

    if (dir.y > 0.01) {
      vec2 uv = dir.xz / (dir.y + 0.18) * 1.5 + vec2(uTime * 0.008, 0.0);
      float cloud = smoothstep(0.52, 0.78, fbm(uv));
      color = mix(color, mix(vec3(1.0), vec3(1.0, 0.86, 0.95), pink), cloud * smoothstep(0.01, 0.14, dir.y));
    }
    // the mist: a band of fog colour along the horizon, thicker when the fog is thicker,
    // so the fogged-out world melts into the sky instead of ending in a hard line
    float band = 1.0 - smoothstep(-0.02, 0.06 + 0.3 * uFog, dir.y);
    color = mix(color, uFogColor, band * uFog);
    if (uNight > 0.001) {
      vec3 night = mix(vec3(0.16, 0.08, 0.26), vec3(0.02, 0.02, 0.08), pow(up, 0.6));
      // small round stars on a grid over the dome (each cell has one, or none), twinkling
      vec2 sp = vec2(atan(dir.x, dir.z) * 70.0, asin(clamp(dir.y, -1.0, 1.0)) * 70.0);
      vec2 cell = floor(sp);
      float h = hash(cell);
      vec2 off = vec2(hash(cell + 7.3), hash(cell + 3.1)) * 0.6 + 0.2;
      float star = step(0.93, h) * smoothstep(0.16, 0.0, length(fract(sp) - off)) * smoothstep(0.03, 0.2, dir.y);
      star *= 0.55 + 0.45 * sin(uTime * 2.5 + h * 60.0);
      night += vec3(star);
      // the aurora: green-to-violet curtains low over the horizon, slowly waving
      if (uAurora > 0.0) {
        // round the horizon as a circle in noise space (an angle would leave a seam where it wraps)
        vec2 hz = normalize(dir.xz + vec2(1e-4));
        float aband = smoothstep(0.06, 0.2, dir.y) * smoothstep(0.62, 0.28, dir.y);
        float shape = smoothstep(0.35, 0.8, noise(hz * 2.4 + vec2(uTime * 0.03, uTime * 0.02)));
        float rays = 0.45 + 0.55 * noise(hz * 16.0 + vec2(0.0, uTime * 0.25));
        float ah = smoothstep(0.06, 0.55, dir.y);
        vec3 aurora = mix(vec3(0.15, 1.0, 0.45), vec3(0.55, 0.25, 1.0), ah);
        night += aurora * aband * shape * rays * 0.5 * uAurora;
      }
      color = mix(color, night, uNight);

      // the moon: a big pale disc with soft craters and a cold glow
      float md = acos(clamp(dot(dir, uMoonDir), -1.0, 1.0));
      vec3 t1 = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
      vec3 t2 = cross(t1, uMoonDir);
      vec2 q = vec2(dot(dir, t1), dot(dir, t2)) / 0.075;
      float crater = noise(q * 2.6 + 3.0) * 0.6 + noise(q * 6.0) * 0.4;
      float disc = smoothstep(0.075, 0.07, md);
      vec3 moon = vec3(0.96, 0.95, 0.88) * (0.78 + 0.22 * smoothstep(0.6, 0.35, crater)) * disc
        + vec3(0.7, 0.75, 1.0) * (exp(-md * 7.0) * 0.4 + exp(-md * 2.5) * 0.1) * (1.0 - disc);
      color = mix(color, moon, disc * uNight) + moon * (1.0 - disc) * uNight;
    }
    // the stage's own sky, laid over the normal one
    if (uStageK > 0.001) {
      float up2 = clamp(dir.y, 0.0, 1.0);
      vec3 st = mix(uStageHorizon, uStageTop, pow(up2, 0.6));
      st += vec3(starAt(dir)) * uStageStars;
      if (uStageAurora > 0.0) st += auroraAt(dir, 0.22) * 1.1 * uStageAurora;
      if (uNebula > 0.0 && dir.y > 0.0) {
        vec2 nuv = dir.xz / (dir.y + 0.25) * 1.2;
        float swirl = fbm(nuv + vec2(fbm(nuv * 1.5 + uTime * 0.02), fbm(nuv * 1.5 - uTime * 0.015)) * 1.6);
        st += uNebulaColor * smoothstep(0.5, 0.95, swirl) * 0.9 * uNebula * smoothstep(0.0, 0.25, dir.y);
      }
      if (uBloodMoon > 0.0) {
        vec3 bm = normalize(vec3(0.3, 0.42, -1.0));
        float d = acos(clamp(dot(dir, bm), -1.0, 1.0));
        vec3 t1 = normalize(cross(bm, vec3(0.0, 1.0, 0.0)));
        vec2 q = vec2(dot(dir, t1), dot(dir, cross(t1, bm))) / 0.17;
        float disc = smoothstep(0.17, 0.16, d);
        vec3 moon = vec3(0.9, 0.1, 0.06) * (0.7 + 0.3 * noise(q * 3.0 + 2.0)) + vec3(1.0, 0.5, 0.3) * smoothstep(0.17, 0.1, d) * 0.15;
        st = mix(st, moon, disc * uBloodMoon) + vec3(1.0, 0.08, 0.04) * (exp(-d * 5.0) * 0.7 + exp(-d * 1.6) * 0.15) * (1.0 - disc) * uBloodMoon;
      }
      color = mix(color, st, uStageK);
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

// Where the sun / moon is p of the way through its day (0 = rising in the east, 1 = setting in the
// west). The arc leans north (-z), down the biome corridor, so you see it while you run.
const _c = new THREE.Color();

function arc(p, out = new THREE.Vector3()) {
  const a = (0.1 + p * 0.8) * Math.PI;
  return out.set(Math.cos(a), 0.05 + Math.sin(a) * 0.5, -0.75).normalize();
}

export class Sky {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 }, uFog: { value: 0 }, uFogColor: { value: new THREE.Color() }, uNight: { value: 0 },
        uSunDir: { value: arc(0.5) }, uMoonDir: { value: arc(0) }, uAurora: { value: 1 },
        uStageK: { value: 0 }, uStageTop: { value: new THREE.Color() }, uStageHorizon: { value: new THREE.Color() },
        uStageStars: { value: 0 }, uStageAurora: { value: 0 }, uBloodMoon: { value: 0 }, uNebula: { value: 0 }, uNebulaColor: { value: new THREE.Color() },
      },
      // z = w pins the dome to the far plane, so it never gets clipped when the
      // quality tier shortens camera.far below the sphere radius (that showed as black sky).
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: fragment,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 20), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.stage = { dim: 0, tint: new THREE.Color('#ffffff') };
  }

  // The sky of the stage at z (blended from the one before over the first BLEND units after an arch).
  // Also keeps this.stage = { dim, tint } for the lights.
  setStageAt(z) {
    let a = NO_STAGE, b = NO_STAGE, t = 0;
    const i = BIOMES.findIndex((bm) => z <= bm.maxZ && z > bm.minZ);
    if (i >= 0) {
      const biome = BIOMES[i];
      a = stageOf(biome.id);
      const fromEntry = biome.maxZ - z;
      if (fromEntry < BLEND) {
        b = i > 0 ? stageOf(BIOMES[i - 1].id) : NO_STAGE;
        t = 1 - fromEntry / BLEND;
        t = t * t * (3 - 2 * t) * 0.5;
      }
    } else if (z <= BIOMES[BIOMES.length - 1].minZ) a = stageOf(BIOMES[BIOMES.length - 1].id);
    const mixN = (x, y) => x + (y - x) * t;
    const u = this.material.uniforms;
    u.uStageK.value = mixN(a.k, b.k);
    // colours: a stage with no sky of its own lends none (the other one's colours are used)
    const top = a.k === 0 ? b.top : b.k === 0 ? a.top : null;
    const hor = a.k === 0 ? b.horizon : b.k === 0 ? a.horizon : null;
    if (top) { u.uStageTop.value.set(top); u.uStageHorizon.value.set(hor); } else {
      u.uStageTop.value.set(a.top).lerp(_c.set(b.top), t);
      u.uStageHorizon.value.set(a.horizon).lerp(_c.set(b.horizon), t);
    }
    u.uStageStars.value = mixN(a.stars, b.stars);
    u.uStageAurora.value = mixN(a.aurora, b.aurora) * u.uAurora.value;
    u.uBloodMoon.value = mixN(a.bloodMoon, b.bloodMoon);
    u.uNebula.value = mixN(a.nebula, b.nebula);
    u.uNebulaColor.value.set(a.nebula >= b.nebula ? a.nebulaColor : b.nebulaColor);
    this.stage.dim = mixN(a.dim, b.dim);
    this.stage.tint.set(a.tint).lerp(_c.set(b.tint), t);
  }

  setFog(color, amount) {
    this.material.uniforms.uFogColor.value.copy(color);
    this.material.uniforms.uFog.value = amount;
  }

  setNight(k) {
    this.material.uniforms.uNight.value = k;
  }

  // p: how far through the current day (or night) we are, 0..1. By day the sun is at p and the moon
  // waits where it set; by night the moon is at p and the sun waits where it set. So when one fades
  // out at the change it is exactly where it was, and the other rises from the east.
  setCelestial(p, night) {
    const u = this.material.uniforms;
    arc(night ? 1 : p, u.uSunDir.value);
    arc(night ? p : 1, u.uMoonDir.value);
  }

  get sunDir() { return this.material.uniforms.uSunDir.value; }
  get moonDir() { return this.material.uniforms.uMoonDir.value; }

  setAurora(on) {
    this.material.uniforms.uAurora.value = on ? 1 : 0;
  }

  update(dt, cameraPosition) {
    this.material.uniforms.uTime.value += dt;
    this.mesh.position.copy(cameraPosition);
  }
}
