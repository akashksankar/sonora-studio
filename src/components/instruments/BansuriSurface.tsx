import React, { useEffect, useState } from 'react';
import { InstrumentConfig, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { getSargamNote } from '../../instruments/instrumentRegistry';
import { midiToFrequency } from '../../utils/musicTheory';
import { BookOpen, Wind } from 'lucide-react';

interface BansuriSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
}

// 7 Finger Holes for classic E or G Bansuri
// In Indian flute:
// All closed = Pa
// Open hole 7 = Dha
// Open hole 6 = Ni
// Open hole 5 = Sa (Base tonic)
// Open hole 4 = Re
// Open hole 3 = Ga
// Open hole 2 = Ma
// Open hole 1 = Tivra Ma
const FINGER_HOLES = [
  { index: 1, label: 'H1', swara: 'Ma’', offsetMidi: 6 },
  { index: 2, label: 'H2', swara: 'Ga', offsetMidi: 4 },
  { index: 3, label: 'H3', swara: 'Re', offsetMidi: 2 },
  { index: 4, label: 'H4', swara: 'Sa', offsetMidi: 0 },
  { index: 5, label: 'H5', swara: 'Ni', offsetMidi: -1 },
  { index: 6, label: 'H6', swara: 'Dha', offsetMidi: -3 },
  { index: 7, label: 'H7', swara: 'Pa', offsetMidi: -5 },
];

