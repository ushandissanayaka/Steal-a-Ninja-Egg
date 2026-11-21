// The game's own music, written for Steal a Ninja Egg. Two tunes, played live (MusicPlayer):
//
//   lobby  "Bamboo Breeze" - a bright, bouncy dojo tune in G major pentatonic (G A B D E): a plucked
//          koto lead, a breathy bamboo-flute counter line in the second half, a round plucked bass
//          and light taiko drums with a woody clack. Plays in the lobby, by the pens and the shops.
//   raid   "Shadow Run" - a fast, tense chase in A minor with the Japanese "in" colour (A Bb D E F):
//          a driving eighth-note bass, a sharp koto lead with an echo, chord stabs and big taiko
//          drums with a roll at the end. Plays on the track, while you sneak to the nests and run.
//
// 16 bars each (an A part and a B part), 16 steps per bar, one chord per bar. Notes are MIDI numbers.
// chords: { root: bass note, tones: chord notes (pad / stabs) }
// melody: per bar, [step, midi, length in steps]
// flute:  (optional) a second, softer line per bar, same format
// drums:  steps for k = kick (taiko), s = snare / clack, h = closed hat / shaker, o = open hat;
//         fill = the last bar's extra tom hits [step, midi]
// swing:  how late the off 16ths come (0 = straight, 0.3 = lazy)
// sound:  which instruments the tune uses (see MusicPlayer)

// G major pentatonic: G3 55 A 57 B 59 D 62 E 64 | G4 67 A 69 B 71 D 74 E 76 | G5 79 A 81 B 83 D 86
const G = { root: 43, tones: [67, 71, 74] };
const C = { root: 48, tones: [67, 72, 76] };
const D = { root: 50, tones: [66, 69, 74] };
const Em = { root: 40, tones: [67, 71, 76] };
const Am = { root: 45, tones: [69, 72, 76] };

// A minor "in": A 57 Bb 58 D 62 E 64 F 65 | A 69 Bb 70 D 74 E 76 F 77 | A 81
const A = { root: 45, tones: [69, 72, 76] };
const Bb = { root: 46, tones: [70, 74, 77] };
const Dm = { root: 50, tones: [69, 74, 77] };
const E = { root: 40, tones: [68, 71, 76] };
const F = { root: 41, tones: [69, 72, 77] };

