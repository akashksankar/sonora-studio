import React, { useEffect, useRef, useState } from 'react';
import { InstrumentConfig, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { midiToFrequency } from '../../utils/musicTheory';

interface ViolinSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
  isCello?: boolean;
}

// Violin strings: G3 (55), D4 (62), A4 (69), E5 (76)
// Cello strings: C2 (36), G2 (43), D3 (50), A3 (57)
const VIOLIN_STRINGS = [
  { id: 0, name: 'E5', baseMidi: 76, thickness: 1.4 },
  { id: 1, name: 'A4', baseMidi: 69, thickness: 2.0 },
  { id: 2, name: 'D4', baseMidi: 62, thickness: 2.8 },
  { id: 3, name: 'G3', baseMidi: 55, thickness: 3.8 },
];

const CELLO_STRINGS = [
  { id: 0, name: 'A3', baseMidi: 57, thickness: 2.0 },
  { id: 1, name: 'D3', baseMidi: 50, thickness: 2.8 },
  { id: 2, name: 'G2', baseMidi: 43, thickness: 3.8 },
  { id: 3, name: 'C2', baseMidi: 36, thickness: 4.8 },
];

export const ViolinSurface: React.FC<ViolinSurfaceProps> = ({
  config,
  activeMidiNotes,
  isCello = false,
}) => {
  const strings = isCello ? CELLO_STRINGS : VIOLIN_STRINGS;
  const instrumentId = isCello ? 'cello' : 'violin';

  const [activeString, setActiveString] = useState<number | null>(null);
  const [activePositionRatio, setActivePositionRatio] = useState<number | null>(null); // 0 (nut) to 1 (bridge)
  const [bowPositionX, setBowPositionX] = useState<number>(50); // % across string
  const [isBowing, setIsBowing] = useState<boolean>(false);
  const touchMap = useRef<Map<number, { stringId: number; midi: number }>>(new Map());

  // Respond to MIDI notes
  useEffect(() => {
    if (activeMidiNotes.length === 0) {
      setActiveString(null);
      setActivePositionRatio(null);
      setIsBowing(false);
      return;
    }

    const latest = activeMidiNotes[activeMidiNotes.length - 1];
    let bestString = 0;
    let minDiff = 999;
    strings.forEach((s, idx) => {
      const diff = latest.note - s.baseMidi;
      if (diff >= 0 && diff < 24 && diff < minDiff) {
        minDiff = diff;
        bestString = idx;
      }
    });

    const semitones = Math.max(0, latest.note - strings[bestString].baseMidi);
    // Position on fingerboard = 1 - 2^(-semitones/12)
    const ratio = Math.min(0.85, 1 - Math.pow(2, -semitones / 12));

    setActiveString(bestString);
    setActivePositionRatio(ratio);
    setIsBowing(true);
    setBowPositionX((prev) => (prev > 60 ? 30 : 70)); // simulate oscillating bow
  }, [activeMidiNotes, strings]);

  const handlePointerDown = async (e: React.PointerEvent, sIdx: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    await audioEngine.init();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.9, (e.clientX - rect.left) / rect.width));

    // Convert finger position to continuous pitch
    const semitones = -12 * Math.log2(1 - ratio);
    const str = strings[sIdx];
    const midiNote = str.baseMidi + semitones;
    const freq = midiToFrequency(midiNote);
    const voiceKey = `bow_${e.pointerId}`;

    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, (sIdx - 1.5) * 0.25, instrumentId);

    touchMap.current.set(e.pointerId, { stringId: sIdx, midi: midiNote });
    setActiveString(sIdx);
    setActivePositionRatio(ratio);
    setIsBowing(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const track = touchMap.current.get(e.pointerId);
    if (!track) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.9, (e.clientX - rect.left) / rect.width));
    const semitones = -12 * Math.log2(1 - ratio);
    const str = strings[track.stringId];
    const midiNote = str.baseMidi + semitones;
    const freq = midiToFrequency(midiNote);
    const voiceKey = `bow_${e.pointerId}`;

    audioEngine.updateVoicePitch(voiceKey, freq, 0.85, 0, 0.025);
    setActivePositionRatio(ratio);
    setBowPositionX(ratio * 100);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    touchMap.current.delete(e.pointerId);
    const voiceKey = `bow_${e.pointerId}`;
    audioEngine.triggerNoteOff(voiceKey);
    if (touchMap.current.size === 0) {
      setActiveString(null);
      setActivePositionRatio(null);
      setIsBowing(false);
    }
  };

  return (
    <div
      id={`${instrumentId}-surface`}
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#14080e] via-[#200d17] to-[#0c0509] text-rose-100 overflow-hidden p-3 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xl shadow-md">
            {isCello ? '🎼' : '🎻'}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-rose-200 tracking-wide">
              {isCello ? 'Cello Orchestral Performance' : 'Violin Virtuoso Performance'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Fretless Fingerboard • Continuous Intonation • Formant Bow Resonance
            </p>
          </div>
        </div>

        {/* Bowing Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-rose-500/20 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Bow Status</span>
          <span
            className={`text-xs font-mono font-bold transition-colors ${
              isBowing ? 'text-rose-400 animate-pulse' : 'text-zinc-500'
            }`}
          >
            {isBowing ? '● BOWING' : '○ REST'}
          </span>
        </div>
      </div>

      {/* Main Fingerboard Stage */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        <div className="relative w-full max-w-5xl min-w-[700px] h-72 rounded-3xl bg-gradient-to-r from-[#211017] via-[#2d1621] to-[#160a10] border-2 border-rose-900/60 shadow-2xl p-6 flex flex-col justify-between overflow-hidden">
          {/* Ebony Fingerboard Background */}
          <div className="absolute inset-y-4 left-16 right-16 rounded-2xl bg-gradient-to-r from-zinc-950 via-[#111116] to-zinc-950 border border-white/5 shadow-2xl" />

          {/* Position Dot Markers (3rd, 5th, 7th, 12th harmonic points) */}
          <div className="absolute inset-y-0 left-16 right-16 pointer-events-none flex justify-around items-center opacity-30">
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400/60" /> {/* Octave */}
          </div>

          {/* 4 Bowed Strings */}
          <div className="relative flex-1 flex flex-col justify-around py-3 pl-16 pr-16 z-10">
            {strings.map((str, sIdx) => {
              const isSounding = activeString === sIdx;

              return (
                <div
                  key={str.id}
                  onPointerDown={(e) => handlePointerDown(e, sIdx)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="relative flex items-center h-12 group cursor-pointer"
                  style={{ touchAction: 'none' }}
                >
                  {/* Nut Label */}
                  <div className="absolute -left-12 flex flex-col items-end w-10 text-right">
                    <span className="text-xs font-bold text-rose-300 font-mono">{str.name}</span>
                  </div>

                  {/* Physical String Wire */}
                  <div
                    className={`absolute left-0 right-0 rounded-full transition-all ${
                      isSounding
                        ? 'bg-rose-300 shadow-[0_0_16px_#f43f5e]'
                        : 'bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-300 opacity-70'
                    }`}
                    style={{ height: `${str.thickness}px` }}
                  />

                  {/* Active Finger Stop Circle */}
                  {isSounding && activePositionRatio !== null && (
                    <div
                      className="absolute w-6 h-6 rounded-full bg-rose-500 border-2 border-white shadow-[0_0_18px_#f43f5e] -translate-x-1/2 pointer-events-none transition-all duration-75"
                      style={{ left: `${activePositionRatio * 100}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Animated Bow Stroke Line overlay */}
          {isBowing && (
            <div
              className="absolute top-6 bottom-6 w-2 bg-gradient-to-b from-amber-200 via-white to-amber-200 rounded-full shadow-[0_0_20px_#f43f5e] pointer-events-none transition-all duration-100 opacity-80"
              style={{ left: `${bowPositionX}%` }}
            />
          )}

          <div className="relative pt-2 border-t border-rose-500/15 flex items-center justify-between pl-16 pr-16 text-[10px] text-zinc-400 font-mono">
            <span>Fretless: Drag finger smoothly along string for microtonal portamento glide</span>
            <span>Tuning in Fifths</span>
          </div>
        </div>
      </div>
    </div>
  );
};
