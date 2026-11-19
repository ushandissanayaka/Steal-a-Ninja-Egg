// Voxel models for the biome guardians and the pets that hatch from their eggs.
// Same idiom as PetDisplay's builders: v.box(x, y, z, w, h, d, color, { rx, ry, rz }),
// where x/z is the centre of the box and y its bottom. Every model faces +Z and stands on y = 0.

const WHITE = '#ffffff', BLACK = '#17181c';

// One eye. A guardian's builder is given v.eye(): each eye then becomes its own little piece, so the
// guardian can keep its eyes shut while it sleeps and open them when someone steals an egg. The eye's
// first box is the eye itself (its middle is where it closes to); the rest (pupils, glints) go with it.
// opts: lid = width of the closed eye's line, lidColor = its colour. Anywhere else (pet art, icons)
// the eye is just more boxes of the model.
const eyeOf = (v, opts) => (v.eye ? v.eye(opts) : v);

function eyes(v, x, y, z, gap, size = 0.5, color = BLACK) {
  for (const side of [-1, 1]) eyeOf(v).box(x + side * gap, y, z, size, size, 0.12, color);
}
// glowing eyes with a small pupil in front
function glowEyes(v, x, y, z, gap, size, glow, pupil) {
  for (const side of [-1, 1]) {
    const e = eyeOf(v);
    e.box(x + side * gap, y, z, size, size, 0.12, glow);
    if (pupil) e.box(x + side * gap, y + size * 0.3, z + 0.04, size * 0.4, size * 0.4, 0.1, pupil);
  }
}
function legs(v, color, w, h, dx, front, back) {
  for (const side of [-1, 1]) {
    v.box(side * dx, 0, front, w, h, w, color);
    v.box(side * dx, 0, back, w, h, w, color);
  }
}
// a row of n square teeth across `width`, hanging down from y (dir -1) or standing up from y (dir 1)
function teeth(v, x, y, z, width, n, size, dir = -1, color = WHITE) {
  const step = width / n;
  for (let i = 0; i < n; i++) {
    v.box(x - width / 2 + step * (i + 0.5), dir < 0 ? y - size : y, z, step * 0.72, size, 0.22, color);
  }
}

const RAINBOW = ['#ff3b5c', '#ff9a1f', '#ffe23a', '#38e06a', '#38b6ff', '#a45cff'];

