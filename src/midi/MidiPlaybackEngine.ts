import { audioEngine } from '../audio/AudioEngine';
import { midiManager } from './MidiManager';
import { GhostTouchPoint, InstrumentId, MidiNoteEvent, ParsedMidiSong } from '../types';
import { midiToFrequency } from '../utils/musicTheory';
import { mapMidiProgramToInstrument } from '../instruments/instrumentRegistry';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface PlaybackEngineSubscriber {
  onTick: (
    currentTimeMs: number,
    activeNotes: MidiNoteEvent[],
    ghostTouch: GhostTouchPoint | null
  ) => void;
  onStateChange: (state: PlaybackState) => void;
  onSongEnd: () => void;
}

export interface TrackState {
  muted: boolean;
  solo: boolean;
  volume: number;
  assignedInstrument?: InstrumentId;
}

export class MidiPlaybackEngine {
  private static instance: MidiPlaybackEngine | null = null;

  private currentSong: ParsedMidiSong | null = null;
  private state: PlaybackState = 'stopped';
  private playbackRate: number = 1.0;
  private userTempoBpm: number = 120;
  private originalTempoBpm: number = 120;
  private primaryInstrument: InstrumentId = 'veena';
  private overrideInstrument: InstrumentId | 'original' = 'veena';

  private currentTimeMs: number = 0;
  private lastPerfTimestamp: number = 0;
  private animFrameId: number | null = null;

  // Loop points
  private isLooping: boolean = false;
  private loopStartMs: number = 0;
  private loopEndMs: number = 0;

  // Active playing voice IDs in AudioEngine
  private activeVoiceKeys: Set<string> = new Set();
  private subscribers: Set<PlaybackEngineSubscriber> = new Set();

  // Track settings (muted, solo, volume, assignedInstrument)
  private trackStates: Map<number, TrackState> = new Map();

  private constructor() {}

  public static getInstance(): MidiPlaybackEngine {
    if (!MidiPlaybackEngine.instance) {
      MidiPlaybackEngine.instance = new MidiPlaybackEngine();
    }
    return MidiPlaybackEngine.instance;
  }

  public setPrimaryInstrument(instrument: InstrumentId) {
    this.primaryInstrument = instrument;
    if (this.overrideInstrument !== 'original') {
      this.overrideInstrument = instrument;
    }
  }

  public getPrimaryInstrument(): InstrumentId {
    return this.primaryInstrument;
  }

  public setOverrideInstrument(instrument: InstrumentId | 'original') {
    this.overrideInstrument = instrument;
  }

  public getOverrideInstrument(): InstrumentId | 'original' {
    return this.overrideInstrument;
  }

  public applyInstrumentToAllTracks(instrument: InstrumentId) {
    this.overrideInstrument = instrument;
    this.primaryInstrument = instrument;
    for (const [trkIdx, state] of this.trackStates.entries()) {
      this.trackStates.set(trkIdx, {
        ...state,
        assignedInstrument: instrument,
      });
    }
  }

  public loadSong(song: ParsedMidiSong) {
    this.stop();
    this.currentSong = song;
    this.originalTempoBpm = song.tempoBpm;
    this.userTempoBpm = song.tempoBpm;
    this.currentTimeMs = 0;
    this.loopStartMs = 0;
    this.loopEndMs = song.durationMs;

    this.trackStates.clear();
    song.tracks.forEach((t) => {
      // Auto-assign appropriate instrument if not already assigned
      let initialInst = t.assignedInstrument;
      if (!initialInst) {
        const isDrum = t.name.toLowerCase().includes('drum') || t.name.toLowerCase().includes('perc');
        initialInst = isDrum ? 'tabla' : this.primaryInstrument;
      }

      this.trackStates.set(t.index, {
        muted: t.muted,
        solo: t.solo,
        volume: t.volume,
        assignedInstrument: initialInst,
      });
    });

    this.notifyTick();
  }

  public getSong(): ParsedMidiSong | null {
    return this.currentSong;
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public getCurrentTime(): number {
    return this.currentTimeMs;
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.25, Math.min(2.0, rate));
  }

  public getTempoBpm(): number {
    return this.userTempoBpm;
  }

  public setTempoBpm(bpm: number) {
    this.userTempoBpm = Math.max(30, Math.min(300, Math.round(bpm)));
  }

  public setLoop(enabled: boolean, startMs?: number, endMs?: number) {
    this.isLooping = enabled;
    if (startMs !== undefined) this.loopStartMs = Math.max(0, startMs);
    if (endMs !== undefined && this.currentSong) {
      this.loopEndMs = Math.min(this.currentSong.durationMs, endMs);
    }
  }

  public getLoopInfo() {
    return {
      enabled: this.isLooping,
      startMs: this.loopStartMs,
      endMs: this.loopEndMs,
    };
  }

  public setTrackState(
    trackIndex: number,
    settings: Partial<TrackState>
  ) {
    const current = this.trackStates.get(trackIndex) || {
      muted: false,
      solo: false,
      volume: 1.0,
      assignedInstrument: this.primaryInstrument,
    };
    this.trackStates.set(trackIndex, { ...current, ...settings });
  }

  public getTrackState(trackIndex: number): TrackState {
    return (
      this.trackStates.get(trackIndex) || {
        muted: false,
        solo: false,
        volume: 1.0,
        assignedInstrument: this.primaryInstrument,
      }
    );
  }

  public async play() {
    if (!this.currentSong) return;

    await audioEngine.init();

    if (this.state === 'playing') return;

    this.state = 'playing';
    this.lastPerfTimestamp = performance.now();
    this.notifyStateChange();

    this.startLoop();
  }

