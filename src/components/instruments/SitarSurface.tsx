import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InstrumentConfig, LearnStep, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { getSargamNote } from '../../instruments/instrumentRegistry';
import { midiToFrequency } from '../../utils/musicTheory';
import { InstrumentMidiConverter } from '../../midi/InstrumentMidiConverter';
import { midiLessonEngine } from '../../midi/MidiLessonEngine';
import { Target, Compass } from 'lucide-react';

interface SitarSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
  currentLearnStep?: LearnStep | null;
  onUserNotePlayed?: (midi: number, vel: number, x: number, y: number) => void;
}

const SITAR_STRINGS = [
  { id: 0, name: 'Baj Tar (Main)', swara: 'Ma', baseMidi: 53, color: '#ea580c', thickness: 2.2 }, // F3
  { id: 1, name: 'Jor (Tonic)', swara: 'Sa', baseMidi: 48, color: '#f97316', thickness: 2.8 }, // C3
  { id: 2, name: 'Laraj (Octave)', swara: 'Pa', baseMidi: 43, color: '#fb923c', thickness: 3.5 }, // G2
  { id: 3, name: 'Kharaj (Bass)', swara: 'Sa', baseMidi: 36, color: '#c2410c', thickness: 4.2 }, // C2
];

const CHIKARI_STRINGS = [
  { id: 4, name: 'Chikari 1', swara: 'Sa', midi: 60 },
  { id: 5, name: 'Chikari 2', swara: 'Sa (H)', midi: 72 },
  { id: 6, name: 'Pancham', swara: 'Pa', midi: 67 },
];

