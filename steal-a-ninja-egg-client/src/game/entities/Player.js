import * as THREE from 'three';
import { BloxityAvatar } from './BloxityAvatar.js';
import { createNameTag } from './NameTag.js';
import { createEgg } from './Egg.js';
import { createAxeMesh } from './Axe.js';
import { TrailRibbon } from './Trail.js';
import { trailById } from '../../shared/progression.js';
import { EGG_SIZES } from '../../shared/gameData.js';

const KNOCKBACK_SECONDS = 0.45;
const JUMP_VELOCITY = 38;
const TAG_HEIGHT = 5.9;
const TREADMILL_JOG_SPEED = 3;
// The held egg sits on both hands, out in front of the chest (the character faces +Z).
const HELD_EGG = new THREE.Vector3(0, 3.95, 2.9); // on top of the hands, a little in front of them
const HELD_EGG_SCALE = 1.05;
const LIFT_SECONDS = 0.35; // the egg rises from the ground into the hands
const SHATTER_SECONDS = 1.4; // hidden while the pieces fly, then...
const POP_SECONDS = 0.35;    // ...pops back together over this long

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

class Character {
  constructor({ name, equipped, proportions, skinUrl }) {
    this.avatar = new BloxityAvatar({ equipped, proportions, skinUrl });
    this.root = new THREE.Group();
    this.root.add(this.avatar.root);
    this.carriedGroup = new THREE.Group();
    this.carriedGroup.position.copy(HELD_EGG);
    this.root.add(this.carriedGroup);
    this.carriedKey = '';
    this.liftT = LIFT_SECONDS;
    this.trail = new TrailRibbon(); // added to the scene by Game
    this.setName(name);
  }

  setName(name) {
    if (this.tag && this.name === name) return;
    if (this.tag) this.root.remove(this.tag);
    this.name = name;
    this.tag = createNameTag(name);
    this.tag.position.y = TAG_HEIGHT;
    this.root.add(this.tag);
  }

  // A picked-up egg is held up in both hands, arms out in front.
  setCarried(json) {
    if (json === this.carriedKey) return;
    const before = JSON.parse(this.carriedKey || '[]').length;
    this.carriedKey = json;
    this.carriedGroup.clear();
    const eggs = JSON.parse(json || '[]');
    eggs.forEach((egg, i) => {
      const mesh = createEgg(egg);
      mesh.scale.setScalar(HELD_EGG_SCALE * Math.min(1.8, EGG_SIZES[egg.size || 1]?.scale || 1));
      mesh.position.set((i - (eggs.length - 1) / 2) * 1.4, 0, 0);
      this.carriedGroup.add(mesh);
    });
    this.avatar.holding = eggs.length > 0;
    if (eggs.length > before) this.liftT = 0;
  }

  updateCarried(dt) {
    this.liftT = Math.min(LIFT_SECONDS, this.liftT + dt);
    const k = this.liftT / LIFT_SECONDS;
    const ease = 1 - (1 - k) ** 3;
    // from the ground in front of the feet up onto the hands, with a little hop at the end
    this.carriedGroup.position.set(
      HELD_EGG.x,
      0.4 + (HELD_EGG.y - 0.4) * ease + Math.sin(k * Math.PI) * 0.6,
      HELD_EGG.z + 0.8 * (1 - ease),
    );
  }

  punch() {
    this.avatar.punch();
  }

  setTrail(id) {
    this.trail.setStyle(trailById(id));
  }

  // Caught by a guardian: the character vanishes into flying pieces (Effects.shatter) and pops back
  // together a moment later.
  shatter() {
    this.shatterT = SHATTER_SECONDS;
    this.avatar.root.visible = false;
    this.carriedGroup.visible = false;
  }

  updateShatter(dt) {
    if (!this.shatterT) return;
    this.shatterT = Math.max(0, this.shatterT - dt);
    if (this.shatterT > POP_SECONDS) return;
    // pop back: grow from nothing with a little overshoot
    const k = 1 - this.shatterT / POP_SECONDS;
    this.avatar.root.visible = true;
    this.carriedGroup.visible = true;
    this.avatar.root.scale.setScalar(Math.max(0.01, k * (1 + Math.sin(k * Math.PI) * 0.25)));
    if (this.shatterT === 0) this.avatar.root.scale.setScalar(1);
  }

  setAxe(id) {
    if (id === this.axeId) return;
    this.axeId = id;
    this.avatar.setTool(createAxeMesh(id));
  }
}

export class LocalPlayer extends Character {
  constructor(opts) {
    super(opts);
    this.body = { pos: new THREE.Vector3(opts.x, 0, opts.z), vel: new THREE.Vector3(), radius: 1.3, grounded: true };
    this.ry = Math.PI; // face north, towards the biomes
    this.anim = 'idle';
    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.ry;
    this.walkSpeed = 30;
    this.knockback = 0;
  }

  // Caught by a guardian (or hit by a bat): thrown away from it and up.
  knock(fromX, fromZ) {
    const dx = this.body.pos.x - fromX, dz = this.body.pos.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.body.vel.set((dx / d) * 45, 30, (dz / d) * 45);
    this.body.grounded = false;
    this.knockback = KNOCKBACK_SECONDS;
  }

