import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  FileMusic,
  Upload,
} from 'lucide-react';
import { audioEngine } from './audio/AudioEngine';
import { midiManager, MidiStatus } from './midi/MidiManager';
import { midiPlaybackEngine } from './midi/MidiPlaybackEngine';
import { midiLessonEngine } from './midi/MidiLessonEngine';
import { TouchSurface } from './components/TouchSurface';
import { ControlBar } from './components/ControlBar';
import { EffectsDrawer } from './components/EffectsDrawer';
import { MidiModal } from './components/MidiModal';
import { MelodyRecorder } from './components/MelodyRecorder';
import { IntroScreen } from './components/IntroScreen';
import { OnboardingHints } from './components/OnboardingHints';
import { ThemeToggle } from './components/ThemeToggle';
import { MidiImportModal } from './components/MidiImportModal';
import { MidiSongBar } from './components/MidiSongBar';
import { PianoRollView } from './components/PianoRollView';
import { LearnModeOverlay } from './components/LearnModeOverlay';
import { MultiInstrumentStage } from './components/instruments/MultiInstrumentStage';
import { InstrumentSelectorModal } from './components/instruments/InstrumentSelectorModal';
import { TanpuraDroneBar } from './components/instruments/TanpuraDroneBar';
import {
  AppMode,
  AudioEngineSettings,
  GhostTouchPoint,
  InstrumentConfig,
  InstrumentId,
  LearnDifficulty,
  LearnStep,
  MidiNoteEvent,
  ParsedMidiSong,
  PerformanceRecording,
  PresetId,
  RecordedEvent,
  ThemeMode,
  ViewMode,
} from './types';
import { PRESETS, SCALES } from './utils/musicTheory';

