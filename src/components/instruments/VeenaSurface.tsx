import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentConfig, LearnStep, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { getSargamNote } from '../../instruments/instrumentRegistry';
import { midiToFrequency } from '../../utils/musicTheory';
import { InstrumentMidiConverter } from '../../midi/InstrumentMidiConverter';
import { midiLessonEngine } from '../../midi/MidiLessonEngine';
import { Sparkles, Target, Compass } from 'lucide-react';

interface VeenaSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
  currentLearnStep?: LearnStep | null;
  onUserNotePlayed?: (midi: number, vel: number, x: number, y: number) => void;
}

// 4 Main Melodic strings tuned to Mandra Sa, Mandra Pa, Madhya Sa, Madhya Pa (Carnatic tuning)
const VEENA_STRINGS = [
  { id: 0, name: 'Sarani', swara: 'Sa', baseMidi: 60, color: '#f59e0b', thickness: 1.6 }, // C4
  { id: 1, name: 'Panchama', swara: 'Pa', baseMidi: 55, color: '#fbbf24', thickness: 2.2 }, // G3
  { id: 2, name: 'Mandra', swara: 'Sa', baseMidi: 48, color: '#fde68a', thickness: 3.0 }, // C3
  { id: 3, name: 'Anumandra', swara: 'Pa', baseMidi: 43, color: '#d97706', thickness: 4.0 }, // G2
];

// 3 Tala / Drone Strings on side ledge
const TALA_STRINGS = [
  { id: 4, name: 'Tala 1', swara: 'Sa', midi: 60 },
  { id: 5, name: 'Tala 2', swara: 'Pa', midi: 55 },
  { id: 6, name: 'Tala 3', swara: 'Sa (H)', midi: 72 },
];

