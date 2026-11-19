// The game's own music, written for Steal a Ninja Egg. Two tunes, played live (MusicPlayer):
//
//   lobby  "Hatchery Hush" - a creepy-cute music-box lullaby in D minor (with the raised 7th, C#,
//          for that haunted toy-box sound), a ghostly "ooh" choir pad, a plucked bass and soft,
//          swung drums. Plays in the lobby, among the pens and the ghosts on the pillars.
//   raid   "Nest Raid" - a fast, tense chase in E phrygian (E F G A B C D, with a B-major turn
//          back home): a driving eighth-note bass, a biting square lead with an echo and harder
//          drums with a tom fill. Plays on the track, while you sneak to the nests and run back.
//
// 8 bars each, 16 steps per bar, one chord per bar. Notes are MIDI numbers.
// chords: { root: bass note, tones: chord notes (pad / stabs) }
// melody: per bar, [step, midi, length in steps]
// drums:  steps for k = kick, s = snare / rim, h = closed hat / shaker, o = open hat;
//         fill = the last bar's extra tom hits [step, midi]
// swing:  how late the off 16ths come (0 = straight, 0.3 = lazy)
// sound:  which instruments the tune uses (see MusicPlayer)

export const SONGS = {
  lobby: {
    name: 'Hatchery Hush',
    bpm: 108,
    swing: 0.28,
    sound: { lead: 'musicBox', bass: 'pluck', pad: 'choir', stabs: false, drums: 'soft', echo: 0.62 },
    chords: [
      { root: 38, tones: [62, 65, 69] }, // Dm
      { root: 34, tones: [58, 62, 65] }, // Bb
      { root: 43, tones: [58, 62, 67] }, // Gm
      { root: 45, tones: [57, 61, 64] }, // A
      { root: 38, tones: [62, 65, 69] }, // Dm
      { root: 41, tones: [57, 60, 65] }, // F
      { root: 43, tones: [58, 62, 67] }, // Gm
      { root: 45, tones: [57, 61, 64] }, // A
    ],
    melody: [
      [[0, 81, 3], [3, 77, 1], [4, 74, 2], [6, 77, 2], [8, 81, 2], [10, 82, 2], [12, 81, 4]],
      [[0, 82, 2], [2, 81, 1], [3, 79, 1], [4, 77, 4], [8, 74, 2], [10, 77, 2], [12, 82, 4]],
      [[0, 79, 3], [3, 82, 1], [4, 86, 2], [6, 82, 2], [8, 79, 2], [10, 77, 2], [12, 74, 4]],
      [[0, 76, 2], [2, 73, 2], [4, 76, 2], [6, 79, 2], [8, 81, 6], [14, 73, 2]],
      [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 86, 2], [8, 85, 2], [10, 86, 1], [11, 85, 1], [12, 81, 4]],
      [[0, 84, 3], [3, 81, 1], [4, 77, 2], [6, 81, 2], [8, 84, 2], [10, 86, 2], [12, 84, 4]],
      [[0, 82, 2], [2, 79, 2], [4, 82, 2], [6, 86, 2], [8, 84, 1], [9, 82, 1], [10, 81, 2], [12, 79, 4]],
      [[0, 81, 2], [2, 85, 2], [4, 88, 4], [8, 85, 2], [10, 81, 2], [12, 76, 2], [14, 73, 2]],
    ],
    drums: { k: [0, 10], s: [4, 12], h: [2, 6, 10, 14], o: [], fill: [] },
  },

  raid: {
    name: 'Nest Raid',
    bpm: 150,
    swing: 0,
    sound: { lead: 'square', bass: 'drive', pad: false, stabs: true, drums: 'hard', echo: 0.75 },
    chords: [
      { root: 40, tones: [64, 67, 71] }, // Em
      { root: 41, tones: [65, 69, 72] }, // F
      { root: 40, tones: [64, 67, 71] }, // Em
      { root: 38, tones: [62, 66, 69] }, // D
      { root: 40, tones: [64, 67, 71] }, // Em
      { root: 41, tones: [65, 69, 72] }, // F
      { root: 43, tones: [62, 67, 71] }, // G
      { root: 35, tones: [63, 66, 71] }, // B
    ],
    melody: [
      [[0, 76, 1], [1, 76, 1], [2, 83, 2], [4, 76, 1], [5, 76, 1], [6, 84, 2], [8, 83, 2], [10, 79, 2], [12, 81, 2], [14, 79, 2]],
      [[0, 77, 1], [1, 77, 1], [2, 84, 2], [4, 77, 1], [5, 77, 1], [6, 86, 2], [8, 84, 2], [10, 81, 2], [12, 77, 4]],
      [[0, 76, 1], [1, 76, 1], [2, 83, 2], [4, 76, 1], [5, 76, 1], [6, 84, 2], [8, 83, 2], [10, 79, 2], [12, 76, 4]],
      [[0, 78, 2], [2, 81, 2], [4, 86, 4], [8, 84, 2], [10, 81, 2], [12, 78, 2], [14, 74, 2]],
      [[0, 88, 2], [2, 86, 1], [3, 84, 1], [4, 83, 4], [8, 79, 2], [10, 83, 2], [12, 88, 4]],
      [[0, 89, 2], [2, 88, 1], [3, 86, 1], [4, 84, 4], [8, 81, 2], [10, 84, 2], [12, 89, 4]],
      [[0, 91, 2], [2, 89, 2], [4, 88, 2], [6, 86, 2], [8, 83, 4], [12, 86, 4]],
      [[0, 87, 3], [3, 86, 1], [4, 83, 2], [6, 78, 2], [8, 75, 4], [12, 78, 2], [14, 83, 2]],
    ],
    drums: {
      k: [0, 6, 8, 11],
      s: [4, 12],
      h: [0, 2, 4, 6, 8, 10, 12, 14],
      o: [14],
      fill: [[12, 52], [13, 50], [14, 47], [15, 43]],
    },
  },
};