  public pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.releaseActiveNotes();
    this.notifyStateChange();
    this.notifyTick();
  }

  public stop() {
    this.state = 'stopped';
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.currentTimeMs = 0;
    this.releaseActiveNotes();
    this.notifyStateChange();
    this.notifyTick();
  }

  public restart() {
    this.seek(this.isLooping ? this.loopStartMs : 0);
    this.play();
  }

  public seek(timeMs: number) {
    if (!this.currentSong) return;
    this.currentTimeMs = Math.max(0, Math.min(this.currentSong.durationMs, timeMs));
    this.lastPerfTimestamp = performance.now();

    // Stop currently sounding voices and re-trigger notes appropriate for new time
    this.releaseActiveNotes();
    this.notifyTick();
  }

  private startLoop() {
    const loop = (now: number) => {
      if (this.state !== 'playing' || !this.currentSong) return;

      const deltaMs = now - this.lastPerfTimestamp;
      this.lastPerfTimestamp = now;

      // Scale speed by playbackRate and user tempo adjustment
      const tempoRatio = this.userTempoBpm / this.originalTempoBpm;
      const effectiveAdvance = deltaMs * this.playbackRate * tempoRatio;

      this.currentTimeMs += effectiveAdvance;

      // Loop or song end check
      const endLimit =
        this.isLooping && this.loopEndMs > this.loopStartMs
          ? this.loopEndMs
          : this.currentSong.durationMs;

      if (this.currentTimeMs >= endLimit) {
        if (this.isLooping) {
          this.currentTimeMs = this.loopStartMs;
          this.releaseActiveNotes();
        } else {
          this.currentTimeMs = this.currentSong.durationMs;
          this.releaseActiveNotes();
          this.state = 'stopped';
          this.notifyStateChange();
          this.notifySongEnd();
          return;
        }
      }

      this.processAudioAndVisuals();
      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private processAudioAndVisuals() {
    if (!this.currentSong) return;

    const curTime = this.currentTimeMs;
    const activeNotes: MidiNoteEvent[] = [];

    // Check if any track is soloed
    let hasSolo = false;
    for (const [, state] of this.trackStates.entries()) {
      if (state.solo) {
        hasSolo = true;
        break;
      }
    }

    // Identify notes currently active at curTime
    const currentActiveKeys = new Set<string>();

    for (const note of this.currentSong.allNotes) {
      if (note.startTime <= curTime && note.endTime > curTime) {
        const trkState = this.trackStates.get(note.track);
        if (trkState) {
          if (hasSolo && !trkState.solo) continue;
          if (trkState.muted) continue;
        }

        activeNotes.push(note);
        const voiceKey = `midi_${note.id}`;
        currentActiveKeys.add(voiceKey);

        // If not already playing, trigger note on
        if (!this.activeVoiceKeys.has(voiceKey)) {
          this.activeVoiceKeys.add(voiceKey);
          const freq = midiToFrequency(note.note);
          const trkVol = trkState ? trkState.volume : 1.0;
          const vel = Math.max(0.1, Math.min(1.0, note.velocity * trkVol));

          // Calculate stereo pan based on note pitch (lower left, higher right)
          const pan = Math.max(-0.8, Math.min(0.8, ((note.note - 60) / 36) * 1.5));
          const effectiveInstrument =
            this.overrideInstrument !== 'original'
              ? this.overrideInstrument
              : (trkState && trkState.assignedInstrument) || this.primaryInstrument;

          audioEngine.triggerNoteOn(voiceKey, freq, vel, pan, effectiveInstrument);
          midiManager.sendNoteOn(note.note, vel);
        }
      }
    }

    // Release any voices that finished
    const voiceKeysSnapshot = Array.from(this.activeVoiceKeys);
    for (const key of voiceKeysSnapshot) {
      if (!currentActiveKeys.has(key)) {
        audioEngine.triggerNoteOff(key);
        this.activeVoiceKeys.delete(key);
      }
    }

    // Ghost touch point calculation
    let ghostTouch: GhostTouchPoint | null = null;
    if (activeNotes.length > 0) {
      // Pick prominent note (highest pitch or latest triggered)
      const leadNote = activeNotes[activeNotes.length - 1];
      // Map MIDI note (range 36 to 96) to horizontal normalized X (0 to 1)
      const normX = Math.max(0.05, Math.min(0.95, (leadNote.note - 36) / 60));
      // Y based on note position in octave or velocity
      const normY = 0.5 - (leadNote.velocity - 0.5) * 0.4;

      ghostTouch = {
        x: normX,
        y: normY,
        active: true,
        noteName: leadNote.noteName,
        midiNote: leadNote.note,
        velocity: leadNote.velocity,
        alpha: 0.9,
      };
    }

    // Notify subscribers with current high-res frame data
    for (const sub of this.subscribers) {
      sub.onTick(curTime, activeNotes, ghostTouch);
    }
  }

  private releaseActiveNotes() {
    for (const key of this.activeVoiceKeys) {
      audioEngine.triggerNoteOff(key);
    }
    this.activeVoiceKeys.clear();
    midiManager.allNotesOff();
  }

  public subscribe(sub: PlaybackEngineSubscriber): () => void {
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  private notifyStateChange() {
    for (const sub of this.subscribers) {
      sub.onStateChange(this.state);
    }
  }

  private notifyTick() {
    for (const sub of this.subscribers) {
      sub.onTick(this.currentTimeMs, [], null);
    }
  }

  private notifySongEnd() {
    for (const sub of this.subscribers) {
      sub.onSongEnd();
    }
  }
}

export const midiPlaybackEngine = MidiPlaybackEngine.getInstance();
