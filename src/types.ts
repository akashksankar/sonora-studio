export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';

export type ScaleName =
  | 'chromatic'
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'japanese';

export type RootKey =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B';

export type VisualizerMode = 'waveform' | 'spectrum' | 'orb' | 'particles' | 'minimal';

export type DisplayMode = 'notes' | 'solfege' | 'frequencies' | 'clean';

export type PresetId =
  | 'pure_sine'
  | 'bright_saw'
  | 'soft_triangle'
  | 'retro_square'
  | 'theremin'
  | 'ambient_pad';

export interface InstrumentPreset {
  id: PresetId;
  name: string;
  subtitle: string;
  waveform: WaveformType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoff: number;
  filterResonance: number;
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  distortion: number;
  continuousPitch: boolean;
}

export interface NoteInfo {
  name: string;
  solfege: string;
  midi: number;
  frequency: number;
  octave: number;
}

export interface ActivePointerVoice {
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  velocity: number;
  pressure: number;
  lastTimestamp: number;
  note: NoteInfo;
  frequency: number;
  harmonyFrequency?: number;
  harmonyNote?: NoteInfo;
  color: string;
}

export interface TouchPoint {
  x: number;
  y: number;
  time: number;
  intensity: number;
}

export interface TouchTrail {
  pointerId: number;
  points: TouchPoint[];
  color: string;
  active: boolean;
  noteName: string;
  frequency: number;
}

export interface RecordedEvent {
  timestamp: number; // relative to start time in ms
  type: 'note_on' | 'note_off' | 'pitch_bend' | 'cc';
  midiNote: number;
  frequency: number;
  velocity: number;
  x: number; // 0-1
  y: number; // 0-1
  pointerId: number;
  duration?: number;
}

export interface PerformanceRecording {
  id: string;
  createdAt: number;
  durationMs: number;
  events: RecordedEvent[];
  key: RootKey;
  scale: ScaleName;
  baseOctave: number;
}

export interface AudioEngineSettings {
  masterVolume: number;
  waveform: WaveformType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoff: number;
  filterResonance: number;
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  distortion: number;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type AppMode = 'play' | 'midi_play' | 'learn';

export type ViewMode = 'touch' | 'roll';

export type LearnDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'performance';

export interface MidiNoteEvent {
  id: string;
  track: number;
  channel: number;
  note: number;
  noteName: string;
  octave: number;
  velocity: number;
  startTime: number; // in milliseconds
  duration: number; // in milliseconds
  endTime: number; // in milliseconds
}

export type InstrumentId =
  // Indian Classical
  | 'veena'
  | 'sitar'
  | 'bansuri'
  | 'tabla'
  | 'mridangam'
  | 'ghatam'
  | 'santoor'
  | 'tanpura'
  // Western / Classical
  | 'violin'
  | 'cello'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'harp'
  | 'grand_piano'
  // Piano Collection
  | 'concert_grand'
  | 'studio_piano'
  | 'upright_piano'
  | 'electric_piano'
  | 'soft_piano'
  | 'vintage_piano'
  | 'synth_piano'
  // Original Expressive Touchpad
  | 'touchpad';

export type InstrumentCategory =
  | 'all'
  | 'indian'
  | 'western'
  | 'piano'
  | 'percussion'
  | 'expressive';

export interface InstrumentDefinition {
  id: InstrumentId;
  name: string;
  nativeName?: string;
  subtitle: string;
  category: InstrumentCategory;
  description: string;
  color: string;
  glowColor: string;
  icon: string;
  minMidi: number;
  maxMidi: number;
  defaultOctave: number;
  soundType: 'plucked' | 'blown' | 'bowed' | 'percussion' | 'piano' | 'synth' | 'drone';
  features: string[];
}

export interface ParsedMidiTrack {
  index: number;
  name: string;
  instrument?: string;
  assignedInstrument?: InstrumentId;
  notes: MidiNoteEvent[];
  muted: boolean;
  solo: boolean;
  volume: number;
}

export interface ParsedMidiSong {
  id: string;
  title: string;
  fileName: string;
  durationMs: number;
  tempoBpm: number;
  timeSignature: string;
  tracks: ParsedMidiTrack[];
  allNotes: MidiNoteEvent[];
}

export interface GhostTouchPoint {
  x: number;
  y: number;
  active: boolean;
  noteName: string;
  midiNote: number;
  velocity: number;
  alpha: number;
}

export interface LearnStep {
  stepIndex: number;
  timestamp: number;
  expectedNotes: MidiNoteEvent[];
  chordName?: string;
  isChord: boolean;
  status: 'pending' | 'active' | 'success' | 'retry';
  playedNote?: number;
  timingOffsetSec?: number;
  timingRating?: 'PERFECT' | 'EARLY' | 'LATE' | 'MISSED';
  playedVelocity?: number;
}

export interface LearnSummary {
  totalNotes: number;
  correctNotes: number;
  timingScorePct: number;
  pitchScorePct: number;
  expressionScorePct: number;
  missedCount: number;
  earlyCount: number;
  lateCount: number;
  userPerformanceEvents: RecordedEvent[];
}

export interface InstrumentConfig {
  rootKey: RootKey;
  scale: ScaleName;
  baseOctave: number;
  octaveSpan: number; // e.g. 2 or 3 octaves
  isScaleLocked: boolean;
  isContinuousPitch: boolean; // Theremin mode
  isDoReMiMode: boolean;
  isTwoFingerHarmony: boolean;
  harmonyInterval: number; // 3, 4, 5, 7 semitones
  visualizerMode: VisualizerMode;
  displayMode: DisplayMode;
  accentColor: string;
  showMusicGrid: boolean;
  performanceMode: boolean;
  theme: ThemeMode;
  ghostHandEnabled: boolean;
  viewMode: ViewMode;
  playbackSpeed: number;
  loopEnabled: boolean;
  loopStartMs: number;
  loopEndMs: number;
  learnDifficulty: LearnDifficulty;
  // Multi-Instrument extensions
  selectedInstrument: InstrumentId;
  tanpuraDroneEnabled: boolean;
  tanpuraDroneKey: RootKey;
  tanpuraDroneVolume: number;
  fingeringGuideVisible: boolean;
  gamakaVisualizationEnabled: boolean;
  particleIntensity: 'subtle' | 'vibrant' | 'minimal';
}