export const CREATURE_BUILDERS = {
  // ───────────────────────────── Guardians ─────────────────────────────

  // Pumpkin Patch: grey wolf with an enormous white grin of square teeth
  grinhound(v) {
    const FUR = '#7d818b', LIGHT = '#8e929c', DARK = '#585c66';
    legs(v, DARK, 1.3, 2.6, 1.3, 2.4, -2.4);
    v.box(0, 2.6, 0, 3.6, 3, 7, FUR);
    for (let i = 0; i < 3; i++) v.box(0, 5.4, -1.8 + i * 1.5, 0.7, 1, 0.9, DARK, { rx: -0.5 });
    v.box(0, 4, 3.4, 3.3, 2.5, 0.9, '#2b1f2a'); // collar
    for (const side of [-1, 1]) v.box(side * 1.1, 4.9, 3.9, 0.35, 0.35, 0.3, '#c8c8d0');
    v.box(0, 4.2, 5, 3.6, 3.2, 3, LIGHT);
    v.box(0, 4.2, 7.2, 2.8, 1.8, 1.6, LIGHT);
    v.box(0, 5.9, 8.05, 0.8, 0.5, 0.1, BLACK); // nose
    // the grin: a white band of square teeth, wrapping round the snout
    v.box(0, 4.35, 8.04, 2.8, 1.2, 0.08, WHITE);
    for (const side of [-1, 1]) v.box(side * 1.43, 4.35, 7.2, 0.08, 1.2, 1.6, WHITE);
    v.box(0, 4.92, 8.1, 2.8, 0.07, 0.06, '#3b0d14');
    for (let i = -2; i <= 2; i++) v.box(i * 0.5 + 0.25, 4.35, 8.1, 0.07, 1.2, 0.06, '#3b0d14');
    glowEyes(v, 0, 6, 6.52, 0.95, 0.65, '#fff7a8', '#e8202a');
    for (const side of [-1, 1]) {
      v.box(side * 1.15, 7.2, 4.6, 0.9, 1.9, 0.7, DARK, { rz: -side * 0.18 });
      v.box(side * 1.15, 7.4, 4.97, 0.45, 1.2, 0.05, '#c06070', { rz: -side * 0.18 });
    }
    v.box(0, 4, -4.2, 0.9, 0.9, 2.8, DARK, { rx: -0.5 });
    // seen from behind: a bushy tail tip, darker haunches, a rump patch and a ruff behind the head
    v.box(0, 4.6, -5.6, 1.2, 1.2, 1.3, LIGHT, { rx: -0.5 });
    for (const side of [-1, 1]) v.box(side * 1.81, 2.9, -2.3, 0.08, 2, 2.4, DARK);
    v.box(0, 3.4, -3.53, 2.4, 1.8, 0.08, DARK);
    v.box(0, 5.6, 3.3, 3.8, 1.6, 0.9, DARK);
  },

  // Candy Lane: a floating candy-pink alien ghost: a huge head with black almond eyes, a stitched
  // grin, a lollipop antenna, long thin arms with three fingers and a wispy tail instead of legs
  sugarSpecter(v) {
    const PINK = '#ff7fc8', PINK2 = '#ff5fb0', LIGHT = '#ffc2e6', RED = '#e8203a', STITCH = '#4a0a24';
    // the wispy tail it floats on
    v.box(0, 0.5, -0.3, 0.7, 0.9, 0.7, PINK2, { rx: 0.5 });
    v.box(0, 1.1, 0, 1.3, 1.1, 1.2, PINK2, { rx: 0.25 });
    v.box(0, 1.9, 0, 1.9, 0.9, 1.6, PINK);
    // the body, with a candy-cane sash and gumdrop buttons
    v.box(0, 2.6, 0, 2.4, 3, 1.8, PINK);
    for (let i = 0; i < 5; i++) v.box(-0.8 + i * 0.4, 3 + i * 0.45, 0.92, 0.42, 0.42, 0.06, i % 2 ? WHITE : RED);
    for (let i = 0; i < 5; i++) v.box(0.8 - i * 0.4, 3 + i * 0.45, -0.92, 0.42, 0.42, 0.06, i % 2 ? WHITE : RED); // the sash goes round the back
    v.box(0.5, 3.1, 0.92, 0.38, 0.38, 0.1, '#3ddc5a');
    v.box(-0.5, 4.4, 0.92, 0.38, 0.38, 0.1, '#29c6ff');
    v.box(0, 5.6, 0, 0.8, 0.7, 0.8, LIGHT);
    // the big head
    v.box(0, 6, 0.4, 2.4, 0.6, 2.4, PINK);
    v.box(0, 6.4, 0.2, 4.2, 3.2, 3.4, PINK);
    v.box(0, 9.6, 0.1, 3.4, 0.6, 2.8, PINK);
    for (const side of [-1, 1]) {
      const e = eyeOf(v, { lidColor: '#8a1f5a' });
      e.box(side * 1, 7.7, 1.91, 1.5, 0.9, 0.08, BLACK, { rz: side * 0.42 });
      e.box(side * 0.78, 8.05, 1.96, 0.32, 0.28, 0.05, '#ff9ad8');
      v.box(side * 2.15, 7.2, 0.4, 0.12, 1.4, 1.6, LIGHT); // cheeks
    }
    v.box(0, 6.85, 1.91, 2.2, 0.16, 0.06, STITCH);
    for (let i = -3; i <= 3; i++) v.box(i * 0.32, 6.67, 1.95, 0.07, 0.52, 0.05, STITCH);
    // the lollipop antenna
    v.box(0, 10.2, 0, 0.2, 1.4, 0.2, WHITE);
    v.box(0, 11.5, 0, 1.5, 1.5, 0.3, '#ff2a6a');
    v.box(0, 11.85, 0.17, 0.8, 0.7, 0.06, WHITE);
    v.box(0, 12.05, 0.21, 0.36, 0.3, 0.05, '#ff2a6a');
    v.box(0, 11.85, -0.17, 0.8, 0.7, 0.06, WHITE); // the lollipop's swirl shows on both sides
    v.box(0, 12.05, -0.21, 0.36, 0.3, 0.05, '#ff2a6a');
    // the back of the head: a stitched seam down the middle and two gumdrops
    v.box(0, 6.6, -1.51, 0.16, 3, 0.06, STITCH);
    for (let i = 0; i < 6; i++) v.box(0, 6.85 + i * 0.48, -1.55, 0.6, 0.07, 0.05, STITCH);
    v.box(-1.2, 8.3, -1.52, 0.5, 0.5, 0.1, '#3ddc5a');
    v.box(1.3, 7.2, -1.52, 0.45, 0.45, 0.1, '#29c6ff');
    // long thin arms, three long fingers each
    for (const side of [-1, 1]) {
      v.box(side * 1.75, 2.9, 0.3, 0.5, 2.8, 0.5, PINK2, { rz: side * 0.22 });
      for (let f = -1; f <= 1; f++) v.box(side * 2.15 + f * 0.2, 1.9, 0.3 + f * 0.15, 0.14, 1, 0.14, LIGHT);
    }
  },

  // Haunted Woods: a very tall cloaked watcher with a pale hollow mask, two orange ember eyes,
  // a crown of dead branches and arms so long its twig fingers nearly touch the ground
  hollowWatcher(v) {
    const DARK = '#221b28', CLOAK = '#3b3046', BARK = '#4e3826', GLOW = '#ff8a1a', MASK = '#d8d2c4', HOLE = '#120a06';
    // the robe, ragged at the hem
    v.box(0, 0.4, 0, 2.8, 5.8, 2.2, CLOAK);
    for (let i = -2; i <= 2; i++) v.box(i * 0.56, 0, 0, 0.44, 0.4 + ((i + 2) % 2) * 0.35, 2.1, DARK);
    v.box(0, 2.2, 1.11, 0.25, 3.6, 0.06, DARK);
    v.box(0, 6.2, 0, 3.4, 1.3, 2.3, CLOAK);
    // the hood and the mask
    v.box(0, 7.3, 0, 2.6, 2.8, 2.6, DARK);
    v.box(0, 7.6, 1.31, 1.6, 2.1, 0.08, MASK);
    for (const side of [-1, 1]) {
      v.box(side * 0.4, 8.5, 1.36, 0.5, 0.62, 0.06, HOLE);
      eyeOf(v, { lid: 0.42, lidColor: '#3a1a08' }).box(side * 0.4, 8.66, 1.4, 0.22, 0.22, 0.05, GLOW);
    }
    v.box(0, 7.85, 1.36, 0.38, 0.7, 0.06, HOLE);
    // from behind: the hood's point hanging down the back, and a torn, patched cloak
    v.box(0, 8.4, -1.35, 1.6, 1.8, 0.4, DARK, { rx: 0.15 });
    v.box(0, 6.6, -1.5, 0.9, 2, 0.35, DARK, { rx: 0.1 });
    v.box(-0.6, 3.2, -1.11, 0.9, 1.1, 0.06, '#4a3d58');
    v.box(0.7, 1.6, -1.11, 0.7, 0.8, 0.06, '#2b2234');
    v.box(0, 0.6, -1.12, 0.22, 4.4, 0.06, DARK);
    // the crown of dead branches
    for (const side of [-1, 1]) {
      v.box(side * 0.7, 10, 0, 0.3, 2.2, 0.3, BARK, { rz: -side * 0.35 });
      v.box(side * 1.6, 11.2, 0, 0.25, 1.4, 0.25, BARK, { rz: side * 0.5 });
      v.box(side * 1.05, 11.4, -0.3, 0.22, 1.2, 0.22, BARK, { rx: -0.4 });
      v.box(side * 2.1, 11.9, 0, 0.2, 1, 0.2, BARK, { rz: -side * 0.4 });
    }
    // the long arms and twig fingers
    for (const side of [-1, 1]) {
      v.box(side * 1.95, 2.6, 0.3, 0.55, 4.3, 0.55, CLOAK);
      for (let f = 0; f < 3; f++) v.box(side * 1.95 + (f - 1) * 0.22, 0.5, 0.3 + f * 0.12, 0.12, 2, 0.12, BARK, { rz: (f - 1) * 0.15 });
    }
  },

  // Graveyard: armoured skeleton knight, red plume, rusty sword
  graveKnight(v) {
    const BONE = '#e8e2cc', STEEL = '#7a7f88', PLATE = '#8d939c', RUST = '#a0603a';
    for (const side of [-1, 1]) {
      v.box(side * 0.8, 0, 0.2, 0.7, 3, 0.7, BONE);
      v.box(side * 0.8, 0, 0.4, 1.3, 0.9, 1.7, '#55595f');
      v.box(side * 0.8, 1.5, 0.3, 0.95, 0.6, 0.95, STEEL); // knee guards
    }
    v.box(0, 2.8, 0, 2.6, 0.8, 1.4, STEEL);
    v.box(0, 3.6, 0, 3.4, 3, 2, PLATE);
    v.box(0, 4.2, 1.01, 1.6, 1.8, 0.06, '#22252a'); // a hole in the armour, ribs showing
    for (let i = 0; i < 3; i++) v.box(0, 4.45 + i * 0.5, 1.05, 1.4, 0.18, 0.06, BONE);
    v.box(-1.1, 3.9, 1.02, 0.7, 0.6, 0.05, '#8a4a22');
    for (const side of [-1, 1]) {
      v.box(side * 2.1, 6.1, 0, 1.4, 0.9, 1.8, STEEL);
      v.box(side * 2.1, 3.4, 0.4, 0.55, 2.8, 0.55, BONE, { rx: side > 0 ? -0.35 : 0 });
    }
    v.box(-2.1, 2.9, 0.4, 0.8, 0.6, 0.8, BONE);
    v.box(2.1, 2.9, 1.2, 0.8, 0.6, 0.8, BONE);
    // rusty sword, planted in front
    v.box(2.1, 0, 1.6, 0.3, 3.1, 0.8, RUST);
    v.box(2.1, 3.1, 1.6, 0.35, 0.35, 1.9, '#4b3524');
    v.box(2.1, 3.45, 1.6, 0.3, 0.8, 0.3, '#4b3524');
    // helmet with a glowing visor
    v.box(0, 6.6, 0, 2.4, 2.3, 2.4, STEEL);
    v.box(0, 7.4, 1.21, 1.9, 0.5, 0.08, BLACK);
    for (const side of [-1, 1]) eyeOf(v, { lid: 0.5 }).box(side * 0.45, 7.45, 1.25, 0.4, 0.4, 0.06, '#ff3030');
    v.box(0, 8.9, -0.2, 0.5, 1.3, 2.4, '#d4202c');
    v.box(0, 8.3, -1.4, 0.5, 1.2, 0.8, '#d4202c');
    // from behind: a torn red cape from the shoulders, a back plate and the helmet's neck guard
    v.box(0, 2.2, -1.15, 3.6, 4.6, 0.15, '#7a1018', { rx: 0.06 });
    for (let i = -2; i <= 2; i++) v.box(i * 0.72, 1.4 + (Math.abs(i) % 2) * 0.4, -1.2, 0.5, 0.8, 0.12, '#7a1018');
    v.box(0, 6.4, -1.25, 3.8, 0.4, 0.4, STEEL);
    v.box(0, 6.6, -1.22, 2, 1.2, 0.1, PLATE);
    v.box(0, 7.5, -1.24, 1.6, 0.2, 0.06, '#55595f');
  },

  // Creepy Carnival: a towering clown: pale face, painted diamond eyes with red pupils, a too-wide
  // grin, orange hair tufts, a ruffle collar, a polka-dot suit and a tiny top hat
  bigTopBrute(v) {
    const SUIT = '#ffd23a', RED = '#e8203a', BLUE = '#2a62d6', FACE = '#f4f0ea', HAIR = '#ff4a1a';
    for (const side of [-1, 1]) {
      v.box(side * 1, 0, 0.6, 1.4, 0.7, 2.7, RED); // big shoes
      v.box(side * 1, 0.7, 0, 1.2, 2.6, 1.2, side < 0 ? '#7a2ab0' : '#2ab04a');
    }
    v.box(0, 3.3, 0, 3.6, 3.4, 2.2, SUIT);
    for (const [x, y, c] of [[-1.1, 3.8, RED], [1, 4.6, BLUE], [-0.9, 5.7, BLUE], [1.2, 6, RED], [0.9, 3.5, '#2ab04a']]) v.box(x, y, 1.11, 0.5, 0.5, 0.06, c);
    for (const y of [4, 5.2]) v.box(0, y, 1.13, 0.5, 0.5, 0.12, RED);
    // the ruffle collar
    v.box(0, 6.6, 0, 4.4, 0.55, 3, WHITE);
    v.box(0, 6.7, 0, 3.6, 0.4, 3.5, '#ff6fbf');
    for (const side of [-1, 1]) {
      v.box(side * 2.35, 3.6, 0.2, 0.9, 3.1, 0.9, SUIT);
      v.box(side * 2.35, 2.8, 0.2, 1.15, 0.9, 1.15, WHITE); // gloves
    }
    // the head
    v.box(0, 7.2, 0.2, 2.6, 2.6, 2.4, FACE);
    for (const side of [-1, 1]) {
      v.box(side * 1.6, 8, 0, 1, 1.5, 1.9, HAIR);
      v.box(side * 0.62, 8.35, 1.41, 0.62, 0.62, 0.06, BLUE, { rz: 0.785 });
      eyeOf(v, { lid: 0.62 }).box(side * 0.62, 8.5, 1.46, 0.26, 0.26, 0.05, '#ff2020');
    }
    v.box(0, 7.85, 1.5, 0.7, 0.7, 0.6, '#ff1f2e');
    v.box(0, 7.4, 1.41, 2, 0.4, 0.06, '#c8102e');
    teeth(v, 0, 7.8, 1.46, 1.7, 6, 0.24, -1);
    // the tiny top hat
    v.box(0, 9.8, 0.2, 1.6, 0.15, 1.6, '#1b1b22');
    v.box(0, 9.95, 0.2, 1, 1.1, 1, '#1b1b22');
    v.box(0, 10.1, 0.2, 1.05, 0.25, 1.05, RED);
    // from behind: the hair goes all round the back of the head, more polka dots, and a big bow
    v.box(0, 7.6, -1.05, 3, 2.2, 0.5, HAIR);
    v.box(0, 9.4, -0.5, 2.4, 0.5, 1.2, HAIR);
    for (const [x, y, c] of [[1, 3.9, BLUE], [-1.2, 4.7, RED], [0.8, 5.8, '#2ab04a'], [-0.6, 3.5, BLUE], [-1.3, 6, RED]]) v.box(x, y, -1.11, 0.5, 0.5, 0.06, c);
    for (const side of [-1, 1]) v.box(side * 0.6, 3.3, -1.2, 1, 0.8, 0.25, RED, { rz: side * 0.3 });
    v.box(0, 3.4, -1.24, 0.45, 0.6, 0.3, '#c8102e');
  },

  // Rainbow Bog: dripping slime blob covered in eyes
  bogHorror(v) {
    v.box(0, 0, 0, 7, 2.2, 7, '#3f8a2a');
    v.box(0, 2.2, 0, 6, 2.4, 6, '#58b23a');
    v.box(0, 4.6, 0, 4.6, 2, 4.6, '#7fd04a');
    v.box(0, 6.6, -0.2, 3, 1.2, 3, '#a8e85a');
    // rainbow slime streaks dripping down the sides
    const drips = [[-3.55, 1.2, 0], [3.55, 1.4, -1.5], [-3.55, 1.4, -2.2], [3.55, 1.1, 1.8], [-2, 1.6, -3.55], [1.8, 1.2, -3.55]];
    drips.forEach(([x, h, z], i) => {
      const side = Math.abs(x) > 3 ? [0.12, 0.6] : [0.6, 0.12];
      v.box(x, 3 - h, z, side[0], h + 1.4, side[1], RAINBOW[i]);
    });
    for (const [x, z, c] of [[-2.6, 3.6, 0], [2.4, 3.6, 2], [3.6, -2.6, 4], [-3.6, 2.6, 5]]) v.box(x, 0, z, 0.7, 0.5, 0.7, RAINBOW[c]);
    // the mouth
    v.box(0, 0.7, 3.51, 4.2, 1.1, 0.06, '#1a2a10');
    teeth(v, 0, 1.8, 3.56, 4.2, 6, 0.5, -1);
    teeth(v, 0, 0.7, 3.56, 4.2, 5, 0.35, 1);
    // many eyes
    const EYES = [[0, 5.2, 2.31, 1.2], [-1.6, 3.2, 3.01, 0.9], [1.6, 2.9, 3.01, 1], [-0.8, 6.8, 1.31, 0.6],
      [0.9, 7, 1.31, 0.5], [1.9, 5.5, 2.31, 0.6], [-1.8, 5, 2.31, 0.55], [-2.5, 2.6, 3.01, 0.5]];
    for (const [x, y, z, s] of EYES) {
      const e = eyeOf(v, { lidColor: '#2f6a1e' });
      e.box(x, y, z, s, s, 0.1, '#f6ff9a');
      e.box(x, y + s * 0.25, z + 0.05, s * 0.45, s * 0.45, 0.08, BLACK);
    }
    // ...all the way round: eyes on its back as well, so it sees you sneaking up from behind
    const BACK_EYES = [[0.4, 4.9, -2.31, 1], [-1.7, 3, -3.01, 0.8], [1.9, 2.6, -3.01, 0.7], [0.2, 6.9, -1.51, 0.55], [-1.9, 5.4, -2.31, 0.5]];
    for (const [x, y, z, s] of BACK_EYES) {
      const e = eyeOf(v, { lidColor: '#2f6a1e' });
      e.box(x, y, z, s, s, 0.1, '#f6ff9a');
      e.box(x, y + s * 0.25, z - 0.05, s * 0.45, s * 0.45, 0.08, BLACK);
    }
  },

  // Frostbite Peaks: white yeti, blue face, icicles down the back, huge arms
  frostbiteYeti(v) {
    const FUR = '#f4f9ff', FUR2 = '#e2eef8', ICE = '#a8e4ff', BLUE = '#5aa8e0';
    for (const side of [-1, 1]) {
      v.box(side * 1.3, 0, 0, 1.8, 2.6, 2, FUR2);
      v.box(side * 1.3, 0, 0.4, 2, 0.6, 2.6, '#8fc8ee');
    }
    v.box(0, 2.6, 0, 5, 4.6, 3.6, FUR);
    v.box(0, 3, 1.81, 3, 3, 0.1, '#d6ecfa');
    for (const side of [-1, 1]) {
      v.box(side * 3.3, 6, 0.2, 2, 1.4, 2.2, FUR); // shoulders
      v.box(side * 3.3, 1.8, 0.3, 1.8, 4.4, 1.8, FUR2);
      v.box(side * 3.3, 0.6, 0.3, 2.2, 1.3, 2.2, BLUE);
    }
    v.box(0, 7.2, 0.4, 3.2, 2.8, 2.8, FUR);
    v.box(0, 7.4, 1.81, 2.4, 2, 0.1, BLUE);
    glowEyes(v, 0, 8.4, 1.88, 0.6, 0.5, '#e6ffff');
    v.box(0, 7.6, 1.88, 1.4, 0.45, 0.06, '#1b2a44');
    for (const side of [-1, 1]) v.box(side * 0.5, 7.25, 1.92, 0.25, 0.4, 0.1, WHITE);
    for (const side of [-1, 1]) v.box(side * 1.3, 9.8, 0.3, 0.45, 1.2, 0.45, ICE, { rz: -side * 0.35 });
    // icicles down the back
    for (let i = 0; i < 5; i++) v.box((i % 2 ? 0.8 : -0.8) * (i % 3 ? 1 : 0), 3.6 + i * 1, -1.9, 0.55, 1.7, 0.55, ICE, { rx: -0.7 });
    // shaggy fur on the back of the head and a short tail
    v.box(0, 7.4, -1.05, 2.8, 2.4, 0.3, FUR2);
    for (const x of [-0.9, 0, 0.9]) v.box(x, 6.9, -1.2, 0.7, 0.8, 0.3, FUR2);
    v.box(0, 2.4, -2.1, 1.2, 1.1, 0.8, FUR2);
  },

  // Ghost Manor: big floating sheet ghost with a gold crown and cyan eyes
  ghostKing(v) {
    const SHEET = '#f4f6ff', SHADE = '#dfe3f5', GOLD = '#ffd23a';
    for (let i = -2; i <= 2; i++) {
      const h = Math.abs(i) % 2 ? 0.6 : 1;
      v.box(i * 1.2, 1.2 - h, 0, 1.2, h, 5, i % 2 ? SHADE : SHEET);
    }
    v.box(0, 1.2, 0, 6, 5.4, 5, SHEET);
    v.box(0, 6.6, 0, 5, 1.2, 4.2, SHEET);
    v.box(0, 7.8, 0, 3.6, 0.8, 3.2, SHEET);
    for (const side of [-1, 1]) v.box(side * 3.5, 3.4, 0.4, 1.2, 1, 2.4, SHADE, { rz: -side * 0.5 });
    for (const side of [-1, 1]) {
      const e = eyeOf(v, { lidColor: '#3a3f5a' });
      e.box(side * 1.1, 4.6, 2.51, 1.1, 1.5, 0.1, '#3ff3ff');
      e.box(side * 1.1, 5.4, 2.56, 0.4, 0.4, 0.06, WHITE);
    }
    v.box(0, 2.6, 2.51, 1.6, 1.4, 0.08, '#1a1a2a');
    teeth(v, 0, 4, 2.55, 1.6, 4, 0.35, -1);
    v.box(0, 3, -2.51, 4, 1, 0.08, '#6a2aa8'); // a royal sash at the back
    v.box(0, 8.6, 0, 2.8, 0.8, 2.6, GOLD);
    for (const [x, z] of [[-1.15, 1.05], [1.15, 1.05], [-1.15, -1.05], [1.15, -1.05], [0, 1.05]]) v.box(x, 9.4, z, 0.5, 0.8, 0.5, GOLD);
    v.box(0, 8.8, 1.31, 0.5, 0.5, 0.1, '#e8203a');
    // from behind: a royal cape with an ermine trim, and a gem on the back of the crown
    v.box(0, 1.6, -2.62, 4.6, 5.6, 0.16, '#6a2aa8');
    v.box(0, 1.4, -2.66, 4.8, 0.5, 0.2, WHITE);
    for (let i = -2; i <= 2; i++) v.box(i * 0.95, 1.55, -2.78, 0.2, 0.2, 0.06, BLACK);
    v.box(0, 7, -2.62, 4.8, 0.45, 0.4, GOLD);
    v.box(0, 8.8, -1.31, 0.5, 0.5, 0.1, '#29c6ff');
  },

  // Demon Pit: a horned fiend on two hooves: black-red skin split by glowing lava cracks, curled
  // horns, spiked shoulders, ragged bat wings and burning eyes
  emberFiend(v) {
    const HIDE = '#2a1416', SKIN = '#4a1a1c', LAVA = '#ff7a1a', HORN = '#e8dcc0', WING = '#3a0e10';
    for (const side of [-1, 1]) {
      v.box(side * 1, 0, 0.2, 1.3, 0.5, 1.7, '#120a0a'); // hooves
      v.box(side * 1, 0.5, 0, 1.2, 2.8, 1.4, HIDE);
      v.box(side * 1, 1.3, 0.71, 0.15, 1.4, 0.06, LAVA);
    }
    v.box(0, 3.2, 0, 3.6, 3.6, 2.2, SKIN);
    v.box(0, 4, 1.11, 0.18, 2.4, 0.06, LAVA);
    v.box(-0.6, 5, 1.11, 1.2, 0.15, 0.06, LAVA, { rz: 0.5 });
    v.box(0.6, 4.4, 1.11, 1.2, 0.15, 0.06, LAVA, { rz: -0.5 });
    // the wings, behind
    for (const side of [-1, 1]) {
      v.box(side * 2.6, 5, -1.3, 2.6, 3.2, 0.15, WING, { rz: -side * 0.35 });
      v.box(side * 2.9, 7.6, -1.3, 2.9, 0.3, 0.3, '#1a0a0c', { rz: -side * 0.35 });
      v.box(side * 3.3, 4.6, -1.25, 0.15, 2.6, 0.08, '#6a1a16', { rz: -side * 0.35 });
    }
    for (const side of [-1, 1]) {
      v.box(side * 2.1, 6.2, 0, 1.4, 1, 1.8, HIDE);
      v.box(side * 2.3, 7.2, 0, 0.35, 0.9, 0.35, HORN);
      v.box(side * 2.3, 3, 0.2, 1, 3.2, 1, SKIN);
      for (let f = -1; f <= 1; f++) v.box(side * 2.3 + f * 0.3, 2.4, 0.7, 0.15, 0.6, 0.15, HORN); // claws
    }
    // the head and horns
    v.box(0, 6.8, 0.2, 2.4, 2.4, 2.2, SKIN);
    v.box(0, 6.6, 1.1, 1.6, 0.8, 0.6, HIDE);
    teeth(v, 0, 7.05, 1.42, 1.4, 4, 0.3, -1, HORN);
    glowEyes(v, 0, 8.1, 1.32, 0.55, 0.45, '#ffdd33', '#e8202a');
    for (const side of [-1, 1]) {
      v.box(side * 1.5, 8.6, 0.2, 1.4, 0.6, 0.6, HORN, { rz: side * 0.3 });
      v.box(side * 2.1, 9, 0.2, 0.55, 1.6, 0.55, HORN, { rz: -side * 0.35 });
      v.box(side * 1.9, 10.4, 0.3, 0.4, 0.8, 0.4, '#c8202a', { rz: -side * 0.8 });
    }
    // from behind: glowing cracks down the back, spines between the wings and a pointed tail
    v.box(0, 3.6, -1.11, 0.2, 3, 0.06, LAVA);
    v.box(0.6, 4.6, -1.11, 1.1, 0.15, 0.06, LAVA, { rz: 0.5 });
    v.box(-0.5, 3.9, -1.11, 1, 0.15, 0.06, LAVA, { rz: -0.4 });
    for (let i = 0; i < 3; i++) v.box(0, 4.3 + i * 0.9, -1.25, 0.3, 0.5, 0.35, HORN, { rx: -0.6 });
    v.box(0, 2.4, -1.9, 0.5, 0.5, 2, HIDE, { rx: 0.5 });
    v.box(0, 1.2, -3.2, 0.4, 0.4, 1.8, HIDE, { rx: 0.25 });
    v.box(0, 0.9, -4.3, 0.8, 0.6, 0.6, '#c8202a', { rx: 0.785 });
  },

  // Nightmare: a lilac-grey alien visitor: a swollen head, huge tilted black eyes with magenta
  // glints, a thin body in a suit with a glowing belt, long three-fingered arms and glowing antennae
  nightVisitor(v) {
    const SKIN = '#8a7aa8', SKIN2 = '#6e5e8e', SUIT = '#2a1f3a', GLOW = '#ff2ad8';
    for (const side of [-1, 1]) {
      v.box(side * 0.6, 0, 0.3, 0.8, 0.3, 1.2, SKIN2);
      v.box(side * 0.6, 0.3, 0, 0.6, 3.1, 0.6, SKIN2);
    }
    v.box(0, 3.4, 0, 2, 2.8, 1.3, SUIT);
    v.box(0, 3.6, 0.66, 2.02, 0.25, 0.06, GLOW);
    v.box(0, 4.9, 0.66, 0.6, 0.6, 0.06, GLOW, { rz: 0.785 });
    v.box(0, 6.2, 0, 0.5, 0.7, 0.5, SKIN2);
    // the head
    v.box(0, 6.4, 0.6, 1.6, 0.6, 1.8, SKIN);
    v.box(0, 6.9, 0.2, 3.6, 2.6, 3, SKIN);
    v.box(0, 9.5, 0, 3, 1, 2.6, SKIN);
    for (const side of [-1, 1]) {
      const e = eyeOf(v, { lidColor: '#4a3a66' });
      e.box(side * 0.85, 7.7, 1.71, 1.35, 0.8, 0.08, BLACK, { rz: side * 0.45 });
      e.box(side * 0.65, 8, 1.76, 0.3, 0.25, 0.05, GLOW);
    }
    // from behind: glowing veins over the back of the swollen head, the belt all round, a glowing spine
    v.box(0, 7.2, -1.31, 0.16, 2.8, 0.06, GLOW);
    for (const side of [-1, 1]) v.box(side * 0.7, 8.2, -1.31, 1.2, 0.12, 0.06, GLOW, { rz: side * 0.6 });
    v.box(0, 3.6, -0.66, 2.02, 0.25, 0.06, GLOW);
    for (let i = 0; i < 4; i++) v.box(0, 4.1 + i * 0.5, -0.68, 0.3, 0.25, 0.06, GLOW);
    v.box(0, 6.95, 1.71, 0.4, 0.08, 0.05, '#3a2a4a');
    // antennae
    for (const side of [-1, 1]) {
      v.box(side * 0.8, 10.4, 0, 0.12, 1.2, 0.12, SKIN2, { rz: -side * 0.3 });
      v.box(side * 1.05, 11.4, 0, 0.35, 0.35, 0.35, GLOW);
    }
    // long arms, three long fingers
    for (const side of [-1, 1]) {
      v.box(side * 1.3, 2.6, 0.2, 0.4, 3.6, 0.4, SKIN2, { rz: side * 0.12 });
      for (let f = -1; f <= 1; f++) v.box(side * 1.55 + f * 0.15, 1.5, 0.2 + f * 0.12, 0.1, 1.1, 0.1, SKIN);
    }
  },

  // The Glitch: a corrupted figure of mismatched neon blocks: a monitor head with red X eyes, slices
  // of its body slipping sideways, an arm floating loose and stray pixels all round it
  glitchEntity(v) {
    const CY = '#00e5ff', MG = '#ff2ad8', LM = '#7dff2a', BK = '#101018';
    v.box(-0.7, 0, 0.1, 1, 3, 1, BK);
    v.box(0.8, 0, -0.1, 1, 2.8, 1, CY);
    v.box(0.8, 2.8, -0.1, 1, 0.4, 1, BK);
    v.box(0, 3, 0, 3, 3.4, 1.8, BK);
    v.box(0.45, 4.2, 0.05, 3, 0.6, 1.9, MG);
    v.box(-0.35, 5.5, 0.03, 3, 0.4, 1.85, CY);
    v.box(-2, 3.3, 0, 0.9, 3, 0.9, LM);
    v.box(2.4, 3.8, 0.3, 0.9, 2.4, 0.9, MG); // the loose arm
    v.box(2.4, 3.1, 0.3, 0.6, 0.5, 0.6, MG);
    // the monitor head
    v.box(0, 6.6, 0, 2.8, 2.4, 2.2, '#20202a');
    v.box(0, 6.85, 1.11, 2.3, 1.9, 0.06, '#0a2a2a');
    for (const side of [-1, 1]) {
      const e = eyeOf(v, { lid: 0.7, lidColor: '#2a6a6a' });
      for (const r of [0.785, -0.785]) e.box(side * 0.55, 7.8, 1.15, 0.7, 0.16, 0.05, '#ff2020', { rz: r });
    }
    teeth(v, 0, 7.35, 1.15, 1.6, 5, 0.3, -1, LM);
    v.box(0.35, 7.3, -0.3, 2.8, 0.3, 2.2, CY); // an afterimage slice of the head
    // stray pixels and a tear
    for (const [x, y, z, s, c] of [[2.6, 6.6, 1, 0.6, CY], [-2.5, 6.2, -0.6, 0.5, LM], [1.9, 9.4, 0.4, 0.5, MG], [-1.6, 9.2, 0.8, 0.4, CY], [-2.8, 1.6, 0.6, 0.45, MG]]) v.box(x, y, z, s, s, s, c);
    v.box(-1.6, 1.4, 0.4, 0.06, 2.2, 3, '#ffffff');
    // from behind: the back of the monitor (vents, a sticker), a loose cable and glitched stripes
    v.box(0, 6.9, -1.4, 2, 1.8, 0.6, '#18181f');
    for (let i = 0; i < 4; i++) v.box(0, 7.1 + i * 0.4, -1.72, 1.4, 0.12, 0.06, '#3a3a48');
    v.box(-0.7, 6.95, -1.72, 0.4, 0.3, 0.05, MG);
    v.box(0.4, 5.2, -1.4, 0.2, 1.8, 0.2, '#2a2a34', { rx: 0.4 });
    v.box(0.4, 4.4, -1.85, 0.4, 0.3, 0.3, LM);
    v.box(-0.2, 3.6, -0.93, 3, 0.35, 0.06, LM);
    v.box(0.5, 4.8, -0.93, 1.2, 0.5, 0.06, CY);
  },

  // The Void: tall black titan, purple cracks, many eyes, crown of shards
  voidTitan(v) {
    const BODY = '#140f22', DARK = '#0b0814', GLOW = '#b04aff', EYE = '#ff8af0';
    for (const side of [-1, 1]) {
      v.box(side * 1, 0, 0, 1.4, 4, 1.4, DARK);
      v.box(side * 1, 1, 0.71, 0.18, 2.2, 0.06, GLOW);
    }
    v.box(0, 4, 0, 3.8, 3.8, 2, BODY);
    v.box(0, 4.6, 1.01, 0.2, 2.6, 0.06, GLOW);
    v.box(-0.6, 5.4, 1.01, 1.2, 0.18, 0.06, GLOW, { rz: 0.4 });
    v.box(0.7, 4.9, 1.01, 1.2, 0.18, 0.06, GLOW, { rz: -0.5 });
    for (const side of [-1, 1]) {
      v.box(side * 2.5, 7, 0, 1.6, 0.9, 1.6, DARK);
      v.box(side * 2.6, 2.2, 0, 1, 5, 1, DARK);
      v.box(side * 2.6, 3.4, 0.51, 0.15, 1.8, 0.06, GLOW);
      for (const dz of [-0.3, 0.3]) v.box(side * 2.6 + dz, 1.2, 0.3, 0.2, 1, 0.2, GLOW); // claws
    }
    v.box(0, 7.8, 0, 2.4, 2.4, 2.2, BODY);
    for (const [x, y, s] of [[-0.6, 9, 0.4], [0.6, 9, 0.4], [0, 8.4, 0.5], [-0.8, 8.3, 0.28], [0.8, 8.3, 0.28], [0, 9.55, 0.28]]) {
      eyeOf(v, { lidColor: '#3a1a5a' }).box(x, y, 1.11, s, s, 0.08, EYE);
    }
    // ...and more eyes on the back of its head; purple cracks over its back and legs
    for (const [x, y, s] of [[-0.5, 8.8, 0.4], [0.6, 9.3, 0.3], [0.3, 8.3, 0.28]]) {
      eyeOf(v, { lidColor: '#3a1a5a' }).box(x, y, -1.11, s, s, 0.08, EYE);
    }
    v.box(0, 4.4, -1.01, 0.2, 3, 0.06, GLOW);
    v.box(0.6, 5.6, -1.01, 1.2, 0.18, 0.06, GLOW, { rz: 0.5 });
    v.box(-0.7, 4.8, -1.01, 1.2, 0.18, 0.06, GLOW, { rz: -0.4 });
    for (const side of [-1, 1]) v.box(side * 1, 1.2, -0.71, 0.18, 2, 0.06, GLOW);
    for (const [x, z, h, r] of [[0, 0.5, 1.8, 0], [-0.8, 0.3, 1.3, 0.3], [0.8, 0.3, 1.3, -0.3], [-0.5, -0.6, 1.1, 0.2], [0.5, -0.6, 1.1, -0.2]]) {
      v.box(x, 10.1, z, 0.35, h, 0.35, '#7a2aff', { rz: r });
    }
  },

  // ───────────────────────────── Pets ─────────────────────────────

  // Pumpkin Patch
  pumpkinCamel(v) {
    const TAN = '#d9b77c', TAN2 = '#c9a46a';
    legs(v, TAN2, 0.45, 2, 0.6, 1.1, -1.1);
    v.box(0, 2, 0, 1.6, 1.2, 3, TAN);
    v.box(0, 3.2, -0.2, 1.4, 1, 1.4, '#ff8a1a');
    v.box(0, 3.2, -0.2, 0.4, 1.02, 1.46, '#e06a10');
    v.box(0, 4.2, -0.2, 0.25, 0.35, 0.25, '#3a7a2a');
    v.box(0, 2.7, 1.5, 0.6, 1.4, 0.6, TAN, { rx: 0.3 });
    v.box(0, 3.8, 2, 0.8, 0.7, 1.3, TAN);
    for (const side of [-1, 1]) v.box(side * 0.3, 4.5, 1.6, 0.2, 0.3, 0.2, TAN2);
    eyes(v, 0, 4.1, 2.66, 0.25, 0.18);
    v.box(0, 2.4, -1.6, 0.25, 0.9, 0.25, TAN2, { rx: -0.3 });
  },
  sheetGhost(v) {
    for (let i = -1; i <= 1; i++) v.box(i * 0.8, 0.1 + (i ? 0.25 : 0), 0, 0.8, 0.6 - (i ? 0.25 : 0), 2.2, i ? '#eef0fa' : WHITE);
    v.box(0, 0.6, 0, 2.4, 2.4, 2.2, WHITE);
    v.box(0, 3, 0, 1.8, 0.7, 1.6, WHITE);
    for (const side of [-1, 1]) v.box(side * 1.35, 1.6, 0.2, 0.5, 0.5, 0.8, '#eef0fa', { rz: -side * 0.5 });
    for (const side of [-1, 1]) v.box(side * 0.45, 2.1, 1.11, 0.35, 0.6, 0.08, BLACK);
    v.box(0, 1.6, 1.11, 0.4, 0.4, 0.08, BLACK);
    for (const side of [-1, 1]) v.box(side * 0.8, 1.8, 1.11, 0.35, 0.18, 0.06, '#ffb3cf');
  },
  scarecrowCat(v) {
    const SACK = '#c8a060', STRAW = '#ffd34a';
    legs(v, '#a8823f', 0.6, 1, 0.6, 0.9, -0.9);
    v.box(0, 1, 0, 1.9, 1.6, 3, SACK);
    v.box(0.96, 1.4, -0.4, 0.06, 0.8, 0.8, '#8a5a3a');
    v.box(0, 1.8, 1.8, 2.1, 1.8, 1.8, SACK);
    v.box(0, 1.9, 2.71, 1.4, 0.06, 0.06, '#5a3a20'); // stitched mouth
    for (let i = -2; i <= 2; i++) v.box(i * 0.3, 1.75, 2.72, 0.06, 0.25, 0.06, '#5a3a20');
    for (const side of [-1, 1]) {
      v.box(side * 0.5, 2.6, 2.71, 0.45, 0.45, 0.08, BLACK); // button eyes
      v.box(side * 0.5, 2.7, 2.76, 0.12, 0.12, 0.06, SACK);
      v.box(side * 1.15, 1.6, 2.1, 0.4, 0.2, 0.6, STRAW, { ry: side * 0.4 });
      v.box(side * 0.7, 3.6, 1.6, 0.55, 0.6, 0.4, SACK);
    }
    v.box(0, 3.6, 1.8, 2.8, 0.15, 2.4, '#7a4a1a');
    v.box(0, 3.75, 1.8, 1.4, 0.8, 1.3, '#7a4a1a');
    v.box(0, 3.75, 1.8, 1.45, 0.25, 1.35, '#e8203a');
    v.box(0, 1.6, -1.9, 0.4, 2, 0.4, STRAW, { rx: -0.5 });
    // a little crow on the hat
    v.box(0.2, 4.55, 1.8, 0.5, 0.5, 0.7, '#22222a');
    v.box(0.2, 4.8, 2.2, 0.15, 0.12, 0.3, '#f4a31e');
  },

  // Candy Lane
  gummyBat(v) {
    const BODY = '#ff3a6a', WING = '#ff9a2a';
    for (const side of [-1, 1]) v.box(side * 0.35, 0, 0, 0.3, 0.6, 0.3, '#d82a52');
    v.box(0, 0.6, 0, 1.6, 1.8, 1.4, BODY);
    for (const side of [-1, 1]) {
      v.box(side * 1.5, 1.4, -0.1, 1.6, 1, 0.25, WING, { rz: side * 0.3 });
      v.box(side * 2.4, 1.3, -0.1, 0.9, 1.2, 0.25, '#3ddc5a', { rz: side * 0.5 });
      v.box(side * 0.5, 2.4, 0, 0.4, 0.7, 0.35, BODY);
      v.box(side * 0.25, 1.1, 0.72, 0.15, 0.3, 0.08, WHITE); // fangs
    }
    v.box(0, 1.35, 0.71, 0.7, 0.1, 0.06, '#8a1030');
    eyes(v, 0, 1.75, 0.72, 0.38, 0.3);
    v.box(0, 2.0, 0.73, 0.18, 0.18, 0.06, WHITE);
  },
  lollipopLlama(v) {
    const WOOL = '#ffd1e8', WOOL2 = '#ffb3d6';
    legs(v, WOOL2, 0.5, 1.6, 0.55, 0.9, -0.9);
    v.box(0, 1.6, 0, 1.7, 1.4, 2.6, WOOL);
    v.box(0, 2.6, 1.1, 0.8, 1.8, 0.8, WOOL);
    v.box(0, 3.8, 1.4, 1, 0.9, 1.4, WOOL);
    v.box(0, 3.85, 2.12, 0.6, 0.5, 0.06, '#ff9ac6');
    for (const side of [-1, 1]) v.box(side * 0.3, 4.7, 1.1, 0.25, 0.6, 0.25, WOOL2);
    eyes(v, 0, 4.25, 2.11, 0.32, 0.22);
    // lollipop on its back
    v.box(0, 3, -0.6, 0.15, 1.4, 0.15, WHITE);
    v.box(0, 4.2, -0.6, 1.4, 1.4, 0.3, '#ff3b8c');
    v.box(0, 4.6, -0.6, 0.9, 0.6, 0.34, '#ffe23a');
    v.box(0, 4.75, -0.6, 0.4, 0.3, 0.38, '#38b6ff');
    v.box(0, 2.4, -1.4, 0.5, 0.6, 0.4, WOOL2);
  },
  candyCornCrab(v) {
    const Y = '#ffd23a', O = '#ff7a1a';
    for (const side of [-1, 1]) for (const z of [-0.6, 0, 0.6]) v.box(side * 1.6, 0, z, 0.9, 0.25, 0.25, O, { rz: side * 0.5 });
    v.box(0, 0.5, 0, 2.6, 0.7, 2, Y);
    v.box(0, 1.2, 0, 2.2, 0.6, 1.7, O);
    v.box(0, 1.8, 0, 1.4, 0.5, 1.2, WHITE);
    v.box(0, 2.3, 0, 0.6, 0.35, 0.6, WHITE);
    for (const side of [-1, 1]) {
      v.box(side * 1.7, 0.6, 1.1, 0.4, 0.4, 0.9, O);
      v.box(side * 2, 0.4, 1.7, 0.9, 0.8, 0.8, Y);
      v.box(side * 1.85, 1.2, 2.1, 0.25, 0.4, 0.3, Y);
      v.box(side * 0.45, 1.8, 0.85, 0.15, 0.9, 0.15, O); // eye stalks
      v.box(side * 0.45, 2.7, 0.85, 0.42, 0.42, 0.42, WHITE);
      v.box(side * 0.45, 2.8, 1.07, 0.2, 0.2, 0.06, BLACK);
    }
  },

  // Haunted Woods
  spookyOwl(v) {
    const FEATH = '#5a3a7a', BELLY = '#a88ac8';
    for (const side of [-1, 1]) v.box(side * 0.45, 0, 0.3, 0.5, 0.3, 0.6, '#f4a31e');
    v.box(0, 0.3, 0, 2, 2.6, 1.8, FEATH);
    v.box(0, 0.6, 0.91, 1.4, 1.5, 0.06, BELLY);
    for (const side of [-1, 1]) {
      v.box(side * 1.1, 0.8, -0.1, 0.3, 1.8, 1.3, '#432a5c');
      v.box(side * 0.75, 2.9, 0, 0.4, 0.7, 0.4, '#432a5c', { rz: -side * 0.3 });
      v.box(side * 0.48, 2.05, 0.91, 0.75, 0.75, 0.08, '#ffd21a');
      v.box(side * 0.48, 2.25, 0.96, 0.32, 0.32, 0.06, BLACK);
    }
    v.box(0, 1.75, 0.95, 0.3, 0.4, 0.2, '#f4a31e');
  },
  twigSpider(v) {
    const TWIG = '#6b4a2e', DARK = '#4a321e';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z = 0.9 - i * 0.6;
        v.box(side * 1.1, 0.9, z, 1.4, 0.18, 0.18, TWIG, { rz: side * 0.4, ry: side * (0.4 - i * 0.27) });
        v.box(side * 1.9, 0, z + (1.5 - i) * 0.2, 0.18, 1.2, 0.18, DARK, { rz: -side * 0.2 });
      }
    }
    v.box(0, 0.8, -0.8, 1.4, 1.2, 1.6, TWIG);
    v.box(0, 1.9, -0.8, 0.15, 0.5, 0.15, '#4c8a2a');
    v.box(0, 2.3, -0.6, 0.4, 0.15, 0.3, '#5fb03a');
    v.box(0, 0.8, 0.5, 1, 0.8, 1, DARK);
    for (const [x, y] of [[-0.25, 1.3], [0.25, 1.3], [-0.15, 1.05], [0.15, 1.05]]) v.box(x, y, 1.01, 0.15, 0.15, 0.06, '#ff2a2a');
  },
  ghostFox(v) {
    const FUR = '#e8f4ff', GLOW = '#5ff3ff';
    legs(v, '#cfe6fa', 0.5, 1, 0.6, 0.9, -0.9);
    v.box(0, 1, 0, 1.7, 1.4, 2.8, FUR);
    v.box(0, 1.6, 1.7, 1.8, 1.5, 1.5, FUR);
    v.box(0, 1.6, 2.7, 0.9, 0.7, 0.8, WHITE);
    v.box(0, 2.1, 3.12, 0.3, 0.25, 0.08, '#3a4a6a');
    for (const side of [-1, 1]) {
      v.box(side * 0.6, 3.1, 1.7, 0.5, 0.8, 0.3, FUR);
      v.box(side * 0.6, 3.6, 1.7, 0.3, 0.35, 0.32, GLOW);
    }
    glowEyes(v, 0, 2.5, 2.46, 0.45, 0.3, GLOW);
    // three wispy tails with glowing tips
    for (const a of [-0.6, 0, 0.6]) {
      v.box(a * 1.2, 1.6, -2, 0.6, 0.6, 1.6, FUR, { rx: 0.5, ry: a });
      v.box(a * 2, 2.4, -2.7, 0.6, 0.6, 0.6, GLOW, { rx: 0.5, ry: a });
    }
  },

  // Graveyard
  boneDog(v) {
    const BONE = '#ece6d2', DARK = '#2a2620';
    legs(v, BONE, 0.35, 1.1, 0.6, 0.9, -0.9);
    v.box(0, 1.1, 0, 1.3, 1.1, 2.4, DARK);
    for (let i = 0; i < 4; i++) v.box(0, 1.1, 0.9 - i * 0.55, 1.4, 1.15, 0.2, BONE);
    v.box(0, 2.1, 0, 0.3, 0.2, 2.6, BONE); // spine
    v.box(0, 1.6, 1.7, 1.5, 1.4, 1.3, BONE);
    v.box(0, 1.6, 2.6, 0.9, 0.6, 0.7, BONE);
    for (const side of [-1, 1]) {
      v.box(side * 0.38, 2.3, 2.36, 0.42, 0.42, 0.06, DARK);
      v.box(side * 0.5, 3, 1.5, 0.35, 0.6, 0.3, BONE);
    }
    v.box(0, 1.4, 3.05, 1.6, 0.25, 0.25, WHITE); // bone in its mouth
    for (const side of [-1, 1]) v.box(side * 0.85, 1.32, 3.05, 0.3, 0.4, 0.4, WHITE);
    v.box(0, 1.9, -1.5, 0.2, 0.2, 1, BONE, { rx: -0.6 });
  },
  zombieBunny(v) {
    const SKIN = '#8fbf7a', SKIN2 = '#6f9e5c';
    legs(v, SKIN2, 0.6, 0.8, 0.6, 0.7, -0.8);
    v.box(0, 0.8, 0, 2, 1.8, 2.4, SKIN);
    v.box(0.3, 1.1, 1.21, 0.9, 0.06, 0.06, '#3a2a2a'); // stitches
    for (const dx of [0, 0.3, 0.6]) v.box(dx, 1, 1.22, 0.06, 0.25, 0.06, '#3a2a2a');
    v.box(0, 2.1, 1.1, 1.8, 1.6, 1.6, SKIN);
    v.box(-0.5, 3.7, 1, 0.45, 1.8, 0.35, SKIN);
    v.box(0.75, 3.3, 0.9, 0.45, 1.6, 0.35, SKIN2, { rz: -1.1 }); // the droopy ear
    v.box(-0.4, 3.3, 1.91, 0.9, 0.3, 0.06, '#f4f0e6'); // bandage
    v.box(-0.4, 2.8, 1.91, 0.4, 0.4, 0.08, '#d8ff3a');
    v.box(0.4, 2.8, 1.91, 0.4, 0.4, 0.08, BLACK);
    v.box(0, 2.3, 1.91, 0.7, 0.2, 0.06, '#3a2a2a');
    v.box(0.15, 2.1, 1.93, 0.2, 0.25, 0.06, WHITE);
    v.box(0, 1.2, -1.35, 0.7, 0.7, 0.4, SKIN2);
  },
  tombBat(v) {
    const STONE = '#8a8f99', STONE2 = '#6c717b', WING = '#7a3ab0';
    // perched on a little tombstone
    v.box(0, 0, 0, 2.2, 0.4, 1.4, STONE2);
    v.box(0, 0.4, 0, 1.8, 1.8, 0.8, STONE);
    v.box(0, 2.2, 0, 1.4, 0.3, 0.8, STONE);
    v.box(0, 1.2, 0.41, 1.1, 0.3, 0.06, '#3a3e46');
    v.box(0, 0.7, 0.41, 0.7, 0.25, 0.06, '#3a3e46');
    v.box(0, 2.5, 0.1, 1.1, 1.2, 0.9, '#2a2230');
    for (const side of [-1, 1]) {
      v.box(side * 1.2, 2.8, 0, 1.4, 1, 0.2, WING, { rz: side * 0.35 });
      v.box(side * 2, 2.5, 0, 0.9, 1.3, 0.2, WING, { rz: side * 0.7 });
      v.box(side * 0.35, 3.7, 0.1, 0.3, 0.6, 0.3, '#2a2230');
      v.box(side * 0.2, 2.6, 0.56, 0.12, 0.25, 0.06, WHITE);
    }
    glowEyes(v, 0, 3.15, 0.56, 0.28, 0.25, '#ff3a3a');
    v.box(0, 4.4, 0.1, 0.9, 0.12, 0.9, '#ffe95a'); // a faint halo
  },

  // Creepy Carnival
  popcornPup(v) {
    const RED = '#e8202e', CORN = '#fff3c8', BUTTER = '#ffd85a';
    legs(v, '#e8c896', 0.5, 0.8, 0.6, 0.8, -0.8);
    for (let i = -2; i <= 2; i++) v.box(i * 0.4, 0.8, 0, 0.4, 1.6, 2.4, Math.abs(i) % 2 ? WHITE : RED);
    for (const [x, z, c] of [[-0.5, 0.6, CORN], [0.5, 0.4, BUTTER], [0, -0.3, CORN], [-0.4, -0.8, BUTTER], [0.5, -0.7, CORN]]) v.box(x, 2.4, z, 0.6, 0.5, 0.6, c);
    v.box(0, 1.8, 1.5, 1.6, 1.4, 1.4, '#f2d8a8');
    v.box(0, 1.8, 2.3, 0.8, 0.6, 0.4, '#f8e6c4');
    v.box(0, 2.25, 2.52, 0.3, 0.2, 0.06, BLACK);
    for (const side of [-1, 1]) v.box(side * 0.85, 2.2, 1.5, 0.3, 1, 0.6, '#c8965a');
    eyes(v, 0, 2.6, 2.21, 0.38, 0.28);
    v.box(0, 3.2, 1.5, 0.5, 0.45, 0.5, CORN);
    v.box(0, 1.7, -1.4, 0.3, 0.3, 0.8, '#c8965a', { rx: -0.6 });
  },
  clownFish(v) {
    const OR = '#ff7a1a';
    for (const side of [-1, 1]) for (const z of [0.6, -0.6]) v.box(side * 0.45, 0, z, 0.3, 0.6, 0.3, '#2a1a1a');
    v.box(0, 0.6, 0, 1.4, 1.9, 2.8, OR);
    for (const z of [0.7, -0.6]) v.box(0, 0.58, z, 1.46, 1.94, 0.35, WHITE);
    v.box(0, 0.55, -0.6, 1.47, 1.96, 0.08, BLACK);
    v.box(0, 2.5, -0.2, 0.25, 0.6, 1.4, OR);
    v.box(0, 0.9, -1.9, 0.25, 1.4, 1, OR);
    for (const side of [-1, 1]) v.box(side * 0.8, 1.2, 0.4, 0.2, 0.5, 0.6, OR, { ry: side * 0.4 });
    v.box(0, 1.3, 1.5, 0.45, 0.45, 0.3, '#ff2030'); // clown nose
    eyes(v, 0, 1.75, 1.41, 0.4, 0.3);
    v.box(0, 0.95, 1.41, 0.5, 0.15, 0.06, '#7a1a10');
  },
  circusElephant(v) {
    const SKIN = '#a0a8c0', SKIN2 = '#8a92aa', GOLD = '#ffd23a';
    legs(v, SKIN2, 0.8, 1.2, 0.7, 0.9, -0.9);
    v.box(0, 1.2, 0, 2.2, 1.8, 2.8, SKIN);
    v.box(0, 2.4, 0, 2.3, 0.6, 1.6, '#d8202e'); // saddle blanket
    v.box(0, 2.38, 0, 2.34, 0.15, 1.65, GOLD);
    v.box(0, 2.1, 1.7, 1.8, 1.6, 1.4, SKIN);
    for (const side of [-1, 1]) {
      v.box(side * 1.1, 2.1, 1.4, 0.2, 1.4, 1.2, SKIN2, { ry: side * 0.3 });
      v.box(side * 0.5, 2.2, 2.45, 0.2, 0.2, 0.5, WHITE);
    }
    v.box(0, 1, 2.5, 0.5, 1.4, 0.5, SKIN2);
    v.box(0, 0.8, 2.75, 0.5, 0.4, 0.4, SKIN2);
    eyes(v, 0, 3, 2.41, 0.45, 0.3);
    v.box(0, 3.7, 1.6, 1, 0.25, 0.9, GOLD); // head band and feather plume
    v.box(0, 3.95, 1.6, 0.25, 1.1, 0.25, '#ff4fa0', { rx: -0.2 });
    v.box(0, 4.8, 1.45, 0.4, 0.5, 0.2, '#a24bff', { rx: -0.2 });
    v.box(0, 1.8, -1.5, 0.2, 0.2, 0.8, SKIN2, { rx: 0.6 });
  },

  // Rainbow Bog
  bogFrog(v) {
    const G = '#4cbf3a', G2 = '#3a9a2c';
    for (const side of [-1, 1]) {
      v.box(side * 0.9, 0, -0.4, 0.7, 0.6, 1.4, G2);
      v.box(side * 0.7, 0, 0.9, 0.5, 0.6, 0.5, G2);
    }
    v.box(0, 0.3, 0, 2.2, 1.3, 2.4, G);
    v.box(0, 0.4, 0.7, 1.8, 0.6, 1.4, '#d8f0a0');
    v.box(0, 1.6, 0.3, 1.8, 0.4, 1.8, G);
    for (const side of [-1, 1]) {
      v.box(side * 0.55, 2, 0.8, 0.7, 0.7, 0.7, G);
      v.box(side * 0.55, 2.15, 1.16, 0.4, 0.4, 0.06, BLACK);
    }
    v.box(0, 1.15, 1.21, 1.6, 0.12, 0.06, '#1a4a14');
    for (const [x, z] of [[-0.5, -0.4], [0.6, -0.7], [0.1, 0.1]]) v.box(x, 2, z, 0.35, 0.15, 0.35, '#2a7a20');
  },
  slimeSnail(v) {
    const SLIME = '#6bdc4a', SHELL = '#8a3ac8';
    v.box(0, 0, 0.3, 1.4, 0.8, 3.4, SLIME);
    v.box(0, 0.8, 1.6, 1.2, 1.3, 0.9, SLIME);
    for (const side of [-1, 1]) {
      v.box(side * 0.35, 2.1, 1.7, 0.18, 0.8, 0.18, SLIME);
      v.box(side * 0.35, 2.9, 1.7, 0.36, 0.36, 0.36, '#d8ff8a');
      v.box(side * 0.35, 3, 1.89, 0.16, 0.16, 0.06, BLACK);
    }
    v.box(0, 0.8, -0.4, 1.8, 2.6, 2.6, SHELL);
    v.box(0, 1.4, -0.4, 1.9, 1.6, 1.6, '#b066f0');
    v.box(0, 1.9, -0.4, 2, 0.6, 0.6, SHELL);
    v.box(0.75, 0, 1.8, 0.3, 0.3, 0.3, '#9af07a');
    v.box(-0.7, 0, -1.2, 0.35, 0.25, 0.5, '#9af07a');
    v.box(0, 1.25, 2.06, 0.5, 0.1, 0.06, '#2a6a1a');
  },
  rainbowToad(v) {
    const SKIN = '#7a5ac8';
    for (const side of [-1, 1]) {
      v.box(side * 1, 0, -0.5, 0.8, 0.7, 1.5, '#5e44a0');
      v.box(side * 0.8, 0, 1, 0.55, 0.7, 0.55, '#5e44a0');
    }
    v.box(0, 0.4, 0, 2.6, 1.5, 2.8, SKIN);
    v.box(0, 0.5, 0.8, 2, 0.7, 1.4, '#e8d8ff');
    RAINBOW.forEach((c, i) => v.box(0, 1.9, 1 - i * 0.38, 2.2, 0.35, 0.38, c));
    for (const side of [-1, 1]) {
      v.box(side * 0.65, 2.1, 1, 0.8, 0.8, 0.8, SKIN);
      v.box(side * 0.65, 2.3, 1.41, 0.45, 0.45, 0.06, '#ffe23a');
      v.box(side * 0.65, 2.42, 1.45, 0.2, 0.2, 0.06, BLACK);
    }
    v.box(0, 1.3, 1.41, 1.8, 0.12, 0.06, '#2a1a4a');
    // a tiny crown
    v.box(0, 2.9, 0.6, 0.9, 0.3, 0.7, '#ffd23a');
    for (const x of [-0.3, 0, 0.3]) v.box(x, 3.2, 0.6, 0.2, 0.3, 0.2, '#ffd23a');
  },

  // Frostbite Peaks
  snowWisp(v) {
    const SNOW = '#f6fbff', ICE = '#8fdcff';
    v.box(0, 0.3, 0, 0.8, 0.6, 0.8, SNOW);
    v.box(0, 0.8, 0, 1.6, 1.4, 1.6, SNOW);
    v.box(0, 2, 0, 2, 1.6, 2, SNOW);
    v.box(0, 3.4, 0, 1.4, 0.7, 1.4, SNOW);
    for (const side of [-1, 1]) v.box(side * 1.3, 2.4, 0, 0.6, 0.6, 0.6, '#e2f2ff');
    v.box(0, 1.2, 0.81, 0.6, 0.6, 0.06, ICE); // icy core
    glowEyes(v, 0, 2.7, 1.01, 0.38, 0.3, '#2a6ab0');
    for (const r of [0, 1.05, 2.1]) v.box(0, 4.1, 0, 0.18, 0.9, 0.18, ICE, { rz: r }); // snowflake crest
  },
  icicleSwordfish(v) {
    const BODY = '#5ab6f0', ICE = '#d8f4ff';
    for (const side of [-1, 1]) for (const z of [0.7, -0.7]) v.box(side * 0.4, 0, z, 0.3, 0.6, 0.3, '#2a5a8a');
    v.box(0, 0.6, 0, 1.3, 1.6, 3, BODY);
    v.box(0, 0.6, 0.1, 1.2, 0.6, 2.8, ICE);
    v.box(0, 0.8, 1.9, 1, 1.2, 0.8, BODY);
    v.box(0, 1.3, 3.2, 0.25, 0.25, 2.2, ICE); // the sword
    v.box(0, 2.2, -0.3, 0.2, 1.2, 1.2, '#3a8ad0', { rx: -0.4 });
    v.box(0, 0.6, -1.9, 0.2, 1.8, 0.9, '#3a8ad0', { rx: 0.25 });
    for (const side of [-1, 1]) v.box(side * 0.75, 0.9, 0.6, 0.15, 0.4, 0.7, ICE, { ry: side * 0.3 });
    eyes(v, 0, 1.45, 2.31, 0.35, 0.28);
  },
  frostbiteBear(v) {
    const SILVER = '#c8d0dc', SILVER2 = '#a8b2c2', ICE = '#9ae4ff';
    legs(v, SILVER2, 0.8, 1, 0.75, 0.9, -0.9);
    v.box(0, 1, 0, 2.6, 2, 3, SILVER);
    v.box(0, 1.8, 1.8, 2.2, 2, 1.6, SILVER);
    v.box(0, 2, 2.6, 1, 0.7, 0.5, '#e6ecf4');
    v.box(0, 2.45, 2.86, 0.4, 0.25, 0.06, BLACK);
    for (const side of [-1, 1]) v.box(side * 0.8, 3.8, 1.7, 0.6, 0.5, 0.4, SILVER2);
    glowEyes(v, 0, 3, 2.61, 0.5, 0.3, ICE);
    // ice crown and back spikes
    for (const [x, h] of [[-0.6, 0.5], [0, 0.8], [0.6, 0.5]]) v.box(x, 3.8, 1.9, 0.3, h, 0.3, ICE);
    for (let i = 0; i < 3; i++) v.box(0, 3, 0.6 - i * 0.8, 0.35, 0.6, 0.35, ICE, { rx: -0.5 });
  },

  // Ghost Manor
  candleGhost(v) {
    const WAX = '#f6efe0';
    v.box(0, 0, 0, 1.8, 0.3, 1.8, '#c8a03a'); // holder
    v.box(0, 0.3, 0, 1.3, 2.4, 1.3, WAX);
    for (const [x, h] of [[-0.66, 0.9], [0.66, 0.6]]) v.box(x, 2.7 - h, 0.3, 0.12, h, 0.3, WAX);
    v.box(0.3, 1.8, 0.66, 0.3, 0.9, 0.12, WAX);
    v.box(0, 2.7, 0, 0.12, 0.3, 0.12, '#2a2a2a');
    v.box(0, 3, 0, 0.5, 0.7, 0.5, '#ffb02e');
    v.box(0, 3.15, 0, 0.3, 0.6, 0.3, '#fff3a0');
    for (const side of [-1, 1]) v.box(side * 0.3, 1.7, 0.66, 0.25, 0.4, 0.06, BLACK);
    v.box(0, 1.15, 0.66, 0.35, 0.35, 0.06, BLACK);
  },
  phantomCat(v) {
    const FUR = '#7a4ab8', FUR2 = '#9a6ad8', GLOW = '#e8b0ff';
    legs(v, '#5e3a94', 0.55, 1, 0.6, 0.8, -0.8);
    v.box(0, 1, 0, 1.8, 1.5, 2.6, FUR);
    v.box(0, 1.8, 1.6, 2, 1.7, 1.6, FUR2);
    for (const side of [-1, 1]) v.box(side * 0.65, 3.5, 1.6, 0.55, 0.7, 0.4, FUR2);
    glowEyes(v, 0, 2.6, 2.41, 0.48, 0.38, '#5fff9a', BLACK);
    v.box(0, 2.2, 2.42, 0.25, 0.18, 0.06, '#ff8ad8');
    // a wispy tail curling up
    v.box(0, 1.6, -1.6, 0.4, 0.4, 1, FUR, { rx: 0.4 });
    v.box(0, 2.1, -2.1, 0.4, 0.8, 0.4, FUR2);
    v.box(0, 2.9, -2, 0.45, 0.45, 0.45, GLOW);
    v.box(0, 2.81, 0, 1.2, 0.08, 0.3, GLOW); // a glowing stripe
  },
  ghostPrince(v) {
    for (let i = -1; i <= 1; i++) v.box(i * 0.75, i ? 0.3 : 0.05, 0, 0.75, i ? 0.4 : 0.65, 1.8, RAINBOW[i + 1]);
    RAINBOW.forEach((c, i) => v.box(0, 0.7 + i * 0.4, 0, 2.2 - (i > 3 ? (i - 3) * 0.3 : 0), 0.4, 1.8 - (i > 3 ? (i - 3) * 0.2 : 0), c));
    v.box(0, 3.1, 0, 1.4, 0.4, 1.2, '#f4e8ff');
    for (const side of [-1, 1]) v.box(side * 1.25, 1.6, 0.1, 0.4, 0.4, 0.7, RAINBOW[4], { rz: -side * 0.5 });
    for (const side of [-1, 1]) v.box(side * 0.42, 1.9, 0.91, 0.32, 0.55, 0.08, BLACK);
    v.box(0, 1.45, 0.91, 0.4, 0.2, 0.06, BLACK);
    v.box(0, 3.5, 0, 1.2, 0.35, 1, '#ffd23a');
    for (const [x, z] of [[-0.45, 0.35], [0.45, 0.35], [0, 0.35], [-0.45, -0.35], [0.45, -0.35]]) v.box(x, 3.85, z, 0.22, 0.35, 0.22, '#ffd23a');
    v.box(0, 3.55, 0.51, 0.25, 0.25, 0.06, '#e8203a');
  },

  // Demon Pit
  hellPup(v) {
    const RED = '#d8242a', DARK = '#2a1214', FLAME = '#ff9a1a';
    legs(v, DARK, 0.5, 0.9, 0.55, 0.8, -0.8);
    v.box(0, 0.9, 0, 1.6, 1.3, 2.4, RED);
    v.box(0, 1.6, 1.5, 1.7, 1.5, 1.4, RED);
    v.box(0, 1.7, 2.35, 0.9, 0.6, 0.5, '#b01a20');
    v.box(0, 2.1, 2.62, 0.3, 0.2, 0.06, BLACK);
    for (const side of [-1, 1]) {
      v.box(side * 0.85, 2.3, 1.5, 0.25, 0.8, 0.5, DARK);
      v.box(side * 0.5, 3.1, 1.4, 0.25, 0.5, 0.25, '#f0e6d0', { rz: -side * 0.3 });
      v.box(side * 0.25, 1.55, 2.62, 0.12, 0.25, 0.06, WHITE);
    }
    glowEyes(v, 0, 2.5, 2.21, 0.42, 0.3, '#ffe23a');
    v.box(0, 1.8, -1.4, 0.3, 0.3, 0.8, RED, { rx: -0.7 });
    v.box(0, 2.3, -1.8, 0.5, 0.6, 0.5, FLAME);
    v.box(0, 2.8, -1.8, 0.3, 0.4, 0.3, '#ffe23a');
  },
  magmaImp(v) {
    const ROCK = '#2a2024', LAVA = '#ff7a1a';
    for (const side of [-1, 1]) {
      v.box(side * 0.45, 0, 0, 0.5, 1, 0.5, ROCK);
      v.box(side * 0.45, 0, 0.15, 0.55, 0.25, 0.8, LAVA);
    }
    v.box(0, 1, 0, 1.4, 1.3, 1, ROCK);
    v.box(0, 1.4, 0.51, 0.15, 0.8, 0.06, LAVA);
    v.box(0, 1.6, 0.51, 0.6, 0.12, 0.06, LAVA, { rz: 0.4 });
    v.box(0, 2.3, 0.1, 1.7, 1.4, 1.4, ROCK);
    for (const side of [-1, 1]) {
      v.box(side * 0.95, 1.2, 0, 0.35, 1, 0.35, ROCK);
      v.box(side * 0.6, 3.6, 0.1, 0.3, 0.6, 0.3, LAVA, { rz: -side * 0.4 });
      v.box(side * 1.1, 1.9, -0.6, 1, 0.8, 0.12, '#5a1a1a', { rz: side * 0.5 });
    }
    glowEyes(v, 0, 3, 0.81, 0.38, 0.32, '#ffe23a');
    v.box(0, 2.6, 0.81, 0.8, 0.2, 0.06, LAVA);
  },
  demonCalf(v) {
    const HIDE = '#5a1418', DARK = '#2a0c0e', GOLD = '#ffc22a', FIRE = '#ff7a1a';
    legs(v, DARK, 0.5, 1.4, 0.6, 1, -1);
    for (const side of [-1, 1]) for (const z of [1, -1]) v.box(side * 0.6, 0, z, 0.55, 0.3, 0.55, FIRE);
    v.box(0, 1.4, 0, 1.8, 1.4, 2.8, HIDE);
    v.box(0, 2, 1.7, 1.6, 1.4, 1.3, HIDE);
    v.box(0, 2, 2.4, 1.2, 0.7, 0.4, '#8a2a2e');
    for (const side of [-1, 1]) {
      v.box(side * 0.25, 2.3, 2.62, 0.18, 0.18, 0.06, FIRE);
      v.box(side * 0.9, 3.3, 1.7, 0.7, 0.3, 0.3, GOLD, { rz: side * 0.3 });
      v.box(side * 1.2, 3.5, 1.7, 0.25, 0.7, 0.25, GOLD, { rz: -side * 0.3 });
    }
    glowEyes(v, 0, 2.85, 2.36, 0.45, 0.3, '#ffe23a', '#e8202a');
    // fiery mane down the back
    for (let i = 0; i < 4; i++) v.box(0, 2.8 - (i ? 0.1 : 0), 1 - i * 0.7, 0.35, 0.5 - i * 0.05, 0.5, i % 2 ? '#ffe23a' : FIRE);
    v.box(0, 2.1, -1.6, 0.25, 0.25, 0.7, HIDE, { rx: 0.7 });
  },

  // Nightmare
  spikePuffer(v) {
    const BODY = '#9a5ae0', SPIKE = '#ffe2ff';
    for (const side of [-1, 1]) v.box(side * 0.45, 0, 0, 0.3, 0.5, 0.3, '#5a2a9a');
    v.box(0, 0.5, 0, 2.2, 2.2, 2.2, BODY);
    v.box(0, 0.5, 0.2, 1.8, 0.8, 1.9, '#e6c8ff');
    for (const [x, y, z] of [[1.2, 1.6, 0], [-1.2, 1.6, 0], [0, 2.8, 0], [0, 1.6, -1.2], [0.85, 2.5, 0.6], [-0.85, 2.5, 0.6],
      [0.85, 2.5, -0.7], [-0.85, 2.5, -0.7], [1.2, 0.9, -0.7], [-1.2, 0.9, -0.7]]) {
      v.box(x, y - 0.15, z, 0.3, 0.3, 0.3, SPIKE, { rx: 0.785, rz: 0.785 });
    }
    glowEyes(v, 0, 1.9, 1.11, 0.5, 0.42, '#ff2ad8', BLACK);
    v.box(0, 1.1, 1.11, 0.5, 0.35, 0.06, '#2a0a3a');
    v.box(0, 1.35, -1.3, 0.2, 0.8, 0.7, '#5a2a9a');
  },
  nightmareRaven(v) {
    const FEATH = '#1c1a26', SHEEN = '#4a2a8a', GLOW = '#c84aff';
    for (const side of [-1, 1]) v.box(side * 0.35, 0, 0.1, 0.2, 0.7, 0.2, '#5a5a62');
    v.box(0, 0.7, 0, 1.4, 1.6, 2.2, FEATH);
    for (const side of [-1, 1]) {
      v.box(side * 0.78, 0.8, -0.3, 0.2, 1.3, 2, SHEEN);
      v.box(side * 0.82, 0.9, -1.1, 0.12, 0.4, 0.6, GLOW);
    }
    v.box(0, 2.1, 0.8, 1.2, 1.2, 1.2, FEATH);
    v.box(0, 2.4, 1.6, 0.4, 0.35, 0.8, '#3a3a44');
    glowEyes(v, 0, 2.75, 1.41, 0.35, 0.28, GLOW);
    v.box(0, 3.3, 0.6, 0.3, 0.5, 0.6, FEATH, { rx: -0.4 });
    v.box(0, 0.9, -1.6, 1, 0.2, 1.2, SHEEN, { rx: -0.3 });
  },
  shadowShark(v) {
    const SKIN = '#2a1a44', GLOW = '#b04aff';
    legs(v, '#1a0e2c', 0.5, 0.6, 0.55, 0.9, -0.9);
    v.box(0, 0.6, 0, 1.6, 1.6, 3.2, SKIN);
    v.box(0, 0.55, 0.1, 1.4, 0.5, 3, '#5a3a8a');
    v.box(0, 0.7, 2, 1.4, 1.4, 1, SKIN);
    v.box(0, 0.9, 2.51, 1.2, 0.6, 0.06, '#0a0414');
    teeth(v, 0, 1.5, 2.54, 1.2, 4, 0.25, -1);
    teeth(v, 0, 0.9, 2.54, 1.2, 4, 0.2, 1);
    glowEyes(v, 0, 1.75, 2.51, 0.5, 0.26, GLOW);
    v.box(0, 2.1, -0.1, 0.25, 1.2, 1.1, SKIN, { rx: -0.45 });
    v.box(0, 2.15, -0.15, 0.27, 0.6, 0.4, GLOW, { rx: -0.45 });
    v.box(0, 1, -1.9, 0.25, 1.6, 0.8, SKIN, { rx: 0.35 });
    for (const side of [-1, 1]) v.box(side * 0.81, 1.5, -0.4, 0.06, 0.15, 2, GLOW);
  },

  // The Glitch
  glitchCat(v) {
    const CY = '#00e5ff', MG = '#ff2ad8', LM = '#7dff2a', BK = '#101018';
    v.box(-0.6, 0, 0.8, 0.5, 1, 0.5, CY);
    v.box(0.7, 0, 0.9, 0.5, 1, 0.5, MG);
    v.box(-0.6, 0, -0.8, 0.5, 1, 0.5, LM);
    v.box(0.6, 0, -0.9, 0.5, 1, 0.5, CY);
    v.box(0, 1, 0, 1.8, 1.4, 2.6, BK);
    v.box(0.25, 1.4, -0.4, 1.9, 0.6, 1, MG);
    v.box(0.2, 1.8, 1.6, 1.9, 1.6, 1.5, CY);
    v.box(-0.3, 1.8, 2.2, 1.2, 0.5, 0.5, BK);
    for (const side of [-1, 1]) v.box(side * 0.65 + 0.2, 3.4, 1.6, 0.5, 0.6, 0.4, side < 0 ? LM : MG);
    v.box(-0.25, 2.6, 2.36, 0.4, 0.4, 0.08, WHITE);
    v.box(0.7, 2.5, 2.36, 0.4, 0.5, 0.08, '#ff2020');
    v.box(0, 1.6, -1.6, 0.4, 0.4, 0.7, LM);
    v.box(0.3, 2.1, -2, 0.4, 0.6, 0.4, MG);
    v.box(-1.4, 2.6, 0.4, 0.3, 0.3, 0.3, LM); // stray pixels
    v.box(1.3, 3.5, -0.6, 0.3, 0.3, 0.3, CY);
  },
  errorBlob(v) {
    const MG = '#ff00dc', BK = '#141414';
    // the classic missing-texture checkerboard
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      v.box(-0.6 + i * 1.2, k * 1.2, -0.6 + j * 1.2, 1.2, 1.2, 1.2, (i + j + k) % 2 ? MG : BK);
    }
    v.box(0, 2.4, 0, 1.4, 0.7, 1.4, MG);
    v.box(0.25, 2.4, 0.1, 0.6, 0.7, 0.9, BK);
    glowEyes(v, 0, 1.3, 1.21, 0.45, 0.35, WHITE);
    v.box(0, 0.6, 1.21, 0.8, 0.15, 0.06, WHITE);
    // a floating error sign
    v.box(0, 3.5, 0, 0.9, 0.9, 0.2, '#ffe23a');
    v.box(0, 3.85, 0.11, 0.18, 0.45, 0.06, BK);
    v.box(0, 3.62, 0.11, 0.18, 0.15, 0.06, BK);
  },
  pixelDragon(v) {
    const G = '#2ad87a', G2 = '#1aa85a', BELLY = '#ffe23a', WING = '#00b8ff';
    legs(v, G2, 0.6, 1, 0.65, 0.9, -0.9);
    v.box(0, 1, 0, 1.8, 1.5, 2.8, G);
    v.box(0, 1, 0.3, 1.4, 0.8, 2.4, BELLY);
    v.box(0, 2, 1.6, 1, 1.2, 1, G, { rx: 0.3 });
    v.box(0, 2.9, 2.1, 1.4, 1.1, 1.5, G);
    v.box(0, 2.9, 3.1, 1, 0.6, 0.7, G2);
    for (const side of [-1, 1]) {
      v.box(side * 0.25, 3.25, 3.46, 0.15, 0.15, 0.06, BLACK);
      v.box(side * 0.4, 4, 1.7, 0.25, 0.6, 0.25, '#ffffff', { rx: -0.4 });
      v.box(side * 1.4, 2.6, -0.1, 1.6, 0.2, 1.4, WING, { rz: side * 0.5 });
      v.box(side * 2.2, 3.3, -0.3, 0.8, 0.2, 1, '#a24bff', { rz: side * 0.7 });
    }
    eyes(v, 0, 3.4, 2.86, 0.38, 0.3);
    for (let i = 0; i < 3; i++) v.box(0, 2.5, 0.7 - i * 0.7, 0.3, 0.35, 0.35, '#ff3b5c');
    v.box(0, 1.4, -1.7, 0.6, 0.6, 1, G, { rx: -0.3 });
    v.box(0, 1.8, -2.4, 0.6, 0.6, 0.6, '#ff3b5c');
  },

  // The Void
  voidEye(v) {
    const TENT = '#3a1a5a';
    for (const [x, z, r] of [[-0.6, 0.3, 0.3], [0.6, 0.3, -0.3], [0, -0.6, 0], [-0.4, -0.3, 0.5], [0.45, -0.25, -0.5]]) {
      v.box(x, 0.2, z, 0.3, 1.3, 0.3, TENT, { rz: r });
      v.box(x * 1.5, 0, z * 1.4, 0.25, 0.4, 0.25, '#7a2aff');
    }
    v.box(0, 1.3, 0, 2.4, 2.4, 2.4, '#f4f0f4');
    for (const side of [-1, 1]) v.box(side * 0.6, 1.6, 1.21, 0.06, 1.2, 0.06, '#e8303a', { rz: side * 0.5 }); // veins
    v.box(0, 1.9, 1.21, 1.3, 1.3, 0.08, '#8a2aff');
    v.box(0, 2.15, 1.25, 0.7, 0.8, 0.06, BLACK);
    v.box(0.25, 2.65, 1.28, 0.2, 0.2, 0.04, WHITE);
  },
  starEater(v) {
    const BODY = '#1a1a5a', BODY2 = '#2a2a8a', STAR = '#ffe23a';
    for (const side of [-1, 1]) v.box(side * 0.6, 0, 0, 0.5, 0.5, 0.6, BODY2);
    v.box(0, 0.5, 0, 2.4, 2.2, 2.2, BODY);
    v.box(0, 0.9, 1.11, 1.8, 0.9, 0.06, '#05051a'); // the mouth, full of stars
    teeth(v, 0, 1.8, 1.14, 1.8, 5, 0.25, -1);
    for (const [x, y] of [[-0.4, 1.2], [0.3, 1.05], [0.65, 1.4]]) v.box(x, y, 1.15, 0.2, 0.2, 0.06, STAR);
    glowEyes(v, 0, 2.1, 1.11, 0.55, 0.38, '#ffffff', BODY);
    for (const [x, y, z] of [[1.1, 1.8, -0.5], [-0.9, 2.3, -0.8], [0.4, 2.1, -1.11]]) v.box(x, y, z, 0.18, 0.18, 0.18, '#d8e0ff');
    v.box(0, 2.7, 0, 0.15, 0.8, 0.15, BODY2);
    v.box(0, 3.5, 0, 0.6, 0.6, 0.15, STAR, { rz: 0.785 });
    v.box(0, 3.5, 0, 0.6, 0.6, 0.12, '#ffb02e');
  },
  goldenAbomination(v) {
    const GOLD = '#ffc22a', GOLD2 = '#d8961a', GEMS = ['#e8203a', '#2ad86a', '#2a8aff'];
    for (const side of [-1, 1]) v.box(side * 0.55, 0, 0, 0.6, 1, 0.6, GOLD2);
    v.box(0, 1, 0, 2, 2.2, 1.6, GOLD);
    v.box(0, 3.2, 0, 1.6, 1.2, 1.4, GOLD);
    // six arms in three pairs
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const rz = side * (0.9 - i * 0.6);
        v.box(side * 1.5, 1.4 + i * 0.6, 0.1 - i * 0.2, 1.4, 0.3, 0.3, i % 2 ? GOLD2 : GOLD, { rz });
        v.box(side * 2.2, 1.1 + i * 1, 0.1 - i * 0.2, 0.4, 0.4, 0.4, GOLD2);
      }
    }
    // gem eyes
    v.box(-0.45, 3.6, 0.71, 0.4, 0.4, 0.08, GEMS[0]);
    v.box(0.45, 3.6, 0.71, 0.4, 0.4, 0.08, GEMS[2]);
    v.box(0, 4.05, 0.71, 0.32, 0.32, 0.08, GEMS[1]);
    v.box(0, 3.3, 0.71, 0.9, 0.15, 0.06, '#5a3a0a');
    v.box(0, 1.6, 0.81, 0.6, 0.6, 0.08, GEMS[0]);
    v.box(0, 4.4, 0, 1.2, 0.3, 1, GOLD2);
    for (const x of [-0.45, 0, 0.45]) v.box(x, 4.7, 0, 0.22, x ? 0.35 : 0.5, 0.22, GOLD);
  },
};
