// Lamps that come on at night: the dojo's roof lanterns, the garden's stone lanterns and shrine lamps,
// the fire temple's four high lamps. By day their glass is dull (off); as night falls it brightens,
// a soft halo shows round each one, and the real lights (the fire temple's) shine on the floor.
//
// Everything lit goes into one unlit voxel set (a few draw calls), the halos into one Points per
// size, and setNight(k) (0 = day, 1 = night) changes only colours, opacities and intensities, so
// nothing has to be rebuilt or recompiled when night comes.

import * as THREE from 'three';
import { ChunkedVoxels } from '../util/bake.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glowMap } from './Effects.js';

const OFF = 0.5;       // how bright the glass is by day (1 = fully lit)

export class NightLamps {
  constructor(scene) {
    this.scene = scene;
    this.v = new ChunkedVoxels();
    this.halos = new Map();   // size -> [[x, y, z, color]]
    this.lights = [];         // { light, power }
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color().setScalar(OFF) });
    this.haloMaterials = [];
    this.beams = [];          // light shining up round things (one merged mesh)
    this.k = -1;
  }

  // the lit glass of a lamp (like Voxels.box)
  box(...args) { this.v.box(...args); }

  // a soft glow round a lamp at night
  halo(x, y, z, size = 10, color = '#ffd88a') {
    const key = Math.round(size);
    if (!this.halos.has(key)) this.halos.set(key, []);
    this.halos.get(key).push([x, y, z, color]);
  }

  // A soft column of light shining up from the ground round something (x, z, its radius, how high):
  // faint by day, bright at night, fading out as it rises.
  beam(x, z, r, h, color = '#ffe8a0') {
    const geo = new THREE.CylinderGeometry(r, r * 0.92, h, 20, 1, true).translate(x, h / 2, z);
    geo.deleteAttribute('normal');
    const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.beams.push(geo);
  }

  // a real light, at power by night and off by day
  light(light, power) {
    light.intensity = 0;
    this.lights.push({ light, power });
    this.scene.add(light);
    if (light.target) this.scene.add(light.target);
  }

  // Called once the world is built.
  finish() {
    if (this.beams.length) {
      this.beamMaterial = new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0.2 } },
        vertexShader: 'attribute vec3 color; varying vec3 vC; varying float vY; void main() { vC = color; vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec3 vC; varying float vY; uniform float uK; void main() { float a = pow(1.0 - vY, 2.2) * uK; gl_FragColor = vec4(vC, a); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const beams = new THREE.Mesh(mergeGeometries(this.beams), this.beamMaterial);
      beams.frustumCulled = false;
      beams.renderOrder = 4;
      this.scene.add(beams);
    }
    const meshes = this.v.meshes((c) => new THREE.Mesh(c.geometry(), this.material));
    if (meshes.length) this.scene.add(...meshes);
    const c = new THREE.Color();
    for (const [size, list] of this.halos) {
      const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3);
      list.forEach(([x, y, z, color], i) => {
        pos.set([x, y, z], i * 3);
        c.set(color);
        col.set([c.r, c.g, c.b], i * 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const material = new THREE.PointsMaterial({
        map: glowMap(), size, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, material);
      points.renderOrder = 5;
      this.scene.add(points);
      this.haloMaterials.push(material);
    }
    this.setNight(0);
  }

  setNight(k) {
    k = Math.round(k * 100) / 100;
    if (k === this.k) return;
    this.k = k;
    this.material.color.setScalar(OFF + (1 - OFF) * k);
    for (const m of this.haloMaterials) m.opacity = 0.85 * k;
    if (this.beamMaterial) this.beamMaterial.uniforms.uK.value = 0.12 + 0.5 * k; // faint by day
    for (const { light, power } of this.lights) light.intensity = power * k;
  }
}