export const SitarSurface: React.FC<SitarSurfaceProps> = ({
  config,
  activeMidiNotes,
  currentLearnStep,
  onUserNotePlayed,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeFret, setActiveFret] = useState<number | null>(null);
  const [activeStringIndex, setActiveStringIndex] = useState<number | null>(null);
  const [meendBend, setMeendBend] = useState<number>(0);
  const [sympatheticGlow, setSympatheticGlow] = useState<boolean>(false);
  const [autoCenterNotice, setAutoCenterNotice] = useState<string | null>(null);
  const [autoCenterEnabled, setAutoCenterEnabled] = useState<boolean>(true);

  const touchMap = useRef<Map<number, { stringId: number; startY: number; midi: number }>>(new Map());

  const fretCount = 20;

  // Calculate targets for the current step in Learn Mode
  const stepTargets = useMemo(() => {
    if (!currentLearnStep || !currentLearnStep.expectedNotes) return [];
    return currentLearnStep.expectedNotes.map((n) =>
      InstrumentMidiConverter.mapNoteToInstrument(n.note, 'sitar')
    );
  }, [currentLearnStep]);

  // Center the view on the chord / note whenever the step advances
  useEffect(() => {
    if (!currentLearnStep || !autoCenterEnabled || !scrollContainerRef.current) return;

    const centering = InstrumentMidiConverter.calculateStepCentering(currentLearnStep, 'sitar');
    const container = scrollContainerRef.current;

    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    if (scrollWidth > clientWidth) {
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

  useEffect(() => {
    if (activeMidiNotes.length === 0) {
      setActiveFret(null);
      setActiveStringIndex(null);
      setSympatheticGlow(false);
      return;
    }

    const latest = activeMidiNotes[activeMidiNotes.length - 1];
    const mapping = InstrumentMidiConverter.mapNoteToInstrument(latest.note, 'sitar');

    if (mapping.stringIndex !== undefined && mapping.fret !== undefined) {
      setActiveStringIndex(mapping.stringIndex);
      setActiveFret(mapping.fret);
      setSympatheticGlow(true);
    }
  }, [activeMidiNotes]);

  const handlePointerDown = async (e: React.PointerEvent, sIdx: number, fIdx: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    await audioEngine.init();

    const str = SITAR_STRINGS[sIdx];
    const midiNote = str.baseMidi + fIdx;
    const freq = midiToFrequency(midiNote);
    const voiceKey = `sitar_p_${e.pointerId}`;

    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, 0, 'sitar');

    touchMap.current.set(e.pointerId, {
      stringId: sIdx,
      startY: e.clientY,
      midi: midiNote,
    });

    setActiveStringIndex(sIdx);
    setActiveFret(fIdx);
    setSympatheticGlow(true);

    if (onUserNotePlayed) {
      onUserNotePlayed(midiNote, 0.85, e.clientX, e.clientY);
    } else {
      midiLessonEngine.handleUserNote(midiNote, 0.85, e.clientX, e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const track = touchMap.current.get(e.pointerId);
    if (!track) return;

    // Vertical drag on curved frets deflects string (Meend pitch bend)
    const deltaY = track.startY - e.clientY;
    const bend = Math.max(0, Math.min(4.0, deltaY / 25));
    setMeendBend(bend);

    const voiceKey = `sitar_p_${e.pointerId}`;
    const targetFreq = midiToFrequency(track.midi + bend);
    audioEngine.updateVoicePitch(voiceKey, targetFreq, 0.85, 0, 0.02);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    touchMap.current.delete(e.pointerId);
    const voiceKey = `sitar_p_${e.pointerId}`;
    audioEngine.triggerNoteOff(voiceKey);
    if (touchMap.current.size === 0) {
      setMeendBend(0);
      setActiveStringIndex(null);
      setActiveFret(null);
    }
  };

  const handleChikariPluck = async (e: React.MouseEvent, chikari: (typeof CHIKARI_STRINGS)[0]) => {
    e.preventDefault();
    await audioEngine.init();
    const voiceKey = `sitar_chikari_${chikari.id}_${Date.now()}`;
    const freq = midiToFrequency(chikari.midi);
    audioEngine.triggerNoteOn(voiceKey, freq, 0.9, 0.3, 'sitar');
    setSympatheticGlow(true);
    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
    }, 450);

    if (onUserNotePlayed) {
      onUserNotePlayed(chikari.midi, 0.85, e.clientX, e.clientY);
    } else {
      midiLessonEngine.handleUserNote(chikari.midi, 0.85, e.clientX, e.clientY);
    }
  };

  return (
    <div
      id="sitar-surface"
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#170a05] via-[#241007] to-[#0f0502] text-orange-100 overflow-hidden p-3 sm:p-5"
    >
      {/* Top Header info & Controls */}
      <div className="flex items-center justify-between z-10 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xl shadow-md">
            🪕
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-orange-200 tracking-wide">
                Classical Indian Sitar
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-serif border border-orange-500/30">
                सितार
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              20 Curved Brass Frets • Jawari Buzz • 11 Taraf Sympathetic Strings • Deep Meend Bends
            </p>
          </div>
        </div>

        {/* Learn Mode Auto-Center Pill & Meend Indicator */}
        <div className="flex items-center gap-2">
          {currentLearnStep && (
            <button
              onClick={() => setAutoCenterEnabled(!autoCenterEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all border ${
                autoCenterEnabled
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 shadow-sm'
                  : 'bg-white/[0.04] border-white/10 text-zinc-400'
              }`}
              title="Automatically center the view on the next fret to click"
            >
              <Compass className={`w-3.5 h-3.5 ${autoCenterEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <span>{autoCenterEnabled ? 'Auto-Center: ON' : 'Auto-Center: OFF'}</span>
            </button>
          )}

          {autoCenterNotice && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/25 border border-orange-500/50 text-orange-200 text-xs font-mono font-medium animate-pulse shadow-lg">
              <Target className="w-3.5 h-3.5 text-orange-300" />
              <span className="truncate max-w-[200px]">{autoCenterNotice}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-orange-500/20 backdrop-blur-sm">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Meend Bend</span>
            <span className="text-xs font-mono font-bold text-orange-400">
              +{meendBend.toFixed(2)} st
            </span>
          </div>
        </div>
      </div>

      {/* Main Scrollable Sitar Neck with Curved Frets */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 my-2 flex items-center justify-start lg:justify-center overflow-x-auto overflow-y-hidden scroll-smooth pb-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#ea580c transparent' }}
      >
        <div className="relative w-full max-w-6xl min-w-[840px] h-72 rounded-3xl bg-gradient-to-r from-[#381a0b] via-[#4d2410] to-[#2b1307] border-2 border-orange-900/60 shadow-2xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
          {/* Taraf Sympathetic Strings Shimmering Bed */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-16 pointer-events-none transition-opacity duration-300 ${
              sympatheticGlow ? 'opacity-80' : 'opacity-20'
            }`}
          >
            <div className="w-full h-full bg-gradient-to-t from-amber-500/20 via-orange-500/10 to-transparent blur-md" />
            <div className="absolute bottom-2 left-20 right-20 flex justify-between">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="w-[1px] h-10 bg-amber-400/40 animate-pulse" />
              ))}
            </div>
          </div>

          {/* Top Swara Label markers */}
          <div className="relative flex items-center justify-between pl-16 pr-6 h-6 border-b border-orange-500/15">
            {Array.from({ length: fretCount }).map((_, fIdx) => {
              const rootMidi = 48; // C3 Sa
              const swara = getSargamNote(rootMidi + fIdx);
              const isHighlight = activeFret === fIdx;
              const isStepFret = stepTargets.some((t) => t.fret === fIdx);

              return (
                <div
                  key={fIdx}
                  className={`flex-1 text-center text-[10px] font-mono transition-all ${
                    isStepFret
                      ? 'text-orange-300 font-bold scale-125 bg-orange-500/20 rounded-md py-0.5 shadow-sm'
                      : isHighlight
                      ? 'text-orange-300 font-bold scale-110'
                      : 'text-zinc-500'
                  }`}
                >
                  {isStepFret ? `🎯 ${swara}` : fIdx % 2 === 0 ? swara : '•'}
                </div>
              );
            })}
          </div>

          {/* Main Playing Strings & Curved Frets */}
          <div className="relative flex-1 flex flex-col justify-around py-3 pl-16 pr-6">
            {/* Curved Frets rendered across strings */}
            <div className="absolute inset-0 flex justify-between pointer-events-none pl-16 pr-6">
              {Array.from({ length: fretCount }).map((_, fIdx) => {
                const isStepFret = stepTargets.some((t) => t.fret === fIdx);
                const isActive = activeFret === fIdx;

                return (
                  <div
                    key={fIdx}
                    className={`w-[3px] h-full rounded-full transition-all ${
                      isStepFret
                        ? 'bg-orange-300 shadow-[0_0_16px_#ea580c] scale-x-150 z-20'
                        : isActive
                        ? 'bg-orange-300 shadow-[0_0_14px_#ea580c]'
                        : 'bg-gradient-to-b from-amber-200/50 via-amber-400/30 to-amber-600/50'
                    }`}
                    style={{
                      transform: 'scaleY(1.05) perspective(200px) rotateX(8deg)',
                    }}
                  />
                );
              })}
            </div>

            {/* 4 Main Sitar Strings */}
            {SITAR_STRINGS.map((str, sIdx) => {
              const isSounding = activeStringIndex === sIdx;

              return (
                <div
                  key={str.id}
                  className="relative flex items-center h-10 group cursor-pointer"
                  style={{ touchAction: 'none' }}
                >
                  <div className="absolute -left-14 flex flex-col items-end w-12 text-right">
                    <span className="text-[11px] font-bold text-orange-300">{str.swara}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{str.name}</span>
                  </div>

                  <div
                    className={`absolute left-0 right-0 rounded-full transition-all ${
                      isSounding
                        ? 'bg-orange-300 shadow-[0_0_14px_#ea580c] -translate-y-1'
                        : 'bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 opacity-80'
                    }`}
                    style={{
                      height: `${str.thickness}px`,
                    }}
                  />

                  {/* Fret Touch Zones */}
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
                              ? 'bg-orange-500/30 ring-2 ring-orange-400/80 rounded-lg cursor-pointer animate-pulse'
                              : isActivePoint
                              ? 'bg-orange-400/20'
                              : 'hover:bg-orange-500/10 active:bg-orange-400/30'
                          }`}
                          title={
                            targetMatch
                              ? `Click to Play: ${targetMatch.targetDescription}`
                              : undefined
                          }
                        >
                          {isActivePoint && !targetMatch && (
                            <div className="w-5 h-5 rounded-full bg-orange-400 border-2 border-white shadow-[0_0_14px_#ea580c] animate-ping opacity-75" />
                          )}

                          {/* INTERACTIVE LEARN MODE TARGET POINT */}
                          {targetMatch && (
                            <div className="relative flex flex-col items-center justify-center pointer-events-none z-30">
                              <div className="absolute w-8 h-8 rounded-full bg-orange-400/30 animate-ping" />
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 border-2 border-white flex items-center justify-center text-[10px] font-bold font-mono text-zinc-950 shadow-[0_0_20px_#ea580c] animate-bounce">
                                👆
                              </div>
                              <div className="absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/90 border border-orange-400/80 text-[10px] font-mono font-bold text-orange-300 shadow-md">
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

          {/* Chikari Strings Row */}
          <div className="relative pt-2 border-t border-orange-500/15 flex items-center justify-between pl-16 pr-6 flex-wrap gap-2">
            <span className="text-[10px] text-zinc-400 font-mono">
              {currentLearnStep
                ? '👉 Click the glowing targets on the frets to play and learn the song'
                : 'Drag upward vertically across frets to pull Meend (microtonal glide)'}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-orange-400/80 font-mono">
                Chikari Rhythmic Drones:
              </span>
              {CHIKARI_STRINGS.map((chikari) => (
                <button
                  key={chikari.id}
                  onClick={(e) => handleChikariPluck(e, chikari)}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-200 text-xs font-mono font-semibold transition-all active:scale-95 shadow-sm"
                >
                  {chikari.swara}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
