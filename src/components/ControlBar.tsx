import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Cable,
  Maximize2,
  Lock,
  Unlock,
  Radio,
  Music,
  Users2,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
  Grid,
} from 'lucide-react';
import {
  InstrumentConfig,
  InstrumentId,
  PresetId,
  RootKey,
  ScaleName,
  WaveformType,
} from '../types';
import { NOTE_NAMES, PRESETS, SCALES } from '../utils/musicTheory';
import { INSTRUMENTS } from '../instruments/instrumentRegistry';
import { authenticSampleBank } from '../audio/AuthenticSampleBank';

interface ControlBarProps {
  config: InstrumentConfig;
  onUpdateConfig: (partial: Partial<InstrumentConfig>) => void;
  onSelectPreset: (presetId: PresetId) => void;
  currentWaveform: WaveformType;
  onSelectWaveform: (waveform: WaveformType) => void;
  onOpenEffects: () => void;
  onOpenMidi: () => void;
  midiConnected: boolean;
  activePresetId: PresetId;
  currentInstrument: InstrumentId;
  onOpenInstrumentModal: () => void;
  surfaceType: 'instrument' | 'touchpad';
  onToggleSurfaceType: () => void;
}

const WAVEFORMS: { type: WaveformType; label: string; icon: string }[] = [
  { type: 'sine', label: 'SINE', icon: '∿' },
  { type: 'triangle', label: 'TRI', icon: '∧' },
  { type: 'sawtooth', label: 'SAW', icon: '⩘' },
  { type: 'square', label: 'SQR', icon: '⊓' },
];

