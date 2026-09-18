import { RootKey } from '../types';
import { midiToFrequency, NOTE_NAMES } from '../utils/musicTheory';
import { audioEngine } from './AudioEngine';
import { authenticSampleBank } from './AuthenticSampleBank';

type FirstStringTuning = 'pa' | 'ma' | 'ni';
type DroneListener = (isRunning: boolean, activeString: number) => void;

export class TanpuraDroneEngine {
  private static instance: TanpuraDroneEngine | null = null;
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private rootKey: RootKey = 'C';
  private firstStringTuning: FirstStringTuning = 'pa';
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private timerId: number | null = null;
  private stringIndex: number = 0;
  private pluckIntervalMs: number = 1100;
  private listeners: Set<DroneListener> = new Set();

  private constructor() {}

  public static getInstance(): TanpuraDroneEngine {
    if (!TanpuraDroneEngine.instance) {
      TanpuraDroneEngine.instance = new TanpuraDroneEngine();
    }
    return TanpuraDroneEngine.instance;
  }

  public subscribe(listener: DroneListener): () => void {
    this.listeners.add(listener);
    listener(this.isRunning, this.stringIndex);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.isRunning, this.stringIndex));
  }

  private ensureAudioContext(): boolean {
    if (!this.ctx) {
      this.ctx = audioEngine.getContext();
    }
    if (!this.ctx) return false;

    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      const masterNode = audioEngine.getMasterGain();
      if (masterNode) {
        this.masterGain.connect(masterNode);
      } else {
        this.masterGain.connect(this.ctx.destination);
      }
    }
    return true;
  }

  public setContext(ctx: AudioContext, destinationNode?: AudioNode) {
    this.ctx = ctx;
    if (this.ctx) {
      if (!this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      }
      if (destinationNode) {
        this.masterGain.disconnect();
        this.masterGain.connect(destinationNode);
      }
    }
  }

  public setRootKey(key: RootKey) {
    this.rootKey = key;
  }

  public getRootKey(): RootKey {
    return this.rootKey;
  }

  public setFirstStringTuning(tuning: FirstStringTuning) {
    this.firstStringTuning = tuning;
  }

  public getFirstStringTuning(): FirstStringTuning {
    return this.firstStringTuning;
  }

  public setTempo(intervalMs: number) {
    this.pluckIntervalMs = Math.max(500, Math.min(2500, intervalMs));
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public async start(key?: RootKey) {
    if (key) this.rootKey = key;
    await audioEngine.init();
    if (!this.ensureAudioContext()) return;

    if (this.isRunning) return;
    this.isRunning = true;
    this.stringIndex = 0;
    this.notify();
    this.scheduleNextPluck();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.notify();
  }

  public pluckString(strIdx: number) {
    if (!this.ensureAudioContext()) return;
    this.pluckSpecificString(strIdx);
    this.stringIndex = strIdx;
    this.notify();
  }

  private getRootFrequency(): number {
    // Octave 3 base
    const keyIndex = NOTE_NAMES.indexOf(this.rootKey);
    const midiC3 = 48;
    const midiRoot = midiC3 + (keyIndex >= 0 ? keyIndex : 0);
    return midiToFrequency(midiRoot);
  }

  private scheduleNextPluck() {
    if (!this.isRunning) return;

    this.pluckSpecificString(this.stringIndex);
    this.notify();
    this.stringIndex = (this.stringIndex + 1) % 4;

    this.timerId = window.setTimeout(() => {
      this.scheduleNextPluck();
    }, this.pluckIntervalMs);
  }

  private pluckSpecificString(strIdx: number) {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const baseFreq = this.getRootFrequency();

    let freqRatio = 1.0;
    let brightness = 2600;
    let decayDuration = 4.2;

    switch (strIdx) {
      case 0:
        // First string: Pa (1.4983), Ma (1.3348), or Ni (1.8877)
        if (this.firstStringTuning === 'ma') {
          freqRatio = 1.3348; // Shuddha Ma (4th)
        } else if (this.firstStringTuning === 'ni') {
          freqRatio = 0.9438; // Shuddha Ni in lower octave
        } else {
          freqRatio = 1.4983; // Pa (5th)
        }
        brightness = 2800;
        decayDuration = 4.0;
        break;
      case 1:
      case 2:
        // Madhya Sa (Tonic)
        freqRatio = 1.0;
        brightness = 2500;
        decayDuration = 4.5;
        break;
      case 3:
        // Kharaj Sa (Deep octave base)
        freqRatio = 0.5;
        brightness = 2200;
        decayDuration = 5.2;
        break;
    }

    const stringFreq = baseFreq * freqRatio;

    // Rich dual-oscillator with microtonal unison beating
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(stringFreq, t);
    osc2.frequency.setValueAtTime(stringFreq * 1.002, t);

    // Jawari buzzing overtone filter (acoustic thread on flat bridge)
    const jawariFilter = this.ctx.createBiquadFilter();
    jawariFilter.type = 'bandpass';
    jawariFilter.frequency.setValueAtTime(stringFreq * 3.5, t);
    jawariFilter.Q.setValueAtTime(2.4, t);

    jawariFilter.frequency.linearRampToValueAtTime(stringFreq * 4.8, t + 0.35);
    jawariFilter.frequency.exponentialRampToValueAtTime(
      Math.max(20, stringFreq * 2.0),
      t + decayDuration
    );

    // Body resonance cavity
    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(brightness, t);
    bodyFilter.Q.setValueAtTime(1.2, t);

    // Amplitude envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(0.22, t + 0.035);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decayDuration);

    // Stereo panning
    const panner = this.ctx.createStereoPanner();
    const pans = [-0.35, -0.1, 0.1, 0.35];
    panner.pan.setValueAtTime(pans[strIdx] ?? 0, t);

    const mixer = this.ctx.createGain();
    mixer.gain.setValueAtTime(0.5, t);
    osc1.connect(mixer);
    osc2.connect(mixer);

    mixer.connect(jawariFilter);
    jawariFilter.connect(bodyFilter);
    mixer.connect(bodyFilter);

    bodyFilter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.masterGain);

    // If authentic acoustic sample is ready, layer authentic wooden string resonance
    if (authenticSampleBank.isReady('sitar') && this.masterGain) {
      const sampleVoice = authenticSampleBank.playSample(
        this.ctx,
        'sitar',
        stringFreq,
        0.35,
        pans[strIdx] ?? 0,
        this.masterGain
      );
      if (sampleVoice) {
        setTimeout(() => {
          sampleVoice.stop(1.2);
        }, (decayDuration - 1.2) * 1000);
      }
    }

    osc1.start(t);
    osc2.start(t);

    const stopTime = t + decayDuration + 0.1;
    osc1.stop(stopTime);
    osc2.stop(stopTime);

    setTimeout(() => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        mixer.disconnect();
        jawariFilter.disconnect();
        bodyFilter.disconnect();
        gainNode.disconnect();
        panner.disconnect();
      } catch {
        // Disconnected
      }
    }, (decayDuration + 0.2) * 1000);
  }
}

export const tanpuraDroneEngine = TanpuraDroneEngine.getInstance();