export const VeenaSurface: React.FC<VeenaSurfaceProps> = ({
  config,
  activeMidiNotes,
  currentLearnStep,
  onUserNotePlayed,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fretboardRef = useRef<HTMLDivElement>(null);

  const [activeFret, setActiveFret] = useState<number | null>(null);
  const [activeStringIndex, setActiveStringIndex] = useState<number | null>(null);
  const [vibratingStrings, setVibratingStrings] = useState<Record<number, number>>({});
  const [gamakaBend, setGamakaBend] = useState<number>(0);
  const [autoCenterNotice, setAutoCenterNotice] = useState<string | null>(null);
  const [autoCenterEnabled, setAutoCenterEnabled] = useState<boolean>(true);

  const touchTracking = useRef<Map<number, { stringId: number; startX: number; midi: number }>>(new Map());

  // 24 Frets on the Veena
  const fretCount = 24;

  // Compute target notes for interactive Learn Mode
  const stepTargets = useMemo(() => {
    if (!currentLearnStep || !currentLearnStep.expectedNotes) return [];
    return currentLearnStep.expectedNotes.map((n) =>
      InstrumentMidiConverter.mapNoteToInstrument(n.note, 'veena')
    );
  }, [currentLearnStep]);

  // Center the view on the chord / note whenever the step advances
  useEffect(() => {
    if (!currentLearnStep || !autoCenterEnabled || !scrollContainerRef.current) return;

    const centering = InstrumentMidiConverter.calculateStepCentering(currentLearnStep, 'veena');
    const container = scrollContainerRef.current;

    // Check if fretboard requires scrolling
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    if (scrollWidth > clientWidth) {
      // Calculate position of target center
      const targetPx = (centering.centerPercent / 100) * scrollWidth;
      const desiredScrollLeft = Math.max(0, targetPx - clientWidth / 2);

      container.scrollTo({
        left: desiredScrollLeft,
        behavior: 'smooth',
      });

      setAutoCenterNotice(centering.description);
      const timer = setTimeout(() => setAutoCenterNotice(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [currentLearnStep, autoCenterEnabled]);

  // React to incoming MIDI playback notes
  useEffect(() => {
    if (activeMidiNotes.length === 0) {
      setActiveStringIndex(null);
      setActiveFret(null);
      return;
    }

    const latestNote = activeMidiNotes[activeMidiNotes.length - 1];
    const mapping = InstrumentMidiConverter.mapNoteToInstrument(latestNote.note, 'veena');

    if (mapping.stringIndex !== undefined && mapping.fret !== undefined) {
      setActiveStringIndex(mapping.stringIndex);
      setActiveFret(mapping.fret);
      setVibratingStrings((prev) => ({
        ...prev,
        [mapping.stringIndex!]: Date.now(),
      }));
    }
  }, [activeMidiNotes]);

  const handlePointerDown = async (
    e: React.PointerEvent,
    stringIdx: number,
    fretIdx: number
  ) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    await audioEngine.init();

    const str = VEENA_STRINGS[stringIdx];
    const midiNote = str.baseMidi + fretIdx;
    const freq = midiToFrequency(midiNote);
    const voiceKey = `veena_p_${e.pointerId}`;

    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, (stringIdx - 1.5) * 0.25, 'veena');

    touchTracking.current.set(e.pointerId, {
      stringId: stringIdx,
      startX: e.clientX,
      midi: midiNote,
    });

    setActiveStringIndex(stringIdx);
    setActiveFret(fretIdx);
    setVibratingStrings((prev) => ({ ...prev, [stringIdx]: Date.now() }));

    // Notify Learn Mode and recording listeners
    if (onUserNotePlayed) {
      onUserNotePlayed(midiNote, 0.85, e.clientX, e.clientY);
    } else {
      midiLessonEngine.handleUserNote(midiNote, 0.85, e.clientX, e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const track = touchTracking.current.get(e.pointerId);
    if (!track) return;

    // Horizontal pull simulates Gamaka (lateral string pull/bend on the fret)
    const deltaX = e.clientX - track.startX;
    const semitoneBend = Math.max(-1.5, Math.min(2.5, deltaX / 50));
    setGamakaBend(semitoneBend);

    const voiceKey = `veena_p_${e.pointerId}`;
    const targetFreq = midiToFrequency(track.midi + semitoneBend);
    audioEngine.updateVoicePitch(voiceKey, targetFreq, 0.85, 0, 0.02);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    touchTracking.current.delete(e.pointerId);
    const voiceKey = `veena_p_${e.pointerId}`;
    audioEngine.triggerNoteOff(voiceKey);
    if (touchTracking.current.size === 0) {
      setGamakaBend(0);
      setActiveStringIndex(null);
      setActiveFret(null);
    }
  };

  const handleTalaPluck = async (e: React.MouseEvent, talaStr: (typeof TALA_STRINGS)[0]) => {
    e.preventDefault();
    await audioEngine.init();
    const voiceKey = `veena_tala_${talaStr.id}_${Date.now()}`;
    const freq = midiToFrequency(talaStr.midi);
    audioEngine.triggerNoteOn(voiceKey, freq, 0.88, 0.4, 'veena');
    setVibratingStrings((prev) => ({ ...prev, [talaStr.id]: Date.now() }));
    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
    }, 400);

    if (onUserNotePlayed) {
      onUserNotePlayed(talaStr.midi, 0.85, e.clientX, e.clientY);
    } else {
      midiLessonEngine.handleUserNote(talaStr.midi, 0.85, e.clientX, e.clientY);
    }
  };

  return (
    <div
      id="veena-surface"
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#110d0a] via-[#1a120b] to-[#0c0806] text-amber-100 overflow-hidden p-3 sm:p-5"
    >
      {/* Top Header info & Learn Mode Status */}
      <div className="flex items-center justify-between z-10 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md">
            🪕
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-amber-200 tracking-wide">
                Saraswati Veena Studio
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-serif border border-amber-500/30">
                सरस्वती वीणा
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              24 Brass Frets • Lateral Gamaka Glides • 4 Melody Strings • Kudam Resonance
            </p>
          </div>
        </div>

        {/* Learn Mode Auto-Center Pill & Gamaka Indicator */}
        <div className="flex items-center gap-2">
          {currentLearnStep && (
            <button
              onClick={() => setAutoCenterEnabled(!autoCenterEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all border ${
                autoCenterEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-white/[0.04] border-white/10 text-zinc-400'
              }`}
              title="Automatically center the view on the next fret or chord to click"
            >
              <Compass className={`w-3.5 h-3.5 ${autoCenterEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <span>{autoCenterEnabled ? 'Auto-Center: ON' : 'Auto-Center: OFF'}</span>
            </button>
          )}

          {autoCenterNotice && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-200 text-xs font-mono font-medium animate-pulse shadow-lg">
              <Target className="w-3.5 h-3.5 text-amber-300" />
              <span className="truncate max-w-[200px]">{autoCenterNotice}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/40 border border-amber-500/20 backdrop-blur-sm">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Gamaka</span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {gamakaBend > 0 ? `+${gamakaBend.toFixed(2)}` : gamakaBend.toFixed(2)} st
            </span>
          </div>
        </div>
      </div>

      {/* Main Scrollable Veena Body & Fretboard */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 my-2 flex items-center justify-start lg:justify-center overflow-x-auto overflow-y-hidden scroll-smooth pb-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#b45309 transparent' }}
      >
        <div
          ref={fretboardRef}
          className="relative w-full max-w-6xl min-w-[840px] h-72 rounded-3xl bg-gradient-to-r from-[#2b170c] via-[#3a2012] to-[#1e0f07] border-2 border-amber-900/60 shadow-2xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden"
        >
          {/* Wood grain patina texture & Kudam bowl hint */}
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-48 h-60 rounded-full bg-gradient-to-br from-amber-900/40 to-black/60 blur-xl pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l from-amber-950/80 to-transparent pointer-events-none" />

          {/* Frets Markers Row (Top Swara Labels) */}
          <div className="relative flex items-center justify-between pl-16 pr-6 h-6 border-b border-amber-500/10">
            {Array.from({ length: fretCount }).map((_, fIdx) => {
              const rootMidi = 60; // C4 Sa
              const swara = getSargamNote(rootMidi + fIdx);
              const isHighlight = activeFret === fIdx;
              const isStepTargetFret = stepTargets.some((t) => t.fret === fIdx);

              return (
                <div
                  key={fIdx}
                  className={`flex-1 text-center text-[10px] font-mono transition-all ${
                    isStepTargetFret
                      ? 'text-amber-300 font-bold scale-125 bg-amber-500/20 rounded-md py-0.5 shadow-sm'
                      : isHighlight
                      ? 'text-amber-300 font-bold scale-110'
                      : 'text-zinc-500'
                  }`}
                >
                  {isStepTargetFret ? `🎯 ${swara}` : fIdx % 2 === 0 ? swara : '•'}
                </div>
              );
            })}
          </div>

          {/* 4 Playing Strings on Wax Ledge */}
          <div className="relative flex-1 flex flex-col justify-around py-3 pl-16 pr-6">
            {/* 24 Brass Fret Bars across strings */}
            <div className="absolute inset-0 flex justify-between pointer-events-none pl-16 pr-6">
              {Array.from({ length: fretCount }).map((_, fIdx) => {
                const isStepFret = stepTargets.some((t) => t.fret === fIdx);
                const isActive = activeFret === fIdx;

                return (
                  <div
                    key={fIdx}
                    className={`w-[2px] h-full transition-all ${
                      isStepFret
                        ? 'bg-amber-300 shadow-[0_0_16px_#f59e0b] scale-x-150 z-20'
                        : isActive
                        ? 'bg-amber-300 shadow-[0_0_12px_#f59e0b]'
                        : 'bg-gradient-to-b from-amber-600/40 via-yellow-500/20 to-amber-700/40'
                    }`}
                  />
                );
              })}
            </div>

            {/* Render 4 strings */}
            {VEENA_STRINGS.map((str, sIdx) => {
              const isSounding = activeStringIndex === sIdx;
              const isVibrating =
                !!vibratingStrings[sIdx] && Date.now() - vibratingStrings[sIdx] < 800;

              return (
                <div
                  key={str.id}
                  className="relative flex items-center h-10 group cursor-pointer"
                  style={{ touchAction: 'none' }}
                >
                  {/* String Name & Swara Tag (Left Nut) */}
                  <div className="absolute -left-14 flex flex-col items-end w-12 text-right">
                    <span className="text-[11px] font-bold text-amber-300">{str.swara}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{str.name}</span>
                  </div>

                  {/* Physical String Wire */}
                  <div
                    className={`absolute left-0 right-0 rounded-full transition-all duration-75 ${
                      isSounding
                        ? 'bg-amber-300 shadow-[0_0_14px_#f59e0b]'
                        : 'bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 opacity-80'
                    } ${isVibrating ? 'animate-pulse' : ''}`}
                    style={{
                      height: `${str.thickness}px`,
                      transform: isVibrating ? 'scaleY(1.8)' : 'none',
                    }}
                  />

                  {/* Fret Touch Zones along this string */}
                  <div className="relative w-full h-full flex justify-between z-10">
                    {Array.from({ length: fretCount }).map((_, fIdx) => {
                      const isActivePoint =
                        activeStringIndex === sIdx && activeFret === fIdx;
                      const targetMatch = stepTargets.find(
                        (t) => t.stringIndex === sIdx && t.fret === fIdx
                      );

                      return (
                        <div
                          key={fIdx}
                          onPointerDown={(e) => handlePointerDown(e, sIdx, fIdx)}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                          className={`relative flex-1 h-full flex items-center justify-center transition-all ${
                            targetMatch
                              ? 'bg-amber-500/30 ring-2 ring-amber-400/80 rounded-lg cursor-pointer animate-pulse'
                              : isActivePoint
                              ? 'bg-amber-400/20'
                              : 'hover:bg-amber-500/10 active:bg-amber-400/30'
                          }`}
                          title={
                            targetMatch
                              ? `Click to Play: ${targetMatch.targetDescription}`
                              : undefined
                          }
                        >
                          {/* Active Note Sounding Visualizer */}
                          {isActivePoint && !targetMatch && (
                            <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_16px_#f59e0b] animate-ping opacity-75" />
                          )}

                          {/* INTERACTIVE LEARN MODE TARGET POINT */}
                          {targetMatch && (
                            <div className="relative flex flex-col items-center justify-center pointer-events-none z-30">
                              {/* Pulsing Target Halo */}
                              <div className="absolute w-8 h-8 rounded-full bg-amber-400/30 animate-ping" />
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border-2 border-white flex items-center justify-center text-[10px] font-bold font-mono text-zinc-950 shadow-[0_0_20px_#f59e0b] animate-bounce">
                                👆
                              </div>

                              {/* Target Note Badge (Floating Above) */}
                              <div className="absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/90 border border-amber-400/80 text-[10px] font-mono font-bold text-amber-300 shadow-md">
                                {targetMatch.sargam} ({targetMatch.noteName})
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Kudam Resonator & Tala Drones Row */}
          <div className="relative pt-2 border-t border-amber-500/10 flex items-center justify-between pl-16 pr-6 flex-wrap gap-2">
            <span className="text-[10px] text-zinc-400 font-mono">
              {currentLearnStep
                ? '👉 Click the glowing targets on the frets to play and learn the song'
                : 'Touch & Drag horizontally on frets to bend pitch (Gamaka)'}
            </span>

            {/* 3 Tala / Drone Strings on side bracket */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-amber-400/80 font-mono">
                Tala Strings:
              </span>
              {TALA_STRINGS.map((tala) => (
                <button
                  key={tala.id}
                  onClick={(e) => handleTalaPluck(e, tala)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs font-mono font-semibold transition-all active:scale-95 shadow-sm"
                >
                  {tala.swara}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
