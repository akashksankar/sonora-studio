import { InstrumentId } from '../types';
import { midiToFrequency } from '../utils/musicTheory';

// Maps our application InstrumentIds to soundfont files in FluidR3_GM
const SOUNDFONT_MAP: Record<InstrumentId, string> = {
  sitar: 'sitar',
  veena: 'sitar', // Routed through dedicated Saraswati Veena Jackwood Kudam Resonator & Formant Filter
  bansuri: 'flute',
  santoor: 'dulcimer',
  violin: 'violin',
  cello: 'cello',
  concert_grand: 'acoustic_grand_piano',
  grand_piano: 'acoustic_grand_piano',
  studio_piano: 'acoustic_grand_piano',
  upright_piano: 'acoustic_grand_piano',
  electric_piano: 'electric_piano_1',
  soft_piano: 'acoustic_grand_piano',
  vintage_piano: 'acoustic_grand_piano',
  synth_piano: 'electric_piano_1',
  acoustic_guitar: 'acoustic_guitar_steel',
  electric_guitar: 'electric_guitar_clean',
  harp: 'orchestral_harp',
  tabla: 'taiko_drum',
  mridangam: 'timpani',
  ghatam: 'taiko_drum',
  tanpura: 'sitar',
  touchpad: 'sitar',
};

const SOUNDFONT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface AuthenticSampleVoice {
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode?: StereoPannerNode;
  filterNodes: AudioNode[];
  baseFreq: number;
  sampleMidi: number;
  stop: (releaseTime?: number) => void;
  setFrequency: (freq: number) => void;
  released: boolean;
}

type BankStatus = 'unloaded' | 'loading' | 'ready' | 'error';
type StatusListener = (instrumentId: InstrumentId, status: BankStatus) => void;

export class AuthenticSampleBank {
  private static instance: AuthenticSampleBank | null = null;
  private rawDictionaries: Map<string, Record<string, string>> = new Map();
  private decodedBuffers: Map<string, Map<string, AudioBuffer>> = new Map();
  private statuses: Map<string, BankStatus> = new Map();
  private listeners: Set<StatusListener> = new Set();
  private loadPromises: Map<string, Promise<boolean>> = new Map();

  private constructor() {}

