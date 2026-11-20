// Owns the renderer, the scene and the main loop, and mirrors the room's state into the world.

import * as THREE from 'three';
import { avatarPfpUrl, bloxity } from '../bloxity/bloxity.js';
import { connect, reloadGame, startedFine } from '../net/connection.js';
import { BIOMES, CYCLE, frozenAt, PETS, PLOT, PLOTS, SHOPS, WORLD, biomeAt, formatNumber, plotToWorld, walkSpeed } from '../shared/gameData.js';
import { GuardianView } from './entities/Guardians.js';
import { GuideArrows } from './entities/GuideArrows.js';
import { QualityManager } from './systems/QualityManager.js';
import { Sky } from './entities/Sky.js';
import { StageSkies } from './entities/StageSkies.js';
import { TrailRibbon } from './entities/Trail.js';
import { TreadmillView } from './entities/Treadmill.js';
import { setPetNight } from './entities/BlockAnimals.js';
import { NightBats } from './entities/NightBats.js';
import { GATE_Z, GlassGate } from './entities/GlassGate.js';
import { Effects } from './entities/Effects.js';
import { GroundEggView } from './entities/Egg.js';
import { InviteSpot } from './entities/InviteSpot.js';
import { LocalPlayer, RemotePlayer } from './entities/Player.js';
import { preloadAvatar } from './entities/BloxityAvatar.js';
import { loadEmotes } from '../bloxity/emotes.js';
import { prewarmPetThumbs, useRenderer as usePetArtRenderer } from './util/petArt.js';
import { AudioManager } from './audio/AudioManager.js';
import { MusicPlayer } from './audio/MusicPlayer.js';
import { buildStartingPlace } from './scenes/StartingPlace.js';
import { updateCorridor } from './scenes/BiomeCorridor.js';
import { FX } from './entities/Tornado.js';
import { spinById } from '../shared/progression.js';
import { onBoardButton } from './entities/PlayerBase.js';
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
import { CameraController } from './systems/CameraController.js';
import { InputSystem } from './systems/InputSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { PhysicsWorld } from './systems/PhysicsWorld.js';
import { loadFonts } from './util/canvasText.js';

const NEAR_PENS = 2; // other players' pens whose ninjas are shown (the nearest ones)
const CULL_EVERY = 0.25;      // seconds between draw-distance checks
const SHAKE_SECONDS = 0.35;
const CLICK_MOVE_LIMIT = 6;
const SHADOW_RANGE = 170;
const SUN_OFFSET = new THREE.Vector3(175, 425, 225);
const AVATAR_HIP = 2.6;
const CAMERA_TRUNK_MARGIN = 0.8;
const SPARKLE_STEP = 3.5; // a puff of magic sparkles every this many units run
const _sparkleAt = new THREE.Vector3();
// Mist. With a smooth game (High/Ultra) and a good connection there is NO mist at all: the whole
// world is clear. Only when the frame rate or the ping gets worse does the mist come in (the worse,
// the closer), so far-away things are hidden and the game does not lag.
// [near, far] in world units, by quality tier; far is also where trees, animals and players stop
// being drawn, so they fade into the mist instead of popping in.
const FOG_COLOR = new THREE.Color('#9aa3ab'); // grey: white mixed with dark
const NO_FOG = { near: 5500, far: 6000 };    // past the camera's far end: nothing is misted
const FOG = {
  low: { near: 110, far: 260 },
  medium: { near: 200, far: 500 },
  high: { near: 1100, far: 1900 },  // only used once the FPS or ping gets worse
  ultra: { near: 1100, far: 1900 },
};
// The mist never comes near the player: everything round you (the track, the guardians chasing you,
// your pen) stays sharp and clear even on Low with a bad connection; only the far end is misted.
const FOG_MIN_NEAR = 100;
const FOG_MIN_FAR = 230;
const NIGHT_SKY = new THREE.Color('#1a1d26'); // the mist at night, under the rain clouds
const EVENING_COLOR = new THREE.Color('#ffc49a');
const EVENING_SUN = new THREE.Color('#ff9a4a');
const SUN_COLOR = new THREE.Color('#fff4e0');
const MOON_COLOR = new THREE.Color('#9fb4ff');
const LIGHT_DISTANCE = SUN_OFFSET.length();
const LIGHT_MIN_Y = 0.6; // the light never comes in flatter than this, so shadows stay short and tidy
const FOG_EASE = 0.7; // how fast the mist moves to a new distance (slow, so it never jumps)
// Live adjustment on top of the tier, from the measured frame rate and ping:
const FOG_FPS = { good: 55, bad: 30, min: 0.55 };   // at 55+ FPS no mist change; at 30 FPS 55% of the distance
const FOG_PING = { good: 110, bad: 320, min: 0.5 }; // at 110 ms or less no change; at 320 ms half the distance
const lerpFactor = (value, good, bad, min) => {
  const k = Math.max(0, Math.min(1, (value - good) / (bad - good)));
  return 1 - k * (1 - min);
};

function safeParse(json) {
  try { return JSON.parse(json); } catch { return {}; }
}