export const ControlBar: React.FC<ControlBarProps> = ({
  config,
  onUpdateConfig,
  onSelectPreset,
  currentWaveform,
  onSelectWaveform,
  onOpenEffects,
  onOpenMidi,
  midiConnected,
  activePresetId,
  currentInstrument,
  onOpenInstrumentModal,
  surfaceType,
  onToggleSurfaceType,
}) => {
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const [sampleStatus, setSampleStatus] = useState<'unloaded' | 'loading' | 'ready' | 'error'>(
    authenticSampleBank.getStatus(currentInstrument)
  );

  useEffect(() => {
    setSampleStatus(authenticSampleBank.getStatus(currentInstrument));
    const unsubscribe = authenticSampleBank.subscribe((inst, status) => {
      if (inst === currentInstrument) {
        setSampleStatus(status);
      }
    });
    return unsubscribe;
  }, [currentInstrument]);

  const activeInstDef = INSTRUMENTS[currentInstrument] || INSTRUMENTS.veena;

  const handleOctaveChange = (delta: number) => {
    const nextOctave = Math.max(1, Math.min(6, config.baseOctave + delta));
    onUpdateConfig({ baseOctave: nextOctave });
  };

  return (
    <div
      id="control-bar-dock"
      className="relative z-30 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#0a0a0e]/90 backdrop-blur-xl border-t sm:border border-white/10 sm:rounded-2xl sm:mb-3 shadow-2xl mx-0 sm:mx-4 max-w-6xl w-full"
    >
      {/* Left group: Instrument Picker, Surface Switcher & Presets */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Main Instrument Picker Button */}
        <button
          id="instrument-library-btn"
          onClick={onOpenInstrumentModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-white/[0.08] to-sky-500/15 hover:from-amber-500/25 hover:to-sky-500/25 border border-amber-500/30 hover:border-amber-400/60 text-xs font-semibold text-white transition-all active:scale-95 shadow-md shadow-amber-500/5"
          title="Open Instrument Library (Veena, Sitar, Flute, Piano, etc.)"
        >
          <span className="text-base">{activeInstDef.icon}</span>
          <span className="max-w-[100px] sm:max-w-none truncate font-bold text-amber-200">
            {activeInstDef.name}
          </span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>

        {/* Surface Switcher: Physical Virtual Instrument vs 2D Microtonal Touchpad */}
        <button
          id="surface-toggle-btn"
          onClick={onToggleSurfaceType}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1.5 ${
            surfaceType === 'instrument'
              ? 'bg-white/10 text-white border-white/20 shadow-sm'
              : 'bg-white/[0.03] text-zinc-400 border-white/5 hover:text-white'
          }`}
          title={
            surfaceType === 'instrument'
              ? 'Switch to 2D Microtonal Touchpad'
              : 'Switch to Physical Instrument Surface'
          }
        >
          <span>{surfaceType === 'instrument' ? '🎛️ Physical' : '📐 TouchPad'}</span>
        </button>

        {/* Authentic Acoustic Sound Status Badge */}
        <div
          id="authentic-sound-badge"
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
            sampleStatus === 'ready'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : sampleStatus === 'loading'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-white/[0.04] border-white/10 text-zinc-400'
          }`}
          title="Authentic Studio Acoustic Samples: Real recorded classical instrument sound"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              sampleStatus === 'ready'
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse'
                : sampleStatus === 'loading'
                ? 'bg-amber-400 animate-ping'
                : 'bg-zinc-500'
            }`}
          />
          <span className="font-semibold whitespace-nowrap">
            {sampleStatus === 'ready'
              ? 'Authentic Studio Audio'
              : sampleStatus === 'loading'
              ? 'Loading Samples...'
              : 'Studio Acoustics'}
          </span>
        </div>

        {/* Preset Selector dropdown */}
        <div className="relative">
          <button
            id="preset-selector-btn"
            onClick={() => {
              setShowPresetsMenu(!showPresetsMenu);
              setShowScaleMenu(false);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold uppercase tracking-wider text-white transition-all active:scale-95 hidden lg:flex"
            title="Synth Tone Presets"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">{PRESETS[activePresetId].name}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {showPresetsMenu && (
            <div
              id="preset-dropdown-menu"
              className="absolute bottom-full mb-2 left-0 w-52 bg-[#121218] border border-white/10 rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-1"
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Synthesizer Presets
              </div>
              {(Object.keys(PRESETS) as PresetId[]).map((id) => {
                const p = PRESETS[id];
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onSelectPreset(id);
                      setShowPresetsMenu(false);
                    }}
                    className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg text-left text-xs transition-all ${
                      activePresetId === id
                        ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">{p.subtitle}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Waveform quick buttons */}
        <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-xl p-0.5">
          {WAVEFORMS.map((wf) => (
            <button
              key={wf.type}
              onClick={() => onSelectWaveform(wf.type)}
              data-waveform={wf.type}
              className={`px-2 py-1 sm:px-2.5 rounded-lg text-[11px] font-mono transition-all ${
                currentWaveform === wf.type
                  ? 'bg-white text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={`${wf.label} Waveform`}
            >
              <span className="text-xs mr-0.5">{wf.icon}</span>
              <span className="hidden md:inline">{wf.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center group: Key, Scale & Octave */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Key & Scale Popover */}
        <div className="relative">
          <button
            id="scale-selector-btn"
            onClick={() => {
              setShowScaleMenu(!showScaleMenu);
              setShowPresetsMenu(false);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-all active:scale-95"
          >
            <Music className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono">{config.rootKey}</span>
            <span className="hidden sm:inline capitalize">
              {SCALES[config.scale].name.split(' ')[0]}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {showScaleMenu && (
            <div
              id="scale-dropdown-menu"
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-[#121218] border border-white/10 rounded-xl p-3 shadow-2xl z-50 flex flex-col gap-2.5"
            >
              {/* Root Key Row */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Root Key
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {NOTE_NAMES.map((k) => (
                    <button
                      key={k}
                      onClick={() => onUpdateConfig({ rootKey: k })}
                      className={`py-1 rounded text-xs font-mono transition-all ${
                        config.rootKey === k
                          ? 'bg-white text-zinc-950 font-bold'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scales */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Scale / Mode
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {(Object.keys(SCALES) as ScaleName[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        onUpdateConfig({ scale: s });
                        setShowScaleMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                        config.scale === s
                          ? 'bg-sky-500/20 text-sky-300 font-semibold'
                          : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      {SCALES[s].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Octave Controls */}
        <div className="flex items-center bg-white/[0.04] border border-white/5 rounded-xl p-0.5">
          <button
            id="octave-down-btn"
            onClick={() => handleOctaveChange(-1)}
            disabled={config.baseOctave <= 1}
            className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30 active:scale-95 transition-all"
            title="Octave Down"
          >
            -
          </button>
          <span className="px-1.5 text-xs font-mono font-medium text-zinc-200">
            OCT {config.baseOctave}
          </span>
          <button
            id="octave-up-btn"
            onClick={() => handleOctaveChange(1)}
            disabled={config.baseOctave >= 6}
            className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30 active:scale-95 transition-all"
            title="Octave Up"
          >
            +
          </button>
        </div>
      </div>

      {/* Right group: Play modes, FX, MIDI, Performance */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Scale Lock Toggle */}
        <button
          id="scale-lock-btn"
          onClick={() => onUpdateConfig({ isScaleLocked: !config.isScaleLocked })}
          className={`p-2 rounded-xl text-xs transition-all ${
            config.isScaleLocked
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white'
          }`}
          title={config.isScaleLocked ? 'Scale Locked (Quantized)' : 'Free Scale'}
        >
          {config.isScaleLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        {/* Theremin Continuous Pitch Toggle */}
        <button
          id="theremin-mode-btn"
          onClick={() => onUpdateConfig({ isContinuousPitch: !config.isContinuousPitch })}
          className={`p-2 rounded-xl text-xs transition-all ${
            config.isContinuousPitch
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white'
          }`}
          title={config.isContinuousPitch ? 'Continuous Theremin Pitch' : 'Stepped Pitch'}
        >
          <Radio className="w-3.5 h-3.5" />
        </button>

        {/* Do-Re-Mi Solfege Mode Toggle */}
        <button
          id="solfege-mode-btn"
          onClick={() => onUpdateConfig({ isDoReMiMode: !config.isDoReMiMode })}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold tracking-wider transition-all ${
            config.isDoReMiMode
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white'
          }`}
          title="Toggle Solfege Do-Re-Mi Mode"
        >
          DO
        </button>

        {/* Two-finger Harmony Mode Toggle */}
        <button
          id="harmony-mode-btn"
          onClick={() => onUpdateConfig({ isTwoFingerHarmony: !config.isTwoFingerHarmony })}
          className={`p-2 rounded-xl text-xs transition-all ${
            config.isTwoFingerHarmony
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'bg-white/[0.04] text-zinc-400 hover:text-white'
          }`}
          title="Two-Finger Harmony (+5th)"
        >
          <Users2 className="w-3.5 h-3.5" />
        </button>

        {/* Music Grid Toggle */}
        <button
          id="grid-toggle-btn"
          onClick={() => onUpdateConfig({ showMusicGrid: !config.showMusicGrid })}
          className={`p-2 rounded-xl text-xs transition-all hidden md:flex ${
            config.showMusicGrid
              ? 'bg-white/10 text-white'
              : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300'
          }`}
          title="Toggle Note Grid Guides"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Effects Drawer Button */}
        <button
          id="open-effects-btn"
          onClick={onOpenEffects}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
          title="Audio Effects & DSP"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">FX</span>
        </button>

        {/* MIDI button */}
        <button
          id="open-midi-btn"
          onClick={onOpenMidi}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold transition-all active:scale-95"
          title="Web MIDI Settings"
        >
          <Cable className="w-3.5 h-3.5 text-zinc-400" />
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              midiConnected ? 'bg-emerald-400 shadow-emerald-400 shadow-sm' : 'bg-zinc-600'
            }`}
          />
        </button>

        {/* Performance Mode */}
        <button
          id="toggle-performance-mode-btn"
          onClick={() => onUpdateConfig({ performanceMode: !config.performanceMode })}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-zinc-400 hover:text-white text-xs transition-all active:scale-95"
          title="Performance Mode (Immersive)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
