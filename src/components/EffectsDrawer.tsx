import React from 'react';
import { Sliders, Volume2, X, Sparkles, Activity, RotateCcw } from 'lucide-react';
import { AudioEngineSettings, VisualizerMode } from '../types';

interface EffectsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioEngineSettings;
  onUpdateSettings: (settings: Partial<AudioEngineSettings>) => void;
  visualizerMode: VisualizerMode;
  onSetVisualizerMode: (mode: VisualizerMode) => void;
  accentColor: string;
  onSetAccentColor: (color: string) => void;
  onReset: () => void;
}

const ACCENT_COLORS = [
  { name: 'Sky Cyan', hex: '#38bdf8' },
  { name: 'Electric Emerald', hex: '#34d399' },
  { name: 'Solar Amber', hex: '#fbbf24' },
  { name: 'Neon Rose', hex: '#fb7185' },
  { name: 'Ultra Violet', hex: '#a78bfa' },
  { name: 'Pure White', hex: '#f3f4f6' },
];

export const EffectsDrawer: React.FC<EffectsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  visualizerMode,
  onSetVisualizerMode,
  accentColor,
  onSetAccentColor,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="effects-drawer-overlay"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        id="effects-drawer-panel"
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-[#0f0f13] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-white/80" />
            <div>
              <h2 className="text-sm font-semibold tracking-wider uppercase text-white">
                Audio Engine & Effects
              </h2>
              <p className="text-xs text-zinc-400">Tactile parameter shaping and studio DSP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="reset-effects-btn"
              onClick={onReset}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
              title="Reset parameters to preset default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              id="close-effects-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Output & Filter */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" /> Filter & Dynamics
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Filter Cutoff */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Cutoff</span>
                <span className="font-mono text-zinc-200">{Math.round(settings.filterCutoff)} Hz</span>
              </div>
              <input
                type="range"
                min="200"
                max="18000"
                step="50"
                value={settings.filterCutoff}
                onChange={(e) => onUpdateSettings({ filterCutoff: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Filter Resonance */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Resonance (Q)</span>
                <span className="font-mono text-zinc-200">{settings.filterResonance.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="12"
                step="0.1"
                value={settings.filterResonance}
                onChange={(e) => onUpdateSettings({ filterResonance: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Spatial & Time Effects (Reverb & Delay) */}
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Spatial Effects (Reverb & Stereo Delay)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reverb Mix */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Reverb Mix</span>
                <span className="font-mono text-zinc-200">{Math.round(settings.reverbMix * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.reverbMix}
                onChange={(e) => onUpdateSettings({ reverbMix: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Reverb Decay */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Reverb Decay</span>
                <span className="font-mono text-zinc-200">{settings.reverbDecay.toFixed(1)} s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={settings.reverbDecay}
                onChange={(e) => onUpdateSettings({ reverbDecay: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Delay Mix */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Delay Mix</span>
                <span className="font-mono text-zinc-200">{Math.round(settings.delayMix * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.01"
                value={settings.delayMix}
                onChange={(e) => onUpdateSettings({ delayMix: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Delay Feedback */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Delay Feedback</span>
                <span className="font-mono text-zinc-200">{Math.round(settings.delayFeedback * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.01"
                value={settings.delayFeedback}
                onChange={(e) => onUpdateSettings({ delayFeedback: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Envelope & Saturation */}
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Envelope & Analog Drive
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Attack */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Attack</span>
                <span className="font-mono text-zinc-200">{(settings.attack * 1000).toFixed(0)} ms</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.5"
                step="0.005"
                value={settings.attack}
                onChange={(e) => onUpdateSettings({ attack: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Release */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Release</span>
                <span className="font-mono text-zinc-200">{(settings.release * 1000).toFixed(0)} ms</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.5"
                step="0.05"
                value={settings.release}
                onChange={(e) => onUpdateSettings({ release: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Drive / Distortion */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Drive</span>
                <span className="font-mono text-zinc-200">{Math.round(settings.distortion * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.4"
                step="0.01"
                value={settings.distortion}
                onChange={(e) => onUpdateSettings({ distortion: Number(e.target.value) })}
                className="w-full accent-sky-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Visualizer & Aesthetic Style */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Visualizer & Accent
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['waveform', 'spectrum', 'orb', 'particles', 'minimal'] as VisualizerMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetVisualizerMode(mode)}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium uppercase tracking-wider transition-all ${
                  visualizerMode === mode
                    ? 'bg-white text-zinc-950 shadow-md font-semibold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Accent:</span>
            <div className="flex items-center gap-2 ml-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => onSetAccentColor(c.hex)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    accentColor === c.hex ? 'scale-110 border-white' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