export const BansuriSurface: React.FC<BansuriSurfaceProps> = ({ config, activeMidiNotes }) => {
  const [openHoles, setOpenHoles] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: false,
    5: false,
    6: false,
    7: false,
  });
  const [isBlowing, setIsBlowing] = useState<boolean>(false);
  const [activeSwara, setActiveSwara] = useState<string>('Sa');
  const [showFingeringGuide, setShowFingeringGuide] = useState<boolean>(false);

  const baseTonicMidi = 60; // C4 Sa

  // Sync active MIDI notes to open hole patterns
  useEffect(() => {
    if (activeMidiNotes.length === 0) {
      setIsBlowing(false);
      return;
    }

    const latest = activeMidiNotes[activeMidiNotes.length - 1];
    setIsBlowing(true);
    const swara = getSargamNote(latest.note, baseTonicMidi);
    setActiveSwara(swara);

    // Compute open holes based on pitch relative to Sa
    const diff = latest.note - baseTonicMidi;
    const newOpenState: Record<number, boolean> = {};

    FINGER_HOLES.forEach((h) => {
      // Holes are open if pitch is higher than hole offset
      newOpenState[h.index] = diff >= h.offsetMidi;
    });

    setOpenHoles(newOpenState);
  }, [activeMidiNotes]);

  const toggleHole = async (hIndex: number) => {
    await audioEngine.init();
    const updated = { ...openHoles, [hIndex]: !openHoles[hIndex] };
    setOpenHoles(updated);

    // Determine sounding pitch based on highest open hole
    let highestMidiOffset = -5; // all closed = Pa
    for (const h of FINGER_HOLES) {
      if (updated[h.index]) {
        highestMidiOffset = Math.max(highestMidiOffset, h.offsetMidi);
      }
    }

    const soundingMidi = baseTonicMidi + highestMidiOffset;
    const swara = getSargamNote(soundingMidi, baseTonicMidi);
    setActiveSwara(swara);

    const voiceKey = 'bansuri_tap';
    const freq = midiToFrequency(soundingMidi);
    audioEngine.triggerNoteOn(voiceKey, freq, 0.85, 0, 'bansuri');
    setIsBlowing(true);

    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
      setIsBlowing(false);
    }, 450);
  };

  const blowTonic = async () => {
    await audioEngine.init();
    const voiceKey = 'bansuri_tonic';
    const freq = midiToFrequency(baseTonicMidi);
    audioEngine.triggerNoteOn(voiceKey, freq, 0.9, 0, 'bansuri');
    setIsBlowing(true);
    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
      setIsBlowing(false);
    }, 600);
  };

  return (
    <div
      id="bansuri-surface"
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#081510] via-[#0d221a] to-[#06100c] text-emerald-100 overflow-hidden p-3 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shadow-md">
            🪈
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-emerald-200 tracking-wide">
                Bansuri Bamboo Flute Performance
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-serif border border-emerald-500/30">
                बांसुरी
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Cylindrical Bamboo Resonator • 7 Finger Holes • Breath Flow Dynamics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Swara badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-emerald-500/20 backdrop-blur-sm">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Swara</span>
            <span className="text-sm font-serif font-bold text-emerald-400">{activeSwara}</span>
          </div>

          {/* Fingering Guide Toggle */}
          <button
            onClick={() => setShowFingeringGuide(!showFingeringGuide)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showFingeringGuide
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fingering Guide</span>
          </button>
        </div>
      </div>

      {/* Main Flute Body */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        <div className="relative w-full max-w-5xl min-w-[700px] h-72 rounded-3xl bg-gradient-to-r from-[#0f2d22] via-[#1a4435] to-[#0c241b] border-2 border-emerald-900/60 shadow-2xl p-6 flex flex-col justify-center items-center overflow-hidden">
          {/* Bamboo Tube Graphics */}
          <div className="relative w-full h-24 rounded-full bg-gradient-to-b from-[#d4a373] via-[#faedcd] to-[#bc6c25] border-4 border-[#8c501c] shadow-2xl flex items-center justify-between px-10">
            {/* Bamboo Node Rings (Decorative vertical bound cords) */}
            <div className="absolute left-6 top-0 bottom-0 w-2 bg-gradient-to-r from-red-800 via-amber-700 to-red-900 shadow-inner" />
            <div className="absolute left-28 top-0 bottom-0 w-2.5 bg-gradient-to-r from-red-800 via-amber-700 to-red-900" />
            <div className="absolute right-8 top-0 bottom-0 w-2 bg-gradient-to-r from-red-800 via-amber-700 to-red-900" />

            {/* Embouchure Mouth Blow-Hole (Left) */}
            <div className="relative flex flex-col items-center">
              <button
                onClick={blowTonic}
                className={`w-10 h-8 rounded-full bg-gradient-to-b from-stone-950 via-zinc-900 to-stone-950 border-2 border-amber-900/80 shadow-inner flex items-center justify-center transition-all ${
                  isBlowing ? 'scale-110 shadow-[0_0_18px_#10b981]' : 'hover:scale-105'
                }`}
                title="Blow Embouchure"
              >
                <Wind
                  className={`w-4 h-4 transition-colors ${
                    isBlowing ? 'text-emerald-400 animate-pulse' : 'text-zinc-600'
                  }`}
                />
              </button>
              <span className="text-[10px] font-mono font-semibold text-zinc-900 mt-1">Mouth</span>

              {/* Animated Breath Airflow Stream */}
              {isBlowing && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 animate-bounce pointer-events-none">
                  <span className="text-xs text-emerald-400 font-mono">💨 Air</span>
                </div>
              )}
            </div>

            {/* 7 Interactive Finger Holes (Right) */}
            <div className="flex items-center gap-6 sm:gap-8 pr-4">
              {FINGER_HOLES.map((hole) => {
                const isOpen = openHoles[hole.index];

                return (
                  <div key={hole.index} className="flex flex-col items-center">
                    <button
                      onClick={() => toggleHole(hole.index)}
                      className={`relative w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                        isOpen
                          ? 'bg-gradient-to-b from-stone-900 via-zinc-950 to-stone-900 border-2 border-amber-950 shadow-inner'
                          : 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 border-2 border-amber-950 shadow-md'
                      } ${isOpen && isBlowing ? 'ring-4 ring-emerald-400/60 shadow-[0_0_16px_#10b981]' : ''}`}
                      title={`${hole.label} (${hole.swara}): ${isOpen ? 'Open' : 'Covered'}`}
                    >
                      {/* Visual Air Ripple Wave emanating if open during playback */}
                      {isOpen && isBlowing && (
                        <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                      )}
                      <span
                        className={`text-[9px] font-mono font-bold ${
                          isOpen ? 'text-emerald-400' : 'text-amber-200'
                        }`}
                      >
                        {hole.swara}
                      </span>
                    </button>
                    <span className="text-[10px] font-mono text-zinc-800 font-medium mt-1">
                      {isOpen ? '○' : '●'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-zinc-400 font-mono mt-4">
            Tap finger holes to open/cover (● = Closed, ○ = Open) • Embouchure blows tonic Sa
          </p>
        </div>
      </div>

      {/* Optional Sargam Fingering Guide Drawer */}
      {showFingeringGuide && (
        <div className="z-20 p-4 rounded-2xl bg-black/80 border border-emerald-500/20 backdrop-blur-md mb-2 animate-in slide-in-from-bottom duration-200">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2">
            Indian Flute Sargam Fingering Guide (Standard E/C Flute)
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Sa</span>
              <p className="text-[10px] text-zinc-400 mt-1">H1-H3 Covered</p>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Re</span>
              <p className="text-[10px] text-zinc-400 mt-1">H1-H2 Covered</p>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Ga</span>
              <p className="text-[10px] text-zinc-400 mt-1">H1 Covered</p>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Ma</span>
              <p className="text-[10px] text-zinc-400 mt-1">All Open</p>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Pa</span>
              <p className="text-[10px] text-zinc-400 mt-1">All Closed</p>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Dha</span>
              <p className="text-[10px] text-zinc-400 mt-1">H7 Open</p>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="font-bold text-emerald-400">Ni</span>
              <p className="text-[10px] text-zinc-400 mt-1">H6-H7 Open</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
