// A line of bright yellow chevrons on the ground, flowing from the player towards what to do next
// (the axe shop, a tree, an egg, your shredder...). Each chevron has a dark outline and a soft glow
// so it stands out on any ground (pink candy, white snow, dark ash), and they pulse gently.

import * as THREE from 'three';
import { glowMap } from './Effects.js';

const COUNT = 9;
const SPACING = 8.5;
const START = 5;        // first arrow this far ahead of the player
const STOP_SHORT = 7;   // no arrows this close to the target
const SPEED = 7;        // units per second the arrows flow
const HEIGHT = 0.35;
const SIZE = 1.45;      // bigger than before, easier to see
const COLOR = '#fff23a';
const OUTLINE = '#3a2a00';

function chevronGeometry(grow = 0) {
  const s = new THREE.Shape();
  s.moveTo(0, 2 + grow * 1.6);
  s.lineTo(3 + grow, -1);
  s.lineTo(3 + grow, -2.7 - grow);
  s.lineTo(0, 0.3 - grow * 0.4);
  s.lineTo(-3 - grow, -2.7 - grow);
  s.lineTo(-3 - grow, -1);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2); // flat on the ground, pointing at -Z
  return g;
}

export class GuideArrows {
  constructor(scene) {
    const fill = chevronGeometry();
    const edge = chevronGeometry(0.55);
    const halo = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2);
    this.arrows = Array.from({ length: COUNT }, () => {
      const group = new THREE.Group();
      const glow = new THREE.Mesh(halo, new THREE.MeshBasicMaterial({
        map: glowMap(), color: COLOR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }));
      glow.position.y = -0.04;
      const outline = new THREE.Mesh(edge, new THREE.MeshBasicMaterial({ color: OUTLINE, transparent: true, depthWrite: false, fog: false }));
      outline.position.y = -0.02;
      const arrow = new THREE.Mesh(fill, new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, depthWrite: false, fog: false }));
      group.add(glow, outline, arrow);
      group.scale.setScalar(SIZE);
      group.traverse((o) => { o.renderOrder = 1; });
      group.visible = false;
      group.userData = { glow, outline, arrow };
      scene.add(group);
      return group;
    });
    this.flow = 0;
    this.time = 0;
  }

  // target: { x, z } or null
  update(dt, from, target) {
    this.time += dt;
    this.flow = (this.flow + dt * SPEED) % SPACING;
    const dx = target ? target.x - from.x : 0, dz = target ? target.z - from.z : 0;
    const dist = Math.hypot(dx, dz);
    const show = target && dist > START + STOP_SHORT;
    const ux = show ? dx / dist : 0, uz = show ? dz / dist : 0;
    const heading = Math.atan2(-dx, -dz);
    const end = dist - STOP_SHORT;
    const pulse = 0.85 + Math.sin(this.time * 5) * 0.15;

    this.arrows.forEach((group, i) => {
      const along = START + i * SPACING + this.flow;
      group.visible = !!show && along < end;
      if (!group.visible) return;
      group.position.set(from.x + ux * along, HEIGHT, from.z + uz * along);
      group.rotation.y = heading;
      // fade in near the player and out at the far end of the line
      const fadeIn = Math.min(1, (along - START) / SPACING);
      const fadeOut = Math.min(1, (end - along) / SPACING, (START + COUNT * SPACING - along) / (SPACING * 2));
      const k = Math.max(0, Math.min(fadeIn, fadeOut));
      const { glow, outline, arrow } = group.userData;
      arrow.material.opacity = k;
      outline.material.opacity = k * 0.85;
      glow.material.opacity = k * 0.6 * pulse;
    });
  }
}
