// Procedural textures.

import * as THREE from 'three';
import { canvasTexture } from './canvasText.js';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function repeating(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// The raised studs seen on every block. White, so vertex colors tint it.
export function studTexture() {
  return repeating(canvasTexture(canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#f3f3f3';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.10)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.beginPath();
    g.arc(33, 35, 19, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(31, 31, 18, 0, Math.PI * 2);
    g.fill();
  })));
}

export function beltTexture() {
  return repeating(canvasTexture(canvas(64, 128, (g, w, h) => {
    g.fillStyle = '#3b3f46';
    g.fillRect(0, 0, w, h);
    // two chevrons per repeat, pointing at the top of the texture
    g.strokeStyle = '#ffd21f';
    g.lineWidth = 11;
    g.lineJoin = 'miter';
    for (const y of [h * 0.25, h * 0.75]) {
      g.beginPath();
      g.moveTo(w * 0.16, y + 15);
      g.lineTo(w * 0.5, y - 15);
      g.lineTo(w * 0.84, y + 15);
      g.stroke();
    }
  })));
}

export function stripeTexture(colors, stripes = 8) {
  return canvasTexture(canvas(256, 256, (g, w, h) => {
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
    }
  }));
}

export function swirlTexture(colors) {
  return canvasTexture(canvas(256, 256, (g, w, h) => {
    const slices = 12;
    for (let i = 0; i < slices; i++) {
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.arc(w / 2, h / 2, w * 0.72, (i / slices) * Math.PI * 2, ((i + 1) / slices) * Math.PI * 2 + 0.01);
      g.fill();
    }
  }));
}

export function glowTexture() {
  return canvasTexture(canvas(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  }));
}

// spots: an optional colour for big speckles (the biome the egg comes from)
export function eggTexture(color, spots = null) {
  let seed = [...(color + (spots || ''))].reduce((a, c) => a + c.charCodeAt(0), 7);
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return canvasTexture(canvas(128, 128, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = next() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.16)';
      g.beginPath();
      g.arc(next() * w, next() * h, 2 + next() * 6, 0, Math.PI * 2);
      g.fill();
    }
    if (!spots) return;
    g.fillStyle = spots;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(next() * w, 18 + next() * (h - 36), 5 + next() * 7, 4 + next() * 5, next() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }));
}

// The tan top of the drop pad with its painted words.
export function padTexture() {
  return canvasTexture(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#d9a566';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.86)';
    g.font = '700 118px "Fredoka", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DROP', w / 2, h / 2 - 68);
    g.fillText('EGGS', w / 2, h / 2 + 68);
  }));
}
