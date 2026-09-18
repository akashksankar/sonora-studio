import React, { useEffect, useState } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { tanpuraDroneEngine } from '../../audio/TanpuraDroneEngine';

export const TanpuraDroneBar: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(tanpuraDroneEngine.getIsRunning());
  const [activeString, setActiveString] = useState<number>(0);
  const [rootKey, setRootKey] = useState<string>('C');
  const [volume, setVolume] = useState<number>(0.5);

  useEffect(() => {
    tanpuraDroneEngine.subscribe((running, strIdx) => {
      setIsRunning(running);
      setActiveString(strIdx);
    });
  }, []);

  const toggleDrone = async () => {
    if (isRunning) {
      tanpuraDroneEngine.stop();
    } else {
      await tanpuraDroneEngine.start();
    }
  };

  return (
    <div
      id="tanpura-companion-bar"
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/20 backdrop-blur-md text-xs text-amber-200"
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span className="text-sm">🪔</span>
        <span className="font-semibold text-amber-300 hidden sm:inline">Tanpura:</span>
      </div>

      {/* Start / Stop */}
      <button
        onClick={toggleDrone}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all active:scale-95 ${
          isRunning
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30'
        }`}
        title="Toggle Background Tanpura Drone"
      >
        {isRunning ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Play className="w-3 h-3 fill-current" />
            <span>Drone</span>
          </>
        )}
      </button>

      {/* Root Sa Selector */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-zinc-400 font-mono hidden md:inline">Sa:</span>
        <select
          value={rootKey}
          onChange={(e) => {
            setRootKey(e.target.value);
            tanpuraDroneEngine.setRootKey(e.target.value);
          }}
          className="bg-black/50 border border-amber-500/30 rounded px-1.5 py-0.5 text-xs font-mono text-amber-300 focus:outline-none"
        >
          {['C', 'C#', 'D', 'D#', 'E', 'F', 'G', 'A'].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-1">
        <Volume2 className="w-3 h-3 text-zinc-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setVolume(v);
            tanpuraDroneEngine.setVolume(v);
          }}
          className="w-14 sm:w-16 accent-amber-400 h-1 rounded bg-white/20"
          title="Tanpura Volume"
        />
      </div>

      {/* Shimmering pulse dot */}
      {isRunning && (
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shadow-[0_0_8px_#f59e0b]" />
      )}
    </div>
  );
};
