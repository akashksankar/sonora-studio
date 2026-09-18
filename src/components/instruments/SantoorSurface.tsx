import React, { useEffect, useState } from 'react';
import { InstrumentConfig, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { midiToFrequency } from '../../utils/musicTheory';
import { getSargamNote } from '../../instruments/instrumentRegistry';

interface SantoorSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
}

// 12 Bridge Courses for Santoor (Left & Right bridges)
const SANTOOR_COURSES = [
  // Right Bridge (Lower/Middle octave)
  { id: 0, bridge: 'right', note: 55, name: 'G3', swara: 'Pa' },
  { id: 1, bridge: 'right', note: 57, name: 'A3', swara: 'Dha' },
  { id: 2, bridge: 'right', note: 59, name: 'B3', swara: 'Ni' },
  { id: 3, bridge: 'right', note: 60, name: 'C4', swara: 'Sa' },
  { id: 4, bridge: 'right', note: 62, name: 'D4', swara: 'Re' },
  { id: 5, bridge: 'right', note: 64, name: 'E4', swara: 'Ga' },

  // Left Bridge (Higher octave)
  { id: 6, bridge: 'left', note: 65, name: 'F4', swara: 'Ma' },
  { id: 7, bridge: 'left', note: 67, name: 'G4', swara: 'Pa' },
  { id: 8, bridge: 'left', note: 69, name: 'A4', swara: 'Dha' },
  { id: 9, bridge: 'left', note: 71, name: 'B4', swara: 'Ni' },
  { id: 10, bridge: 'left', note: 72, name: 'C5', swara: 'Sa’' },
  { id: 11, bridge: 'left', note: 74, name: 'D5', swara: 'Re’' },
];

export const SantoorSurface: React.FC<SantoorSurfaceProps> = ({ config, activeMidiNotes }) => {
  const [activeCourseId, setActiveCourseId] = useState<number | null>(null);
  const [malletStrikePos, setMalletStrikePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (activeMidiNotes.length === 0) {
      setActiveCourseId(null);
      setMalletStrikePos(null);
      return;
    }

    const latest = activeMidiNotes[activeMidiNotes.length - 1];
    let best = 0;
    let minDiff = 999;
    SANTOOR_COURSES.forEach((c) => {
      const diff = Math.abs(latest.note - c.note);
      if (diff < minDiff) {
        minDiff = diff;
        best = c.id;
      }
    });

    setActiveCourseId(best);
  }, [activeMidiNotes]);

  const handleStrike = async (e: React.MouseEvent, course: (typeof SANTOOR_COURSES)[0]) => {
    await audioEngine.init();
    const rect = e.currentTarget.getBoundingClientRect();
    setMalletStrikePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setActiveCourseId(course.id);

    const voiceKey = `santoor_${course.id}_${Date.now()}`;
    const freq = midiToFrequency(course.note);
    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, (course.id - 6) * 0.15, 'santoor');

    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
      setActiveCourseId(null);
      setMalletStrikePos(null);
    }, 400);
  };

  return (
    <div
      id="santoor-surface"
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#191008] via-[#24170d] to-[#120b05] text-amber-100 overflow-hidden p-3 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md">
            🥢
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-amber-200 tracking-wide">
                Kashmiri 100-String Santoor
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-serif border border-amber-500/30">
                संतूर
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Trapezoidal Walnut Soundboard • Walnut Mezrab Mallets • Crystalline Sustain
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-amber-500/20 backdrop-blur-sm text-xs font-mono text-amber-400">
          Mezrab Mallet Strikes
        </div>
      </div>

      {/* Trapezoidal Santoor Soundboard */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        <div
          className="relative w-full max-w-4xl min-w-[680px] h-72 rounded-3xl bg-gradient-to-r from-[#3e2314] via-[#522f1b] to-[#2d180d] border-2 border-amber-900/60 shadow-2xl p-6 flex justify-between items-center overflow-hidden"
          style={{
            clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
          }}
        >
          {/* Walnut Bridges (Left & Right) */}
          <div className="flex-1 flex justify-around h-full items-center px-6">
            {/* Left Bridge Courses */}
            <div className="flex-1 flex flex-col justify-around h-full pr-4 border-r border-amber-500/20">
              <span className="text-[10px] font-mono text-amber-300/80 mb-1 text-center">
                Left Bridge (Tar Saptak)
              </span>
              {SANTOOR_COURSES.filter((c) => c.bridge === 'left').map((course) => {
                const isActive = activeCourseId === course.id;

                return (
                  <button
                    key={course.id}
                    onClick={(e) => handleStrike(e, course)}
                    className={`relative h-7 rounded-lg transition-all flex items-center justify-between px-3 border ${
                      isActive
                        ? 'bg-amber-400/40 border-amber-300 shadow-[0_0_12px_#f59e0b]'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold text-amber-200">{course.swara}</span>
                    <div className="flex-1 mx-3 h-[1px] bg-gradient-to-r from-amber-400/30 to-amber-200/50" />
                    <span className="text-[10px] text-zinc-400 font-mono">{course.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Bridge Courses */}
            <div className="flex-1 flex flex-col justify-around h-full pl-4">
              <span className="text-[10px] font-mono text-amber-300/80 mb-1 text-center">
                Right Bridge (Madhya Saptak)
              </span>
              {SANTOOR_COURSES.filter((c) => c.bridge === 'right').map((course) => {
                const isActive = activeCourseId === course.id;

                return (
                  <button
                    key={course.id}
                    onClick={(e) => handleStrike(e, course)}
                    className={`relative h-7 rounded-lg transition-all flex items-center justify-between px-3 border ${
                      isActive
                        ? 'bg-amber-400/40 border-amber-300 shadow-[0_0_12px_#f59e0b]'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold text-amber-200">{course.swara}</span>
                    <div className="flex-1 mx-3 h-[1px] bg-gradient-to-r from-amber-400/30 to-amber-200/50" />
                    <span className="text-[10px] text-zinc-400 font-mono">{course.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-400 font-mono">
        Tap any string course to strike with wooden curved mezrab mallets
      </div>
    </div>
  );
};
