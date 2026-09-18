import React, { useEffect, useRef, useState } from 'react';
import { InstrumentConfig, InstrumentId, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { midiToFrequency, NOTE_NAMES } from '../../utils/musicTheory';

interface GuitarHarpSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
  instrumentId: InstrumentId;
}

// Standard 6 Guitar Strings: E2 (40), A2 (45), D3 (50), G3 (55), B3 (59), E4 (64)
const GUITAR_STRINGS = [
  { id: 0, name: 'E4 (High)', baseMidi: 64, thickness: 1.4 },
  { id: 1, name: 'B3', baseMidi: 59, thickness: 1.8 },
  { id: 2, name: 'G3', baseMidi: 55, thickness: 2.2 },
  { id: 3, name: 'D3', baseMidi: 50, thickness: 3.0 },
  { id: 4, name: 'A2', baseMidi: 45, thickness: 3.8 },
  { id: 5, name: 'E2 (Low)', baseMidi: 40, thickness: 4.6 },
];

// Concert Harp 15 Diatonic Strings (C3 to C5)
const HARP_STRINGS = [
  { id: 0, midi: 48, name: 'C3', color: '#ef4444' }, // Red C
  { id: 1, midi: 50, name: 'D3', color: '#cbd5e1' },
  { id: 2, midi: 52, name: 'E3', color: '#cbd5e1' },
  { id: 3, midi: 53, name: 'F3', color: '#3b82f6' }, // Blue F
  { id: 4, midi: 55, name: 'G3', color: '#cbd5e1' },
  { id: 5, midi: 57, name: 'A3', color: '#cbd5e1' },
  { id: 6, midi: 59, name: 'B3', color: '#cbd5e1' },
  { id: 7, midi: 60, name: 'C4', color: '#ef4444' }, // Red C4
  { id: 8, midi: 62, name: 'D4', color: '#cbd5e1' },
  { id: 9, midi: 64, name: 'E4', color: '#cbd5e1' },
  { id: 10, midi: 65, name: 'F4', color: '#3b82f6' }, // Blue F4
  { id: 11, midi: 67, name: 'G4', color: '#cbd5e1' },
  { id: 12, midi: 69, name: 'A4', color: '#cbd5e1' },
  { id: 13, midi: 71, name: 'B4', color: '#cbd5e1' },
  { id: 14, midi: 72, name: 'C5', color: '#ef4444' }, // Red C5
];

