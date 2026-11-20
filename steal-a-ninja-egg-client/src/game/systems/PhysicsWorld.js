import { WORLD } from '../../shared/gameData.js';

const GRAVITY = 110;
const EDGE = 2;

// Flat ground, with the player as a circle against boxes and tree trunks.
export class PhysicsWorld {
  constructor() {
    this.boxes = [];   // { minX, maxX, minZ, maxZ, top }
    this.circles = []; // { x, z, r, active }
    this.surfaces = []; // { minX, maxX, minZ, maxZ, height, ry }
  }

  addBox(minX, maxX, minZ, maxZ, top = Infinity) {
    this.boxes.push({
      minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ), top,
    });
  }

  addCircle(x, z, r) {
    const circle = { x, z, r, active: true };
    this.circles.push(circle);
    return circle;
  }

  // A raised floor the player can step onto, like a treadmill belt. ry = the way to face on it.
  addSurface(minX, maxX, minZ, maxZ, height, ry) {
    this.surfaces.push({
      minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ), height, ry,
    });
  }

  // A plain raised floor you walk up onto (the pens' stages): never a treadmill.
  addFloor(minX, maxX, minZ, maxZ, height) {
    this.surfaces.push({
      minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ), height, floor: true,
    });
  }

  // A round raised floor (the training arena): standing still on it you spin.
  addRoundSurface(x, z, r, height, extra = {}) {
    this.surfaces.push({ round: true, x, z, r, height, ...extra });
  }

  surfaceAt(x, z) {
    return this.surfaces.find((s) => (s.round
      ? Math.hypot(x - s.x, z - s.z) <= s.r
      : x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ)) || null;
  }

  step(body, dt) {
    const p = body.pos;
    body.vel.y -= GRAVITY * dt;
    p.x += body.vel.x * dt;
    p.y += body.vel.y * dt;
    p.z += body.vel.z * dt;

    const ground = this.surfaceAt(p.x, p.z)?.height ?? 0;
    if (p.y <= ground) {
      p.y = ground;
      body.vel.y = 0;
      body.grounded = true;
    } else {
      body.grounded = false;
    }

    for (const b of this.boxes) {
      if (p.y >= b.top) continue;
      const nx = Math.max(b.minX, Math.min(b.maxX, p.x));
      const nz = Math.max(b.minZ, Math.min(b.maxZ, p.z));
      let dx = p.x - nx;
      let dz = p.z - nz;
      const d = Math.hypot(dx, dz);
      if (d >= body.radius) continue;
      if (d > 1e-5) {
        p.x = nx + (dx / d) * body.radius;
        p.z = nz + (dz / d) * body.radius;
      } else {
        // the center is inside the box: leave by the nearest side
        const left = p.x - b.minX, right = b.maxX - p.x, back = p.z - b.minZ, front = b.maxZ - p.z;
        const least = Math.min(left, right, back, front);
        if (least === left) p.x = b.minX - body.radius;
        else if (least === right) p.x = b.maxX + body.radius;
        else if (least === back) p.z = b.minZ - body.radius;
        else p.z = b.maxZ + body.radius;
      }
    }

    for (const c of this.circles) {
      if (!c.active) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const reach = c.r + body.radius;
      const d = Math.hypot(dx, dz);
      if (d >= reach || d < 1e-5) continue;
      p.x = c.x + (dx / d) * reach;
      p.z = c.z + (dz / d) * reach;
    }

    p.x = Math.max(-WORLD.halfX + EDGE, Math.min(WORLD.halfX - EDGE, p.x));
    p.z = Math.max(WORLD.northZ + EDGE, Math.min(WORLD.southZ - EDGE, p.z));
  }
}