  public static getInstance(): AuthenticSampleBank {
    if (!AuthenticSampleBank.instance) {
      AuthenticSampleBank.instance = new AuthenticSampleBank();
    }
    return AuthenticSampleBank.instance;
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(instId: InstrumentId, status: BankStatus) {
    this.listeners.forEach((fn) => fn(instId, status));
  }

  public getStatus(instId: InstrumentId): BankStatus {
    const sfKey = SOUNDFONT_MAP[instId] || 'sitar';
    return this.statuses.get(sfKey) || 'unloaded';
  }

  public isReady(instId: InstrumentId): boolean {
    const sfKey = SOUNDFONT_MAP[instId] || 'sitar';
    return this.statuses.get(sfKey) === 'ready';
  }

  /**
   * Converts MIDI number to the Soundfont note name convention (e.g. 60 -> "C4", 61 -> "Db4")
   */
  public midiToNoteName(midi: number): string {
    const noteIndex = Math.max(0, midi % 12);
    const octave = Math.floor(midi / 12) - 1;
    return `${SOUNDFONT_NOTE_NAMES[noteIndex]}${octave}`;
  }

  /**
   * Converts a base64 string or data URI into an ArrayBuffer for AudioContext decoding
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const commaIdx = base64.indexOf(',');
    const cleanBase64 = commaIdx >= 0 ? base64.substring(commaIdx + 1) : base64;
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Load and parse authentic soundfont file from CDN
   */
  public async loadInstrument(instId: InstrumentId, ctx: AudioContext): Promise<boolean> {
    const sfKey = SOUNDFONT_MAP[instId] || 'sitar';

    if (this.statuses.get(sfKey) === 'ready') {
      return true;
    }

    // If an existing load is in flight, return its promise
    if (this.loadPromises.has(sfKey)) {
      return this.loadPromises.get(sfKey)!;
    }

    const loadPromise = (async () => {
      this.statuses.set(sfKey, 'loading');
      this.notify(instId, 'loading');

      try {
        const url = `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/${sfKey}-mp3.js`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch soundfont: ${res.status}`);
        }

        const text = await res.text();

        // Extract object literal cleanly
        const assignmentIdx = text.indexOf('MIDI.Soundfont.');
        const eqIdx = text.indexOf('=', assignmentIdx);
        const start = text.indexOf('{', eqIdx);
        const end = text.lastIndexOf('}');

        if (start === -1 || end === -1) {
          throw new Error('Malformed soundfont data');
        }

        const objStr = text.slice(start, end + 1);
        const notesDict = new Function('return (' + objStr + ')')() as Record<string, string>;

        this.rawDictionaries.set(sfKey, notesDict);
        if (!this.decodedBuffers.has(sfKey)) {
          this.decodedBuffers.set(sfKey, new Map());
        }

        // Pre-decode standard playable central octaves (Octaves 2 through 6)
        const centralNotes: string[] = [];
        for (let oct = 2; oct <= 6; oct++) {
          for (const n of SOUNDFONT_NOTE_NAMES) {
            const noteKey = `${n}${oct}`;
            if (notesDict[noteKey]) {
              centralNotes.push(noteKey);
            }
          }
        }

        // Decode in batches of 4 for responsive performance
        const batchSize = 4;
        for (let i = 0; i < centralNotes.length; i += batchSize) {
          const batch = centralNotes.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (noteKey) => {
              try {
                const b64 = notesDict[noteKey];
                const arrayBuffer = this.base64ToArrayBuffer(b64);
                const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
                  ctx.decodeAudioData(arrayBuffer, resolve, reject);
                });
                this.decodedBuffers.get(sfKey)!.set(noteKey, audioBuffer);
              } catch {
                // Non-critical: skip note
              }
            })
          );
        }

        this.statuses.set(sfKey, 'ready');
        this.notify(instId, 'ready');
        return true;
      } catch (err) {
        console.warn(`[AuthenticSampleBank] Error loading soundfont for ${instId} (${sfKey}):`, err);
        this.statuses.set(sfKey, 'error');
        this.notify(instId, 'error');
        return false;
      } finally {
        this.loadPromises.delete(sfKey);
      }
    })();

    this.loadPromises.set(sfKey, loadPromise);
    return loadPromise;
  }

  /**
   * Preload an array of instruments (e.g. Sitar, Veena, Flute)
   */
  public preload(insts: InstrumentId[], ctx: AudioContext) {
    insts.forEach((inst) => {
      this.loadInstrument(inst, ctx).catch(() => {});
    });
  }

  /**
   * Retrieves an already decoded AudioBuffer or decodes it on-demand
   */
  public async getAudioBuffer(
    instId: InstrumentId,
    noteName: string,
    ctx: AudioContext
  ): Promise<AudioBuffer | null> {
    const sfKey = SOUNDFONT_MAP[instId] || 'sitar';
    const bank = this.decodedBuffers.get(sfKey);
    if (bank && bank.has(noteName)) {
      return bank.get(noteName)!;
    }

    const dict = this.rawDictionaries.get(sfKey);
    if (!dict || !dict[noteName]) return null;

    try {
      const b64 = dict[noteName];
      const arrayBuffer = this.base64ToArrayBuffer(b64);
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });
      if (!this.decodedBuffers.has(sfKey)) {
        this.decodedBuffers.set(sfKey, new Map());
      }
      this.decodedBuffers.get(sfKey)!.set(noteName, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  /**
   * Find closest already-decoded AudioBuffer if exact note is still decoding
   */
  private findClosestDecodedBuffer(
    sfKey: string,
    targetMidi: number
  ): { buffer: AudioBuffer; midi: number } | null {
    const bank = this.decodedBuffers.get(sfKey);
    if (!bank || bank.size === 0) return null;

    let closestDist = Infinity;
    let closestMidi = targetMidi;
    let closestBuf: AudioBuffer | null = null;

    for (let offset = 0; offset <= 24; offset++) {
      for (const sign of [0, -1, 1]) {
        if (sign === 0 && offset > 0) continue;
        const testMidi = targetMidi + sign * offset;
        const testNote = this.midiToNoteName(testMidi);
        if (bank.has(testNote)) {
          return { buffer: bank.get(testNote)!, midi: testMidi };
        }
      }
    }

    return null;
  }

  /**
   * Triggers an authentic sampled acoustic voice with real-time continuous pitch bending
   */
  public playSample(
    ctx: AudioContext,
    instId: InstrumentId,
    frequency: number,
    velocity: number,
    pan: number,
    destinationNode: AudioNode
  ): AuthenticSampleVoice | null {
    const sfKey = SOUNDFONT_MAP[instId] || 'sitar';
    const targetMidi = Math.round(12 * Math.log2(frequency / 440) + 69);
    const clampedMidi = Math.max(21, Math.min(108, targetMidi));
    const exactNote = this.midiToNoteName(clampedMidi);

    const bank = this.decodedBuffers.get(sfKey);
    let sampleBuffer: AudioBuffer | null = null;
    let sampleMidi = clampedMidi;

    if (bank && bank.has(exactNote)) {
      sampleBuffer = bank.get(exactNote)!;
    } else {
      const closest = this.findClosestDecodedBuffer(sfKey, clampedMidi);
      if (closest) {
        sampleBuffer = closest.buffer;
        sampleMidi = closest.midi;
      }
    }

    if (!sampleBuffer) {
      return null;
    }

    const t = ctx.currentTime;
    const baseFreq = midiToFrequency(sampleMidi);
    const playbackRate = frequency / baseFreq;

    const source = ctx.createBufferSource();
    source.buffer = sampleBuffer;
    source.playbackRate.setValueAtTime(Math.max(0.1, Math.min(8.0, playbackRate)), t);

    // Gain envelope node
    const gain = ctx.createGain();
    const nominalGain = Math.max(0.1, Math.min(1.0, velocity * 0.85));
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(nominalGain, t + 0.008);

    // Stereo Panner
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    }

    const filterNodes: AudioNode[] = [];

    // Dedicated Saraswati Veena Acoustic Kudam Resonator & Formant Filter
    if (instId === 'veena') {
      // 1. Jackwood Kudam lower chamber resonance (285 Hz, +4.5dB)
      const kudam1 = ctx.createBiquadFilter();
      kudam1.type = 'peaking';
      kudam1.frequency.setValueAtTime(285, t);
      kudam1.Q.setValueAtTime(2.6, t);
      kudam1.gain.setValueAtTime(4.5, t);

      // 2. Kudam upper soundboard chamber resonance (580 Hz, +3.8dB)
      const kudam2 = ctx.createBiquadFilter();
      kudam2.type = 'peaking';
      kudam2.frequency.setValueAtTime(580, t);
      kudam2.Q.setValueAtTime(2.4, t);
      kudam2.gain.setValueAtTime(3.8, t);

      // 3. Brass fret overtone reflection (1150 Hz, +2.5dB)
      const fretBuzz = ctx.createBiquadFilter();
      fretBuzz.type = 'peaking';
      fretBuzz.frequency.setValueAtTime(1150, t);
      fretBuzz.Q.setValueAtTime(3.0, t);
      fretBuzz.gain.setValueAtTime(2.5, t);

      // 4. Jackwood warm acoustic body roll-off (lowpass at 6800 Hz)
      const warmBody = ctx.createBiquadFilter();
      warmBody.type = 'lowpass';
      warmBody.frequency.setValueAtTime(6800, t);
      warmBody.Q.setValueAtTime(0.707, t);

      source.connect(kudam1);
      kudam1.connect(kudam2);
      kudam2.connect(fretBuzz);
      fretBuzz.connect(warmBody);
      warmBody.connect(gain);

      filterNodes.push(kudam1, kudam2, fretBuzz, warmBody);
    } else if (instId === 'sitar') {
      // Sitar Jawari sympathetic shimmer peak (2600 Hz)
      const jawariPeak = ctx.createBiquadFilter();
      jawariPeak.type = 'peaking';
      jawariPeak.frequency.setValueAtTime(2600, t);
      jawariPeak.Q.setValueAtTime(2.2, t);
      jawariPeak.gain.setValueAtTime(3.5, t);

      source.connect(jawariPeak);
      jawariPeak.connect(gain);
      filterNodes.push(jawariPeak);
    } else if (instId === 'bansuri') {
      // Bansuri Bamboo body air formant filter (1450 Hz & 2900 Hz)
      const air1 = ctx.createBiquadFilter();
      air1.type = 'peaking';
      air1.frequency.setValueAtTime(1450, t);
      air1.Q.setValueAtTime(2.0, t);
      air1.gain.setValueAtTime(3.0, t);

      source.connect(air1);
      air1.connect(gain);
      filterNodes.push(air1);
    } else {
      source.connect(gain);
    }

    if (panner) {
      gain.connect(panner);
      panner.connect(destinationNode);
    } else {
      gain.connect(destinationNode);
    }

    source.start(t);

    const voice: AuthenticSampleVoice = {
      sourceNode: source,
      gainNode: gain,
      pannerNode: panner || undefined,
      filterNodes,
      baseFreq,
      sampleMidi,
      released: false,
      stop: (releaseTime = 0.08) => {
        if (voice.released) return;
        voice.released = true;
        const now = ctx.currentTime;
        gain.gain.setTargetAtTime(0, now, Math.max(0.01, releaseTime / 3));
        const stopAt = now + releaseTime + 0.05;
        try {
          source.stop(stopAt);
        } catch {
          // Already stopped
        }
        setTimeout(() => {
          try {
            source.disconnect();
            filterNodes.forEach((fn) => fn.disconnect());
            gain.disconnect();
            if (panner) panner.disconnect();
          } catch {
            // Ignored
          }
        }, (releaseTime + 0.1) * 1000);
      },
      setFrequency: (newFreq: number) => {
        const rate = Math.max(0.1, Math.min(8.0, newFreq / baseFreq));
        source.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.015);
      },
    };

    return voice;
  }
}

export const authenticSampleBank = AuthenticSampleBank.getInstance();
