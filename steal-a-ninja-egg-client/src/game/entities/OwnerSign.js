// The board on top of each pen's treadmill frame: the owner's profile picture and name. Your own board says
// "YOUR BASE" and has a bouncing arrow over it for a while after you join.

import * as THREE from 'three';
import { canvasTexture, drawOutlinedText, FONT_TITLE, FONT_UI, measure } from '../util/canvasText.js';
import { lambert } from '../util/materials.js';

const W = 640;
const H = 300;
const PIC = 200;
const SIGN_HEIGHT = 16; // world units, before the plot scale
const ARROW_SECONDS = 12;

const pictures = new Map(); // url -> Promise<HTMLImageElement | null>
function loadPicture(url) {
  if (!url) return Promise.resolve(null);
  if (!pictures.has(url)) {
    pictures.set(url, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // keeps the canvas usable as a WebGL texture
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return pictures.get(url);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fitName(name, maxWidth) {
  let size = 64;
  while (size > 30 && measure(name, size, FONT_UI, 700) > maxWidth) size -= 2;
  return size;
}

function draw(g, { name, mine }, img) {
  g.clearRect(0, 0, W, H);
  const accent = mine ? '#46e24a' : '#ffc531';
  // a round (pill) board: fully rounded ends
  roundRect(g, 8, 8, W - 16, H - 16, (H - 16) / 2);
  g.fillStyle = 'rgba(16, 18, 26, 0.9)';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = accent;
  g.stroke();

  // round profile picture with a colored ring
  const cx = 8 + (H - 16) / 2, cy = H / 2; // the picture sits in the round left end
  g.save();
  g.beginPath();
  g.arc(cx, cy, PIC / 2, 0, Math.PI * 2);
  g.fillStyle = '#dfe6ee';
  g.fill();
  g.clip();
  if (img) g.drawImage(img, cx - PIC / 2, cy - PIC / 2, PIC, PIC);
  g.restore();
  g.beginPath();
  g.arc(cx, cy, PIC / 2, 0, Math.PI * 2);
  g.lineWidth = 9;
  g.strokeStyle = accent;
  g.stroke();

  const textX = cx + PIC / 2 + 18;
  const textW = W - textX - 70; // clear of the round right end
  const middle = textX + textW / 2;
  drawOutlinedText(g, mine ? 'YOUR BASE' : 'BASE OF', middle, 92, {
    size: 44, fill: accent, font: FONT_TITLE, weight: 400, stroke: '#0b0c10', strokeWidth: 6,
  });
  drawOutlinedText(g, name, middle, 178, { size: fitName(name, textW), fill: '#ffffff', stroke: '#0b0c10', strokeWidth: 7 });
}

export class OwnerSign {
  // height: the board's height in world units (before the plot scale)
  constructor(parent, position, height = SIGN_HEIGHT) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = canvasTexture(this.canvas);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, depthTest: false })); // always on top
    this.sprite.scale.set(height * (W / H), height, 1);
    this.sprite.position.copy(position);
    this.sprite.renderOrder = 8;
    this.sprite.visible = false;
    parent.add(this.sprite);

    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.2, 4), lambert('#46e24a', { emissive: '#1c5a10' }));
    this.arrow.rotation.x = Math.PI;
    this.arrow.visible = false;
    parent.add(this.arrow);
    this.arrowBase = position.clone().add(new THREE.Vector3(0, height / 2 + 4, 0));
    this.key = '';
    this.time = 0;
    this.arrowLeft = 0;
  }

  // owner: { name, pfp, mine } or null for a free frame
  set(owner) {
    const key = owner ? `${owner.name}|${owner.pfp}|${owner.mine}` : '';
    if (key === this.key) return;
    const wasMine = this.key.endsWith('|true');
    this.key = key;
    this.sprite.visible = !!owner;
    if (!owner) return void (this.arrowLeft = 0);
    if (owner.mine && !wasMine) this.arrowLeft = ARROW_SECONDS;

    const g = this.canvas.getContext('2d');
    draw(g, owner, null);
    this.texture.needsUpdate = true;
    loadPicture(owner.pfp).then((img) => {
      if (!img || this.key !== key) return;
      draw(g, owner, img);
      this.texture.needsUpdate = true;
    });
  }

  update(dt) {
    this.time += dt;
    this.arrowLeft = Math.max(0, this.arrowLeft - dt);
    this.arrow.visible = this.arrowLeft > 0;
    if (!this.arrow.visible) return;
    this.arrow.position.copy(this.arrowBase).setY(this.arrowBase.y + Math.abs(Math.sin(this.time * 4)) * 2);
    this.arrow.rotation.y = this.time * 2;
  }
}