  // Caught by a guardian: thrown high up into the air, tumbling; shatters when it lands (landed()).
  launch(fromX, fromZ) {
    const dx = this.body.pos.x - fromX, dz = this.body.pos.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.body.vel.set((dx / d) * 26, 62, (dz / d) * 26); // ~17 units up, about a second in the air
    this.body.grounded = false;
    this.knockback = 1.6; // no control while flying
    this.flying = 0.0001;
  }

  // true once, the moment a launched player hits the ground
  landed() {
    if (!this.justLanded) return false;
    this.justLanded = false;
    return true;
  }

  update(dt, input, cameraYaw, physics) {
    const WALK_SPEED = this.walkSpeed;
    this.knockback = Math.max(0, this.knockback - dt);
    // knocked back, or the last seconds of the day / night (frozen): no walking
    const move = this.knockback > 0 || this.frozen ? input.moveVector().set(0, 0) : input.moveVector();
    const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw);
    const rx = Math.cos(cameraYaw), rz = -Math.sin(cameraYaw);
    let wx = fx * move.y + rx * move.x;
    let wz = fz * move.y + rz * move.x;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }

    const k = this.flying ? 0 : 1 - Math.exp(-dt * (this.body.grounded ? 18 : 6)); // flying: no steering
    this.body.vel.x += (wx * WALK_SPEED - this.body.vel.x) * k;
    this.body.vel.z += (wz * WALK_SPEED - this.body.vel.z) * k;

    if (input.consumeJump() && this.body.grounded && !this.frozen) {
      this.body.vel.y = JUMP_VELOCITY;
      this.justJumped = true; // Game plays the jump sound
      this.body.grounded = false;
    }

    physics.step(this.body, dt);
    if (len > 0.05) this.ry = lerpAngle(this.ry, Math.atan2(wx, wz), 1 - Math.exp(-dt * 14));

    let speed = Math.hypot(this.body.vel.x, this.body.vel.z);
    const belt = physics.surfaceAt(this.body.pos.x, this.body.pos.z);
    this.onTreadmill = !!belt && this.body.grounded && len <= 0.05;

    if (!this.body.grounded) this.anim = this.body.vel.y > 0 ? 'jump' : 'fall';
    else this.anim = this.onTreadmill || (speed > 0.8 && len > 0) ? 'walk' : 'idle';

    // standing on a treadmill: face the console and jog slowly on the spot
    if (this.onTreadmill) {
      this.ry = lerpAngle(this.ry, belt.ry, 1 - Math.exp(-dt * 10));
      speed = TREADMILL_JOG_SPEED;
    }

    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.ry;
    // flying after a catch: tumbling head over heels until it lands
    if (this.flying) {
      this.flying += dt;
      this.root.rotation.x = -this.flying * 8;
      if (this.body.grounded && this.flying > 0.2) {
        this.flying = 0;
        this.root.rotation.x = 0;
        this.knockback = 0;
        this.justLanded = true;
      }
    }
    this.avatar.anim = this.anim;
    this.avatar.speed = speed;
    this.avatar.update(dt);
    this.updateCarried(dt);
    this.updateShatter(dt);
    this.trail.update(dt, this.root.position);
  }
}

// How quickly others catch up with their latest position (lower = smoother on a slow connection).
export class RemotePlayer extends Character {
  static smoothing = 12;
  static trails = true; // other players' trails (off on Low quality; your own always shows)

  constructor(opts) {
    super(opts);
    this.target = new THREE.Vector3(opts.x, opts.y, opts.z);
    this.targetRy = opts.ry;
    this.anim = 'idle';
    this.root.position.copy(this.target);
  }

  setState(s) {
    this.target.set(s.x, s.y, s.z);
    this.targetRy = s.ry;
    this.anim = s.anim || 'idle';
    this.setName(s.name);
    this.setCarried(s.carried);
    this.setAxe(s.axe);
    if (s.swing !== this.swingKey) {
      if (this.swingKey !== undefined) { this.punch(); RemotePlayer.onSwing?.(this); } // they swung their bat
      this.swingKey = s.swing;
    }
    this.setTrail(RemotePlayer.trails ? s.trail : '');
    if (s.emote && s.emote !== this.emoteKey) {
      const first = this.emoteKey === undefined; // joining: do not replay an old emote
      this.emoteKey = s.emote;
      if (!first) this.avatar.playEmote(s.emote.split(":")[0]);
    }
  }

  update(dt) {
    const before = this.root.position.clone();
    if (this.root.position.distanceTo(this.target) > 30) this.root.position.copy(this.target);
    else this.root.position.lerp(this.target, 1 - Math.exp(-dt * RemotePlayer.smoothing));
    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.targetRy, 1 - Math.exp(-dt * RemotePlayer.smoothing));
    this.avatar.anim = this.anim;
    this.avatar.speed = dt > 0 ? before.distanceTo(this.root.position) / dt : 0;
    this.avatar.update(dt);
    this.updateCarried(dt);
    this.updateShatter(dt);
    this.trail.update(dt, this.root.position);
    // Other players never cast shadows (only your own character does). Their avatar parts,
    // accessories, bat and held eggs load in at different times, so this is re-checked often.
    this.noShadowTimer = (this.noShadowTimer || 0) - dt;
    if (this.noShadowTimer <= 0) {
      this.noShadowTimer = 0.5;
      this.root.traverse((o) => { if (o.castShadow) o.castShadow = false; });
    }
  }

  dispose() {
    this.trail.dispose();
    this.root.parent?.remove(this.root);
    this.avatar.dispose();
  }
}
