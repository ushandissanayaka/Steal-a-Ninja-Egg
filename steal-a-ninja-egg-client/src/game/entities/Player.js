import * as THREE from 'three';
import { BloxityAvatar } from './BloxityAvatar.js';
import { createNameTag } from './NameTag.js';
import { createEgg } from './Egg.js';
import { TrailRibbon } from './Trail.js';
import { Tornado, WhirlTrail } from './Tornado.js';
import { spinById, spinTier, trailById } from '../../shared/progression.js';
import { EGG_SIZES, WORLD } from '../../shared/gameData.js';

const KNOCKBACK_SECONDS = 0.45;
const JUMP_VELOCITY = 38;
const TAG_HEIGHT = 5.9;
const TREADMILL_JOG_SPEED = 3;
const SPIN_SPEED = 16;      // radians a second, spinning in the training arena
const TORNADO_HEIGHT = 12;     // the player's whirlwind: much bigger than the player (like the video)
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
    // the whirlwind the player turns into (like the video): in the training arena, while carrying a
    // stolen egg out on the track, and whenever they choose to (the Spin button)
    this.setSpinStyle('breeze');
    this.setName(name);
  }

  // The look of their whirlwind (their spin style from the Spin Shop): every style up the list is a
  // bigger whirlwind.
  setSpinStyle(id) {
    const style = spinById(id);
    if (this.tornado && this.spinStyle === style.id) return;
    const k = this.tornado?.k || 0;
    this.tornado?.dispose();
    this.spinStyle = style.id;
    this.tornado = new Tornado(TORNADO_HEIGHT * (1 + spinTier(style.id) * 0.06), style);
    this.tornado.k = k;
    this.root.add(this.tornado.root);
    this.whirlTrail?.dispose(); // made again in the new colours (see updateWhirl)
    this.whirlTrail = null;
  }

  // Is the character a whirlwind right now? (anim says so for other players: 'spin' / 'tornado')
  get isTornado() {
    return (this.anim === 'spin' || this.anim === 'tornado') && !this.shatterT;
  }

  // The whirlwind form: the character hides inside a spinning tornado (it grows in round them as
  // they vanish, and they pop back out as it shrinks away). A quick Spin move (a click) is a short
  // burst of it.
  updateWhirl(dt) {
    // the smoke and dust left behind the whirlwind (in the world, so it is made once the player is in it)
    if (!this.whirlTrail && this.root.parent) {
      const style = spinById(this.spinStyle);
      this.whirlTrail = new WhirlTrail(this.root.parent, this.tornado.height, style.colors);
    }
    this.whirlTrail?.update(dt, this.root.position, this.tornado.k);
    const on = this.isTornado;
    this.tornado.update(dt, on);
    const k = this.tornado.k;
    // the body shrinks into the wind and comes back out of it
    this.avatar.root.visible = (!this.shatterT || this.shatterT <= POP_SECONDS) && k < 0.85;
    if (!this.shatterT) this.avatar.root.scale.setScalar(Math.max(0.01, 1 - k));
    // a carried egg floats in the middle of the whirlwind, turning
    if (k > 0.05) {
      this.carriedGroup.position.set(0, 2.2 + Math.sin(this.tornado.t * 3) * 0.3, 0);
      this.carriedGroup.rotation.y += dt * 6;
    } else this.carriedGroup.rotation.y = 0;
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
    this.carrying = eggs.length > 0;
    if (eggs.length > before) this.liftT = 0;
  }

  updateCarried(dt) {
    if (this.tornado?.k > 0.05) return; // inside the whirlwind (see updateWhirl)
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

  // (another player's spin attack: no quick whirl is shown, only their whirlwind form)
  punch() {}

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

  // Nothing is held in the hands in this game (the bat was removed); the weapon only sets how long a
  // Spin dazes a guardian (on the server).
  setAxe(id) {
    this.axeId = id;
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

    const jump = input.consumeJump();
    // Space in the arena: out through its door (like the video)
    if (jump && this.arena) this.exitArena();
    else if (jump && this.body.grounded && !this.frozen) {
      this.body.vel.y = JUMP_VELOCITY;
      this.justJumped = true; // Game plays the jump sound
      this.body.grounded = false;
    }

    physics.step(this.body, dt);
    if (len > 0.05) this.ry = lerpAngle(this.ry, Math.atan2(wx, wz), 1 - Math.exp(-dt * 14));

    let speed = Math.hypot(this.body.vel.x, this.body.vel.z);
    const belt = physics.surfaceAt(this.body.pos.x, this.body.pos.z);
    // the training arena: only its floor counts (not the base round the wall)
    // (and only your own arena once it is unlocked: Game sets canSpin, like the server's check)
    const onFloor = belt && !belt.floor && (!belt.round || (Math.hypot(this.body.pos.x - belt.x, this.body.pos.z - belt.z) <= belt.floorR
      && (!this.canSpin || this.canSpin(belt))));
    this.onTreadmill = !!onFloor && this.body.grounded && len <= 0.05;
    this.arena = this.onTreadmill && belt.round ? belt : null;

    // a whirlwind: carrying a stolen egg out on the track (back at the start it turns back into the
    // player, the egg up in their hands), or because they chose to (the Spin button)
    const onTrack = this.body.pos.z < WORLD.lineZ;
    this.carryTornado = this.carrying && onTrack;
    if (this.arena) this.anim = 'spin';
    else if (this.carryTornado || this.manualTornado) this.anim = 'tornado';
    else if (!this.body.grounded) this.anim = this.body.vel.y > 0 ? 'jump' : 'fall';
    else this.anim = this.onTreadmill || (speed > 0.8 && len > 0) ? 'walk' : 'idle';

    if (this.arena) {
      // standing still in the arena: spin on the spot in a whirlwind
      this.ry += SPIN_SPEED * dt;
      speed = 0;
    } else if (this.onTreadmill) {
      // standing on a treadmill: face the console and jog slowly on the spot
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
    this.updateWhirl(dt);
    this.trail.update(dt, this.root.position);
  }

  // The Spin button: turn into a whirlwind, or back into the player.
  toggleTornado() {
    this.manualTornado = !this.manualTornado;
    return this.manualTornado;
  }

  // The "Exit Arena" button: hop out through the arena's doorway.
  exitArena() {
    const a = this.arena;
    if (!a) return;
    const dx = Math.cos(a.doorAngle), dz = Math.sin(a.doorAngle);
    this.body.pos.set(a.x + dx * (a.r + 3), 0, a.z + dz * (a.r + 3));
    this.body.vel.set(0, 0, 0);
    this.ry = Math.atan2(dx, dz);
    // out of the whirlwind at once: the player's own shape again (no shrinking wind left behind)
    this.manualTornado = false;
    this.arena = null;
    this.onTreadmill = false;
    this.anim = 'idle';
    this.tornado.k = 0;
    this.tornado.root.visible = false;
    this.avatar.root.visible = true;
    this.avatar.root.scale.setScalar(1);
    this.exitedAt = performance.now();
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
    this.setSpinStyle(s.spin);
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
    // spinning in their arena: turn on the spot here (their facing comes too seldom to show the spin)
    if (this.anim === 'spin') this.root.rotation.y += SPIN_SPEED * dt;
    else this.root.rotation.y = lerpAngle(this.root.rotation.y, this.targetRy, 1 - Math.exp(-dt * RemotePlayer.smoothing));
    this.avatar.anim = this.anim;
    this.avatar.speed = dt > 0 ? before.distanceTo(this.root.position) / dt : 0;
    this.avatar.update(dt);
    this.updateCarried(dt);
    this.updateShatter(dt);
    this.updateWhirl(dt);
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
    this.whirlTrail?.dispose();
    this.root.parent?.remove(this.root);
    this.avatar.dispose();
  }
}
