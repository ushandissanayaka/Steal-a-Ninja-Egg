// Pictures of the pets for the popups: each pet's own voxel model rendered once into a small image
// and cached. They are queued and drawn one at a time in idle moments; until a picture is ready,
// petThumb() returns '' and the popup shows a placeholder; onThumbReady() tells it when to redraw.
//
// They are drawn with the GAME's own renderer into an offscreen target, and the pixels come back
// asynchronously (readRenderTargetPixelsAsync), then are encoded off the main thread (toBlob).
// Drawing them with a second WebGL canvas and toDataURL() made the GPU and the main thread wait for
// each picture, which froze the game every few hundred ms while the player was running about.

import * as THREE from 'three';
import { createPetMesh } from '../entities/PetDisplay.js';
import { createAxeMesh } from '../entities/Axe.js';
import { HORRORS, buildHorror } from '../entities/Horrors.js';

const SIZE = 128;
const DRAW = SIZE * 2;        // drawn twice as big and scaled down: smooth edges without MSAA
const cache = new Map();      // id -> image URL ('' if it could not be drawn)
const queue = [];
const queued = new Set();
const listeners = new Set();
let renderer = null;          // the game's renderer (useRenderer)
let target = null;
let scene = null;
let camera = null;
let pixels = null;
let working = false;

let busy = () => false;

// The game hands over its renderer once it exists (pictures wait until then), and says when it is
// busy (the player running about): no pictures are drawn then, so they never cost a frame mid-run.
export function useRenderer(r, isBusy) {
  renderer = r;
  if (isBusy) busy = isBusy;
  work();
}

function setup() {
  target = new THREE.WebGLRenderTarget(DRAW, DRAW, { colorSpace: THREE.SRGBColorSpace });
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#9a9a9a', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  pixels = new Uint8Array(DRAW * DRAW * 4);
}

// The pet seen from the front, a little from the side and above.
async function draw(id) {
  let mesh = null;
  try {
    if (!target) setup();
    if (id.startsWith('weapon:')) {
      // a weapon ('weapon:<id>'): standing up, leaning to the right, like a picture of it in a card
      mesh = new THREE.Group();
      const w = createAxeMesh(id.slice(7));
      w.rotation.set(-Math.PI / 2, 0, -0.65);
      mesh.add(w);
    } else if (HORRORS.has(id)) {
      // a guardian drawn as its realistic model (eyes open), for the index
      const h = buildHorror(id);
      h.update({ t: 1, open: 1, awake: 1, run: 0, viewer: null });
      mesh = h.root;
      mesh.rotation.y = 0.45;
    } else {
      mesh = createPetMesh(id);
      mesh.rotation.y = 0.55;
    }
    scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    camera.position.set(center.x + size * 0.35, center.y + size * 0.45, center.z + size * 1.75);
    camera.lookAt(center);

    // draw into the offscreen target without disturbing the game's own frame
    const before = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(before);
    renderer.setClearColor(clear, alpha);
    renderer.shadowMap.enabled = shadows;
    scene.remove(mesh);

    await renderer.readRenderTargetPixelsAsync(target, 0, 0, DRAW, DRAW, pixels);
    const big = document.createElement('canvas');
    big.width = big.height = DRAW;
    const img = new ImageData(new Uint8ClampedArray(pixels), DRAW, DRAW);
    big.getContext('2d').putImageData(img, 0, 0);
    const small = document.createElement('canvas');
    small.width = small.height = SIZE;
    const g = small.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.translate(0, SIZE); // the pixels come back bottom row first
    g.scale(1, -1);
    g.drawImage(big, 0, 0, SIZE, SIZE);
    const blob = await new Promise((done) => small.toBlob(done, 'image/png'));
    return blob ? URL.createObjectURL(blob) : '';
  } catch (err) {
    console.warn('[petArt] could not draw', id, err);
    return '';
  } finally {
    if (mesh) {
      scene.remove(mesh);
      if (!HORRORS.has(id) && !mesh.userData.sharedGeometry) mesh.traverse((o) => o.geometry?.dispose()); // a horror shares its eye geometry with the guardians in the world
    }
  }
}

const GAP_MS = 120; // at least this long between two pictures
// a moment when the browser has nothing else to do (or, at worst, after a couple of seconds)
const idle = (fn) => setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 2000 }) : fn()), GAP_MS);

function work() {
  if (working || !queue.length || !renderer) return;
  working = true;
  idle(async () => {
    if (busy()) {
      working = false;
      setTimeout(work, 400);
      return;
    }
    const id = queue.shift();
    queued.delete(id);
    cache.set(id, await draw(id));    // one picture per idle moment
    listeners.forEach((fn) => fn(id));
    working = false;
    work();
  });
}

// urgent: a popup on screen wants it, so it goes to the front of the queue (ahead of the prewarm)
function request(id, urgent = false) {
  if (cache.has(id)) return;
  if (queued.has(id)) {
    if (urgent && queue.indexOf(id) > 0) queue.unshift(...queue.splice(queue.indexOf(id), 1));
    return;
  }
  queued.add(id);
  if (urgent) queue.unshift(id);
  else queue.push(id);
  work();
}

// The picture if it is ready, '' otherwise (it is then queued; onThumbReady fires when it is).
export function petThumb(id) {
  if (cache.has(id)) return cache.get(id);
  request(id, true);
  return '';
}

export function onThumbReady(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Queue pictures ahead of time, a few seconds after loading (not while the world is still settling),
// so popups usually find them ready.
export function prewarmPetThumbs(ids, delayMs = 6000) {
  setTimeout(() => { for (const id of ids) request(id); }, delayMs);
}