export const SONGS = {
  lobby: {
    name: 'Bamboo Breeze',
    bpm: 128,
    swing: 0.12,
    sound: { lead: 'koto', bass: 'pluck', pad: 'flute', stabs: false, drums: 'taiko', echo: 0.5 },
    chords: [G, Em, C, D, G, Em, C, D, Em, C, G, D, Em, C, Am, D],
    melody: [
      // A: the hook, bouncing up the scale
      [[0, 74, 2], [2, 76, 2], [4, 79, 3], [7, 76, 1], [8, 74, 2], [10, 71, 2], [12, 74, 4]],
      [[0, 71, 2], [2, 74, 2], [4, 76, 2], [6, 74, 2], [8, 71, 3], [11, 69, 1], [12, 67, 4]],
      [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 74, 2], [14, 76, 2]],
      [[0, 78, 3], [3, 76, 1], [4, 74, 2], [6, 69, 2], [8, 74, 6], [14, 69, 2]],
      [[0, 74, 2], [2, 76, 2], [4, 79, 3], [7, 81, 1], [8, 83, 2], [10, 81, 2], [12, 79, 4]],
      [[0, 76, 2], [2, 79, 1], [3, 76, 1], [4, 74, 2], [6, 71, 2], [8, 74, 2], [10, 76, 2], [12, 79, 4]],
      [[0, 81, 2], [2, 79, 2], [4, 76, 2], [6, 79, 2], [8, 84, 3], [11, 83, 1], [12, 81, 4]],
      [[0, 79, 2], [2, 78, 2], [4, 74, 4], [8, 69, 2], [10, 71, 2], [12, 74, 2], [14, 78, 2]],
      // B: higher and brighter, with quick runs
      [[0, 83, 3], [3, 81, 1], [4, 79, 2], [6, 76, 2], [8, 79, 1], [9, 81, 1], [10, 83, 2], [12, 86, 4]],
      [[0, 84, 2], [2, 83, 2], [4, 79, 2], [6, 76, 2], [8, 79, 4], [12, 76, 2], [14, 79, 2]],
      [[0, 83, 2], [2, 86, 2], [4, 88, 3], [7, 86, 1], [8, 83, 2], [10, 81, 2], [12, 79, 4]],
      [[0, 81, 1], [1, 83, 1], [2, 81, 2], [4, 78, 2], [6, 74, 2], [8, 76, 2], [10, 78, 2], [12, 81, 4]],
      [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 79, 2], [10, 76, 2], [12, 79, 2], [14, 83, 2]],
      [[0, 84, 3], [3, 83, 1], [4, 81, 2], [6, 79, 2], [8, 76, 2], [10, 79, 2], [12, 84, 4]],
      [[0, 81, 2], [2, 84, 2], [4, 88, 4], [8, 84, 2], [10, 81, 2], [12, 76, 4]],
      [[0, 78, 2], [2, 81, 2], [4, 86, 4], [8, 84, 1], [9, 83, 1], [10, 81, 2], [12, 78, 2], [14, 74, 2]],
    ],
    // the bamboo flute: long, soft notes under the B part
    flute: [
      [], [], [], [], [], [], [], [],
      [[0, 71, 8], [8, 74, 8]], [[0, 76, 8], [8, 72, 8]], [[0, 74, 8], [8, 79, 8]], [[0, 78, 16]],
      [[0, 71, 8], [8, 76, 8]], [[0, 72, 8], [8, 76, 8]], [[0, 76, 16]], [[0, 74, 8], [8, 78, 8]],
    ],
    drums: { k: [0, 7, 10], s: [4, 12], h: [2, 6, 10, 14], o: [14], fill: [[12, 50], [13, 47], [14, 45], [15, 43]] },
  },

  raid: {
    name: 'Shadow Run',
    bpm: 132,
    swing: 0,
    sound: { lead: 'koto', bass: 'drive', pad: false, stabs: true, drums: 'taikoHard', echo: 0.75 },
    chords: [A, A, Bb, A, Dm, Bb, E, E, F, Dm, A, Bb, F, Dm, E, E],
    melody: [
      // A: a darting figure that keeps snapping back to A
      [[0, 69, 1], [1, 69, 1], [2, 76, 2], [4, 69, 1], [5, 69, 1], [6, 77, 2], [8, 76, 2], [10, 74, 2], [12, 70, 2], [14, 69, 2]],
      [[0, 69, 1], [1, 69, 1], [2, 76, 2], [4, 69, 1], [5, 69, 1], [6, 81, 2], [8, 77, 2], [10, 76, 2], [12, 74, 4]],
      [[0, 70, 1], [1, 70, 1], [2, 77, 2], [4, 70, 1], [5, 70, 1], [6, 82, 2], [8, 81, 2], [10, 77, 2], [12, 76, 2], [14, 74, 2]],
      [[0, 76, 2], [2, 74, 2], [4, 70, 2], [6, 69, 2], [8, 64, 2], [10, 65, 2], [12, 69, 4]],
      [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 77, 2], [8, 74, 1], [9, 76, 1], [10, 77, 2], [12, 81, 4]],
      [[0, 82, 2], [2, 81, 2], [4, 77, 2], [6, 74, 2], [8, 77, 2], [10, 74, 2], [12, 70, 4]],
      [[0, 76, 1], [1, 77, 1], [2, 76, 2], [4, 71, 2], [6, 68, 2], [8, 71, 2], [10, 76, 2], [12, 80, 4]],
      [[0, 81, 1], [1, 80, 1], [2, 76, 2], [4, 71, 2], [6, 68, 2], [8, 64, 4], [12, 68, 2], [14, 71, 2]],
      // B: climbing, louder, then the dash home
      [[0, 81, 3], [3, 77, 1], [4, 72, 2], [6, 77, 2], [8, 81, 2], [10, 84, 2], [12, 82, 4]],
      [[0, 81, 2], [2, 77, 2], [4, 74, 2], [6, 77, 2], [8, 81, 2], [10, 86, 2], [12, 84, 4]],
      [[0, 81, 1], [1, 81, 1], [2, 88, 2], [4, 81, 1], [5, 81, 1], [6, 89, 2], [8, 88, 2], [10, 86, 2], [12, 82, 2], [14, 81, 2]],
      [[0, 82, 2], [2, 81, 2], [4, 77, 2], [6, 74, 2], [8, 82, 2], [10, 86, 2], [12, 89, 4]],
      [[0, 88, 2], [2, 84, 2], [4, 81, 2], [6, 77, 2], [8, 81, 1], [9, 84, 1], [10, 88, 2], [12, 89, 4]],
      [[0, 86, 2], [2, 81, 2], [4, 77, 2], [6, 74, 2], [8, 77, 2], [10, 81, 2], [12, 86, 4]],
      [[0, 88, 1], [1, 86, 1], [2, 83, 2], [4, 80, 2], [6, 76, 2], [8, 80, 2], [10, 83, 2], [12, 88, 4]],
      [[0, 88, 2], [2, 86, 1], [3, 83, 1], [4, 80, 2], [6, 76, 2], [8, 71, 2], [10, 68, 2], [12, 64, 4]],
    ],
    drums: { k: [0, 3, 6, 8, 11, 14], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], o: [7, 15], fill: [[8, 55], [10, 52], [12, 50], [13, 48], [14, 45], [15, 43]] },
  },
};
