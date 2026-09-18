import {
  InstrumentPreset,
  NoteInfo,
  PresetId,
  RootKey,
  ScaleName,
} from '../types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const SOLFEGE_SYLLABLES: Record<number, string> = {
  0: 'DO',
  1: 'DI',
  2: 'RE',
  3: 'RI',
  4: 'MI',
  5: 'FA',
  6: 'FI',
  7: 'SOL',
  8: 'SI',
  9: 'LA',
  10: 'LI',
  11: 'TI',
};

export const MAJOR_SOLFEGE = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'TI'];

export const SCALES: Record<ScaleName, { name: string; intervals: number[] }> = {
  chromatic: {
    name: 'Chromatic',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  major: {
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  minor: {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  pentatonic: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9],
  },
  blues: {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
  },
  dorian: {
    name: 'Dorian Mode',
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  mixolydian: {
    name: 'Mixolydian Mode',
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
  japanese: {
    name: 'Insen / Japanese',
    intervals: [0, 1, 5, 7, 10],
  },
};

export const PRESETS: Record<PresetId, InstrumentPreset> = {
  pure_sine: {
    id: 'pure_sine',
    name: 'Pure Sine',
    subtitle: 'Warm & Organic Sub',
    waveform: 'sine',
    attack: 0.02,
    decay: 0.2,
    sustain: 0.85,
    release: 0.35,
    filterCutoff: 12000,
    filterResonance: 1.0,
    reverbMix: 0.25,
    reverbDecay: 1.8,
    delayTime: 0.25,
    delayFeedback: 0.3,
    delayMix: 0.15,
    distortion: 0,
    continuousPitch: false,
  },
  bright_saw: {
    id: 'bright_saw',
    name: 'Bright Saw',
    subtitle: 'Analog Lead & Bass',
    waveform: 'sawtooth',
    attack: 0.01,
    decay: 0.15,
    sustain: 0.75,
    release: 0.25,
    filterCutoff: 4500,
    filterResonance: 3.5,
    reverbMix: 0.3,
    reverbDecay: 2.2,
    delayTime: 0.3,
    delayFeedback: 0.4,
    delayMix: 0.2,
    distortion: 0.05,
    continuousPitch: false,
  },
  soft_triangle: {
    id: 'soft_triangle',
    name: 'Soft Triangle',
    subtitle: 'Gentle Flute & Keys',
    waveform: 'triangle',
    attack: 0.04,
    decay: 0.3,
    sustain: 0.7,
    release: 0.4,
    filterCutoff: 8000,
    filterResonance: 1.2,
    reverbMix: 0.4,
    reverbDecay: 2.5,
    delayTime: 0.35,
    delayFeedback: 0.35,
    delayMix: 0.25,
    distortion: 0,
    continuousPitch: false,
  },
  retro_square: {
    id: 'retro_square',
    name: 'Retro Square',
    subtitle: '8-Bit & Chiptune Chime',
    waveform: 'square',
    attack: 0.005,
    decay: 0.12,
    sustain: 0.65,
    release: 0.2,
    filterCutoff: 3800,
    filterResonance: 2.0,
    reverbMix: 0.18,
    reverbDecay: 1.2,
    delayTime: 0.2,
    delayFeedback: 0.25,
    delayMix: 0.18,
    distortion: 0.08,
    continuousPitch: false,
  },
  theremin: {
    id: 'theremin',
    name: 'Theremin Expressive',
    subtitle: 'Continuous Pitch & Vibrato',
    waveform: 'sine',
    attack: 0.08,
    decay: 0.1,
    sustain: 0.95,
    release: 0.5,
    filterCutoff: 6500,
    filterResonance: 2.5,
    reverbMix: 0.5,
    reverbDecay: 3.0,
    delayTime: 0.4,
    delayFeedback: 0.5,
    delayMix: 0.35,
    distortion: 0,
    continuousPitch: true,
  },
  ambient_pad: {
    id: 'ambient_pad',
    name: 'Ambient Pad',
    subtitle: 'Deep Cinematic Texture',
    waveform: 'sawtooth',
    attack: 0.25,
    decay: 0.6,
    sustain: 0.8,
    release: 0.8,
    filterCutoff: 2200,
    filterResonance: 4.0,
    reverbMix: 0.65,
    reverbDecay: 4.0,
    delayTime: 0.45,
    delayFeedback: 0.6,
    delayMix: 0.4,
    distortion: 0.02,
    continuousPitch: false,
  },
};

/**
 * Convert MIDI note number to Frequency in Hz (A4 = 440Hz, MIDI 69)
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert frequency in Hz to fractional MIDI note
 */
export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Get note name, octave, and solfege from MIDI note
 */
export function getNoteInfo(midi: number, rootKey: RootKey = 'C'): NoteInfo {
  const roundedMidi = Math.round(midi);
  const noteIndex = (roundedMidi % 12 + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex];
  const octave = Math.floor(roundedMidi / 12) - 1;

  // Calculate relative degree from root key for solfege
  const rootIndex = NOTE_NAMES.indexOf(rootKey);
  const relativeInterval = (noteIndex - rootIndex + 12) % 12;
  const solfege = SOLFEGE_SYLLABLES[relativeInterval] || 'DO';

  return {
    name: `${noteName}${octave}`,
    solfege,
    midi: roundedMidi,
    frequency: midiToFrequency(midi),
    octave,
  };
}

/**
 * Get all available notes for a given root key, scale, and octave range
 */
export function getScaleNotes(
  rootKey: RootKey,
  scaleName: ScaleName,
  baseOctave: number,
  octaveSpan: number = 2
): NoteInfo[] {
  const rootIndex = NOTE_NAMES.indexOf(rootKey);
  const intervals = SCALES[scaleName].intervals;
  const notes: NoteInfo[] = [];

  for (let oct = 0; oct <= octaveSpan; oct++) {
    const currentOctave = baseOctave + oct;
    for (let i = 0; i < intervals.length; i++) {
      // Don't duplicate the top root note if octaveSpan ends
      if (oct === octaveSpan && i > 0) break;

      const semitonesFromC = rootIndex + intervals[i];
      const midiNote = (currentOctave + 1) * 12 + semitonesFromC;
      notes.push(getNoteInfo(midiNote, rootKey));
    }
  }

  return notes;
}

/**
 * Map touch coordinate (0 to 1) to musical pitch and frequency.
 * X: Note in scale (left to right)
 * Y: Expression / Sub-octave / Continuous pitch bend (bottom to top higher pitch or modulation)
 */
export function mapCoordinateToPitch({
  normalizedX,
  normalizedY,
  rootKey,
  scaleName,
  baseOctave,
  octaveSpan,
  isContinuousPitch,
  isScaleLocked,
}: {
  normalizedX: number; // 0 to 1
  normalizedY: number; // 0 (top) to 1 (bottom)
  rootKey: RootKey;
  scaleName: ScaleName;
  baseOctave: number;
  octaveSpan: number;
  isContinuousPitch: boolean;
  isScaleLocked: boolean;
}): { note: NoteInfo; frequency: number } {
  // Clamp inputs
  const nx = Math.max(0, Math.min(1, normalizedX));
  // Invert Y so bottom is lower, top is higher expression/pitch
  const ny = 1 - Math.max(0, Math.min(1, normalizedY));

  const scaleNotes = getScaleNotes(rootKey, scaleName, baseOctave, octaveSpan);
  const minMidi = scaleNotes[0].midi;
  const maxMidi = scaleNotes[scaleNotes.length - 1].midi;
  const midiRange = maxMidi - minMidi;

  if (isContinuousPitch) {
    // Continuous Theremin-like mode: exact fractional pitch based on X + subtle Y vibrato/bend
    const continuousMidi = minMidi + nx * midiRange + (ny - 0.5) * 1.5;
    const freq = midiToFrequency(continuousMidi);
    const note = getNoteInfo(Math.round(continuousMidi), rootKey);
    return { note, frequency: freq };
  }

  if (isScaleLocked) {
    // Quantize strictly to the scale notes
    const noteIndex = Math.min(
      scaleNotes.length - 1,
      Math.floor(nx * scaleNotes.length)
    );
    const selectedNote = scaleNotes[noteIndex];
    return {
      note: selectedNote,
      frequency: selectedNote.frequency,
    };
  }

  // Chromatic or soft snap
  const targetMidi = minMidi + nx * midiRange;
  const nearestMidi = Math.round(targetMidi);
  const note = getNoteInfo(nearestMidi, rootKey);
  return {
    note,
    frequency: note.frequency,
  };
}

/**
 * Calculate harmony note (e.g., +3 minor/major 3rd, +5 perfect 5th, +7 7th, +12 octave)
 */
export function getHarmonyNote(
  baseNote: NoteInfo,
  intervalSemitones: number,
  rootKey: RootKey
): NoteInfo {
  const harmonyMidi = baseNote.midi + intervalSemitones;
  return getNoteInfo(harmonyMidi, rootKey);
}

/**
 * Identify standard musical chords from MIDI note numbers
 */
export function getChordName(midiNotes: number[]): string {
  if (!midiNotes || midiNotes.length === 0) return 'CHORD';
  if (midiNotes.length === 1) return getNoteInfo(midiNotes[0]).name;

  const sorted = [...new Set(midiNotes.map((n) => n % 12))].sort((a, b) => a - b);
  const rootMidi = Math.min(...midiNotes);
  const rootInfo = getNoteInfo(rootMidi);
  const rootPitchClass = rootMidi % 12;

  // Relative intervals from root
  const intervals = sorted
    .map((pc) => (pc - rootPitchClass + 12) % 12)
    .sort((a, b) => a - b);

  const intKey = intervals.join('-');

  if (intKey === '0-4-7') return `${rootInfo.name} Major`;
  if (intKey === '0-3-7') return `${rootInfo.name} Minor`;
  if (intKey === '0-4-7-11') return `${rootInfo.name} Maj7`;
  if (intKey === '0-4-7-10') return `${rootInfo.name} 7`;
  if (intKey === '0-3-7-10') return `${rootInfo.name} m7`;
  if (intKey === '0-3-6') return `${rootInfo.name} Dim`;
  if (intKey === '0-4-8') return `${rootInfo.name} Aug`;
  if (intKey === '0-2-7') return `${rootInfo.name} Sus2`;
  if (intKey === '0-5-7') return `${rootInfo.name} Sus4`;
  if (intKey === '0-7') return `${rootInfo.name} 5th`;

  // Fallback
  return `${rootInfo.name} Chord`;
}