export default function App() {
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<PresetId>('pure_sine');
  const [isEffectsOpen, setIsEffectsOpen] = useState<boolean>(false);
  const [isMidiModalOpen, setIsMidiModalOpen] = useState<boolean>(false);
  const [midiConnected, setMidiConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pointerCount, setPointerCount] = useState<number>(0);

  // Theme Mode
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('touchpad_theme') as ThemeMode;
    return saved || 'dark';
  });

  // Mode & MIDI Add-on States
  const [appMode, setAppMode] = useState<AppMode>('play');
  const [viewMode, setViewMode] = useState<ViewMode>('touch');
  const [activeMidiSong, setActiveMidiSong] = useState<ParsedMidiSong | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [ghostHandEnabled, setGhostHandEnabled] = useState<boolean>(true);
  const [activeMidiNotes, setActiveMidiNotes] = useState<MidiNoteEvent[]>([]);
  const [ghostTouch, setGhostTouch] = useState<GhostTouchPoint | null>(null);
  const [isWindowDragOver, setIsWindowDragOver] = useState<boolean>(false);

  // Multi-Instrument State
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentId>('veena');
  const [surfaceType, setSurfaceType] = useState<'instrument' | 'touchpad'>('instrument');
  const [isInstrumentModalOpen, setIsInstrumentModalOpen] = useState<boolean>(false);

  // Learn Mode states
  const [learnDifficulty, setLearnDifficulty] = useState<LearnDifficulty>('beginner');
  const [currentLearnStep, setCurrentLearnStep] = useState<LearnStep | null>(null);
  const [isComparingOriginal, setIsComparingOriginal] = useState<boolean>(false);
  const [userPerformanceEvents, setUserPerformanceEvents] = useState<RecordedEvent[]>([]);

  // Manual Performance Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [activeRecording, setActiveRecording] = useState<PerformanceRecording | null>(null);
  const [replayTimeMs, setReplayTimeMs] = useState<number | null>(null);
  const recordingEventsRef = useRef<RecordedEvent[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  // Instrument Config
  const [config, setConfig] = useState<InstrumentConfig>({
    rootKey: 'C',
    scale: 'major',
    baseOctave: 4,
    octaveSpan: 2,
    isScaleLocked: true,
    isContinuousPitch: false,
    isDoReMiMode: false,
    isTwoFingerHarmony: false,
    harmonyInterval: 7, // Perfect fifth
    visualizerMode: 'waveform',
    displayMode: 'notes',
    accentColor: '#38bdf8',
    showMusicGrid: true,
    performanceMode: false,
    theme: 'dark',
    ghostHandEnabled: true,
    activeMidiSong: null,
    viewMode: 'touch',
  });

  // Audio Engine Settings (live mirror)
  const [audioSettings, setAudioSettings] = useState<AudioEngineSettings>(
    audioEngine.getSettings()
  );

  // Synchronize Theme with DOM & localStorage
  useEffect(() => {
    localStorage.setItem('touchpad_theme', theme);
    const root = document.documentElement;

    let effectiveTheme = theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    }

    if (effectiveTheme === 'light') {
      root.classList.add('theme-light');
      setConfig((c) => ({ ...c, theme: 'light' }));
    } else {
      root.classList.remove('theme-light');
      setConfig((c) => ({ ...c, theme: 'dark' }));
    }
  }, [theme]);

  // Monitor MIDI status
  useEffect(() => {
    const unsub = midiManager.subscribeStatus((status: MidiStatus) => {
      setMidiConnected(status === 'connected');
    });
    return () => unsub();
  }, []);

  // Synchronize MIDI Playback Engine subscriptions
  useEffect(() => {
    const unsub = midiPlaybackEngine.subscribe({
      onTick: (_timeMs, activeNotes, currentGhostTouch) => {
        setActiveMidiNotes(activeNotes);
        setGhostTouch(currentGhostTouch);
      },
      onStateChange: () => {},
      onSongEnd: () => {
        setActiveMidiNotes([]);
        setGhostTouch(null);
      },
    });

    return () => unsub();
  }, []);

  // Synchronize Learn Mode current step for TouchPad target guidance
  useEffect(() => {
    const unsub = midiLessonEngine.subscribe({
      onStepChange: (step) => {
        setCurrentLearnStep(step);
      },
      onFeedback: () => {},
      onLessonComplete: () => {
        setCurrentLearnStep(null);
      },
    });

    return () => unsub();
  }, []);

  // Update instrument configuration
  const handleUpdateConfig = useCallback((partial: Partial<InstrumentConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  // Update AudioEngine parameters
  const handleUpdateAudioSettings = useCallback((partial: Partial<AudioEngineSettings>) => {
    setAudioSettings((prev) => {
      const updated = { ...prev, ...partial };
      audioEngine.updateSettings(partial);
      return updated;
    });
  }, []);

  // Apply a sound preset
  const handleSelectPreset = useCallback(
    (presetId: PresetId) => {
      setActivePresetId(presetId);
      const preset = PRESETS[presetId];

      const newSettings: Partial<AudioEngineSettings> = {
        waveform: preset.waveform,
        attack: preset.attack,
        decay: preset.decay,
        sustain: preset.sustain,
        release: preset.release,
        filterCutoff: preset.filterCutoff,
        filterResonance: preset.filterResonance,
        reverbMix: preset.reverbMix,
        reverbDecay: preset.reverbDecay,
        delayTime: preset.delayTime,
        delayFeedback: preset.delayFeedback,
        delayMix: preset.delayMix,
        distortion: preset.distortion,
      };

      audioEngine.updateSettings(newSettings);
      setAudioSettings((prev) => ({ ...prev, ...newSettings }));

      handleUpdateConfig({
        isContinuousPitch: preset.continuousPitch,
      });
    },
    [handleUpdateConfig]
  );

  const handleResetPreset = useCallback(() => {
    handleSelectPreset(activePresetId);
  }, [activePresetId, handleSelectPreset]);

  // Handle Song Loaded from Import Modal
  const handleSongLoaded = (
    song: ParsedMidiSong,
    targetMode: 'play' | 'learn',
    targetInstrument?: InstrumentId
  ) => {
    const inst = targetInstrument || currentInstrument;
    setCurrentInstrument(inst);
    setActiveMidiSong(song);
    handleUpdateConfig({ activeMidiSong: song });
    midiPlaybackEngine.setPrimaryInstrument(inst);
    midiPlaybackEngine.applyInstrumentToAllTracks(inst);
    midiPlaybackEngine.loadSong(song);

    if (targetMode === 'learn') {
      midiPlaybackEngine.pause();
      setActiveMidiNotes([]);
      setAppMode('learn');
      midiLessonEngine.prepareLesson(song, learnDifficulty, inst);
      midiLessonEngine.startLesson();
    } else {
      midiLessonEngine.stopLesson();
      setAppMode('midi_play');
      midiPlaybackEngine.play();
    }
  };

  const handleSetAppMode = useCallback(
    (mode: AppMode) => {
      setAppMode(mode);
      if (mode === 'learn') {
        midiPlaybackEngine.pause();
        setActiveMidiNotes([]);
        if (activeMidiSong) {
          midiLessonEngine.prepareLesson(activeMidiSong, learnDifficulty, currentInstrument);
          midiLessonEngine.startLesson();
        }
      } else if (mode === 'midi_play') {
        midiLessonEngine.stopLesson();
        if (activeMidiSong) {
          midiPlaybackEngine.play();
        }
      } else {
        midiPlaybackEngine.stop();
        midiLessonEngine.stopLesson();
        setActiveMidiNotes([]);
      }
    },
    [activeMidiSong, learnDifficulty, currentInstrument]
  );

  const handleCloseSong = () => {
    midiPlaybackEngine.stop();
    midiLessonEngine.stopLesson();
    setActiveMidiSong(null);
    setAppMode('play');
    setActiveMidiNotes([]);
    setGhostTouch(null);
    handleUpdateConfig({ activeMidiSong: null });
  };

  // Recording Handlers
  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      const duration = performance.now() - recordingStartTimeRef.current;
      const finishedRecording: PerformanceRecording = {
        id: `rec_${Date.now()}`,
        createdAt: Date.now(),
        durationMs: duration,
        events: [...recordingEventsRef.current],
        key: config.rootKey,
        scale: config.scale,
        baseOctave: config.baseOctave,
      };
      setActiveRecording(finishedRecording);
    } else {
      recordingEventsRef.current = [];
      recordingStartTimeRef.current = performance.now();
      setIsRecording(true);
      setReplayTimeMs(null);
    }
  }, [isRecording, config.rootKey, config.scale, config.baseOctave]);

  const handleRecordEvent = useCallback((event: RecordedEvent) => {
    const relTimestamp = performance.now() - recordingStartTimeRef.current;
    recordingEventsRef.current.push({
      ...event,
      timestamp: relTimestamp,
    });
    // If in Learn Mode, also append to user performance events
    setUserPerformanceEvents((prev) => [...prev, { ...event, timestamp: relTimestamp }]);
  }, []);

  const handleClearRecording = useCallback(() => {
    recordingEventsRef.current = [];
    setActiveRecording(null);
    setReplayTimeMs(null);
    setUserPerformanceEvents([]);
  }, []);

  // Replay user performance in learn mode
  const handleReplayUserPerformance = () => {
    if (userPerformanceEvents.length === 0) return;
    const rec: PerformanceRecording = {
      id: `perf_${Date.now()}`,
      createdAt: Date.now(),
      durationMs: activeMidiSong ? activeMidiSong.durationMs : 10000,
      events: userPerformanceEvents,
      key: config.rootKey,
      scale: config.scale,
      baseOctave: config.baseOctave,
    };
    setActiveRecording(rec);
    setReplayTimeMs(0);
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Master Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.updateSettings({
      masterVolume: nextMuted ? 0 : audioSettings.masterVolume,
    });
  };

  // Window drag-and-drop detection for instant MIDI play
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsWindowDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (!e.relatedTarget) {
        setIsWindowDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsWindowDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        setIsImportModalOpen(true);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Keyboard Shortcuts for desktop convenience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (appMode === 'midi_play') {
          if (midiPlaybackEngine.getState() === 'playing') {
            midiPlaybackEngine.pause();
          } else {
            midiPlaybackEngine.play();
          }
        } else {
          handleToggleRecord();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (e.key === 'Escape') {
        if (config.performanceMode) {
          handleUpdateConfig({ performanceMode: false });
        }
        setIsEffectsOpen(false);
        setIsMidiModalOpen(false);
        setIsImportModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleRecord, config.performanceMode, handleUpdateConfig, appMode]);

  const isLight = theme === 'light';

  return (
    <main
      className={`relative w-screen h-screen overflow-hidden flex flex-col justify-between select-none touch-none transition-colors duration-300 ${
        isLight ? 'bg-[#F7F7F5] text-[#111111]' : 'bg-[#070709] text-zinc-100'
      }`}
    >
      {/* Intro Landing Splash Experience */}
      {!hasEntered && <IntroScreen onEnter={() => setHasEntered(true)} />}

      {/* Progressive Onboarding Hints */}
      {hasEntered && !config.performanceMode && appMode === 'play' && (
        <OnboardingHints pointerCount={pointerCount} />
      )}

      {/* Global Drop Overlay Badge */}
      {isWindowDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none animate-fade-in">
          <div className="px-8 py-4 rounded-2xl bg-sky-500 text-white font-mono font-bold tracking-widest text-lg shadow-2xl flex items-center gap-3 animate-bounce">
            <Upload className="w-6 h-6" />
            <span>DROP TO PLAY</span>
          </div>
        </div>
      )}

      {/* Unified Navigation: Show standard header in free play, or Unified Studio Bar when MIDI song is active */}
      {!activeMidiSong ? (
        <header
          id="touchpad-top-bar"
          className={`relative z-30 flex items-center justify-between px-3 sm:px-6 pt-3 pb-2 transition-all duration-300 ${
            config.performanceMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'
          }`}
        >
          {/* Brand & Scale status */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold tracking-[0.25em] uppercase font-mono ${
                  isLight ? 'text-[#111111]' : 'text-white'
                }`}
              >
                TOUCHPAD
              </span>
              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-zinc-500" />
              <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-400">
                {config.rootKey} {SCALES[config.scale].name.split(' ')[0]}
              </span>
            </div>

            {/* Mode Badges */}
            <div className="hidden md:flex items-center gap-1.5">
              {config.isContinuousPitch && (
                <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[9px] font-mono uppercase tracking-wider border border-violet-500/30">
                  Theremin
                </span>
              )}
              {config.isDoReMiMode && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-mono uppercase tracking-wider border border-amber-500/30">
                  Solfege
                </span>
              )}
              {config.isTwoFingerHarmony && (
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[9px] font-mono uppercase tracking-wider border border-sky-500/30">
                  +5th
                </span>
              )}
            </div>
          </div>

          {/* Center: Prominent minimalist IMPORT MIDI button */}
          <div className="flex items-center gap-2">
            <button
              id="import-midi-btn"
              onClick={() => setIsImportModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold tracking-wider uppercase transition-all active:scale-95 cursor-pointer ${
                isLight
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'bg-white text-zinc-950 hover:bg-zinc-100 shadow-md'
              }`}
              title="Import Standard MIDI file (.mid, .midi)"
            >
              <FileMusic className="w-3.5 h-3.5" />
              <span>IMPORT MIDI</span>
            </button>

            {/* Melody Recorder (Free play mode only) */}
            {appMode === 'play' && (
              <div className="hidden sm:flex items-center">
                <MelodyRecorder
                  isRecording={isRecording}
                  onToggleRecord={handleToggleRecord}
                  activeRecording={activeRecording}
                  onClearRecording={handleClearRecording}
                  onReplayTimeChange={setReplayTimeMs}
                  onOpenMidiModal={() => setIsMidiModalOpen(true)}
                />
              </div>
            )}
          </div>

          {/* Right utility buttons: Tanpura Drone, Theme toggle, Mute, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Tanpura Drone companion bar */}
            <div className="hidden lg:flex">
              <TanpuraDroneBar />
            </div>

            {/* Theme Switcher */}
            <ThemeToggle currentTheme={theme} onThemeChange={setTheme} />

            {/* Master Mute */}
            <button
              id="master-mute-btn"
              onClick={handleToggleMute}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {/* Fullscreen toggle */}
            <button
              id="fullscreen-toggle-btn"
              onClick={handleToggleFullscreen}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors hidden sm:flex"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>
      ) : (
        /* Sleek Unified Studio Top Bar when MIDI is active (Zero overlay issues) */
        <MidiSongBar
          song={activeMidiSong}
          appMode={appMode}
          onSetAppMode={handleSetAppMode}
          viewMode={viewMode}
          onSetViewMode={setViewMode}
          ghostHandEnabled={ghostHandEnabled}
          onToggleGhostHand={() => {
            const next = !ghostHandEnabled;
            setGhostHandEnabled(next);
            handleUpdateConfig({ ghostHandEnabled: next });
          }}
          onCloseSong={handleCloseSong}
          currentInstrument={currentInstrument}
          onSelectInstrument={(inst) => {
            setCurrentInstrument(inst);
            midiPlaybackEngine.setPrimaryInstrument(inst);
            midiPlaybackEngine.applyInstrumentToAllTracks(inst);
            midiLessonEngine.setTargetInstrument(inst);
          }}
          learnDifficulty={learnDifficulty}
          onSelectDifficulty={(diff) => {
            setLearnDifficulty(diff);
            midiLessonEngine.prepareLesson(activeMidiSong, diff, currentInstrument);
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      )}

      {/* Main Expressive Instrument Stage */}
      <section
        id="instrument-stage"
        className="relative flex-1 w-full h-full overflow-hidden flex flex-col"
      >
        {/* If Roll View is selected, display Piano Roll View */}
        {activeMidiSong && viewMode === 'roll' ? (
          <PianoRollView
            song={activeMidiSong}
            theme={theme}
            accentColor={config.accentColor}
          />
        ) : (
          /* Multi-Instrument Virtual Performance Stage */
          <MultiInstrumentStage
            instrumentId={currentInstrument}
            surfaceType={surfaceType}
            config={{ ...config, ghostHandEnabled }}
            isRecording={isRecording}
            onRecordEvent={handleRecordEvent}
            activeRecording={activeRecording}
            replayTimeMs={replayTimeMs}
            onPointerCountChange={setPointerCount}
            appMode={appMode}
            activeMidiSong={activeMidiSong}
            activeMidiNotes={activeMidiNotes}
            ghostTouch={ghostHandEnabled ? ghostTouch : null}
            currentLearnStep={currentLearnStep}
            isComparingOriginal={isComparingOriginal}
            userPerformanceEvents={userPerformanceEvents}
          />
        )}

        {/* Learn Mode Overlay HUD & Interactive Guidance */}
        {appMode === 'learn' && activeMidiSong && (
          <LearnModeOverlay
            song={activeMidiSong}
            difficulty={learnDifficulty}
            onSelectDifficulty={(diff) => {
              setLearnDifficulty(diff);
              midiLessonEngine.prepareLesson(activeMidiSong, diff, currentInstrument);
            }}
            onReplayUserPerformance={handleReplayUserPerformance}
            onToggleCompareOriginal={() =>
              setIsComparingOriginal(!isComparingOriginal)
            }
            isComparing={isComparingOriginal}
            onClose={() => setAppMode('midi_play')}
            currentInstrument={currentInstrument}
            onSelectInstrument={(inst) => {
              setCurrentInstrument(inst);
              midiPlaybackEngine.setPrimaryInstrument(inst);
              midiPlaybackEngine.applyInstrumentToAllTracks(inst);
              midiLessonEngine.setTargetInstrument(inst);
            }}
          />
        )}

        {/* Minimal exit button when in Performance Mode */}
        {config.performanceMode && (
          <button
            id="exit-performance-mode-btn"
            onClick={() => handleUpdateConfig({ performanceMode: false })}
            className="absolute top-4 right-4 z-40 px-3 py-1.5 rounded-full bg-black/60 border border-white/20 text-white text-[11px] font-mono tracking-wider opacity-30 hover:opacity-100 transition-opacity"
          >
            EXIT PERFORMANCE
          </button>
        )}
      </section>

      {/* Floating Bottom Control Bar Dock (Synthesizer, scales, octaves, FX) */}
      {!config.performanceMode && (
        <footer className="relative z-30 flex justify-center pb-2 sm:pb-3 px-2 pointer-events-auto">
          <ControlBar
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onSelectPreset={handleSelectPreset}
            currentWaveform={audioSettings.waveform}
            onSelectWaveform={(wf) => handleUpdateAudioSettings({ waveform: wf })}
            onOpenEffects={() => setIsEffectsOpen(true)}
            onOpenMidi={() => setIsMidiModalOpen(true)}
            midiConnected={midiConnected}
            activePresetId={activePresetId}
            currentInstrument={currentInstrument}
            onOpenInstrumentModal={() => setIsInstrumentModalOpen(true)}
            surfaceType={surfaceType}
            onToggleSurfaceType={() =>
              setSurfaceType((prev) => (prev === 'instrument' ? 'touchpad' : 'instrument'))
            }
          />
        </footer>
      )}

      {/* Multi-Instrument Library Selection Modal */}
      <InstrumentSelectorModal
        isOpen={isInstrumentModalOpen}
        onClose={() => setIsInstrumentModalOpen(false)}
        selectedInstrument={currentInstrument}
        onSelectInstrument={(id) => {
          setCurrentInstrument(id);
          midiPlaybackEngine.setPrimaryInstrument(id);
        }}
      />

      {/* MIDI Import Modal */}
      <MidiImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSongLoaded={handleSongLoaded}
      />

      {/* Effects & Audio DSP Drawer */}
      <EffectsDrawer
        isOpen={isEffectsOpen}
        onClose={() => setIsEffectsOpen(false)}
        settings={audioSettings}
        onUpdateSettings={handleUpdateAudioSettings}
        visualizerMode={config.visualizerMode}
        onSetVisualizerMode={(mode) => handleUpdateConfig({ visualizerMode: mode })}
        accentColor={config.accentColor}
        onSetAccentColor={(col) => handleUpdateConfig({ accentColor: col })}
        onReset={handleResetPreset}
      />

      {/* MIDI Device & Export Modal */}
      <MidiModal
        isOpen={isMidiModalOpen}
        onClose={() => setIsMidiModalOpen(false)}
        activeRecording={activeRecording}
      />
    </main>
  );
}
