// Collects many colored boxes into one mesh. The whole world is built from these.

import * as THREE from 'three';
import { voxelMaterial } from './materials.js';

const STUD_SIZE = 1.3; // world units per repeat of the stud texture
const template = new THREE.BoxGeometry(1, 1, 1);
const tPos = template.getAttribute('position');
const tNor = template.getAttribute('normal');
const tUv = template.getAttribute('uv');
const tIdx = template.getIndex();

const _color = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _normalMatrix = new THREE.Matrix3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _center = new THREE.Vector3();

export class Voxels {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
  }

  // x, z = center of the box, y = its bottom.
  box(x, y, z, w, h, d, color, { rx = 0, ry = 0, rz = 0 } = {}) {
    _color.set(color);
    _center.set(x, y + h / 2, z);
    _quat.setFromEuler(_euler.set(rx, ry, rz));
    _matrix.compose(_center, _quat, _one);
    _normalMatrix.getNormalMatrix(_matrix);

    const base = this.positions.length / 3;
    for (let i = 0; i < tPos.count; i++) {
      _v.set(tPos.getX(i) * w, tPos.getY(i) * h, tPos.getZ(i) * d).applyMatrix4(_matrix);
      this.positions.push(_v.x, _v.y, _v.z);
      _v.set(tNor.getX(i), tNor.getY(i), tNor.getZ(i)).applyMatrix3(_normalMatrix).normalize();
      this.normals.push(_v.x, _v.y, _v.z);
      const face = i >> 2; // BoxGeometry order: +x -x +y -y +z -z, four vertices each
      const [su, sv] = face < 2 ? [d, h] : face < 4 ? [w, d] : [w, h];
      this.uvs.push((tUv.getX(i) * su) / STUD_SIZE, (tUv.getY(i) * sv) / STUD_SIZE);
      this.colors.push(_color.r, _color.g, _color.b);
    }
    for (let i = 0; i < tIdx.count; i++) this.indices.push(base + tIdx.getX(i));
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    return g;
  }

  mesh({ castShadow = true, receiveShadow = true } = {}) {
    const m = new THREE.Mesh(this.geometry(), voxelMaterial());
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    return m;
  }
}

// The same, but split into chunks along Z (the road), so the parts of the world far behind the mist
// or outside the view are not drawn at all, and shadows only draw the chunks near the player.
// Boxes longer than a chunk (whole-length walls, the island under the map) go in one "big" chunk.
export class ChunkedVoxels {
  constructor(size = 320) {
    this.size = size;
    this.chunks = new Map(); // chunk index (or 'big') -> Voxels
  }

  box(x, y, z, w, h, d, color, opts) {
    const key = d > this.size ? 'big' : Math.floor(z / this.size);
    let chunk = this.chunks.get(key);
    if (!chunk) this.chunks.set(key, (chunk = new Voxels()));
    chunk.box(x, y, z, w, h, d, color, opts);
    return this;
  }

  // make(voxels) -> Mesh. Each mesh remembers its Z range for distance culling (none for 'big').
  meshes(make = (v) => v.mesh()) {
    return [...this.chunks].map(([key, v]) => {
      const mesh = make(v);
      if (key !== 'big') mesh.userData.chunk = { z: (key + 0.5) * this.size, half: this.size / 2 };
      return mesh;
    });
  }
}
