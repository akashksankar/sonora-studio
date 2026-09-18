import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { midiManager } from '../midi/MidiManager';
import { midiLessonEngine } from '../midi/MidiLessonEngine';
import {
  ActivePointerVoice,
  AppMode,
  GhostTouchPoint,
  InstrumentConfig,
  LearnStep,
  MidiNoteEvent,
  ParsedMidiSong,
  PerformanceRecording,
  RecordedEvent,
  TouchTrail,
} from '../types';
import {
  getHarmonyNote,
  getScaleNotes,
  mapCoordinateToPitch,
} from '../utils/musicTheory';

interface TouchSurfaceProps {
  config: InstrumentConfig;
  isRecording: boolean;
  onRecordEvent: (event: RecordedEvent) => void;
  activeRecording: PerformanceRecording | null;
  replayTimeMs: number | null; // null if not replaying
  onPointerCountChange?: (count: number) => void;
  appMode?: AppMode;
  activeMidiSong?: ParsedMidiSong | null;
  activeMidiNotes?: MidiNoteEvent[];
  ghostTouch?: GhostTouchPoint | null;
  currentLearnStep?: LearnStep | null;
  isComparingOriginal?: boolean;
  userPerformanceEvents?: RecordedEvent[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

interface TouchPulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export const TouchSurface: React.FC<TouchSurfaceProps> = ({
  config,
  isRecording,
  onRecordEvent,
  activeRecording,
  replayTimeMs,
  onPointerCountChange,
  appMode = 'play',
  activeMidiSong,
  activeMidiNotes = [],
  ghostTouch = null,
  currentLearnStep = null,
  isComparingOriginal = false,
  userPerformanceEvents = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // High-frequency real-time refs (No React re-renders on touchmove!)
  const activeVoicesRef = useRef<Map<number, ActivePointerVoice>>(new Map());
  const trailsRef = useRef<Map<number, TouchTrail>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const pulsesRef = useRef<TouchPulse[]>([]);
  const configRef = useRef<InstrumentConfig>(config);
  const isRecordingRef = useRef<boolean>(isRecording);
  const onRecordEventRef = useRef(onRecordEvent);

  // Smooth interpolated ghost touch position
  const ghostTouchPosRef = useRef<{ x: number; y: number; alpha: number }>({
    x: 0.5,
    y: 0.5,
    alpha: 0,
  });

  // Keep refs up-to-date with current props
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    onRecordEventRef.current = onRecordEvent;
  }, [onRecordEvent]);

  // Handle ResizeObserver for responsive full-screen canvas
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    return () => ro.disconnect();
  }, []);

  // Main Canvas Rendering Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Time-domain and Frequency buffers for visualizer
    const timeBuffer = new Uint8Array(512);
    const freqBuffer = new Uint8Array(256);

    const render = () => {
      animId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      const currentConfig = configRef.current;
      const isLight = currentConfig.theme === 'light';
      const analyser = audioEngine.getAnalyser();

      // Clear with dark or light subtle fade for silky motion blur / trails
      ctx.fillStyle = isLight
        ? 'rgba(247, 247, 245, 0.42)'
        : 'rgba(7, 7, 9, 0.35)';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Subtle Note Grid / Pitch Guides
      if (currentConfig.showMusicGrid && !currentConfig.performanceMode) {
        drawNoteGrid(ctx, width, height, currentConfig, isLight);
      }

      // 2. Draw Audio Visualizer (Waveform, Spectrum, Orb, or Particles)
      if (analyser) {
        analyser.getByteTimeDomainData(timeBuffer);
        analyser.getByteFrequencyData(freqBuffer);

        const vizColor = isLight
          ? '#0284c7'
          : currentConfig.accentColor || '#38bdf8';

        if (currentConfig.visualizerMode === 'waveform') {
          drawWaveform(ctx, width, height, timeBuffer, vizColor, isLight);
        } else if (currentConfig.visualizerMode === 'spectrum') {
          drawSpectrum(ctx, width, height, freqBuffer, vizColor, isLight);
        } else if (currentConfig.visualizerMode === 'orb') {
          drawOrb(ctx, width, height, freqBuffer, timeBuffer, vizColor, isLight);
        } else if (currentConfig.visualizerMode === 'particles') {
          drawParticleField(ctx, width, height, freqBuffer, vizColor, isLight);
        }
      }

      // 3. Draw Pulses (expanding ripple on touch)
      for (let i = pulsesRef.current.length - 1; i >= 0; i--) {
        const pulse = pulsesRef.current[i];
        pulse.radius += (pulse.maxRadius - pulse.radius) * 0.12 + 1.2;
        pulse.alpha *= 0.91;

        if (pulse.alpha < 0.01 || pulse.radius >= pulse.maxRadius) {
          pulsesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(pulse.x * width, pulse.y * height, pulse.radius, 0, Math.PI * 2);
        ctx.strokeStyle = pulse.color;
        ctx.globalAlpha = isLight ? pulse.alpha * 0.7 : pulse.alpha;
        ctx.lineWidth = isLight ? 2 : 1.8;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // 4. Draw Particles (burst on touch and swift swipe)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.alpha *= 0.92;

        if (p.alpha < 0.02) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = isLight ? p.alpha * 0.8 : p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 5. Draw Touch Trails (Ink-style in light mode, luminous in dark mode)
      const now = performance.now();
      trailsRef.current.forEach((trail, ptrId) => {
        trail.points = trail.points.filter((pt) => now - pt.time < 750);

        if (trail.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(trail.points[0].x * width, trail.points[0].y * height);

          for (let i = 1; i < trail.points.length; i++) {
            const pt = trail.points[i];
            ctx.lineTo(pt.x * width, pt.y * height);
          }

          if (isLight) {
            ctx.strokeStyle = 'rgba(17, 24, 39, 0.75)';
            ctx.lineWidth = 3.0;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 4;
            ctx.globalAlpha = trail.active ? 0.9 : 0.4;
          } else {
            ctx.strokeStyle = trail.color;
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = trail.color;
            ctx.shadowBlur = 12;
            ctx.globalAlpha = trail.active ? 0.8 : 0.35;
          }

          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
        }

        if (!trail.active && trail.points.length === 0) {
          trailsRef.current.delete(ptrId);
        }
      });

      // 6. Draw Active Touch Indicators (Halo, Note Label, Frequency)
      activeVoicesRef.current.forEach((voice) => {
        const vx = voice.x * width;
        const vy = voice.y * height;

        if (isLight) {
          // Delicate ink halo in light mode
          ctx.beginPath();
          ctx.arc(vx, vy, 48, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(vx, vy, 24, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Core
          ctx.beginPath();
          ctx.arc(vx, vy, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Radial Glow in dark mode
          const grad = ctx.createRadialGradient(vx, vy, 4, vx, vy, 64);
          grad.addColorStop(0, voice.color);
          grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(vx, vy, 64, 0, Math.PI * 2);
          ctx.fill();

          // Inner solid core
          ctx.beginPath();
          ctx.arc(vx, vy, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = voice.color;
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Label above finger (Note name or Solfege)
        if (currentConfig.displayMode !== 'clean') {
          ctx.textAlign = 'center';
          ctx.font =
            '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isLight ? '#111111' : '#ffffff';

          let displayPrimary = voice.note.name;
          if (currentConfig.isDoReMiMode) {
            displayPrimary = `${voice.note.solfege} · ${voice.note.name}`;
          }

          ctx.fillText(displayPrimary, vx, vy - 24);

          // Frequency readout
          if (
            currentConfig.displayMode === 'frequencies' ||
            !currentConfig.performanceMode
          ) {
            ctx.font = '400 11px ui-monospace, SFMono-Regular, monospace';
            ctx.fillStyle = isLight
              ? 'rgba(0, 0, 0, 0.55)'
              : 'rgba(255, 255, 255, 0.65)';
            ctx.fillText(`${voice.frequency.toFixed(1)} Hz`, vx, vy - 10);
          }

          if (voice.harmonyNote) {
            ctx.font = '500 11px ui-monospace, SFMono-Regular, monospace';
            ctx.fillStyle = isLight
              ? 'rgba(2, 132, 199, 0.9)'
              : 'rgba(160, 210, 255, 0.85)';
            ctx.fillText(`+ ${voice.harmonyNote.name}`, vx, vy + 24);
          }
        }
      });

      // 7. Draw MIDI Playback Active Notes & Melody Path
      if (activeMidiNotes.length > 0) {
        drawMidiActiveNotes(ctx, width, height, activeMidiNotes, isLight);
      }

      // 8. Draw Ghost Hand / Ghost Touch (Virtual smooth performer)
      if (currentConfig.ghostHandEnabled && ghostTouch) {
        // Interpolate smooth movement towards target
        const currentG = ghostTouchPosRef.current;
        currentG.x += (ghostTouch.x - currentG.x) * 0.18;
        currentG.y += (ghostTouch.y - currentG.y) * 0.18;
        currentG.alpha += (ghostTouch.alpha - currentG.alpha) * 0.15;

        drawGhostHand(ctx, width, height, currentG, ghostTouch.noteName, isLight);
      }

      // 9. Draw Learn Mode Target Guidance
      if (appMode === 'learn' && currentLearnStep) {
        drawLearnTargets(ctx, width, height, currentLearnStep, isLight);
      }

      // 10. Draw Original vs User Performance Comparison Layers
      if (isComparingOriginal && userPerformanceEvents.length > 0) {
        drawPerformanceComparison(
          ctx,
          width,
          height,
          activeMidiSong,
          userPerformanceEvents,
          isLight
        );
      }

      // 11. Draw Replay Playhead and Historical Trails if Replaying manual recording
      if (replayTimeMs !== null && activeRecording) {
        drawReplayPlayback(ctx, width, height, activeRecording, replayTimeMs, isLight);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    replayTimeMs,
    activeRecording,
    activeMidiNotes,
    ghostTouch,
    currentLearnStep,
    appMode,
    isComparingOriginal,
    userPerformanceEvents,
    activeMidiSong,
  ]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    // Resume AudioContext on first touch
    audioEngine.resume();

    const rect = target.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const currentConfig = configRef.current;

    // Pitch mapping
    const { note, frequency } = mapCoordinateToPitch({
      normalizedX: nx,
      normalizedY: ny,
      rootKey: currentConfig.rootKey,
      scaleName: currentConfig.scale,
      baseOctave: currentConfig.baseOctave,
      octaveSpan: currentConfig.octaveSpan,
      isContinuousPitch: currentConfig.isContinuousPitch,
      isScaleLocked: currentConfig.isScaleLocked,
    });

    const velocity =
      e.pressure && e.pressure > 0
        ? Math.min(1, Math.max(0.4, e.pressure))
        : 0.82;
    const pan = nx * 2 - 1;

    // Trigger Voice in Audio Engine
    const voiceKey = `ptr_${e.pointerId}`;
    audioEngine.triggerNoteOn(voiceKey, frequency, velocity, pan);
    midiManager.sendNoteOn(note.midi, velocity);

    // If in Learn Mode, process user note evaluation
    if (appMode === 'learn') {
      midiLessonEngine.handleUserNote(note.midi, velocity, nx, ny);
    }

    // Harmony Handling
    let harmonyNote;
    let harmonyFreq;
    if (currentConfig.isTwoFingerHarmony) {
      harmonyNote = getHarmonyNote(
        note,
        currentConfig.harmonyInterval,
        currentConfig.rootKey
      );
      harmonyFreq = harmonyNote.frequency;
      audioEngine.triggerNoteOn(`${voiceKey}_harm`, harmonyFreq, velocity * 0.75, pan);
      midiManager.sendNoteOn(harmonyNote.midi, velocity * 0.75);
    }

    const voiceColor = currentConfig.accentColor || '#38bdf8';

    // Store active voice
    const activeVoice: ActivePointerVoice = {
      pointerId: e.pointerId,
      x: nx,
      y: ny,
      startX: nx,
      startY: ny,
      velocity: 0,
      pressure: velocity,
      lastTimestamp: performance.now(),
      note,
      frequency,
      harmonyFrequency: harmonyFreq,
      harmonyNote,
      color: voiceColor,
    };
    activeVoicesRef.current.set(e.pointerId, activeVoice);
    onPointerCountChange?.(activeVoicesRef.current.size);

    // Touch trail
    trailsRef.current.set(e.pointerId, {
      pointerId: e.pointerId,
      points: [{ x: nx, y: ny, time: performance.now(), intensity: velocity }],
      color: voiceColor,
      active: true,
      noteName: note.name,
      frequency,
    });

    // Visual Pulse Ripple
    pulsesRef.current.push({
      x: nx,
      y: ny,
      radius: 8,
      maxRadius: 65,
      alpha: 0.85,
      color: voiceColor,
    });

    // Particle Burst
    spawnParticles(nx, ny, 14, voiceColor, 2.5);

    // Recording event
    if (isRecordingRef.current) {
      onRecordEventRef.current({
        timestamp: 0,
        type: 'note_on',
        midiNote: note.midi,
        frequency,
        velocity,
        x: nx,
        y: ny,
        pointerId: e.pointerId,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const voice = activeVoicesRef.current.get(e.pointerId);
    if (!voice) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const now = performance.now();
    const dt = Math.max(1, now - voice.lastTimestamp);
    const dx = nx - voice.x;
    const dy = ny - voice.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = dist / (dt / 1000);

    voice.velocity = speed;
    voice.x = nx;
    voice.y = ny;
    voice.lastTimestamp = now;

    const currentConfig = configRef.current;

    // Recalculate pitch
    const { note, frequency } = mapCoordinateToPitch({
      normalizedX: nx,
      normalizedY: ny,
      rootKey: currentConfig.rootKey,
      scaleName: currentConfig.scale,
      baseOctave: currentConfig.baseOctave,
      octaveSpan: currentConfig.octaveSpan,
      isContinuousPitch: currentConfig.isContinuousPitch,
      isScaleLocked: currentConfig.isScaleLocked,
    });

    const pan = nx * 2 - 1;
    const voiceKey = `ptr_${e.pointerId}`;

    if (currentConfig.isContinuousPitch) {
      audioEngine.updateVoicePitch(voiceKey, frequency, 0.85, pan, 0.035);
      if (currentConfig.isTwoFingerHarmony && voice.harmonyFrequency) {
        const harmRatio = Math.pow(2, currentConfig.harmonyInterval / 12);
        audioEngine.updateVoicePitch(`${voiceKey}_harm`, frequency * harmRatio, 0.65, pan, 0.035);
      }
      const bend = Math.max(-1, Math.min(1, (frequency - voice.note.frequency) / 20));
      midiManager.sendPitchBend(bend);
    } else if (note.midi !== voice.note.midi) {
      midiManager.sendNoteOff(voice.note.midi);
      voice.note = note;
      voice.frequency = frequency;
      audioEngine.updateVoicePitch(voiceKey, frequency, 0.85, pan, 0.015);
      midiManager.sendNoteOn(note.midi, 0.85);

      if (currentConfig.isTwoFingerHarmony && voice.harmonyNote) {
        midiManager.sendNoteOff(voice.harmonyNote.midi);
        const newHarm = getHarmonyNote(
          note,
          currentConfig.harmonyInterval,
          currentConfig.rootKey
        );
        voice.harmonyNote = newHarm;
        voice.harmonyFrequency = newHarm.frequency;
        audioEngine.updateVoicePitch(`${voiceKey}_harm`, newHarm.frequency, 0.65, pan, 0.015);
        midiManager.sendNoteOn(newHarm.midi, 0.65);
      }

      if (appMode === 'learn') {
        midiLessonEngine.handleUserNote(note.midi, 0.85, nx, ny);
      }

      if (isRecordingRef.current) {
        onRecordEventRef.current({
          timestamp: 0,
          type: 'note_on',
          midiNote: note.midi,
          frequency,
          velocity: 0.85,
          x: nx,
          y: ny,
          pointerId: e.pointerId,
        });
      }
    }

    const modulationAmount = Math.min(1, (1 - ny) * 0.7 + Math.min(0.3, speed * 0.15));
    midiManager.sendCC(1, modulationAmount);

    const trail = trailsRef.current.get(e.pointerId);
    if (trail) {
      trail.points.push({ x: nx, y: ny, time: now, intensity: Math.min(1, speed) });
      trail.noteName = note.name;
      trail.frequency = frequency;
    }

    if (speed > 1.2 && Math.random() < 0.6) {
      spawnParticles(nx, ny, 2, voice.color, speed * 1.2);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const voice = activeVoicesRef.current.get(e.pointerId);
    if (voice) {
      const voiceKey = `ptr_${e.pointerId}`;
      audioEngine.triggerNoteOff(voiceKey);
      midiManager.sendNoteOff(voice.note.midi);

      if (voice.harmonyNote) {
        audioEngine.triggerNoteOff(`${voiceKey}_harm`);
        midiManager.sendNoteOff(voice.harmonyNote.midi);
      }

      if (isRecordingRef.current) {
        onRecordEventRef.current({
          timestamp: 0,
          type: 'note_off',
          midiNote: voice.note.midi,
          frequency: voice.frequency,
          velocity: 0,
          x: voice.x,
          y: voice.y,
          pointerId: e.pointerId,
        });
      }

      activeVoicesRef.current.delete(e.pointerId);
      onPointerCountChange?.(activeVoicesRef.current.size);
    }

    const trail = trailsRef.current.get(e.pointerId);
    if (trail) {
      trail.active = false;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handlePointerCancel = handlePointerUp;

  const spawnParticles = (
    nx: number,
    ny: number,
    count: number,
    color: string,
    speedMultiplier: number = 1
  ) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.001 + Math.random() * 0.003) * speedMultiplier;
      particlesRef.current.push({
        x: nx,
        y: ny,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.9,
        size: 1.5 + Math.random() * 2.5,
        color,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      id="touchpad-surface"
      className="relative w-full h-full flex-1 overflow-hidden select-none touch-none cursor-crosshair bg-transparent"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        id="touchpad-canvas"
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};

// Canvas Sub-renderers

function drawNoteGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: InstrumentConfig,
  isLight: boolean
) {
  const scaleNotes = getScaleNotes(
    config.rootKey,
    config.scale,
    config.baseOctave,
    config.octaveSpan
  );
  const count = scaleNotes.length;
  if (count <= 1) return;

  ctx.lineWidth = 1;
  ctx.textAlign = 'center';

  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * width;
    const note = scaleNotes[i];
    const isRoot = note.name.startsWith(config.rootKey);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    if (isLight) {
      ctx.strokeStyle = isRoot ? 'rgba(0, 0, 0, 0.14)' : 'rgba(0, 0, 0, 0.04)';
    } else {
      ctx.strokeStyle = isRoot ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.035)';
    }
    ctx.stroke();

    const label = config.isDoReMiMode ? note.solfege : note.name;
    ctx.font = isRoot
      ? '600 12px -apple-system, BlinkMacSystemFont, sans-serif'
      : '400 10px ui-monospace, SFMono-Regular, monospace';

    if (isLight) {
      ctx.fillStyle = isRoot ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.28)';
    } else {
      ctx.fillStyle = isRoot ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.22)';
    }
    ctx.fillText(label, x, height - 28);
  }

  for (let yStep = 1; yStep <= 3; yStep++) {
    const y = (yStep / 4) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.025)';
    ctx.stroke();
  }
}

function drawMidiActiveNotes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  notes: MidiNoteEvent[],
  isLight: boolean
) {
  // Map notes across horizontal space (MIDI 36 to 96)
  const coords = notes.map((n) => {
    const nx = Math.max(0.06, Math.min(0.94, (n.note - 36) / 60));
    const ny = 0.5 - (n.velocity - 0.5) * 0.45;
    return { x: nx * width, y: ny * height, note: n };
  });

  // Connect sequential active notes with melody trajectory line
  if (coords.length > 1) {
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw active pulse & note heads
  coords.forEach(({ x, y, note }) => {
    const radius = 16;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.2)' : 'rgba(56, 189, 248, 0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#0284c7' : '#ffffff';
    ctx.shadowColor = isLight ? 'rgba(2, 132, 199, 0.5)' : '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.font = '600 12px monospace';
    ctx.fillStyle = isLight ? '#111111' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(note.noteName, x, y - 16);
  });
}

function drawGhostHand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ghostPos: { x: number; y: number; alpha: number },
  noteName: string,
  isLight: boolean
) {
  const gx = ghostPos.x * width;
  const gy = ghostPos.y * height;
  const alpha = Math.max(0, Math.min(1, ghostPos.alpha));

  ctx.save();
  ctx.globalAlpha = alpha;

  // Luminous outer aura
  const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, 48);
  grad.addColorStop(0, isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(168, 85, 247, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(gx, gy, 48, 0, Math.PI * 2);
  ctx.fill();

  // Ghost Diamond/Cross indicator (✦)
  ctx.strokeStyle = isLight ? '#7c3aed' : '#c084fc';
  ctx.lineWidth = 1.8;
  const size = 12;
  ctx.beginPath();
  ctx.moveTo(gx, gy - size);
  ctx.lineTo(gx + size, gy);
  ctx.lineTo(gx, gy + size);
  ctx.lineTo(gx - size, gy);
  ctx.closePath();
  ctx.stroke();

  // Core dot
  ctx.beginPath();
  ctx.arc(gx, gy, 4, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? '#7c3aed' : '#ffffff';
  ctx.fill();

  // Subtle label
  ctx.font = '500 10px monospace';
  ctx.fillStyle = isLight ? '#6d28d9' : '#e9d5ff';
  ctx.textAlign = 'center';
  ctx.fillText(`GHOST: ${noteName}`, gx, gy + 22);

  ctx.restore();
}

function drawLearnTargets(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step: LearnStep,
  isLight: boolean
) {
  const time = performance.now() * 0.004;
  const pulseRadius = 18 + Math.sin(time) * 4;

  step.expectedNotes.forEach((n) => {
    const nx = Math.max(0.06, Math.min(0.94, (n.note - 36) / 60));
    const ny = 0.5 - (n.velocity - 0.5) * 0.45;
    const tx = nx * width;
    const ty = ny * height;

    // Target pulsing ring
    ctx.beginPath();
    ctx.arc(tx, ty, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Target center crosshair
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.fill();

    // Note name pill
    ctx.font = '700 12px monospace';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(n.noteName, tx, ty - 22);
  });
}

function drawPerformanceComparison(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  song: ParsedMidiSong | null | undefined,
  userEvents: RecordedEvent[],
  isLight: boolean
) {
  if (!song) return;

  // Layer 1: Original Song Notes trajectory (Violet)
  ctx.beginPath();
  song.allNotes.slice(0, 60).forEach((n, idx) => {
    const nx = Math.max(0.06, Math.min(0.94, (n.note - 36) / 60));
    const ny = 0.5 - (n.velocity - 0.5) * 0.45;
    const x = nx * width;
    const y = ny * height;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = isLight ? 'rgba(124, 58, 237, 0.4)' : 'rgba(168, 85, 247, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Layer 2: User Performance trajectory (Emerald / Sky)
  ctx.beginPath();
  userEvents.slice(0, 60).forEach((ev, idx) => {
    const x = ev.x * width;
    const y = ev.y * height;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = isLight ? 'rgba(16, 185, 129, 0.65)' : 'rgba(52, 211, 153, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  buffer: Uint8Array,
  color: string,
  isLight: boolean
) {
  ctx.beginPath();
  const sliceWidth = width / buffer.length;
  let x = 0;
  const centerY = height * 0.5;

  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i] / 128.0;
    const y = centerY + (v - 1.0) * (height * 0.28);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }

  ctx.strokeStyle = color;
  ctx.globalAlpha = isLight ? 0.45 : 0.35;
  ctx.lineWidth = 1.6;
  if (!isLight) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freqBuffer: Uint8Array,
  color: string,
  isLight: boolean
) {
  const bars = 48;
  const barWidth = width / bars;
  const step = Math.floor(freqBuffer.length / bars);

  ctx.fillStyle = color;
  ctx.globalAlpha = isLight ? 0.3 : 0.22;

  for (let i = 0; i < bars; i++) {
    const val = freqBuffer[i * step] / 255;
    const barHeight = val * (height * 0.4);
    const x = i * barWidth;
    const y = height - barHeight;

    ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
  }

  ctx.globalAlpha = 1.0;
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freqBuffer: Uint8Array,
  timeBuffer: Uint8Array,
  color: string,
  isLight: boolean
) {
  let sum = 0;
  for (let i = 0; i < 32; i++) {
    sum += freqBuffer[i];
  }
  const avg = sum / (32 * 255);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const baseRadius = Math.min(width, height) * 0.12;
  const radius = baseRadius + avg * (baseRadius * 0.85);

  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * 1.5);
  grad.addColorStop(0, isLight ? 'rgba(2, 132, 199, 0.3)' : '#ffffff');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.globalAlpha = isLight ? 0.3 + avg * 0.3 : 0.35 + avg * 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function drawParticleField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freqBuffer: Uint8Array,
  color: string,
  isLight: boolean
) {
  let energy = 0;
  for (let i = 0; i < 16; i++) {
    energy += freqBuffer[i];
  }
  const factor = energy / (16 * 255);

  if (factor > 0.05) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = isLight ? factor * 0.5 : factor * 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.5, factor * (width * 0.35), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }
}

function drawReplayPlayback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  recording: PerformanceRecording,
  replayTimeMs: number,
  isLight: boolean
) {
  const events = recording.events.filter((e) => e.type === 'note_on');
  if (events.length === 0) return;

  ctx.beginPath();
  events.forEach((ev, idx) => {
    const x = ev.x * width;
    const y = ev.y * height;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const activeEv = events.find((e) => Math.abs(e.timestamp - replayTimeMs) < 120);
  if (activeEv) {
    const px = activeEv.x * width;
    const py = activeEv.y * height;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    if (!isLight) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 20;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
