// The Invite Friend spot in the Starting Place: a golden glowing pad with a well-dressed Bloxity
// character dancing on it and stacks of cash floating around. Walking onto it opens the invite
// popup (see InteractionSystem).

import * as THREE from 'three';
import { BloxityAvatar, skinUrlFor } from './BloxityAvatar.js';
import { getEmote, loadEmotes } from '../../bloxity/emotes.js';
import { makeBillboard } from '../util/canvasText.js';
import { Voxels } from '../util/bake.js';
import { addGlowRing } from './Shops.js';
import { FRIEND_BOOST } from '../../shared/progression.js';

export const INVITE_RADIUS = 9;
// Bloxity catalogue items: a black tee with a red flame print and a chain, grey patterned pants,
// black "Raven Spike Hair"; and the Bloxity "Dance" emote.
const DANCER_OUTFIT = { shirtId: '6aba9a1cdb0e2abe15d06243', pantsId: '6aba4c7a2e312c092557e63d', hairId: '6a50080d1dc04005b8daee77' };
const DANCE_EMOTE = '000000000000000000000e04';
const DANCER_SCALE = 1.6;
const CASH_STACKS = 7;

function cashStack() {
  const v = new Voxels();
  v.box(0, 0, 0, 3.2, 1.1, 1.9, '#3fcf4b');
  v.box(0, 1.1, 0, 3.2, 1.1, 1.9, '#5ae065');
  v.box(0, 0, 0, 0.8, 2.25, 1.95, '#ffd21f');
  return v.mesh({ castShadow: false });
}

export class InviteSpot {
  constructor(scene, x, z) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    scene.add(this.group);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(INVITE_RADIUS, 40), new THREE.MeshLambertMaterial({ color: '#ffe066' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.1;
    this.group.add(floor);
    this.ring = addGlowRing(scene, x, z, INVITE_RADIUS, '#ffe33a');

    const sign = makeBillboard([
      { text: 'INVITE FRIEND', size: 84, fill: '#ffd21f' },
      { text: `Each Friend = ${Math.round(FRIEND_BOOST * 100)}% Cash Boost`, size: 52, fill: '#7dff3f' },
    ], 4.4);
    sign.position.y = 14.5;
    this.group.add(sign);

    // the dancer: real Bloxity items, the Bloxity "Dance" emote on loop
    this.dancer = new BloxityAvatar({ equipped: DANCER_OUTFIT, skinUrl: skinUrlFor(DANCER_OUTFIT) });
    this.dancer.root.scale.setScalar(DANCER_SCALE);
    this.dancer.root.position.y = 0.1;
    this.group.add(this.dancer.root);
    // the Bloxity Dance emote when it loads; otherwise (or until then) the avatar's own dance
    this.danceMode = 'dance';
    Promise.all([this.dancer.ready, loadEmotes()]).then(() => {
      if (!getEmote(DANCE_EMOTE)) return;
      this.danceMode = 'idle'; // emotes play in the idle pose
      this.dancer.playEmote(DANCE_EMOTE);
    }).catch(() => {});

    this.stacks = Array.from({ length: CASH_STACKS }, (_, i) => {
      const mesh = cashStack();
      mesh.userData = { angle: (i / CASH_STACKS) * Math.PI * 2, radius: 5 + (i % 3) * 1.4, height: 2 + (i % 4) * 1.6, spin: 0.6 + (i % 3) * 0.3 };
      this.group.add(mesh);
      return mesh;
    });
  }

  update(dt, time) {
    this.ring(time);
    // keep dancing: if the emote stopped for any reason, start it again (or fall back to our dance)
    if (this.danceMode === 'idle' && !this.dancer.emote) {
      if (getEmote(DANCE_EMOTE)) this.dancer.playEmote(DANCE_EMOTE);
      else this.danceMode = 'dance';
    }
    this.dancer.anim = this.danceMode;
    this.dancer.update(dt);
    // a bouncy groove on top: bobbing to the beat and turning side to side
    this.dancer.root.position.y = 0.1 + Math.abs(Math.sin(time * 6.5)) * 0.9;
    this.dancer.root.rotation.y = Math.sin(time * 1.6) * 0.6;
    for (const s of this.stacks) {
      const u = s.userData;
      const a = u.angle + time * 0.5;
      s.position.set(Math.cos(a) * u.radius, u.height + Math.sin(time * 1.6 + u.angle * 3) * 0.8, Math.sin(a) * u.radius);
      s.rotation.set(Math.sin(time + u.angle) * 0.5, time * u.spin, Math.cos(time * 0.8 + u.angle) * 0.4);
    }
  }
}
