import React, { useEffect, useState } from 'react';
import { InstrumentConfig, MidiNoteEvent, RootKey } from '../../types';
import { tanpuraDroneEngine } from '../../audio/TanpuraDroneEngine';
import { Play, Square, Volume2 } from 'lucide-react';
import { NOTE_NAMES } from '../../utils/musicTheory';

interface TanpuraSurfaceProps {
  config: InstrumentConfig;
  activeMidiNotes: MidiNoteEvent[];
}

export const TanpuraSurface: React.FC<TanpuraSurfaceProps> = ({ config }) => {
  const [isRunning, setIsRunning] = useState<boolean>(tanpuraDroneEngine.getIsRunning());
  const [activeString, setActiveString] = useState<number>(0);
  const [rootKey, setRootKey] = useState<RootKey>((config.rootKey as RootKey) || 'C');
  const [volume, setVolume] = useState<number>(0.6);
  const [tempoBpm, setTempoBpm] = useState<number>(60);
  const [firstStringTuning, setFirstStringTuning] = useState<'Pa' | 'Ma' | 'Ni'>('Pa');

  useEffect(() => {
    const unsub = tanpuraDroneEngine.subscribe((running, stringIdx) => {
      setIsRunning(running);
      setActiveString(stringIdx);
    });
    return unsub;
  }, []);

  const handleToggleDrone = async () => {
    if (isRunning) {
      tanpuraDroneEngine.stop();
    } else {
      await tanpuraDroneEngine.start(rootKey);
    }
  };

  const handleRootChange = (key: string) => {
    const rk = key as RootKey;
    setRootKey(rk);
    tanpuraDroneEngine.setRootKey(rk);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    tanpuraDroneEngine.setVolume(v);
  };

  const handleTempoChange = (bpm: number) => {
    setTempoBpm(bpm);
    const intervalMs = Math.round(60000 / Math.max(20, bpm));
    tanpuraDroneEngine.setTempo(intervalMs);
  };

  const handleTuningChange = (t: 'Pa' | 'Ma' | 'Ni') => {
    setFirstStringTuning(t);
    tanpuraDroneEngine.setFirstStringTuning(t.toLowerCase() as 'pa' | 'ma' | 'ni');
  };

  const handleManualPluck = (idx: number) => {
    tanpuraDroneEngine.pluckString(idx);
    setActiveString(idx);
  };

  const stringLabels = [
    { idx: 0, name: `1st String (${firstStringTuning})`, swara: firstStringTuning, desc: 'Pancham / Madhyam' },
    { idx: 1, name: '2nd String (Sa)', swara: 'Sa', desc: 'Jodi / Middle Tonic' },
    { idx: 2, name: '3rd String (Sa)', swara: 'Sa', desc: 'Jodi / Middle Tonic' },
    { idx: 3, name: '4th String (Kharaj Sa)', swara: 'Sa (L)', desc: 'Kharaj / Bass Tonic' },
  ];

  return (
    <div
      id="tanpura-surface"
      className="relative w-full h-full min-h-[440px] flex flex-col justify-between select-none bg-gradient-to-b from-[#1b1007] via-[#29170a] to-[#120a04] text-amber-100 overflow-hidden p-3 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-md">
            🪔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-amber-200 tracking-wide">
                Classical Tanpura Drone System
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-serif border border-amber-500/30">
                तानपूरा
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Harmonic Resonance Chamber • Continuous Jivari Thread Buzz • Background Drone
            </p>
          </div>
        </div>

        {/* Master Play/Stop Drone Toggle */}
        <button
          onClick={handleToggleDrone}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-lg active:scale-95 ${
            isRunning
              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
              : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
          }`}
        >
          {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isRunning ? 'Stop Drone' : 'Start Drone'}</span>
        </button>
      </div>

      {/* 4 Vertical Tanpura Strings Visualizer */}
      <div className="relative flex-1 my-3 flex items-center justify-center overflow-x-auto overflow-y-hidden">
        <div className="relative w-full max-w-3xl h-72 rounded-3xl bg-gradient-to-b from-[#351b0a] via-[#48250f] to-[#251206] border-2 border-amber-900/60 shadow-2xl p-6 flex justify-around items-center overflow-hidden">
          {/* Circular Rosewood Tabli Medallion */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-br from-amber-600/10 via-amber-800/10 to-transparent border border-amber-500/10 pointer-events-none" />

          {/* 4 Strings */}
          {stringLabels.map((str) => {
            const isSounding = activeString === str.idx && isRunning;

            return (
              <div
                key={str.idx}
                onClick={() => handleManualPluck(str.idx)}
                className="relative flex flex-col items-center h-full justify-between cursor-pointer group px-4 py-2"
              >
                {/* String Title & Swara */}
                <div className="text-center">
                  <span
                    className={`text-sm font-serif font-bold transition-colors ${
                      isSounding ? 'text-amber-300 scale-110' : 'text-zinc-400'
                    }`}
                  >
                    {str.swara}
                  </span>
                  <p className="text-[9px] text-zinc-500 font-mono">{str.desc}</p>
                </div>

                {/* Vertical String Wire */}
                <div className="relative flex-1 w-8 flex items-center justify-center my-2">
                  <div
                    className={`w-[2px] h-full rounded-full transition-all duration-100 ${
                      isSounding
                        ? 'bg-amber-300 w-[3px] shadow-[0_0_16px_#f59e0b]'
                        : 'bg-gradient-to-b from-amber-300/60 via-amber-200/40 to-amber-400/60 group-hover:bg-amber-300'
                    }`}
                  />
                  {isSounding && (
                    <div className="absolute inset-y-0 w-8 bg-amber-400/10 rounded-full blur-sm animate-pulse" />
                  )}
                </div>

                <span className="text-[10px] text-zinc-500 font-mono group-hover:text-amber-300">
                  Pluck
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tanpura Controls Bar: Root Sa Key, First String Tuning, Tempo, Volume */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 backdrop-blur-sm text-xs">
        {/* Sa Root Key Selector */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono">Sa Tonic:</span>
          <div className="flex items-center gap-1">
            {['C', 'C#', 'D', 'D#', 'E', 'F', 'G', 'A'].map((k) => (
              <button
                key={k}
                onClick={() => handleRootChange(k)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  rootKey === k
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* 1st String Tuning Mode */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono">1st String:</span>
          {(['Pa', 'Ma', 'Ni'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTuningChange(t)}
              className={`px-2 py-1 rounded-lg text-xs font-serif font-bold transition-all ${
                firstStringTuning === t
                  ? 'bg-amber-400 text-zinc-950 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Volume & Tempo Sliders */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 accent-amber-400 h-1 rounded bg-white/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">{tempoBpm} BPM</span>
            <input
              type="range"
              min="30"
              max="120"
              step="5"
              value={tempoBpm}
              onChange={(e) => handleTempoChange(parseInt(e.target.value))}
              className="w-20 accent-amber-400 h-1 rounded bg-white/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
