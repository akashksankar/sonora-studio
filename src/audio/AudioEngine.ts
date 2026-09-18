import { AudioEngineSettings, InstrumentId, WaveformType } from '../types';
import { tanpuraDroneEngine } from './TanpuraDroneEngine';
import { authenticSampleBank, AuthenticSampleVoice } from './AuthenticSampleBank';

interface VoiceInstance {
  osc?: OscillatorNode;
  sampleVoice?: AuthenticSampleVoice;
  filter?: BiquadFilterNode;
  gain: GainNode;
  panner: StereoPannerNode;
  startTime: number;
  released: boolean;
  extraOscs?: OscillatorNode[];
  extraNodes?: AudioNode[];
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Master bus nodes
  private dcBlocker: BiquadFilterNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterLimiterNode: WaveShaperNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Effects nodes
  private delayNode: DelayNode | null = null;
  private delayDampingFilter: BiquadFilterNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayDryGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;

  private convolverNode: ConvolverNode | null = null;
  private reverbDryGain: GainNode | null = null;
  private reverbWetGain: GainNode | null = null;

  private distortionNode: WaveShaperNode | null = null;

  // Active voices keyed by pointerId or voice key
  private voices: Map<string, VoiceInstance> = new Map();

  // Current engine configuration
  private settings: AudioEngineSettings = {
    masterVolume: 0.8,
    waveform: 'sine',
    attack: 0.02,
    decay: 0.15,
    sustain: 0.8,
    release: 0.35,
    filterCutoff: 10000,
    filterResonance: 1.0,
    reverbMix: 0.25,
    reverbDecay: 1.8,
    delayTime: 0.25,
    delayFeedback: 0.3,
    delayMix: 0.15,
    distortion: 0,
  };

  /**
   * Initializes the AudioContext upon user gesture
   */
  public async init(): Promise<boolean> {
    if (this.isInitialized && this.ctx && this.ctx.state === 'running') {
      return true;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.buildGraph();
      this.isInitialized = true;
      if (this.ctx) {
        authenticSampleBank.preload(['sitar', 'veena', 'bansuri', 'santoor', 'violin', 'concert_grand'], this.ctx);
      }
      return true;
    } catch (e) {
      console.warn('AudioContext initialization failed:', e);
      return false;
    }
  }