export const GuitarHarpSurface: React.FC<GuitarHarpSurfaceProps> = ({
  config,
  activeMidiNotes,
  instrumentId,
}) => {
  const isHarp = instrumentId === 'harp';
  const isElectric = instrumentId === 'electric_guitar';

  const [activeFret, setActiveFret] = useState<number | null>(null);
  const [activeString, setActiveString] = useState<number | null>(null);
  const [activeHarpIndex, setActiveHarpIndex] = useState<number | null>(null);

  const fretCount = 15;

  useEffect(() => {
    if (activeMidiNotes.length === 0) {
      setActiveFret(null);
      setActiveString(null);
      setActiveHarpIndex(null);
      return;
    }

    const latest = activeMidiNotes[activeMidiNotes.length - 1];

    if (isHarp) {
      let bestIdx = 0;
      let minDiff = 999;
      HARP_STRINGS.forEach((s, idx) => {
        const diff = Math.abs(latest.note - s.midi);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = idx;
        }
      });
      setActiveHarpIndex(bestIdx);
    } else {
      let bestStr = 0;
      let minDiff = 999;
      GUITAR_STRINGS.forEach((s, idx) => {
        const diff = latest.note - s.baseMidi;
        if (diff >= 0 && diff < fretCount && diff < minDiff) {
          minDiff = diff;
          bestStr = idx;
        }
      });
      setActiveString(bestStr);
      setActiveFret(Math.max(0, Math.min(fretCount - 1, latest.note - GUITAR_STRINGS[bestStr].baseMidi)));
    }
  }, [activeMidiNotes, isHarp]);

  const handleGuitarPluck = async (sIdx: number, fIdx: number) => {
    await audioEngine.init();
    const str = GUITAR_STRINGS[sIdx];
    const midi = str.baseMidi + fIdx;
    const freq = midiToFrequency(midi);
    const voiceKey = `gtr_${sIdx}_${fIdx}_${Date.now()}`;

    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, (sIdx - 2.5) * 0.2, instrumentId);
    setActiveString(sIdx);
    setActiveFret(fIdx);

    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
      setActiveString(null);
      setActiveFret(null);
    }, 450);
  };

  const handleHarpPluck = async (str: (typeof HARP_STRINGS)[0], idx: number) => {
    await audioEngine.init();
    const freq = midiToFrequency(str.midi);
    const voiceKey = `harp_${str.id}_${Date.now()}`;

    audioEngine.triggerNoteOn(voiceKey, freq, 0.88, (idx - 7) * 0.1, 'harp');
    setActiveHarpIndex(idx);

    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
      setActiveHarpIndex(null);
    }, 600);
  };

  return (
    <div
      id={`${instrumentId}-surface`}
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#111218] via-[#161822] to-[#0c0d12] text-zinc-100 overflow-hidden p-3 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md">
            {isHarp ? '✨' : isElectric ? '⚡' : '🎸'}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
              {isHarp
                ? 'Concert Pedaled Harp'
                : isElectric
                ? 'Custom Electric Guitar'
                : 'Acoustic Dreadnought Guitar'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {isHarp
                ? 'Glissando Swipe Gestures • Traditional Red C and Blue F Strings'
                : '6-String Rosewood Fretboard • Inlay Markers • Dynamic Plucks'}
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-zinc-300">
          {isHarp ? 'Swipe across strings' : 'Tap fret & string to pluck'}
        </div>
      </div>

      {/* Surface Stage */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        {isHarp ? (
          /* Concert Harp Vertical String Array */
          <div className="relative w-full max-w-4xl h-72 rounded-3xl bg-gradient-to-b from-[#1c182a] to-[#100d1a] border-2 border-purple-900/40 shadow-2xl p-6 flex justify-between items-center overflow-hidden">
            {HARP_STRINGS.map((str, idx) => {
              const isActive = activeHarpIndex === idx;

              return (
                <div
                  key={str.id}
                  onPointerDown={() => handleHarpPluck(str, idx)}
                  onPointerEnter={(e) => {
                    if (e.buttons > 0) handleHarpPluck(str, idx); // Swipe glissando support!
                  }}
                  className="relative flex-1 h-full flex flex-col items-center justify-between cursor-pointer group hover:bg-white/[0.03] transition-colors"
                >
                  <span className="text-[11px] font-mono font-bold" style={{ color: str.color }}>
                    {str.name}
                  </span>

                  {/* Vertical String Wire */}
                  <div className="relative flex-1 w-full flex items-center justify-center my-2">
                    <div
                      className={`w-[2px] h-full rounded-full transition-all ${
                        isActive
                          ? 'w-[4px] shadow-[0_0_16px_#a855f7] bg-purple-300'
                          : 'opacity-70 group-hover:opacity-100'
                      }`}
                      style={{ backgroundColor: isActive ? '#d8b4fe' : str.color }}
                    />
                  </div>

                  <span className="text-[9px] text-zinc-500 font-mono">
                    {str.name.startsWith('C') ? '● Red' : str.name.startsWith('F') ? '● Blue' : '○'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Guitar Fretboard */
          <div className="relative w-full max-w-5xl min-w-[700px] h-72 rounded-3xl bg-gradient-to-r from-[#24150e] via-[#351e13] to-[#1a0f0a] border-2 border-amber-900/60 shadow-2xl p-6 flex flex-col justify-between overflow-hidden">
            {/* Position Inlay Dots (Frets 3, 5, 7, 9, 12) */}
            <div className="absolute inset-x-16 top-1/2 -translate-y-1/2 pointer-events-none flex justify-between px-4 opacity-30">
              {Array.from({ length: fretCount }).map((_, fIdx) => (
                <div key={fIdx} className="flex-1 flex justify-center">
                  {[3, 5, 7, 9].includes(fIdx + 1) && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
                  )}
                  {fIdx + 1 === 12 && (
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 6 Guitar Strings */}
            <div className="relative flex-1 flex flex-col justify-around py-2 pl-12 pr-6">
              {/* Nickel/Silver Fret Wires */}
              <div className="absolute inset-0 flex justify-between pointer-events-none pl-12 pr-6">
                {Array.from({ length: fretCount }).map((_, fIdx) => (
                  <div
                    key={fIdx}
                    className={`w-[2px] h-full ${
                      activeFret === fIdx
                        ? 'bg-amber-300 shadow-[0_0_12px_#f59e0b]'
                        : 'bg-zinc-500/30'
                    }`}
                  />
                ))}
              </div>

              {GUITAR_STRINGS.map((str, sIdx) => {
                const isSounding = activeString === sIdx;

                return (
                  <div key={str.id} className="relative flex items-center h-8 group">
                    <span className="absolute -left-10 text-[11px] font-mono font-bold text-zinc-400">
                      {str.name.split(' ')[0]}
                    </span>

                    <div
                      className={`absolute left-0 right-0 rounded-full transition-all ${
                        isSounding
                          ? 'bg-amber-300 shadow-[0_0_14px_#f59e0b]'
                          : 'bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-400 opacity-80'
                      }`}
                      style={{ height: `${str.thickness}px` }}
                    />

                    {/* Fret Touch Points */}
                    <div className="relative w-full h-full flex justify-between z-10">
                      {Array.from({ length: fretCount }).map((_, fIdx) => (
                        <button
                          key={fIdx}
                          onClick={() => handleGuitarPluck(sIdx, fIdx)}
                          className="flex-1 h-full hover:bg-amber-400/20 active:bg-amber-400/40 rounded transition-all flex items-center justify-center"
                        >
                          {activeString === sIdx && activeFret === fIdx && (
                            <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_12px_#f59e0b] animate-ping" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative pt-2 border-t border-white/5 flex items-center justify-between pl-12 pr-6 text-[10px] text-zinc-400 font-mono">
              <span>Standard EADGBE Tuning</span>
              <span>15 Frets</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
