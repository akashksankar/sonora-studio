import React, { useEffect, useState } from 'react';
import { InstrumentConfig, InstrumentId, MidiNoteEvent } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { midiToFrequency } from '../../utils/musicTheory';

interface PercussionSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
  mode?: 'tabla' | 'mridangam' | 'ghatam';
}

// Indian Bol strokes for Tabla
const TABLA_ZONES = [
  // Bayan (Bass drum - Left)
  { id: 'bayan_center', drum: 'bayan', name: 'Ge / Gha', bol: 'घे', midi: 48, freq: 85, color: '#f59e0b', desc: 'Resonant Bass Bend' },
  { id: 'bayan_rim', drum: 'bayan', name: 'Ka / Ke', bol: 'क', midi: 45, freq: 110, color: '#d97706', desc: 'Damped Flat Slap' },

  // Dayan (Treble drum - Right)
  { id: 'dayan_syahi', drum: 'dayan', name: 'Tin / Tun', bol: 'तिं', midi: 60, freq: 261, color: '#38bdf8', desc: 'Center Black Spot Ring' },
  { id: 'dayan_maidan', drum: 'dayan', name: 'Sur / Ti', bol: 'ती', midi: 62, freq: 293, color: '#0ea5e9', desc: 'Middle Parchment Zone' },
  { id: 'dayan_kinar', drum: 'dayan', name: 'Ta / Na', bol: 'ता', midi: 65, freq: 349, color: '#0284c7', desc: 'Outer Leather Rim Chime' },
  { id: 'combo_dha', drum: 'combo', name: 'Dha', bol: 'धा', midi: 60, freq: 261, color: '#a855f7', desc: 'Ge + Ta Combined Strike' },
];