  /**
   * Ensure AudioContext is running before playing a sound
   */
  public async resume(): Promise<void> {
    if (!this.ctx) {
      await this.init();
      return;
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  public getEffectsInput(): AudioNode | null {
    return this.dcBlocker;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Constructs the master audio graph with high headroom, de-clicking,
   * smooth reverb, lowpass tape delay, and soft limiter.
   */
  private buildGraph(): void {
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. DC Blocker Highpass (removes sub-audible offsets that cause speaker pops)
    this.dcBlocker = this.ctx.createBiquadFilter();
    this.dcBlocker.type = 'highpass';
    this.dcBlocker.frequency.setValueAtTime(20, t);
    this.dcBlocker.Q.setValueAtTime(0.707, t);

    // Connect Tanpura Drone engine to the master processing bus
    tanpuraDroneEngine.setContext(this.ctx, this.dcBlocker);

    // 2. Master Global Tone Filter
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.setValueAtTime(this.settings.filterCutoff, t);
    this.masterFilter.Q.setValueAtTime(this.settings.filterResonance, t);

    // 3. Distortion / Saturation Node
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.makeDistortionCurve(this.settings.distortion);
    this.distortionNode.oversample = 'none';

    // 4. Delay Network with lowpass damping filter in feedback loop
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.settings.delayTime, t);

    this.delayDampingFilter = this.ctx.createBiquadFilter();
    this.delayDampingFilter.type = 'lowpass';
    this.delayDampingFilter.frequency.setValueAtTime(3200, t);
    this.delayDampingFilter.Q.setValueAtTime(0.707, t);

    this.delayFeedbackGain = this.ctx.createGain();
    const safeFeedback = Math.min(0.75, this.settings.delayFeedback);
    this.delayFeedbackGain.gain.setValueAtTime(safeFeedback, t);

    this.delayDryGain = this.ctx.createGain();
    this.delayWetGain = this.ctx.createGain();
    this.updateDelayMix(this.settings.delayMix);

    // Wire delay loop: delayNode -> damping -> feedback -> delayNode
    this.delayNode.connect(this.delayDampingFilter);
    this.delayDampingFilter.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);

    // 5. Reverb Network with Normalized Algorithmic Impulse Response
    this.convolverNode = this.ctx.createConvolver();
    this.rebuildReverbImpulse(this.settings.reverbDecay);

    this.reverbDryGain = this.ctx.createGain();
    this.reverbWetGain = this.ctx.createGain();
    this.updateReverbMix(this.settings.reverbMix);

    this.convolverNode.connect(this.reverbWetGain);

    // 6. Master Bus: Post-effects sum -> MasterGain -> Compressor -> Soft Limiter -> Analyser -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.settings.masterVolume, t);

    // Master Compressor (Smooth, transparent dynamics leveler)
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-10, t);
    this.masterCompressor.knee.setValueAtTime(12, t);
    this.masterCompressor.ratio.setValueAtTime(4.5, t);
    this.masterCompressor.attack.setValueAtTime(0.005, t);
    this.masterCompressor.release.setValueAtTime(0.18, t);

    // Master Soft Limiter (Musical tanh saturation to completely eliminate hard clipping cracks)
    this.masterLimiterNode = this.ctx.createWaveShaper();
    this.masterLimiterNode.curve = this.makeMasterLimiterCurve();
    this.masterLimiterNode.oversample = 'none';

    // Analyser Node for Real-time Visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    // --- Audio Graph Wiring ---
    // Voices -> dcBlocker -> masterFilter -> distortionNode
    this.dcBlocker.connect(this.masterFilter);
    this.masterFilter.connect(this.distortionNode);

    // Distortion output splits to Delay (dry + send)
    this.distortionNode.connect(this.delayDryGain);
    this.distortionNode.connect(this.delayNode);

    // Delay sum goes to Reverb (dry + send)
    const postDelaySum = this.ctx.createGain();
    this.delayDryGain.connect(postDelaySum);
    this.delayWetGain.connect(postDelaySum);

    postDelaySum.connect(this.reverbDryGain);
    postDelaySum.connect(this.convolverNode);

    // Reverb sum goes to Master Gain
    const postReverbSum = this.ctx.createGain();
    this.reverbDryGain.connect(postReverbSum);
    this.reverbWetGain.connect(postReverbSum);

    postReverbSum.connect(this.masterGain);

    // Master Gain -> Compressor -> Soft Limiter -> Analyser -> Output
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiterNode);
    this.masterLimiterNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  /**
   * Generates a smooth, normalized algorithmic impulse response.
   * Crucially normalizes total energy so the convolved wet signal NEVER
   * clips, explodes in volume, or creates speaker crackling.
   */
  private rebuildReverbImpulse(decayTime: number): void {
    if (!this.ctx || !this.convolverNode) return;
    const rate = this.ctx.sampleRate;
    const safeDecay = Math.max(0.2, Math.min(3.5, decayTime));
    const length = Math.max(1, Math.floor(rate * safeDecay));
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    // Soft 8ms initial fade-in eliminates attack clicks
    const attackSamples = Math.floor(rate * 0.008);
    let sumAbs = 0;

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * (safeDecay / 4.0)));
      const attack = i < attackSamples ? i / attackSamples : 1;
      const env = attack * decay;

      const l = (Math.random() * 2 - 1) * env;
      const r = (Math.random() * 2 - 1) * env;

      left[i] = l;
      right[i] = r;
      sumAbs += (Math.abs(l) + Math.abs(r)) * 0.5;
    }

    // Bound maximum gain of convolution to ~0.70 to guarantee zero digital clipping
    const normFactor = sumAbs > 0 ? 0.70 / sumAbs : 1.0;
    for (let i = 0; i < length; i++) {
      left[i] *= normFactor;
      right[i] *= normFactor;
    }

    this.convolverNode.buffer = impulse;
  }

  /**
   * Master soft-limiting curve using algebraic saturation.
   * Completely transparent at normal levels and rounds peaks smoothly without clipping.
   */
  private makeMasterLimiterCurve(): Float32Array {
    const nSamples = 2048;
    const curve = new Float32Array(nSamples);
    for (let i = 0; i < nSamples; i++) {
      const x = (i * 2) / (nSamples - 1) - 1;
      // f(x) = x / (1 + |x|^3)^(1/3)
      curve[i] = x / Math.pow(1 + Math.pow(Math.abs(x), 3), 1 / 3);
    }
    return curve;
  }

  /**
   * Smooth musical saturation curve (normalized tanh).
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const nSamples = 2048;
    const curve = new Float32Array(nSamples);
    if (amount <= 0.001) {
      for (let i = 0; i < nSamples; i++) {
        curve[i] = (i * 2) / (nSamples - 1) - 1;
      }
      return curve;
    }
    const drive = 1 + amount * 6;
    const norm = Math.tanh(drive);
    for (let i = 0; i < nSamples; i++) {
      const x = (i * 2) / (nSamples - 1) - 1;
      curve[i] = Math.tanh(x * drive) / norm;
    }
    return curve;
  }

  private updateDelayMix(mix: number): void {
    if (!this.ctx || !this.delayDryGain || !this.delayWetGain) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, mix));
    this.delayDryGain.gain.setTargetAtTime(1 - clamped * 0.4, t, 0.02);
    this.delayWetGain.gain.setTargetAtTime(clamped * 0.65, t, 0.02);
  }

  private updateReverbMix(mix: number): void {
    if (!this.ctx || !this.reverbDryGain || !this.reverbWetGain) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, mix));
    this.reverbDryGain.gain.setTargetAtTime(1 - clamped * 0.35, t, 0.02);
    this.reverbWetGain.gain.setTargetAtTime(clamped * 0.65, t, 0.02);
  }

  /**
   * Smoothly fades out and stops a voice without clicks or state conflicts.
   */
  private fadeAndStopVoice(voice: VoiceInstance): void {
    if (!this.ctx || voice.released) return;
    voice.released = true;

    if (voice.sampleVoice) {
      voice.sampleVoice.stop(0.04);
      return;
    }

    const t = this.ctx.currentTime;

    // Smooth de-clicking exponential fade to zero
    voice.gain.gain.setTargetAtTime(0, t, 0.012);

    const stopTime = t + 0.06;
    try {
      voice.osc.stop(stopTime);
      if (voice.extraOscs) {
        voice.extraOscs.forEach((o) => {
          try {
            o.stop(stopTime);
          } catch {
            // Already stopped
          }
        });
      }
    } catch {
      // Already stopped
    }

    setTimeout(() => {
      try {
        voice.osc.disconnect();
        if (voice.extraOscs) {
          voice.extraOscs.forEach((o) => {
            try {
              o.disconnect();
            } catch {
              // Disconnected
            }
          });
        }
        if (voice.extraNodes) {
          voice.extraNodes.forEach((n) => {
            try {
              n.disconnect();
            } catch {
              // Disconnected
            }
          });
        }
        voice.filter.disconnect();
        voice.gain.disconnect();
        voice.panner.disconnect();
      } catch {
        // Already disconnected
      }
    }, 85);
  }

  /**
   * Trigger note-on for a pointer or voice key with pristine headroom and smooth ramp.
   * Supports specialized synthesis modeling per InstrumentId.
   */
  public triggerNoteOn(
    voiceKey: string,
    frequency: number,
    velocity: number = 0.8,
    pan: number = 0,
    instrumentId?: InstrumentId
  ): void {
    if (!this.ctx || !this.dcBlocker) return;

    // If existing voice with this key is active, safely detach and fade it out
    const existingVoice = this.voices.get(voiceKey);
    if (existingVoice) {
      this.voices.delete(voiceKey);
      this.fadeAndStopVoice(existingVoice);
    }

    const t = this.ctx.currentTime;
    const safeFreq = Math.max(20, Math.min(18000, frequency));
    const nyquist = (this.ctx.sampleRate / 2) * 0.88;
    const extraOscs: OscillatorNode[] = [];
    const extraNodes: AudioNode[] = [];

    // Gain Envelope node
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);

    // Primary Voice Filter
    const voiceFilter = this.ctx.createBiquadFilter();
    voiceFilter.type = 'lowpass';
    voiceFilter.Q.setValueAtTime(0.707, t);

    // Primary Oscillator
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(safeFreq, t);

    // Stereo Panner
    const panner = this.ctx.createStereoPanner();
    const clampedPan = Math.max(-1, Math.min(1, pan));
    panner.pan.setValueAtTime(clampedPan, t);

    // Default envelope parameters
    let nominalGain = 0.30;
    let attackTime = Math.max(0.006, this.settings.attack);
    let decayDuration = Math.max(0.02, this.settings.decay);
    let sustainRatio = this.settings.sustain;
    let cutoffBase = Math.max(120, Math.min(nyquist, safeFreq * (2.5 + velocity * 3.5)));

    // Apply specialized sound synthesis by instrument type
    const inst = instrumentId || 'touchpad';

    // Trigger authentic soundfont playback if ready
    if (this.ctx && this.dcBlocker) {
      if (authenticSampleBank.isReady(inst)) {
        const sampleVoice = authenticSampleBank.playSample(
          this.ctx,
          inst,
          safeFreq,
          velocity,
          clampedPan,
          this.dcBlocker
        );
        if (sampleVoice) {
          this.voices.set(voiceKey, {
            sampleVoice,
            gain: sampleVoice.gainNode,
            panner: (sampleVoice.pannerNode || panner) as StereoPannerNode,
            startTime: t,
            released: false,
          });
          return;
        }
      } else {
        // Trigger non-blocking load so next plucks use authentic sample
        authenticSampleBank.loadInstrument(inst, this.ctx).catch(() => {});
      }
    }

    if (inst === 'bansuri') {
      // Cylindrical bamboo pipe: soft breath attack, pure sine + octave overtone, subtle vibrato
      osc.type = 'sine';
      nominalGain = 0.32;
      attackTime = 0.038;
      decayDuration = 0.18;
      sustainRatio = 0.85;
      cutoffBase = Math.min(nyquist, 3600);

      // Octave harmonic overtone
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(safeFreq * 2, t);
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.24, t);
      osc2.connect(gain2);
      gain2.connect(voiceFilter);
      osc2.start(t);
      extraOscs.push(osc2);
      extraNodes.push(gain2);

      // Subtle breath vibrato LFO (5.2Hz)
      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.setValueAtTime(5.2, t);
      const vibratoGain = this.ctx.createGain();
      vibratoGain.gain.setValueAtTime(0, t);
      vibratoGain.gain.linearRampToValueAtTime(safeFreq * 0.012, t + 0.15); // gentle delayed vibrato
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibratoGain.connect(osc2.frequency);
      vibrato.start(t);
      extraOscs.push(vibrato);
      extraNodes.push(vibratoGain);
    } else if (inst === 'sitar') {
      // Sitar: Sharp mizrab pluck, bright sawtooth, jawari overtone buzz resonance
      osc.type = 'sawtooth';
      nominalGain = 0.28;
      attackTime = 0.006;
      decayDuration = 0.70;
      sustainRatio = 0.45;

      // Resonant Jawari bandpass peak
      const jawari = this.ctx.createBiquadFilter();
      jawari.type = 'bandpass';
      jawari.frequency.setValueAtTime(Math.min(nyquist, Math.max(1600, safeFreq * 3.2)), t);
      jawari.Q.setValueAtTime(2.6, t);
      voiceFilter.frequency.setValueAtTime(Math.min(nyquist, safeFreq * 5.5), t);

      // Wire: osc -> jawari -> voiceFilter
      osc.connect(jawari);
      jawari.connect(voiceFilter);
      extraNodes.push(jawari);
    } else if (inst === 'veena') {
      // Veena: Saraswati Veena with warm woody body resonance, sustained singing pluck
      osc.type = 'triangle';
      nominalGain = 0.32;
      attackTime = 0.012;
      decayDuration = 0.85;
      sustainRatio = 0.60;
      cutoffBase = Math.min(nyquist, safeFreq * 3.8 + 600);

      // Warm saw under-layer for brass fret buzz
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(safeFreq, t);
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.20, t);
      osc2.connect(gain2);
      gain2.connect(voiceFilter);
      osc2.start(t);
      extraOscs.push(osc2);
      extraNodes.push(gain2);
    } else if (inst === 'santoor') {
      // Santoor: 100-string hammered zither. Fast mallet attack, detuned unison pair for multi-string ring
      osc.type = 'triangle';
      nominalGain = 0.30;
      attackTime = 0.004;
      decayDuration = 0.75;
      sustainRatio = 0.35;
      cutoffBase = Math.min(nyquist, safeFreq * 4.5);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(safeFreq * 1.0025, t); // micro detune course
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.25, t);
      osc2.connect(gain2);
      gain2.connect(voiceFilter);
      osc2.start(t);
      extraOscs.push(osc2);
      extraNodes.push(gain2);
    } else if (inst === 'tabla') {
      // Dual-nature Indian drums
      nominalGain = 0.35;
      if (safeFreq >= 190) {
        // Dayan (Treble bell ring): Tuned sine fundamental + 2.14x Bessel membrane harmonic
        osc.type = 'sine';
        attackTime = 0.003;
        decayDuration = 0.28;
        sustainRatio = 0.01; // ringing decay, near-zero sustain

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(safeFreq * 2.14, t);
        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.35, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc2.connect(gain2);
        gain2.connect(voiceFilter);
        osc2.start(t);
        extraOscs.push(osc2);
        extraNodes.push(gain2);
      } else {
        // Bayan (Bass drum with pitch bend "Ge" stroke)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(safeFreq * 1.38, t);
        osc.frequency.exponentialRampToValueAtTime(safeFreq, t + 0.08); // pitch bend down
        attackTime = 0.005;
        decayDuration = 0.38;
        sustainRatio = 0.12;
      }
    } else if (inst === 'mridangam') {
      // Mridangam: Jackwood dual barrel drum
      nominalGain = 0.34;
      osc.type = 'sine';
      attackTime = 0.004;
      decayDuration = 0.25;
      sustainRatio = 0.05;
      if (safeFreq >= 180) {
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(safeFreq * 2.3, t);
        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.3, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc2.connect(gain2);
        gain2.connect(voiceFilter);
        osc2.start(t);
        extraOscs.push(osc2);
        extraNodes.push(gain2);
      }
    } else if (inst === 'ghatam') {
      // Ghatam: Baked clay pot Helmholtz resonator
      osc.type = 'sine';
      nominalGain = 0.34;
      attackTime = 0.003;
      decayDuration = 0.19;
      sustainRatio = 0.02;
      voiceFilter.type = 'bandpass';
      voiceFilter.Q.setValueAtTime(3.8, t);
      cutoffBase = safeFreq;
    } else if (inst === 'violin' || inst === 'cello') {
      // Bowed string: Sawtooth with wooden body formant filter & expressive natural vibrato
      osc.type = 'sawtooth';
      nominalGain = 0.28;
      attackTime = inst === 'cello' ? 0.045 : 0.035;
      decayDuration = 0.12;
      sustainRatio = 0.90;
      cutoffBase = Math.min(nyquist, safeFreq * 2.8 + (inst === 'cello' ? 400 : 800));

      // 5.5Hz vibrato
      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.setValueAtTime(5.5, t);
      const vibratoGain = this.ctx.createGain();
      vibratoGain.gain.setValueAtTime(0, t);
      vibratoGain.gain.linearRampToValueAtTime(safeFreq * 0.014, t + 0.12);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(t);
      extraOscs.push(vibrato);
      extraNodes.push(vibratoGain);
    } else if (inst === 'acoustic_guitar') {
      // Plucked steel string with acoustic body resonance
      osc.type = 'triangle';
      nominalGain = 0.30;
      attackTime = 0.008;
      decayDuration = 0.65;
      sustainRatio = 0.35;
      cutoffBase = Math.min(nyquist, safeFreq * 3.5 + 400);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(safeFreq, t);
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.22, t);
      osc2.connect(gain2);
      gain2.connect(voiceFilter);
      osc2.start(t);
      extraOscs.push(osc2);
      extraNodes.push(gain2);
    } else if (inst === 'electric_guitar') {
      // Driven electric guitar with pickup bite
      osc.type = 'sawtooth';
      nominalGain = 0.27;
      attackTime = 0.006;
      decayDuration = 0.80;
      sustainRatio = 0.70;
      cutoffBase = Math.min(nyquist, safeFreq * 2.5 + 1200);
    } else if (inst === 'harp') {
      // Concert Harp: Crystalline plucked string with bell-like decay
      osc.type = 'triangle';
      nominalGain = 0.30;
      attackTime = 0.005;
      decayDuration = 1.15;
      sustainRatio = 0.20;
      cutoffBase = Math.min(nyquist, safeFreq * 3.8);
    } else if (inst === 'electric_piano') {
      // Rhodes-style bell tine FM: fundamental sine + 7th harmonic bell attack
      osc.type = 'sine';
      nominalGain = 0.30;
      attackTime = 0.008;
      decayDuration = 0.75;
      sustainRatio = 0.55;
      cutoffBase = Math.min(nyquist, safeFreq * 3.0 + 800);

      const tineOsc = this.ctx.createOscillator();
      tineOsc.type = 'sine';
      tineOsc.frequency.setValueAtTime(safeFreq * 7, t);
      const tineGain = this.ctx.createGain();
      tineGain.gain.setValueAtTime(0.28 * velocity, t);
      tineGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09); // rapid tine bell ping
      tineOsc.connect(tineGain);
      tineGain.connect(voiceFilter);
      tineOsc.start(t);
      extraOscs.push(tineOsc);
      extraNodes.push(tineGain);
    } else if (inst === 'soft_piano') {
      // Cinematic felt piano: warm, intimate, dark filter
      osc.type = 'triangle';
      nominalGain = 0.32;
      attackTime = 0.020;
      decayDuration = 1.10;
      sustainRatio = 0.40;
      cutoffBase = Math.min(nyquist, 1300 + velocity * 1200);
    } else if (inst === 'synth_piano') {
      // Cyberpunk synth keys: saw + square with fast filter sweep
      osc.type = 'sawtooth';
      nominalGain = 0.26;
      attackTime = 0.006;
      decayDuration = 0.45;
      sustainRatio = 0.55;
      voiceFilter.Q.setValueAtTime(2.4, t);
      cutoffBase = Math.min(nyquist, safeFreq * 4.5 + velocity * 3000);
      voiceFilter.frequency.setValueAtTime(cutoffBase * 1.5, t);
      voiceFilter.frequency.exponentialRampToValueAtTime(Math.max(150, cutoffBase * 0.4), t + 0.35);
    } else if (
      inst === 'concert_grand' ||
      inst === 'studio_piano' ||
      inst === 'upright_piano' ||
      inst === 'vintage_piano' ||
      inst === 'grand_piano'
    ) {
      // Multi-harmonic acoustic piano
      osc.type = 'triangle';
      nominalGain = 0.30;
      attackTime = 0.007;
      decayDuration = 0.95;
      sustainRatio = 0.48;
      cutoffBase = Math.min(nyquist, safeFreq * 2.4 + velocity * 4200);

      // Secondary detuned string for acoustic unison warmth
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      const detuneFactor = inst === 'vintage_piano' ? 1.004 : 1.0012;
      osc2.frequency.setValueAtTime(safeFreq * detuneFactor, t);
      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.20, t);
      osc2.connect(gain2);
      gain2.connect(voiceFilter);
      osc2.start(t);
      extraOscs.push(osc2);
      extraNodes.push(gain2);
    } else {
      // Default TouchPad waveform synthesis
      osc.type = this.settings.waveform;
      nominalGain = 0.30;
      attackTime = Math.max(0.006, this.settings.attack);
      decayDuration = Math.max(0.02, this.settings.decay);
      sustainRatio = this.settings.sustain;
      cutoffBase = Math.max(120, Math.min(nyquist, safeFreq * (2.5 + velocity * 3.5)));
    }

    voiceFilter.frequency.setValueAtTime(cutoffBase, t);

    // Envelope calculations
    const targetGain = Math.max(0.04, Math.min(1, velocity)) * nominalGain;
    const attackEnd = t + attackTime;

    // Linear ramp from true 0 prevents step clicks
    gain.gain.linearRampToValueAtTime(targetGain, attackEnd);

    // Decay to sustain level with smooth exponential ramp
    const decayEnd = attackEnd + decayDuration;
    const sustainGain = Math.max(0.001, targetGain * sustainRatio);
    gain.gain.exponentialRampToValueAtTime(sustainGain, decayEnd);

    // Connect primary osc if not wired through special filter
    if (extraNodes.length === 0 || inst !== 'sitar') {
      osc.connect(voiceFilter);
    }
    voiceFilter.connect(gain);
    gain.connect(panner);
    panner.connect(this.dcBlocker);

    osc.start(t);

    this.voices.set(voiceKey, {
      osc,
      filter: voiceFilter,
      gain,
      panner,
      startTime: t,
      released: false,
      extraOscs: extraOscs.length > 0 ? extraOscs : undefined,
      extraNodes: extraNodes.length > 0 ? extraNodes : undefined,
    });
  }

  /**
   * Update continuous pitch / modulation for an active voice with anti-zipper smoothing.
   */
  public updateVoicePitch(
    voiceKey: string,
    frequency: number,
    velocity: number = 0.8,
    pan: number = 0,
    glideTime: number = 0.035
  ): void {
    const voice = this.voices.get(voiceKey);
    if (!voice || !this.ctx || voice.released) return;

    const t = this.ctx.currentTime;
    const safeFreq = Math.max(20, Math.min(18000, frequency));
    const clampedPan = Math.max(-1, Math.min(1, pan));

    if (voice.sampleVoice) {
      voice.sampleVoice.setFrequency(safeFreq);
      if (voice.sampleVoice.pannerNode) {
        voice.sampleVoice.pannerNode.pan.setTargetAtTime(clampedPan, t, 0.02);
      }
      return;
    }

    // Smooth frequency glide with minimum 12ms curve to eliminate zipper noise
    if (voice.osc) {
      voice.osc.frequency.setTargetAtTime(safeFreq, t, Math.max(0.012, glideTime));
    }

    // Dynamic brightness response safely bounded below Nyquist
    const nyquist = (this.ctx.sampleRate / 2) * 0.88;
    const cutoff = Math.max(100, Math.min(nyquist, safeFreq * (2.5 + velocity * 3.5)));
    if (voice.filter) {
      voice.filter.frequency.setTargetAtTime(cutoff, t, 0.025);
    }

    // Pan update
    if (voice.panner) {
      voice.panner.pan.setTargetAtTime(clampedPan, t, 0.02);
    }
  }

  /**
   * Trigger note-off release envelope with zero click or pop.
   */
  public triggerNoteOff(voiceKey: string): void {
    const voice = this.voices.get(voiceKey);
    if (!voice || !this.ctx || voice.released) return;

    voice.released = true;
    this.voices.delete(voiceKey);

    const releaseTime = Math.max(0.02, this.settings.release);

    if (voice.sampleVoice) {
      voice.sampleVoice.stop(releaseTime);
      return;
    }

    const t = this.ctx.currentTime;
    const timeConstant = Math.max(0.008, releaseTime / 3.5);

    // Smooth exponential release from instantaneous audio-thread level to 0
    voice.gain.gain.setTargetAtTime(0, t, timeConstant);

    const stopTime = t + releaseTime + 0.08;
    try {
      if (voice.osc) {
        voice.osc.stop(stopTime);
      }
    } catch {
      // Already stopped
    }

    setTimeout(() => {
      try {
        if (voice.osc) voice.osc.disconnect();
        if (voice.filter) voice.filter.disconnect();
        voice.gain.disconnect();
        if (voice.panner) voice.panner.disconnect();
      } catch {
        // Already disconnected
      }
    }, (releaseTime + 0.12) * 1000);
  }

  /**
   * Play a clean, silky chime tone for startup / confirmation.
   */
  public playConfirmationChime(): void {
    if (!this.ctx) return;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      setTimeout(() => {
        const key = `chime_${idx}`;
        this.triggerNoteOn(key, freq, 0.35, (idx - 1.5) * 0.3);
        setTimeout(() => this.triggerNoteOff(key), 280);
      }, idx * 75);
    });
  }

  /**
   * Update audio parameters in real time with smooth parameter interpolation.
   */
  public updateSettings(partial: Partial<AudioEngineSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (partial.masterVolume !== undefined && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(partial.masterVolume, t, 0.02);
    }
    if (partial.waveform !== undefined) {
      this.voices.forEach((voice) => {
        if (!voice.released) {
          voice.osc.type = partial.waveform!;
        }
      });
    }
    if (partial.filterCutoff !== undefined && this.masterFilter) {
      this.masterFilter.frequency.setTargetAtTime(partial.filterCutoff, t, 0.02);
    }
    if (partial.filterResonance !== undefined && this.masterFilter) {
      this.masterFilter.Q.setTargetAtTime(partial.filterResonance, t, 0.02);
    }
    if (partial.delayTime !== undefined && this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(partial.delayTime, t, 0.04);
    }
    if (partial.delayFeedback !== undefined && this.delayFeedbackGain) {
      const safeFeedback = Math.min(0.75, partial.delayFeedback);
      this.delayFeedbackGain.gain.setTargetAtTime(safeFeedback, t, 0.02);
    }
    if (partial.delayMix !== undefined) {
      this.updateDelayMix(partial.delayMix);
    }
    if (partial.reverbMix !== undefined) {
      this.updateReverbMix(partial.reverbMix);
    }
    if (partial.reverbDecay !== undefined) {
      this.rebuildReverbImpulse(partial.reverbDecay);
    }
    if (partial.distortion !== undefined && this.distortionNode) {
      this.distortionNode.curve = this.makeDistortionCurve(partial.distortion);
    }
  }

  public getSettings(): AudioEngineSettings {
    return { ...this.settings };
  }

  public setWaveform(type: WaveformType): void {
    this.updateSettings({ waveform: type });
  }

  /**
   * Release all currently active voices smoothly.
   */
  public releaseAllVoices(): void {
    const keys = Array.from(this.voices.keys());
    keys.forEach((key) => {
      this.triggerNoteOff(key);
    });
  }
}

// Singleton export
export const audioEngine = new AudioEngine();
