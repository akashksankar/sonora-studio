import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentConfig, InstrumentId, LearnStep, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { midiToFrequency, NOTE_NAMES } from '../../utils/musicTheory';
import { getSargamNote } from '../../instruments/instrumentRegistry';
import { InstrumentMidiConverter } from '../../midi/InstrumentMidiConverter';
import { midiLessonEngine } from '../../midi/MidiLessonEngine';
import { ChevronLeft, ChevronRight, Compass, Target } from 'lucide-react';

interface PianoSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
  pianoId?: InstrumentId;
  currentLearnStep?: LearnStep | null;
  onUserNotePlayed?: (midi: number, vel: number, x: number, y: number) => void;
}

export const PianoSurface: React.FC<PianoSurfaceProps> = ({
  config,
  activeMidiNotes,
  pianoId = 'concert_grand',
  currentLearnStep,
  onUserNotePlayed,
}) => {
  const [startOctave, setStartOctave] = useState<number>(3); // C3 = 48
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [showSwara, setShowSwara] = useState<boolean>(false);
  const [autoCenterNotice, setAutoCenterNotice] = useState<string | null>(null);
  const [autoCenterEnabled, setAutoCenterEnabled] = useState<boolean>(true);

  const activeVoicesRef = useRef<Map<number, string>>(new Map());

  const numKeys = 36; // 3 full octaves
  const startMidi = startOctave * 12 + 12; // C(startOctave)
  const endMidi = startMidi + numKeys - 1;

  // Determine target notes for the current step in Learn Mode
  const stepTargetMidis = useMemo(() => {
    if (!currentLearnStep || !currentLearnStep.expectedNotes) return new Set<number>();
    return new Set<number>(currentLearnStep.expectedNotes.map((n) => n.note));
  }, [currentLearnStep]);

  // Auto-center keyboard view to make sure chords outside current octave range are centered
  useEffect(() => {
    if (!currentLearnStep || !autoCenterEnabled || currentLearnStep.expectedNotes.length === 0) return;

    const notes = currentLearnStep.expectedNotes.map((n) => n.note);
    const minNote = Math.min(...notes);
    const maxNote = Math.max(...notes);

    // If chord notes are outside or near the edges of [startMidi, endMidi]
    if (minNote < startMidi || maxNote > endMidi) {
      const avgNote = (minNote + maxNote) / 2;
      // Center the octave view so avgNote is in the middle octave (octave 2 of 3)
      const targetOctave = Math.max(1, Math.min(5, Math.floor((avgNote - 24) / 12)));
      if (targetOctave !== startOctave) {
        setStartOctave(targetOctave);
        const chordDesc = currentLearnStep.isChord
          ? `${currentLearnStep.chordName || 'Chord'} (${notes.map((n) => NOTE_NAMES[n % 12]).join(' ')})`
          : `${NOTE_NAMES[notes[0] % 12]}${Math.floor(notes[0] / 12) - 1}`;
        setAutoCenterNotice(`Centered: ${chordDesc}`);
        const timer = setTimeout(() => setAutoCenterNotice(null), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [currentLearnStep, autoCenterEnabled, startMidi, endMidi, startOctave]);

  // Update active keys from activeMidiNotes
  useEffect(() => {
    const currentNotes = new Set<number>();
    activeMidiNotes.forEach((n) => currentNotes.add(n.note));
    setActiveKeys(currentNotes);
  }, [activeMidiNotes]);

  // Determine if a semitone is black key
  const isBlackKey = (midi: number) => {
    const noteInOct = midi % 12;
    return [1, 3, 6, 8, 10].includes(noteInOct);
  };

  const handleKeyDown = async (e: React.PointerEvent, midi: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    await audioEngine.init();

    const voiceKey = `piano_${midi}_${Date.now()}`;
    activeVoicesRef.current.set(midi, voiceKey);

    const freq = midiToFrequency(midi);
    const pan = Math.max(-0.6, Math.min(0.6, ((midi - 60) / 24) * 0.8));

    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, pan, pianoId as InstrumentId);
    setActiveKeys((prev) => new Set(prev).add(midi));

    if (onUserNotePlayed) {
      onUserNotePlayed(midi, 0.85, e.clientX, e.clientY);
    } else {
      midiLessonEngine.handleUserNote(midi, 0.85, e.clientX, e.clientY);
    }
  };

  const handleKeyUp = (midi: number) => {
    const voiceKey = activeVoicesRef.current.get(midi);
    if (voiceKey) {
      audioEngine.triggerNoteOff(voiceKey);
      activeVoicesRef.current.delete(midi);
    }
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  };

  // Group keys for clean rendering
  const keysArray = Array.from({ length: numKeys }, (_, i) => startMidi + i);
  const whiteKeys = keysArray.filter((m) => !isBlackKey(m));

  // Piano model title
  const pianoTitles: Record<string, { title: string; desc: string }> = {
    concert_grand: { title: 'Concert Grand Piano', desc: 'Steinway D-274 9-foot Acoustic Grand' },
    studio_piano: { title: 'Studio Piano', desc: 'Yamaha C7 Bright Modern Production Grand' },
    upright_piano: { title: 'Upright Piano', desc: 'Felt-damped Intimate Living Room Upright' },
    electric_piano: { title: 'Electric Piano', desc: 'Fender Rhodes Stage Vintage Tines & Bell Glow' },
    soft_piano: { title: 'Soft Piano', desc: 'Cinematic Muted Felt Layers & Warm Resonance' },
    vintage_piano: { title: 'Vintage Piano', desc: 'Warm 1970s Honky-Tonk Tape Coloration' },
    synth_piano: { title: 'Synth Piano', desc: 'Lush 80s FM Stereo Digital Hybrid' },
  };

  const currentInfo = pianoTitles[pianoId] || pianoTitles.concert_grand;

  return (
    <div
      id="piano-surface"
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#0e0f14] via-[#141620] to-[#0a0b0e] text-zinc-100 overflow-hidden p-3 sm:p-5"
    >
      {/* Top Header & Controls */}
      <div className="flex items-center justify-between z-10 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-xl shadow-md">
            🎹
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
              {currentInfo.title}
            </h3>
            <p className="text-[11px] text-zinc-400 hidden sm:block">{currentInfo.desc}</p>
          </div>
        </div>

        {/* Controls: Auto-Center, Swara toggle, Octave shift */}
        <div className="flex items-center gap-2">
          {currentLearnStep && (
            <button
              onClick={() => setAutoCenterEnabled(!autoCenterEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all border ${
                autoCenterEnabled
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-sm'
                  : 'bg-white/[0.04] border-white/10 text-zinc-400'
              }`}
              title="Auto-shift octaves to center chords outside screen"
            >
              <Compass className={`w-3.5 h-3.5 ${autoCenterEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <span>{autoCenterEnabled ? 'Auto-Center: ON' : 'Auto-Center: OFF'}</span>
            </button>
          )}

          {autoCenterNotice && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/25 border border-sky-500/50 text-sky-200 text-xs font-mono font-medium animate-pulse shadow-lg">
              <Target className="w-3.5 h-3.5 text-sky-300" />
              <span className="truncate max-w-[200px]">{autoCenterNotice}</span>
            </div>
          )}

          {/* Swara Toggle */}
          <button
            onClick={() => setShowSwara(!showSwara)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
              showSwara
                ? 'bg-amber-500 text-zinc-950 border-amber-400'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
            }`}
          >
            {showSwara ? 'Sargam (Sa Re)' : 'Western (C D)'}
          </button>

          {/* Octave Shifter */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setStartOctave((o) => Math.max(1, o - 1))}
              className="p-1 rounded hover:bg-white/10 text-zinc-300 disabled:opacity-30"
              disabled={startOctave <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono px-1.5 text-zinc-300">
              Oct {startOctave}-{startOctave + 2}
            </span>
            <button
              onClick={() => setStartOctave((o) => Math.min(5, o + 1))}
              className="p-1 rounded hover:bg-white/10 text-zinc-300 disabled:opacity-30"
              disabled={startOctave >= 5}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Piano Keyboard */}
      <div className="relative flex-1 my-2 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        <div className="relative w-full max-w-5xl min-w-[760px] h-72 rounded-3xl bg-[#090a0e] border-2 border-white/10 shadow-2xl p-4 flex flex-col justify-end overflow-hidden">
          {/* Piano Fallboard Felt Liner */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-red-800 shadow-inner border-b border-red-950" />

          {/* Keys container */}
          <div className="relative w-full h-60 flex select-none">
            {/* White Keys */}
            <div className="relative w-full h-full flex">
              {whiteKeys.map((midi) => {
                const isActive = activeKeys.has(midi);
                const isStepTarget = stepTargetMidis.has(midi);
                const noteName = NOTE_NAMES[midi % 12];
                const swara = getSargamNote(midi);

                return (
                  <button
                    key={midi}
                    id={`piano-key-${midi}`}
                    onPointerDown={(e) => handleKeyDown(e, midi)}
                    onPointerUp={() => handleKeyUp(midi)}
                    onPointerLeave={() => handleKeyUp(midi)}
                    className={`relative flex-1 h-full rounded-b-lg border-r border-b border-zinc-400/30 transition-all flex flex-col justify-end pb-3 items-center ${
                      isStepTarget
                        ? 'bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400 text-zinc-950 ring-2 ring-amber-500 shadow-[0_0_16px_#f59e0b] scale-[0.99] z-10'
                        : isActive
                        ? 'bg-gradient-to-b from-sky-200 via-sky-300 to-sky-400 text-zinc-950 shadow-inner scale-[0.99] translate-y-1'
                        : 'bg-gradient-to-b from-zinc-100 via-white to-zinc-200 text-zinc-800 hover:from-white hover:to-zinc-100'
                    }`}
                  >
                    {isStepTarget && (
                      <div className="absolute top-4 w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-md animate-bounce">
                        👆
                      </div>
                    )}
                    <span className={`text-[11px] font-mono font-bold ${isStepTarget ? 'text-zinc-950' : ''}`}>
                      {showSwara ? swara : noteName}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {Math.floor(midi / 12) - 1}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Black Keys */}
            <div className="absolute inset-0 flex pointer-events-none">
              {whiteKeys.map((wMidi, idx) => {
                const blackMidi = wMidi + 1;
                const hasBlack = isBlackKey(blackMidi) && idx < whiteKeys.length - 1;
                const isStepTarget = stepTargetMidis.has(blackMidi);

                return (
                  <div key={wMidi} className="relative flex-1 h-full">
                    {hasBlack && (
                      <button
                        id={`piano-key-${blackMidi}`}
                        onPointerDown={(e) => handleKeyDown(e, blackMidi)}
                        onPointerUp={() => handleKeyUp(blackMidi)}
                        onPointerLeave={() => handleKeyUp(blackMidi)}
                        className={`pointer-events-auto absolute -right-[28%] top-0 w-[56%] h-[62%] rounded-b-md z-20 transition-all flex flex-col justify-end pb-2 items-center border border-black/80 ${
                          isStepTarget
                            ? 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 ring-2 ring-amber-300 shadow-[0_0_18px_#f59e0b] scale-[1.02]'
                            : activeKeys.has(blackMidi)
                            ? 'bg-gradient-to-b from-sky-400 via-sky-500 to-sky-600 shadow-[0_0_16px_#38bdf8] translate-y-0.5'
                            : 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-black shadow-lg hover:from-zinc-700 hover:to-zinc-900'
                        }`}
                      >
                        {isStepTarget && (
                          <div className="absolute top-2 w-5 h-5 rounded-full bg-white text-zinc-950 font-bold text-[10px] flex items-center justify-center shadow-md animate-bounce">
                            👆
                          </div>
                        )}
                        <span className="text-[9px] font-mono font-semibold text-zinc-300">
                          {showSwara ? getSargamNote(blackMidi) : NOTE_NAMES[blackMidi % 12]}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-400 font-mono">
        {currentLearnStep
          ? '👉 Click the highlighted keys to play the step and advance the lesson'
          : 'Playable via Touch, Click, or MIDI Keyboard'}
      </div>
    </div>
  );
};