export const PercussionSurface: React.FC<PercussionSurfaceProps> = ({
  config,
  activeMidiNotes,
  mode = 'tabla',
}) => {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [rippleKey, setRippleKey] = useState<number>(0);
  const [lastBol, setLastBol] = useState<string>('धा Dha');

  // React to MIDI playback
  useEffect(() => {
    if (activeMidiNotes.length === 0) return;

    const latest = activeMidiNotes[activeMidiNotes.length - 1];
    const isBass = latest.note < 54;

    const matchedZone = isBass
      ? TABLA_ZONES[0] // Bayan
      : TABLA_ZONES[4]; // Dayan rim

    setActiveZoneId(matchedZone.id);
    setLastBol(`${matchedZone.bol} ${matchedZone.name}`);
    setRippleKey((prev) => prev + 1);

    const timer = setTimeout(() => {
      setActiveZoneId(null);
    }, 180);
    return () => clearTimeout(timer);
  }, [activeMidiNotes]);

  const handleStrike = async (zone: (typeof TABLA_ZONES)[0]) => {
    await audioEngine.init();
    setActiveZoneId(zone.id);
    setLastBol(`${zone.bol} ${zone.name}`);
    setRippleKey((prev) => prev + 1);

    const voiceKey = `perc_${zone.id}_${Date.now()}`;
    const freq = zone.freq;

    audioEngine.triggerNoteOn(voiceKey, freq, 0.88, zone.drum === 'bayan' ? -0.3 : 0.3, (mode || 'tabla') as InstrumentId);

    setTimeout(() => {
      audioEngine.triggerNoteOff(voiceKey);
      setActiveZoneId(null);
    }, 280);
  };

  return (
    <div
      id={`${mode}-surface`}
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#170e06] via-[#211409] to-[#0f0904] text-amber-100 overflow-hidden p-3 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md">
            {mode === 'tabla' ? '🥁' : mode === 'mridangam' ? '🪘' : '🏺'}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-amber-200 tracking-wide capitalize">
              {mode === 'tabla'
                ? 'Indian Tabla Ensemble'
                : mode === 'mridangam'
                ? 'Carnatic Mridangam'
                : 'South Indian Ghatam'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Dual-Membrane Bessel Acoustics • Tuned Indian Bol Strikes
            </p>
          </div>
        </div>

        {/* Current Bol Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-amber-500/20 backdrop-blur-sm">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Current Stroke</span>
          <span className="text-sm font-serif font-bold text-amber-400">{lastBol}</span>
        </div>
      </div>

      {/* Main Drum Stage */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        <div className="relative w-full max-w-4xl h-80 rounded-3xl bg-gradient-to-r from-[#2c170a] via-[#3a200e] to-[#251307] border-2 border-amber-900/60 shadow-2xl p-6 flex items-center justify-around overflow-hidden">
          {/* Bayan (Left Bass Drum) */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-mono font-bold text-amber-300 mb-2 uppercase tracking-wider">
              Bayan (Bass)
            </span>
            <div
              className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950 border-8 border-[#543015] shadow-2xl flex items-center justify-center p-4 cursor-pointer transition-transform ${
                activeZoneId?.startsWith('bayan') ? 'scale-105 ring-4 ring-amber-400/50' : 'hover:scale-[1.02]'
              }`}
              onClick={() => handleStrike(TABLA_ZONES[0])}
            >
              {/* Outer Kinar rim */}
              <div
                className="absolute inset-2 rounded-full border-2 border-amber-600/30"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStrike(TABLA_ZONES[1]);
                }}
              />

              {/* Bayan Syahi Black Spot (Off-center bass paste) */}
              <div
                className={`w-20 h-20 rounded-full bg-gradient-to-br from-stone-900 via-zinc-950 to-black border border-zinc-700 shadow-inner flex items-center justify-center transition-all ${
                  activeZoneId === 'bayan_center' ? 'scale-110 shadow-[0_0_20px_#f59e0b]' : ''
                }`}
              >
                <span className="text-xs font-serif font-bold text-zinc-400">घे Ge</span>
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono mt-2">Deep modulated bass glide</span>
          </div>

          {/* Dayan (Right Treble Drum) */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-mono font-bold text-sky-300 mb-2 uppercase tracking-wider">
              Dayan (Tuned Treble)
            </span>
            <div
              className={`relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br from-stone-200 via-amber-100 to-amber-200 border-8 border-[#3f200c] shadow-2xl flex items-center justify-center p-3 cursor-pointer transition-transform ${
                activeZoneId?.startsWith('dayan') ? 'scale-105 ring-4 ring-sky-400/50' : 'hover:scale-[1.02]'
              }`}
            >
              {/* Outer Kinar Rim Ring */}
              <div
                className="absolute inset-1 rounded-full border-4 border-amber-300/40 hover:bg-sky-400/20 transition-colors flex items-center justify-center"
                onClick={() => handleStrike(TABLA_ZONES[4])}
              >
                <span className="absolute top-2 text-[10px] font-serif font-bold text-zinc-800">ता Ta</span>
              </div>

              {/* Maidan Middle Ring */}
              <div
                className="w-32 h-32 rounded-full border-2 border-amber-400/30 hover:bg-sky-500/20 transition-colors flex items-center justify-center"
                onClick={() => handleStrike(TABLA_ZONES[3])}
              >
                {/* Syahi Center Black Dot */}
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br from-stone-950 via-black to-zinc-900 border border-zinc-700 shadow-inner flex items-center justify-center cursor-pointer transition-all ${
                    activeZoneId === 'dayan_syahi' ? 'scale-110 shadow-[0_0_20px_#38bdf8]' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStrike(TABLA_ZONES[2]);
                  }}
                >
                  <span className="text-xs font-serif font-bold text-zinc-400">तिं Tin</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono mt-2">Bell-like harmonic ring</span>
          </div>
        </div>
      </div>

      {/* Quick Stroke Triggers Bar */}
      <div className="flex items-center justify-center gap-2 flex-wrap z-10">
        {TABLA_ZONES.map((zone) => (
          <button
            key={zone.id}
            onClick={() => handleStrike(zone)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
              activeZoneId === zone.id
                ? 'bg-amber-400 text-zinc-950 border-white shadow-lg'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-300'
            }`}
          >
            <span className="font-serif font-bold">{zone.bol}</span>
            <span>{zone.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