export class Game {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.sendTimer = 0;
    this.lastSent = '';
    this.remotes = new Map();
    this.groundEggs = new Map();
    this.animals = new Map();
    this.eggsSynced = false;
    this.zoneId = null;
    this.lastSpeed = null;
    this.sendInterval = 0.1;
    this.cullTimer = 0;
    this.shakeLeft = 0;
    this.me = null;
    this.running = false;
    this.focus = new THREE.Vector3();
  }

  // One loading stage: tells Boxity and our loading page, then lets the browser draw the bar before
  // the next (possibly heavy) stage runs.
  async loadingStep(text, progress) {
    bloxity.loadingStep(text);
    this.store.set({ loading: { text, progress } });
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  async start() {
    // sound: starts on the player's first touch / key (browsers block it before that), even while loading
    this.audio = new AudioManager();
    this.music = new MusicPlayer(this.audio);
    this.audio.onStart = () => this.music.start();
    // another player swinging their bat near me: a quieter swish
    RemotePlayer.onSwing = (r) => this.audio.swing(0.6 * this.soundLevel(r.root.position.x, r.root.position.z, 90));
    bloxity.loadingStart(); // Bloxity shows its loading page until loadingEnd
    bloxity.adScreen('lobby'); // banners only while loading
    await this.loadingStep('Loading fonts', 0.08);
    await loadFonts();
    this.setupRenderer();
    // pet pictures are drawn with this renderer, off screen, and only while the player stands still
    usePetArtRenderer(this.renderer, () => {
      const v = this.player?.body?.vel;
      return !!v && Math.hypot(v.x, v.z) > 1;
    });

    await this.loadingStep('Building the world', 0.22);
    this.physics = new PhysicsWorld();
    this.effects = new Effects(this.scene);
    this.world = buildStartingPlace(this.scene, this.physics, this.effects);
    this.guideArrows = new GuideArrows(this.scene);
    this.inviteSpot = new InviteSpot(this.scene, SHOPS.invite.x, SHOPS.invite.z);
    this.glassGate = new GlassGate(this.scene);
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.stageSkies = new StageSkies(this.scene); // dragons, magic orbs, the giant skull... over some stages
    this.bats = new NightBats(this.scene);
    this.lightDir = SUN_OFFSET.clone().normalize();

    await this.loadingStep('Loading your avatar', 0.62);
    await preloadAvatar();

    await this.loadingStep('Joining a server', 0.75);
    if (bloxity.embedded) await bloxity.waitForUser(2500);
    this.joinedAs = bloxity.userId(); // the identity this session joined with (null = guest)
    this.room = await connect({
      token: bloxity.token(),
      guestKey: bloxity.guestKey(),
      guestName: bloxity.displayName(),
      avatar: bloxity.equipped,
      props: bloxity.proportions,
    });
    await this.loadingStep('Getting ready', 0.92);
    await new Promise((resolve) => this.room.onStateChange.once(resolve));
    bloxity.updateRoom(this.room.roomId);

    this.me = this.room.state.players.get(this.room.sessionId);
    this.player = new LocalPlayer({
      name: bloxity.displayName(),
      equipped: bloxity.equipped,
      proportions: bloxity.proportions,
      skinUrl: bloxity.skinTextureUrl(),
      x: this.me.x,
      z: this.me.z,
    });
    // you spin (and get faster) only in your own arena, once it is unlocked (the server checks the same)
    this.playerLight = new THREE.PointLight('#ffffff', 0, 46, 1.4); // always there (off by day), so nothing recompiles
    this.playerLight.position.y = 6;
    this.player.root.add(this.playerLight);
    this.player.canSpin = (arena) => arena.plot === this.me?.plot && (this.me?.treadmill || 'none') !== 'none';
    this.scene.add(this.player.root, this.player.trail.mesh);

    this.setupInput();
    this.listen();
    this.room.send('mine'); // listening now: the server sends my own data again, in full
    this.setupQuality();
    this.setupPlatform();
    this.showMyBase();
    this.room.send('offlineCheck'); // "you earned while away" popup, once we are listening

    this.running = true;
    this.store.set({ loading: { text: 'Ready!', progress: 1 } });
    bloxity.loadingEnd();
    bloxity.adScreen('gameplay'); // playing: no banners from here on
    bloxity.gameplayStart();
    this.store.set({ phase: 'playing' });
    startedFine();
    // pet pictures for the popups, drawn in idle moments (on Low quality only when a popup needs them)
    if (this.quality?.tier !== 'low') prewarmPetThumbs(Object.keys(PETS));
    if (import.meta.env.DEV) window.__game = this;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = FOG_COLOR.clone(); // fallback behind the sky dome, never black
    // Mist over the far end of the world. Its distance follows the quality tier and the
    // connection (see updateFogTarget); it starts thin and eases to its target.
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG.ultra.near, FOG.ultra.far);
    this.fogTarget = { near: FOG.ultra.near, far: FOG.ultra.far };
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 6000);
    TrailRibbon.camera = this.camera; // trails turn to face it

    this.hemi = new THREE.HemisphereLight('#ffffff', '#b8d8a0', 1.7);
    this.scene.add(this.hemi);
    this.nightK = 0; // 0 = day, 1 = night (eased)
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -SHADOW_RANGE;
    c.right = SHADOW_RANGE;
    c.top = SHADOW_RANGE;
    c.bottom = -SHADOW_RANGE;
    c.near = 1;
    c.far = 1000;
    this.sun.shadow.bias = -0.001;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target);

    // Any change of size (window, rotation, Bloxity's frame, browser zoom, another monitor) is
    // handled once per frame at most: dragging a window edge fires dozens of events, and rebuilding
    // the picture for each of them made the game stutter.
    this.onResize = () => {
      if (this.resizeQueued) return;
      this.resizeQueued = true;
      requestAnimationFrame(() => { this.resizeQueued = false; this.updateResolution(); });
    };
    window.addEventListener('resize', this.onResize);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.onResize) : null;
    this.resizeObserver?.observe(this.container);
    this.watchSharpness();
    this.updateResolution();
  }

  // How many pixels the game draws, from the screen's size, its sharpness (devicePixelRatio, which
  // browser zoom and moving to another monitor change) and the quality tier:
  //   never blurry: never fewer pixels than the screen really has (1 per CSS pixel, or the screen's
  //                 own pixels when zoomed out);
  //   never laggy:  on sharp screens the extra sharpness stops at the tier's pixel budget, so a big
  //                 (or fullscreen 4K) window does not suddenly cost twice as much to draw.
  updateResolution() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    const q = this.q;
    const wanted = Math.min(dpr, q ? q.pixelRatio : 1, Math.sqrt((q?.maxPixels || Infinity) / (w * h)));
    const ratio = Math.round(Math.max(wanted, Math.min(1, dpr)) * 100) / 100;
    if (w === this.viewW && h === this.viewH && ratio === this.renderer.getPixelRatio()) return;
    this.viewW = w;
    this.viewH = h;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // a phone held upright sees very little to the sides at the normal 62°: widen the view there
    const tall = Math.min(1, w / h);
    this.camera.fov = Math.min(85, (2 * Math.atan(Math.tan((62 / 2) * Math.PI / 180) / Math.sqrt(tall)) * 180) / Math.PI);
    this.camera.updateProjectionMatrix();
    this.quality?.settle(); // the frame that rebuilt the picture is not a sign of a slow device
  }

  // devicePixelRatio has no event of its own: a media query for the current value tells when it changes.
  watchSharpness() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const changed = () => { this.sharpnessOff?.(); this.onResize(); this.watchSharpness(); };
    mq.addEventListener?.('change', changed);
    this.sharpnessOff = () => mq.removeEventListener?.('change', changed);
  }

  setupInput() {
    this.input = new InputSystem();
    this.camController = new CameraController(this.camera, this.renderer.domElement);
    this.camController.focus.copy(this.player.body.pos);
    this.interaction = new InteractionSystem(this);

    this.input.onKey((code) => {
      if (code === 'KeyE') this.interaction.interact();
      else if (code === 'KeyQ') this.interaction.dropEggs();
      else if (code === 'Digit1') this.toggleTornado(); // the Spin button
      else if (code === 'Escape') {
        // close what is open; with nothing open, Escape opens Boxity's menu (the game draws no menu of its own)
        const ui = this.store.get();
        if (ui.popup || ui.opened || ui.shop) this.store.set({ shop: false, popup: null, opened: null });
        else bloxity.showMenu();
      }
    });

    const dom = this.renderer.domElement;
    let press = null;
    this.onPointerDown = (e) => {
      press = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    this.onPointerUp = (e) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < CLICK_MOVE_LIMIT && !this.clickBoard(e)) this.interaction.click();
      press = null;
    };
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);

    this.unsubscribeSettings = bloxity.onSettings((s) => {
      this.camController.sensitivity = Number(s.camera_sensitivity) || 1;
      this.audio.setVolumes(s); // master / music volume (and the profile card's speaker)
      this.quality?.setCap(s.graphics_quality);
    });
  }

  listen() {
    const me = () => this.room.sessionId;
    // my own pets list and popup data: only to me, only what changed (not through the room state)
    this.room.onMessage('mine', ({ allPets, meta }) => {
      if (typeof meta === 'string' && meta !== this.metaJson) {
        this.metaJson = meta;
        this.meta = safeParse(meta);
        this.store.set({ meta: { ...this.meta, at: performance.now() } });
      }
      if (typeof allPets === 'string' && allPets !== this.allPetsJson) {
        this.allPetsJson = allPets;
        const list = safeParse(allPets);
        this.store.set({ allPets: Array.isArray(list) ? list : [] });
      }
    });
    // caught by a guardian: you burst into pieces, are thrown back and the egg goes home to its nest
    // the change of day / night: everyone is sent back to the lobby, facing the glass gate
    this.room.onMessage('teleport', ({ x, z }) => {
      if (this.fancy) this.effects.burst(this.player.body.pos.clone().setY(3), '#e0a8ff', 18, 16);
      this.audio.teleport();
      this.player.body.pos.set(x, 0, z);
      this.player.body.vel.set(0, 0, 0);
      this.player.knockback = 0;
      this.camController.yaw = 0;
      this.player.shatter();
      this.player.shatterT = 0.35; // pop back in
      if (this.fancy) this.effects.burst(new THREE.Vector3(x, 3, z), '#7fffe0', 22, 18);
    });
    this.room.onMessage('caught', ({ from, name, x, z }) => {
      this.effects.burst(new THREE.Vector3(x, 4, z), '#fff3b0', 18, 16);
      if (from !== me()) {
        // they are thrown up (their own game sends where they fly); they shatter as they land
        setTimeout(() => {
          const remote = this.remotes.get(from);
          if (remote?.root.visible) {
            this.effects.shatter(remote.root.position);
            remote.shatter();
          }
        }, 1150);
        return;
      }
      // thrown high into the air by the guardian; the shatter comes on landing (see frame)
      this.player.launch(x, z);
      this.audio.chomp();
      this.audio.whoosh();
      this.shake(0.5);
      this.toast(`${name} caught you! Your egg went back to its nest`, '#ff5a5a');
    });
    this.room.onMessage('escaped', ({ name }) => { this.toast(`You escaped ${name}! Go to your Pen!`, '#7dff3f'); this.audio.escape(); });
    this.room.onMessage('woke', ({ id, by }) => {
      const view = this.animals.get(id);
      // the guardian roars: loud when it is after me, quieter the further away it is
      if (view) this.audio.roar(by === me() ? 1 : this.soundLevel(view.root.position.x, view.root.position.z));
      if (view && by === me()) {
        // it roars first (the ground shakes), and only then does it come for you
        this.effects.floatText('ROAAAR!', view.root.position.clone().setY(16), '#ffd21f', 1.5);
        this.shake(0.8);
        setTimeout(() => {
          if (!this.animals.has(id)) return;
          this.effects.floatText('RUN!!', view.root.position.clone().setY(14), '#ff3b3b', 2.4);
          this.shake(0.4);
        }, 1500);
      }
    });
    this.room.onMessage('lunge', ({ id }) => {
      const view = this.animals.get(id);
      if (!view) return;
      view.lungeNow?.();
      this.audio.lunge();
      this.shake(0.3);
    });
    this.room.onMessage('bonked', ({ by, target, x, z }) => {
      this.effects.burst(new THREE.Vector3(x, 4, z), '#ffd21f', 14, 12);
      this.audio.batHit(by === me() || target === me() ? 1 : this.soundLevel(x, z));
      if (target === me()) { this.audio.loseEgg(); this.shake(0.5); this.toast('Bonk! You dropped your egg!', '#ff5a5a'); }
      else if (by === me()) this.toast('Bonk! They dropped their egg!', '#7dff3f');
    });
    this.room.onMessage('stunned', ({ x, z }) => {
      this.effects.burst(new THREE.Vector3(x, 8, z), '#ffe14a', 16, 14);
      this.effects.floatText('BONK!', new THREE.Vector3(x, 14, z), '#ffe14a', 2);
      // the bat's thwack and the guardian's howl of pain
      const level = this.soundLevel(x, z, 200);
      this.audio.batHit(level);
      this.audio.monsterPain(level);
    });
    this.room.onMessage('announce', ({ text, color, big }) => {
      this.audio.zone();
      this.store.set({ announce: { text, color, big: !!big, at: performance.now() } });
      clearTimeout(this.announceTimer);
      this.announceTimer = setTimeout(() => this.store.set({ announce: null }), big ? 3500 : 6000);
    });
    this.room.onMessage('placed', ({ bonus } = {}) => {
      this.audio.plop();
      this.interaction.markDone('pen');
      this.toast(bonus > 0 ? `Your egg is growing! +$${formatNumber(bonus)} to unlock your Training Arena!` : 'Your egg is growing!', '#7dff3f');
    });
    this.room.onMessage('speedGift', ({ amount }) => {
      this.audio.coin(true);
      const p = this.player.body.pos;
      this.effects.floatText(`+${formatNumber(amount)} Speed`, new THREE.Vector3(p.x, p.y + 8, p.z), '#35b8ff', 2);
      this.effects.magicDust(new THREE.Vector3(p.x, p.y + 4, p.z), 30, 4, 10);
      this.toast(`FREE ${formatNumber(amount)} Speed claimed! Go steal eggs!`, '#35b8ff');
    });
    this.room.onMessage('bought', ({ name }) => { this.toast(`You got the ${name}!`, '#7dff3f'); this.audio.coin(true); });
    // shop / pets / index / rebirth results
    this.room.onMessage('notice', ({ text, ok }) => {
      this.toast(text, ok ? '#7dff3f' : '#ff5a5a');
      if (ok) this.audio.coin(); else this.audio.error();
    });
    this.room.onMessage('opened', ({ pets }) => this.store.set({ opened: { pets, at: performance.now() } }));
    this.room.onMessage('offline', (info) => this.store.set({ offline: info }));
    this.room.onMessage('gift', ({ amount }) => {
      this.audio.coin(true);
      const p = this.player.body.pos;
      this.effects.floatText(`+$${formatNumber(amount)}`, new THREE.Vector3(p.x, p.y + 8, p.z), '#7dff3f', 1.8);
      this.effects.magicDust(new THREE.Vector3(p.x, p.y + 4, p.z), 30, 4, 10);
    });
    this.room.onMessage('hatched', (result) => {
      this.interaction.markDone('hatch');
      this.world.plots[this.me.plot]?.hatchedAt(result.slot);
      this.audio.hatch();
      this.store.set({ reveal: { ...result, at: performance.now() } });
      if (result.bonus > 0) {
        clearTimeout(this.bonusTimer);
        this.bonusTimer = setTimeout(() => this.toast(`Starter bonus: +$${formatNumber(result.bonus)}!`, '#7dff3f'), 3300);
      }
      clearTimeout(this.revealTimer);
      this.revealTimer = setTimeout(() => this.store.set({ reveal: null }), 3200);
    });
    // the egg opened, but I already have every animal of its stage: no animal comes out
    this.room.onMessage('duplicate', ({ biome, slot }) => {
      const plot = this.world.plots[this.me.plot];
      plot?.hatchedAt(slot); // the egg still bursts open in its smoke
      this.audio.loseEgg();
      const s = PLOT.eggSlots[slot] || PLOT.eggSlots[0];
      if (plot) this.effects.floatText('DUPLICATE!', plot.localToWorld(s.x, 10, s.z), '#ff5a5a', 3);
      this.toast(`Duplicate! You already have all the ${biome || 'stage'} animals. Steal from the next stage!`, '#ff5a5a');
    });
    this.room.onLeave(() => {
      if (this.disposed) return; // we left on purpose
      this.connectionLost();
    });
  }

  // The connection dropped (bad signal, the phone slept, the server restarted...). No dead end: the
  // loading page comes back (ours and Bloxity's), we wait for the internet if it is gone, then load
  // the game again in the same room. Progress is kept on the server, eggs in progress included.
  connectionLost() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.music?.stop();
    const roomId = this.room?.roomId;
    const step = (text, progress) => {
      bloxity.loadingStep(text);
      this.store.set({ phase: 'reconnecting', loading: { text, progress } });
    };
    bloxity.gameplayEnd();
    bloxity.loadingStart();
    bloxity.adScreen('lobby'); // the reconnect page is a loading page: banners again until we are back
    step('Connection lost. Reconnecting', 0.1);
    const go = () => {
      if (!navigator.onLine) { step('Waiting for the internet', 0.1); return; }
      window.removeEventListener('online', go);
      clearInterval(this.onlineTimer);
      step('Reconnecting', 0.4);
      setTimeout(() => reloadGame(roomId), 900);
    };
    window.addEventListener('online', go);
    this.onlineTimer = setInterval(go, 2000);
    go();
  }

  setupQuality() {
    this.quality = new QualityManager({
      onTier: (tier, q) => this.applyQuality(tier, q),
      onNetwork: (grade, n) => {
        this.sendInterval = n.sendInterval;
        RemotePlayer.smoothing = n.smoothing;
        GuardianView.smoothing = n.smoothing - 2;
        this.network = grade;
        this.updateFogTarget();
        this.effects.setMagicLevel(this.tier, grade);
      },
    });
    this.quality.setCap(bloxity.settings.graphics_quality);
    this.quality.start();
    this.room.onMessage('pong', ({ t }) => { if (typeof t === 'number') this.quality.pong(t); });
  }

  // Turns the heavy things up or down for the chosen tier.
  applyQuality(tier, q) {
    this.q = q;
    this.updateResolution(); // sharpness for this tier (never blurry, see updateResolution)
    const sun = this.sun;
    sun.castShadow = q.shadows;
    if (q.shadows) {
      if (sun.shadow.mapSize.x !== q.shadowSize) {
        sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      const c = sun.shadow.camera;
      c.left = c.bottom = -q.shadowRange;
      c.right = c.top = q.shadowRange;
      c.updateProjectionMatrix();
    }
    // shadows redrawn every frame, or every 2nd frame on Medium (half the shadow cost)
    this.renderer.shadowMap.autoUpdate = !q.shadows || q.shadowEvery <= 1;
    this.renderer.shadowMap.needsUpdate = true;
    // the extras weaker devices skip
    GroundEggView.sparkles = q.sparkles;
    this.world.dancers.setQuality(q);
    this.bats.setQuality(tier);
    this.sky.setAurora(tier !== 'low');
    RemotePlayer.trails = q.otherTrails;
    TrailRibbon.sparkles = q.sparkles !== false;
    this.effects.particles = q.particles;
    // the camera sees the whole world (the mist and cull decide what is drawn), so a clear sky with
    // no mist never ends in a hard edge
    this.camera.far = NO_FOG.far;
    this.camera.updateProjectionMatrix();
    this.tier = tier;
    this.updateFogTarget();
    this.effects.setMagicLevel(tier, this.network);
    this.cullTimer = CULL_EVERY; // re-check what is in view now
    // new shadow settings mean new shaders for everything: compile them now, not as each thing comes into view
    if (this.animals?.size) this.precompile();
    this.store.set({ perf: { ...this.store.get().perf, tier: q.label } });
  }

  // How far you see. High/Ultra with a smooth frame rate and a good ping: no mist at all. When the
  // FPS drops or the ping rises, the mist comes in (the worse, the closer); Low and Medium (a weak
  // device or a bad connection) always have some. Re-checked every second (publishPerf) and
  // whenever the tier or connection grade changes.
  updateFogTarget() {
    const q = this.quality;
    const fps = q ? lerpFactor(-q.fps, -FOG_FPS.good, -FOG_FPS.bad, FOG_FPS.min) : 1; // lower FPS -> closer mist
    const ping = q?.ping == null ? 1 : lerpFactor(q.ping, FOG_PING.good, FOG_PING.bad, FOG_PING.min);
    const k = Math.min(fps, ping); // whichever is worse decides
    const smoothTier = this.tier === 'high' || this.tier === 'ultra';
    if (smoothTier && k >= 0.999 && this.network !== 'poor') {
      this.fogTarget = { ...NO_FOG };
      return;
    }
    const base = FOG[this.tier] || FOG.medium;
    const far = Math.max(FOG_MIN_FAR, base.far * k);
    this.fogTarget = { near: Math.max(FOG_MIN_NEAR, Math.min(base.near * k, far * 0.6)), far };
  }

  updateFog(dt) {
    const fog = this.scene.fog;
    const t = Math.min(1, dt * FOG_EASE);
    fog.near += (this.fogTarget.near - fog.near) * t;
    fog.far += (this.fogTarget.far - fog.far) * t;
    // the sky's horizon gets the same mist: thick when the fog is close, faint when far
    // (none at all when there is no mist)
    const amount = Math.max(0, Math.min(1, 1 - (fog.far - FOG_MIN_FAR) / (FOG.ultra.far - FOG_MIN_FAR) * 0.92));
    this.skyFogAmount = amount;
    // the mist takes the colour of the stage's sky (a red haze in Blood Moon, violet in the Void...)
    const stageSky = this.sky.material.uniforms;
    fog.color.copy(FOG_COLOR).lerp(stageSky.uStageHorizon.value, stageSky.uStageK.value * 0.85);
    this.sky.setFog(fog.color, amount);
  }

  // Hides trees, animals and other players beyond the draw distance (checked a few times a second).
  cull(dt) {
    this.cullTimer += dt;
    if (this.cullTimer < CULL_EVERY) return;
    this.cullTimer = 0;
    const far = this.fogTarget.far; // nothing past the mist is drawn (no mist: everything is)
    const p = this.player.body.pos;
    const near = (x, z, margin = 0) => Math.hypot(x - p.x, z - p.z) < far + margin;
    for (const animal of this.animals.values()) {
      animal.visible = !animal.away && near(animal.target.x, animal.target.z, 20); // away: out chasing me as my own chaser
      animal.root.visible = animal.visible;
    }
    for (const remote of this.remotes.values()) remote.root.visible = near(remote.target.x, remote.target.z, 40);
    for (const egg of this.groundEggs.values()) egg.group.visible = near(egg.x, egg.z, 10);
    // world chunks (ground, cliffs, decor) further along the road than the mist are not drawn
    for (const chunk of this.world.chunks) {
      const c = chunk.userData.chunk;
      if (c) chunk.visible = Math.abs(c.z - p.z) - c.half < far + 80;
    }
  }

  shake(strength) {
    if (!this.q?.cameraShake) return;
    this.shakeLeft = SHAKE_SECONDS;
    this.shakeStrength = strength;
  }

  // A pillar or tree between the player and the camera pulls the camera in front of it.
  keepCameraOutOfTrunks() {
    const f = this.focus, c = this.camera.position;
    const dx = c.x - f.x, dz = c.z - f.z;
    const a = dx * dx + dz * dz;
    if (a < 1e-4) return;
    let nearest = 1;
    for (const circle of this.physics.circles) {
      if (!circle.active) continue;
      const r = circle.r + CAMERA_TRUNK_MARGIN;
      const fx = f.x - circle.x, fz = f.z - circle.z;
      const b = 2 * (fx * dx + fz * dz);
      const cc = fx * fx + fz * fz - r * r;
      if (cc < 0) continue; // the player is up against it
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t >= nearest) continue;
      if (f.y + (c.y - f.y) * t > (circle.top ?? Infinity)) continue;
      nearest = t;
    }
    if (nearest >= 1) return;
    c.set(f.x + dx * nearest, f.y + (c.y - f.y) * nearest, f.z + dz * nearest);
    this.camera.lookAt(f);
  }

  // The player's Bloxity friends: for the invite popup, and sent to the server for the friend cash boost.
  // Called on joining, on sign-in and every time the Invite popup opens (so the list is fresh).
  async loadFriends() {
    if (!this.room) return;
    if (!bloxity.user) {
      this.store.set({ friends: [], friendsLoading: false, roomId: this.room.roomId });
      return;
    }
    this.store.set({ friendsLoading: true });
    const res = await bloxity.friends();
    const list = Array.isArray(res) ? res : res?.friends || res?.data || [];
    const friends = list.map((f) => ({
      id: String(f.id ?? f.userId ?? f._id ?? ''),
      name: f.displayName || f.username || f.name || 'Friend',
      online: !!(f.online ?? f.isOnline ?? (f.status === 'online' || f.status === 'in_game')),
      avatar: f.avatarUrl || f.pfp || f.avatar?.headshot || null,
    })).filter((f) => f.id);
    this.store.set({ friends, friendsLoading: false, roomId: this.room.roomId });
    this.room.send('friends', { ids: friends.map((f) => f.id) });
  }

  // Running leaves a trail of magic sparkles: a small puff at the feet every few steps. Few particles
  // each, and Effects caps how many are alive, so it never makes the game lag.
  runSparkles() {
    const p = this.player.body.pos;
    const last = this.lastSparkleAt;
    this.lastSparkleAt = last || p.clone();
    if (!last || !this.player.body.grounded || this.player.onTreadmill) {
      if (last) last.copy(p);
      return;
    }
    const moved = Math.hypot(p.x - last.x, p.z - last.z);
    const step = Math.max(SPARKLE_STEP, this.player.walkSpeed * 0.13); // faster runners: puffs further apart
    if (moved > step * 4) return void last.copy(p); // a jump in position (respawn, knockback)
    if (moved < step) return;
    last.copy(p);
    _sparkleAt.set(p.x, p.y + 0.3, p.z);
    this.effects.magicDust(_sparkleAt, 4, 0.9, 4);
  }

  // ---------------------------------------------------------------- Boxity platform hooks

  setupPlatform() {
    loadEmotes(); // the emote catalogue, so emotes from Boxity's picker can play
    this.platformOff = [
      bloxity.onAdBreak((on) => { this.adBreak = on; this.audio.setPaused(on); if (!on) this.clock.getDelta(); }),
      // a popup opening
      this.store.subscribe(() => {
        const popup = this.store.get().popup;
        if (popup && popup !== this.lastPopup) this.audio.pop();
        if (popup === 'invite' && this.lastPopup !== 'invite') this.loadFriends();
        this.lastPopup = popup;
      }),
      bloxity.onPlayerEvent(({ event, data }) => {
        if (event === 'respawn_request') this.sendHome(); // Boxity menu: Reset Character (instant)
        else if (event === 'play_emote' && typeof data === 'string') {
          this.player.avatar.playEmote(data);
          this.room.send('emote', { id: data }); // everyone else sees it too
        }
      }),
      // chat: Boxity draws the chat; the game shows each message over the sender's head
      bloxity.onChat((m) => {
        const who = m.isLocalPlayer ? this.player : this.remoteByUser(m.userId);
        if (!who) return;
        who.bubble?.parent?.remove(who.bubble);
        who.bubble = bloxity.attachBubble(THREE, who.root, m);
      }),
    ];
    // the top-right card: name + picture (the account when signed in, the Boxity guest otherwise),
    // the speaker (Boxity master volume) and the Gems balance
    this.platformOff.push(
      bloxity.onUser(() => { this.refreshProfile(); this.loadFriends(); this.rejoinIfIdentityChanged(); }),
      bloxity.onSettings(() => this.refreshProfile(false)),
    );
    this.store.set({ embedded: bloxity.embedded });
    this.gemsTimer = setInterval(() => this.refreshProfile(), 30_000);
  }

  // Signed in (or out) mid-game: the server must know the new identity (saves, Gems, leaderboards),
  // so rejoin the SAME room as it, which keeps the player with their friends (the save is written on
  // leaving and a guest's progress moves into a new account). Done once per identity, never in a loop.
  rejoinIfIdentityChanged() {
    const now = bloxity.userId();
    if (!this.room || now === this.joinedAs) return;
    const key = 'cse_rejoined_as';
    try {
      if (sessionStorage.getItem(key) === String(now)) return;
      sessionStorage.setItem(key, String(now));
    } catch {}
    console.info('[bloxity] identity changed, rejoining the same room');
    const roomId = this.room.roomId;
    this.room.leave(true).catch(() => {}).finally(() => reloadGame(roomId));
  }

  async refreshProfile(withGems = true) {
    if (withGems) this.gems = bloxity.user ? (await bloxity.gemsBalance()) ?? this.gems ?? 0 : 0;
    this.store.set({
      profile: { name: bloxity.displayName(), pfp: bloxity.pfp(), gems: this.gems ?? 0, muted: bloxity.settings.master_volume === '0' },
    });
  }

  remoteByUser(userId) {
    const id = String(userId || '');
    for (const [sessionId, remote] of this.remotes) {
      const p = this.room.state.players.get(sessionId);
      if (p && (p.userId === id || p.userId.replace(/^[a-z]+_/, '') === id)) return remote;
    }
    return null;
  }

  // back to your own base, popping back into view
  // Whose ninjas are shown: your own pen, and the ninjas in the NEAR_PENS other pens nearest you;
  // the rest are hidden (not built, not animated), so a full room of pens never costs more than
  // three. How many of them show follows the device and the connection (FX.level, the tier):
  //   full on Ultra:  yours all, the near ones 10 each      full on High: yours all, 8 each
  //   mid:            yours 10, 5 each                       low / poor connection: yours 6, 2 each
  // Re-checked twice a second; a pen already shown stays until another is clearly nearer (no flicker
  // when you stand between two).
  updatePenViews(dt) {
    this.penViewT = (this.penViewT || 0) - dt;
    if (this.penViewT > 0 || !this.me) return;
    this.penViewT = 0.5;
    const level = FX.level ?? 2;
    const [own, others] = level >= 2 ? (this.tier === 'ultra' ? [Infinity, 10] : [Infinity, 8]) : level === 1 ? [10, 5] : [6, 2];
    const p = this.player.body.pos;
    const mid = (PLOT.penMinX + PLOT.penMaxX) / 2;
    const near = this.world.plots
      .map((view, i) => ({ view, i, d: (() => { const c = plotToWorld(PLOTS[i], mid, 0); return Math.hypot(c.x - p.x, c.z - p.z); })() }))
      .filter((e) => e.i !== this.me.plot)
      .sort((a, b) => a.d - b.d);
    const shown = new Set(near.slice(0, NEAR_PENS).map((e) => e.i));
    // keep one shown before if it is about as near as the last one picked
    const lastD = near[NEAR_PENS - 1]?.d ?? Infinity;
    for (const e of near) if (this.nearPens?.has(e.i) && !shown.has(e.i) && e.d < lastD + 25) {
      const farthest = [...shown].map((i) => near.find((n) => n.i === i)).sort((a, b) => b.d - a.d)[0];
      if (farthest && !this.nearPens.has(farthest.i)) { shown.delete(farthest.i); shown.add(e.i); }
    }
    this.nearPens = shown;
    this.world.plots.forEach((view, i) => view.setPetLimit(i === this.me.plot ? own : shown.has(i) ? others : 0));
  }

  sendHome() {
    const at = plotToWorld(PLOTS[this.me.plot], PLOT.spawn.x, (Math.random() - 0.5) * 8); // outside your own pen
    this.player.body.pos.set(at.x, 0, at.z);
    this.player.body.vel.set(0, 0, 0);
    this.player.knockback = 0;
    this.player.root.visible = true;
    this.player.shatter();
    this.player.shatterT = 0.35; // just the pop back
    this.audio.teleport();
  }

  // how loud a sound at (x, z) is for me: 1 right here, fading to nothing `range` away
  soundLevel(x, z, range = 140) {
    const p = this.player.body.pos;
    return Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / range);
  }

  toast(text, color) {
    this.store.set({ toast: { text, color, at: performance.now() } });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.store.set({ toast: null }), 2000);
  }

  // Compiles the shaders of EVERYTHING in the world now, in the background, including what the cull
  // has hidden (far chunks, guardians, eggs). Otherwise each one compiles in the frame it first comes
  // into view: a freeze of up to a second when running into a new part of the map.
  precompile() {
    if (!this.renderer.compileAsync) return;
    if (this.precompiling) {
      this.precompileAgain = true; // settings changed meanwhile: once more when this one is done
      return;
    }
    this.precompiling = true;
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.visible && (o.isMesh || o.isGroup || o.isInstancedMesh || o.isPoints)) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const done = () => {
      this.precompiling = false;
      this.cullTimer = CULL_EVERY; // let the cull hide again what it hides
      if (this.precompileAgain) {
        this.precompileAgain = false;
        this.precompile();
      }
    };
    const job = this.renderer.compileAsync(this.scene, this.camera);
    for (const o of hidden) o.visible = false; // the programs are already requested; nothing extra is drawn
    job.then(done, done);
  }

  syncAnimals() {
    const animals = this.room.state.animals;
    let chased = false;
    let added = false;
    // Each thief has a chaser of their own (owner = them) that only they see; the nest's own guardian
    // (g<nest>) stays asleep for everyone else, and is hidden from me while my chaser is out.
    const mine = this.room.sessionId;
    const out = new Set(); // nests whose guardian is out chasing me
    animals.forEach((a, id) => { if (a.owner === mine) out.add(`g${id.slice(1).split('.')[0]}`); });
    animals.forEach((a, id) => {
      if (a.owner && a.owner !== mine) return; // someone else's chaser: not mine to see
      let view = this.animals.get(id);
      if (!view) {
        view = new GuardianView(a, this.scene);
        this.animals.set(id, view);
        added = true;
      }
      view.setState(a);
      view.away = out.has(id);
      if (view.away) view.root.visible = false;
      if ((a.mood === 'chase' || a.mood === 'alert') && a.target === mine) chased = true;
    });
    // chasers that went home (or whose thief got away): gone
    for (const [id, view] of this.animals) {
      if (animals.has(id)) continue;
      this.scene.remove(view.root);
      this.animals.delete(id);
    }
    // new guardians: compile their shaders now, in the background, instead of in the frame they
    // first come into view (that was a hitch of a few hundred ms when running into a new biome)
    if (added) this.precompile();
    if (chased && !this.wasChased) this.audio.alert(); // a guardian woke up and is after me
    this.wasChased = chased;
    this.store.set({ chased });
  }

  // sounds for what changed on me since last frame: an egg picked up
  eventSounds(me) {
    const carried = me.carried === '[]' ? 0 : (me.carried.match(/"type"/g) || []).length;
    if (this.soundState && carried > this.soundState.carried) this.audio.pickup();
    this.soundState = { carried };
  }

  // My cash, speed and axe, the zone I am in, and speed gained on the treadmill.
  publishPerf() {
    const now = performance.now();
    if (now - (this.perfAt || 0) < 1000) return;
    this.perfAt = now;
    this.updateFogTarget(); // follow the live frame rate and ping
    const q = this.quality;
    this.store.set({ perf: { tier: q.settings.label, fps: Math.round(q.fps), ping: q.ping === null ? null : Math.round(q.ping), network: this.network } });
  }

  syncMe() {
    const me = this.me;
    this.eventSounds(me);
    // (my pets list and popup data arrive in the private 'mine' message, see listen)
    if (me.pen !== this.penJson) {
      this.penJson = me.pen;
      this.store.set({ pen: JSON.parse(me.pen || '[]') });
    }
    const slow = !!this.store.get().slowMode;
    this.player.walkSpeed = walkSpeed(me.speed) * (this.meta?.walk || 1) * (slow ? 0.5 : 1);
    // the server slows my chasers down with me
    if (slow !== this.sentSlow) {
      this.sentSlow = slow;
      this.room.send('slowMode', { on: slow });
    }
    this.player.setAxe(me.axe || 'bat');
    this.player.setSpinStyle(me.spin); // my whirlwind's look (Spin Shop)
    this.player.setTrail(me.trail);
    const state = this.room.state;
    this.store.set({
      stats: { cash: me.cash, income: me.income, speed: me.speed, treadmill: me.treadmill, axe: me.axe || 'bat' },
      clock: { night: state.night, left: state.clock },
      onTreadmill: !!this.player.onTreadmill,
    });
    if (this.lastSpeed !== null && me.speed > this.lastSpeed) {
      const p = this.player.body.pos;
      this.effects.floatText(`+${formatNumber(me.speed - this.lastSpeed)} ⚡`, new THREE.Vector3(p.x, p.y + 7, p.z), '#35b8ff');
    }
    this.lastSpeed = me.speed;

    const biome = biomeAt(this.player.body.pos.z);
    const id = biome?.id || null;
    if (id !== this.zoneId) {
      if (biome && this.zoneId !== undefined) this.audio.zone();
      this.zoneId = id;
      this.music.setSong(biome ? 'raid' : 'lobby'); // the chase tune on the track, the lullaby in the lobby
      clearTimeout(this.zoneTimer);
      this.store.set({ zone: biome ? { name: biome.name, difficulty: biome.difficulty, speed: biome.speed } : null });
      if (biome) this.zoneTimer = setTimeout(() => this.store.set({ zone: null }), 4000);
    }
  }

  pfpOf(p) {
    const key = p.avatar + p.props;
    if (!this.pfps) this.pfps = new Map();
    if (!this.pfps.has(key)) this.pfps.set(key, avatarPfpUrl(safeParse(p.avatar), safeParse(p.props)));
    return this.pfps.get(key);
  }

  // On joining: look at your own frame and say which one it is.
  showMyBase() {
    // facing the corridor into the biomes, with the camera behind the player
    const p = this.player.body.pos;
    const dx = 0 - p.x, dz = WORLD.lineZ - p.z;
    this.player.ry = Math.atan2(dx, dz);
    this.camController.yaw = this.player.ry + Math.PI;
    this.camController.pitch = 0.22;
    this.camController.distance = this.camController.targetDistance = 36;
    this.toast('Welcome! Your pen is the one with your name on it.', '#46e24a');
  }

  syncGroundEggs() {
    const eggs = this.room.state.eggs;
    eggs.forEach((egg, id) => {
      if (!this.groundEggs.has(id)) this.groundEggs.set(id, new GroundEggView(id, egg, this.scene, { fly: this.eggsSynced, effects: this.effects }));
    });
    this.eggsSynced = true;
    for (const [id, view] of this.groundEggs) {
      if (eggs.has(id)) continue;
      view.dispose();
      this.groundEggs.delete(id);
    }
  }

  syncPlayers() {
    const players = this.room.state.players;
    const owners = new Map();
    players.forEach((p, sessionId) => {
      owners.set(p.plot, { p, sessionId });
      if (sessionId === this.room.sessionId) return;
      let remote = this.remotes.get(sessionId);
      if (!remote) {
        remote = new RemotePlayer({
          name: p.name, x: p.x, y: p.y, z: p.z, ry: p.ry,
          equipped: safeParse(p.avatar), proportions: safeParse(p.props),
        });
        this.remotes.set(sessionId, remote);
        this.scene.add(remote.root, remote.trail.mesh);
        bloxity.playerJoined(p.name);
      }
      remote.setState(p);
    });
    // the other players here, for the gift picker in the shop
    const others = [];
    players.forEach((p, sessionId) => { if (sessionId !== this.room.sessionId) others.push({ sid: sessionId, name: p.name }); });
    const key = others.map((o) => o.sid + o.name).join('|');
    if (key !== this.othersKey) {
      this.othersKey = key;
      this.store.set({ others });
    }
    for (const [sessionId, remote] of this.remotes) {
      if (players.has(sessionId)) continue;
      remote.dispose();
      this.remotes.delete(sessionId);
    }
    this.world.plots.forEach((plot, i) => {
      const owner = owners.get(i);
      const mine = owner?.sessionId === this.room.sessionId;
      const sign = owner ? { name: owner.p.name, mine, pfp: mine ? bloxity.pfp() : this.pfpOf(owner.p) } : null;
      plot.sync(owner?.p || null, mine, sign, mine && this.me.carried !== '[]');
      // the arena's floor arrows race round while its owner spins in it
      plot.setSpinning(mine ? this.player.anim === 'spin' : owner?.p.anim === 'spin');
    });
    this.player.setCarried(this.me.carried);
  }

  sendPosition(dt) {
    this.sendTimer += dt;
    if (this.sendTimer < this.sendInterval) return;
    this.sendTimer = 0;
    const p = this.player.body.pos;
    const message = { x: p.x, y: p.y, z: p.z, ry: this.player.ry, anim: this.player.anim };
    const key = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${this.player.ry.toFixed(2)},${this.player.anim}`;
    if (key === this.lastSent) return;
    this.lastSent = key;
    this.room.send('move', message);
  }

  // Night: the lights dim and turn blue, the sky goes dark purple. Eased so it never jumps.
  updateNight(dt) {
    const goal = this.room.state.night ? 1 : 0;
    this.nightK += (goal - this.nightK) * Math.min(1, dt * 0.8);
    const k = this.nightK;
    // night: cool, bright moonlight, so everything (the plots, the arenas, the eggs, the guardians)
    // still shows clearly under the dark sky; the lamps and the light beams do the rest
    this.hemi.intensity = 1.7 - k * 0.75;
    this.hemi.color.setRGB(1 - k * 0.32, 1 - k * 0.2, 1);
    this.sun.intensity = 2.5 - k * 1.85;
    FX.night = k;
    // my whirlwind lights up the ground round me at night, in its own colour
    if (this.playerLight) {
      this.playerLight.intensity = k * (this.player.tornado?.k || 0) * 380;
      this.playerLight.color.set(spinById(this.me?.spin).glow);
    }
    this.sky.setNight(k);
    this.world.lamps?.setNight(k); // the stage lamps come on as night falls
    setPetNight(Math.max(k, this.sky.stage?.dim || 0), this.time); // the animals' glowing parts shine out at night
    if (k > 0.01) this.sky.setFog(NIGHT_SKY, Math.max(this.skyFogAmount || 0, k * 0.5));
    this.updateCelestial(dt);
    // the evening: the last CYCLE.eveningS seconds of the day the sky turns orange and pink and the
    // light goes warm and a little lower, before the night's rain clouds come over
    const { night, clock } = this.room.state;
    const eveGoal = night ? 0 : Math.max(0, Math.min(1, 1 - (clock || 0) / CYCLE.eveningS));
    this.eveningK = (this.eveningK || 0) + (eveGoal - (this.eveningK || 0)) * Math.min(1, dt * 0.8);
    const ev = this.eveningK * (1 - k);
    this.sky.setEvening(ev);
    if (ev > 0.001) {
      this.hemi.color.lerp(EVENING_COLOR, ev * 0.45);
      this.hemi.intensity *= 1 - ev * 0.2;
      this.sun.color.lerp(EVENING_SUN, ev * 0.7);
      this.sun.intensity *= 1 - ev * 0.25;
    }
    // a dark stage (Blood Moon, the Void...) dims the light and tints it its own colour
    const stage = this.sky.stage;
    if (stage.dim > 0.001) {
      this.hemi.intensity *= 1 - stage.dim * 0.45;
      this.hemi.color.lerp(stage.tint, stage.dim * 0.6);
      this.sun.intensity *= 1 - stage.dim * 0.5;
      this.sun.color.lerp(stage.tint, stage.dim * 0.5);
    }
  }

  // The sun (by day) and the moon (by night) cross the sky with the server's clock: state.clock is
  // the seconds left in this day or night. It only ticks once a second, so the shown position eases
  // after it instead of jumping. The light comes from wherever the sun / moon is (never too low).
  updateCelestial(dt) {
    const { night, clock } = this.room.state;
    const total = (night ? CYCLE.nightMs : CYCLE.dayMs) / 1000;
    const target = Math.max(0, Math.min(1, 1 - clock / total));
    if (this.celestialNight !== night || this.celestialP === undefined) {
      this.celestialNight = night; // a new day / night: start from where it rises
      this.celestialP = target;
    }
    this.celestialP += (target - this.celestialP) * Math.min(1, dt * 1.5);
    this.sky.setCelestial(this.celestialP, night);
    const k = this.nightK;
    this.lightDir.copy(this.sky.sunDir).lerp(this.sky.moonDir, k);
    this.lightDir.y = Math.max(this.lightDir.y, LIGHT_MIN_Y);
    this.lightDir.normalize();
    this.sun.color.copy(SUN_COLOR).lerp(MOON_COLOR, k);
  }

  frame() {
    const rawDt = this.clock.getDelta();
    if (this.adBreak) return; // a Boxity ad break: everything stands still until it ends
    const dt = Math.min(0.05, rawDt);
    // Every part of the frame runs on its own (safe): if one part ever throws, the rest of the game
    // still moves, updates and draws, instead of the whole frame stopping (which looks like a freeze).
    const safe = this.safe;
    safe('quality', () => this.quality.frame(rawDt, (t) => this.room.send('ping', { t })));
    // the effects' level (see effectLevel): animations and powers show from mid level up, in full on high
    FX.level = this.effectLevel();
    FX.fancy = FX.level >= 1;
    TreadmillView.fancy = FX.fancy;
    this.updateExtras(dt);
    safe('cull', () => this.cull(dt));
    this.time += dt;

    safe('player', () => {
      this.input.update();
      const fromZ = this.player.body.pos.z;
      this.player.frozen = frozenAt(this.room.state); // the last seconds of the day / night
      this.player.update(dt, this.input, this.camController.yaw, this.physics);
      this.blockAtGlass(fromZ);
      if (this.player.justJumped) { this.player.justJumped = false; this.audio.jump(); }
      if (this.player.landed()) { // thrown by a guardian, now hits the ground: in pieces
        this.effects.shatter(this.player.body.pos);
        this.audio.shatter();
        this.player.shatter();
        this.shake(0.9);
      }
    });
    safe('sparkles', () => this.runSparkles());
    safe('camera', () => {
      this.focus.copy(this.player.body.pos).setY(this.player.body.pos.y + AVATAR_HIP);
      this.camController.update(dt, this.focus, this.input.cameraTurn(false), this.input.cameraPitch());
      this.keepCameraOutOfTrunks();
      if (this.shakeLeft > 0) {
        this.shakeLeft = Math.max(0, this.shakeLeft - dt);
        const k = this.shakeStrength * (this.shakeLeft / SHAKE_SECONDS);
        this.camera.position.x += (Math.random() - 0.5) * k * 2;
        this.camera.position.y += (Math.random() - 0.5) * k * 2;
      }
    });

    safe('syncEggs', () => this.syncGroundEggs());
    safe('syncPlayers', () => this.syncPlayers());
    safe('syncAnimals', () => this.syncAnimals());
    safe('syncMe', () => this.syncMe());
    safe('perf', () => this.publishPerf());
    GuardianView.viewer = this.player.body.pos; // name plates show near the player
    // one broken thing (an animal, a tree, another player...) never stops the others
    for (const animal of this.animals.values()) if (animal.visible !== false) safe('animal', () => animal.update(dt));
    for (const egg of this.groundEggs.values()) safe('egg', () => egg.update(dt));
    for (const remote of this.remotes.values()) if (remote.root.visible) safe('remote', () => remote.update(dt));
    safe('penViews', () => this.updatePenViews(dt));
    for (const plot of this.world.plots) safe('plot', () => plot.update(dt));
    safe('effects', () => this.effects.update(dt));
    for (const glow of this.world.boardGlows) glow.uTime.value = this.time;
    // the dancing invite character only when it can be seen
    if (Math.hypot(this.player.body.pos.x - SHOPS.invite.x, this.player.body.pos.z - SHOPS.invite.z) < 260) safe('invite', () => this.inviteSpot.update(dt, this.time));
    for (const update of this.world.shine) safe('shine', () => update(this.time));
    if (this.room?.state) safe('dojo', () => this.world.setDojoClock(this.room.state.night, this.room.state.clock));
    safe('dancers', () => this.world.dancers.update(dt, this.time, this.player.body.pos, this.fogTarget.far, this.viewH, this.extrasK));

    safe('sky', () => {
      this.updateFog(dt);
      this.sky.update(dt, this.camera.position);
      this.sky.setStageAt(this.player.body.pos.z);
      this.stageSkies.update(dt, this.player.body.pos.z);
      updateCorridor(dt, this.player.body.pos.z); // the stages' torches, dust and bubbles (only the near ones move)
      const pad = this.world.spawnPad, me = this.player.body.pos;
      pad?.update(dt, this.nightK, !!pad && Math.hypot(me.x - pad.x, me.z - pad.z) < 400); // the spawn pad's beam and dust
      this.updateNight(dt);
      this.sun.position.copy(this.player.body.pos).addScaledVector(this.lightDir, LIGHT_DISTANCE);
      this.sun.target.position.copy(this.player.body.pos);
      this.bats.update(dt, this.nightK, this.player.body.pos, this.extrasK);
      const nearGate = Math.abs(this.player.body.pos.z - GATE_Z) < 300; // the ticks only near the corridor mouth
      if (this.glassGate.update(dt, this.room.state) && nearGate) this.audio.tone(this.room.state.clock <= 1 ? 1320 : 880, 0.09, { type: 'square', vol: 0.12 });
      if (this.glassGate.justBroke && nearGate) this.audio.shatter(); // the wall breaks apart
    });

    safe('interaction', () => {
      this.interaction.update();
      this.interaction.publish();
    });
    safe('tips', () => this.updateTips(dt));
    safe('arrows', () => this.guideArrows.update(dt, this.player.body.pos, this.interaction.guide));
    safe('network', () => this.sendPosition(dt));
    safe('render', () => {
      if (!this.renderer.shadowMap.autoUpdate && (this.shadowFrame = (this.shadowFrame || 0) + 1) % this.q.shadowEvery === 0) {
        this.renderer.shadowMap.needsUpdate = true;
      }
      this.renderer.render(this.scene, this.camera);
    });
  }

  // A click on the green button of one of my plot's boards (Upgrade Arena / Upgrade Pen): buy it.
  clickBoard(e) {
    const plot = this.world?.plots?.[this.me?.plot];
    if (!plot || !this.room) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    const hit = _ray.intersectObjects(plot.boards(), false)[0];
    if (!hit) return false;
    const buy = hit.object.userData.buy;
    if (buy && onBoardButton(hit.uv)) {
      this.room.send(buy);
      this.audio.pop?.();
    }
    return true; // a click on a board never does anything else
  }

  // Tips for new players, low on the screen in big letters: each one once (remembered in this
  // browser), one at a time, as soon as it is useful. They never stop the game.
  updateTips(dt) {
    if (!this.tipsSeen) {
      try { this.tipsSeen = new Set(JSON.parse(localStorage.getItem('sne-tips') || '[]')); } catch { this.tipsSeen = new Set(); }
      this.tipWait = 4; // a moment after joining before the first one
    }
    this.tipWait -= dt;
    if (this.tipWait > 0 || this.store.get().popup) return;
    const p = this.player, me = this.me;
    if (!p || !me) return;
    const pen = (() => { try { return JSON.parse(me.pen || '[]'); } catch { return []; } })();
    const plot = PLOTS[me.plot];
    const inMyPen = plot && Math.hypot(p.body.pos.x - plot.x, p.body.pos.z - plot.z) < 140;
    const tips = [
      ['spin', true, '🌀 Click SPIN (or press 1) to turn into a whirlwind! Click again to turn back'],
      ['arena', p.arena, '⚡ Stay in your Arena to spin faster and faster! Press SPACE to leave it'],
      ['carry', p.carryTornado, '🥚 You stole an egg! Whirl back to the start before the guardian catches you!'],
      ['place', p.carrying && !p.carryTornado && inMyPen, '🏠 Click inside your pen to put the egg down to grow'],
      ['hatch', pen.some((e) => e.left <= 0), '🐣 Your egg is ready! Hold E on it to hatch a ninja'],
    ];
    const next = tips.find(([key, when]) => when && !this.tipsSeen.has(key));
    if (!next) return;
    this.tipsSeen.add(next[0]);
    try { localStorage.setItem('sne-tips', JSON.stringify([...this.tipsSeen])); } catch { /* private mode */ }
    this.store.set({ tip: { text: next[2], at: performance.now() } });
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.store.set({ tip: null }), 7000);
    this.tipWait = 8; // the next one waits until this one has gone
  }

  // The Spin button (or 1): turn into a whirlwind, or back. Turning into one is a spin attack too
  // (it dazes a guardian right next to you, like the bat used to).
  toggleTornado() {
    if (!this.player || !this.room) return;
    const on = this.player.toggleTornado();
    this.store.set({ tornado: on });
    if (on) {
      this.audio.swing();
      this.room.send('swing');
    }
  }

  // The glass gate (closed for the last seconds of each day / night) is one-way: it stops you walking
  // from the lobby into the corridor, but lets anyone coming home pass straight through.
  blockAtGlass(fromZ) {
    if (!this.glassGate.closed) return;
    const body = this.player.body, p = body.pos;
    if (Math.abs(p.x) > WORLD.openingHalf || fromZ < GATE_Z) return; // beside it, or already north of it
    const stop = GATE_Z + body.radius;
    if (p.z < stop) {
      p.z = stop;
      body.vel.z = Math.max(0, body.vel.z);
    }
  }

  // Runs one part of the frame; an error is logged once per part (not 60 times a second) and the
  // game carries on.
  // The heavier effects (the glass bursting into a dust spiral, the treadmill smoke spiralling with
  // magic dust) run only on a smooth tier with a good connection; otherwise the plain versions run.
  // How much of the effects (whirlwind dust, guardian powers, ninjas' powers, magic dust) to show:
  //   2 full: High / Ultra with a good connection
  //   1 mid:  Medium, or High / Ultra on a fair connection: every animation shows, with fewer particles
  //   0 low:  Low, or a poor connection: the plain versions
  // and at once one level lower (two when it is bad) while the live frame rate dips, before the tier
  // itself has time to drop, so a heavy moment never turns into lag.
  effectLevel() {
    const net = this.network || 'good';
    let level = this.tier === 'low' || net === 'poor' ? 0 : (this.tier === 'high' || this.tier === 'ultra') && net === 'good' ? 2 : 1;
    const fps = Math.min(this.quality?.fps ?? 60, this.quality?.recentFps ?? 60);
    const dip = fps < 30 ? 2 : fps < 44 ? 1 : 0;
    // a dip counts at once; coming back up waits until the frames have been fine for 4 s (no flicker)
    const now = performance.now();
    if (dip >= (this.fxDip || 0)) {
      if (dip > 0) this.fxDipUntil = now + 4000;
      this.fxDip = dip;
    } else if (now > (this.fxDipUntil || 0)) this.fxDip = dip;
    return Math.max(0, level - this.fxDip);
  }

  get fancy() {
    return (this.tier === 'high' || this.tier === 'ultra') && (this.network || 'good') === 'good';
  }

  // The moving extras (the night bats, the ghosts floating on the lobby pillars, their beams and dust)
  // follow `fancy`, eased: they come in slowly only after the game has been smooth with a good
  // connection for a couple of seconds, and go away a little faster when it is not, so they never
  // blink on and off and never pop.
  updateExtras(dt) {
    this.fancyFor = this.fancy ? (this.fancyFor || 0) + dt : 0;
    const target = this.fancyFor > 2 ? 1 : 0;
    const k = this.extrasK ?? 0;
    this.extrasK = target > k ? Math.min(1, k + dt / 1.5) : Math.max(0, k - dt / 0.8);
  }

  safe = (name, fn) => {
    try {
      fn();
    } catch (err) {
      this.frameErrors ??= new Set();
      if (!this.frameErrors.has(name)) {
        this.frameErrors.add(name);
        console.error(`[game] ${name} failed (the game keeps running):`, err);
      }
    }
  };

  dispose() {
    this.running = false;
    this.renderer?.setAnimationLoop(null);
    this.unsubscribeSettings?.();
    this.music?.stop();
    this.audio?.dispose();
    this.platformOff?.forEach((off) => off?.());
    clearInterval(this.gemsTimer);
    this.input?.dispose();
    clearTimeout(this.revealTimer);
    clearTimeout(this.bonusTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.zoneTimer);
    clearTimeout(this.announceTimer);
    this.quality?.dispose();
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.sharpnessOff?.();
    this.room?.leave();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
