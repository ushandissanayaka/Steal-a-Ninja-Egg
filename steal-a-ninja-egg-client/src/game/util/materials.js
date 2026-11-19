import * as THREE from 'three';
import { studTexture } from './textures.js';

let voxel = null;

// Shared by every Voxels mesh: vertex colors over the stud pattern.
export function voxelMaterial() {
  voxel ??= new THREE.MeshLambertMaterial({ vertexColors: true, map: studTexture() });
  return voxel;
}

export const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
