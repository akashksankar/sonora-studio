import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Volume2,
  VolumeX,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  SlidersHorizontal,
  Hand,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Music,
  Target,
  Sun,
  Moon,
} from 'lucide-react';
import {
  midiPlaybackEngine,
  PlaybackState,
} from '../midi/MidiPlaybackEngine';
import { midiLessonEngine } from '../midi/MidiLessonEngine';
import {
  AppMode,
  InstrumentId,
  LearnDifficulty,
  LearnStep,
  ParsedMidiSong,
  ThemeMode,
  ViewMode,
} from '../types';
import { INSTRUMENTS, getSargamNote } from '../instruments/instrumentRegistry';
import { InstrumentMidiConverter } from '../midi/InstrumentMidiConverter';

interface MidiSongBarProps {
  song: ParsedMidiSong;
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  ghostHandEnabled: boolean;
  onToggleGhostHand: () => void;
  onCloseSong: () => void;
  currentInstrument?: InstrumentId;
  onSelectInstrument?: (inst: InstrumentId) => void;
  learnDifficulty?: LearnDifficulty;
  onSelectDifficulty?: (diff: LearnDifficulty) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

const DIFFICULTIES: { id: LearnDifficulty; label: string }[] = [
  { id: 'beginner', label: 'EASY' },
  { id: 'intermediate', label: 'MEDIUM' },
  { id: 'advanced', label: 'HARD' },
];

export const MidiSongBar: React.FC<MidiSongBarProps> = ({
  song,
  appMode,
  onSetAppMode,
  viewMode,
  onSetViewMode,
  ghostHandEnabled,
  onToggleGhostHand,
  onCloseSong,
  currentInstrument = 'veena',
  onSelectInstrument,
  learnDifficulty = 'beginner',
  onSelectDifficulty,
  isMuted = false,
  onToggleMute,
  isFullscreen = false,
  onToggleFullscreen,
  theme = 'dark',
  onToggleTheme,
}) => {
  // Playback state
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [currentTempo, setCurrentTempo] = useState<number>(song.tempoBpm);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [loopA, setLoopA] = useState<number>(0);
  const [loopB, setLoopB] = useState<number>(song.durationMs);

  // Learn state
  const [currentStep, setCurrentStep] = useState<LearnStep | null>(null);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [currentBpm, setCurrentBpm] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    status: 'correct' | 'try_again' | 'chord_complete';
    text: string;
  } | null>(null);

  // Menus
  const [showInstrumentMenu, setShowInstrumentMenu] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [showTrackMixer, setShowTrackMixer] = useState<boolean>(false);

  // Sync current instrument
  const activeInst = (currentInstrument || 'veena') as InstrumentId;

  // Playback engine subscriber
  useEffect(() => {
    const unsub = midiPlaybackEngine.subscribe({
      onTick: (timeMs) => setCurrentTimeMs(timeMs),
      onStateChange: (st) => setPlaybackState(st),
      onSongEnd: () => setPlaybackState('stopped'),
    });
    setPlaybackState(midiPlaybackEngine.getState());
    setCurrentTempo(midiPlaybackEngine.getTempoBpm());
    return () => unsub();
  }, []);

  // Lesson engine subscriber
  useEffect(() => {
    const unsub = midiLessonEngine.subscribe({
      onStepChange: (step, idx, total) => {
        setCurrentStep(step);
        setStepIndex(idx);
        setTotalSteps(total);
      },
      onFeedback: (status, text, _rating, streakVal, bpmVal) => {
        setFeedback({ status, text });
        if (typeof streakVal === 'number') setStreak(streakVal);
        if (typeof bpmVal === 'number' && bpmVal > 0) setCurrentBpm(bpmVal);
        setTimeout(() => {
          setFeedback((prev) => (prev?.text === text ? null : prev));
        }, 1200);
      },
      onLessonComplete: () => {},
    });

    const cur = midiLessonEngine.getCurrentStep();
    setCurrentStep(cur);
    const prog = midiLessonEngine.getProgress();
    setStepIndex(prog.current - 1);
    setTotalSteps(prog.total);
    setStreak(midiLessonEngine.getStreak());

    return () => unsub();
  }, []);

  const handleTogglePlay = () => {
    if (playbackState === 'playing') {
      midiPlaybackEngine.pause();
    } else {
      midiPlaybackEngine.play();
    }
  };

  const handleRestart = () => {
    if (appMode === 'learn') {
      midiLessonEngine.goToStep(0);
    } else {
      midiPlaybackEngine.restart();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetMs = ratio * song.durationMs;
    midiPlaybackEngine.seek(targetMs);
  };

  const handleInstrumentChange = (instId: InstrumentId) => {
    setShowInstrumentMenu(false);
    onSelectInstrument?.(instId);
    midiPlaybackEngine.setPrimaryInstrument(instId);
    midiPlaybackEngine.applyInstrumentToAllTracks(instId);
    midiLessonEngine.setTargetInstrument(instId);
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Target step coordinates & info
  const nextStep = midiLessonEngine.getNextStep();
  const targetMap =
    currentStep && currentStep.expectedNotes.length > 0
      ? InstrumentMidiConverter.mapNoteToInstrument(
          currentStep.expectedNotes[0].note,
          activeInst
        )
      : null;

  const currentNoteName =
    currentStep && currentStep.expectedNotes.length > 0
      ? currentStep.isChord
        ? currentStep.chordName || 'Chord'
        : currentStep.expectedNotes[0].noteName
      : 'Ready';

  const currentSwara =
    currentStep && currentStep.expectedNotes.length > 0
      ? getSargamNote(currentStep.expectedNotes[0].note, 0)
      : null;

  const nextNoteName =
    nextStep && nextStep.expectedNotes.length > 0
      ? nextStep.expectedNotes[0].noteName
      : null;

  const progressPct =
    appMode === 'learn'
      ? totalSteps > 0
        ? Math.min(100, ((stepIndex + 1) / totalSteps) * 100)
        : 0
      : Math.min(100, (currentTimeMs / song.durationMs) * 100);

  return (
    <div
      id="unified-midi-top-bar"
      className="relative z-30 w-full bg-[#0a0a0f]/95 backdrop-blur-2xl border-b border-white/10 text-zinc-200 select-none shadow-xl"
    >
      {/* 2px Micro-Progress Bar right at the top */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-white/5 overflow-hidden">
        <div
          className={`h-full transition-all duration-150 ${
            appMode === 'learn'
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400'
              : 'bg-gradient-to-r from-sky-500 to-indigo-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-col gap-1.5">
        {/* Row 1: Unified Studio Navigation & Quick Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Exit & Song Title & Instrument Sound Pill */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Exit Song Button */}
            <button
              id="exit-song-btn"
              onClick={onCloseSong}
              className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-white/10 transition-colors"
              title="Close Song and Return to Free Play"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Song Title & Tempo */}
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs sm:text-sm text-white tracking-wide truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs font-mono">
                {song.title}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                {currentTempo} BPM &bull; {song.timeSignature}
              </span>
            </div>

            {/* Global Instrument Sound Selector Dropdown */}
            <div className="relative">
              <button
                id="song-instrument-selector-btn"
                onClick={() => setShowInstrumentMenu(!showInstrumentMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-mono font-medium transition-all shadow-sm active:scale-95"
                title="Change Authentically Converted Instrument Sound"
              >
                <span className="text-sm">{INSTRUMENTS[activeInst]?.icon || '🪕'}</span>
                <span className="font-semibold hidden xs:inline truncate max-w-[90px] sm:max-w-none">
                  {INSTRUMENTS[activeInst]?.name.split(' ')[0]}
                </span>
                <span className="text-[10px] opacity-70">▾</span>
              </button>

              {showInstrumentMenu && (
                <div className="absolute top-full mt-1.5 left-0 w-52 bg-[#12121a] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 animate-fade-in">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 px-2 py-1 border-b border-white/5">
                    Instrument Sound
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {Object.values(INSTRUMENTS).map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => handleInstrumentChange(inst.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors ${
                          activeInst === inst.id
                            ? 'bg-amber-500/20 text-amber-200 font-bold border border-amber-500/30'
                            : 'hover:bg-white/5 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{inst.icon}</span>
                          <span className="truncate">{inst.name}</span>
                        </div>
                        {activeInst === inst.id && (
                          <span className="text-[9px] text-amber-400 font-mono">ON</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center / Right: Mode Switcher [ LEARN | PLAY ] & Quick Utility */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Play vs Interactive Learn Segmented Toggle */}
            <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/10">
              <button
                id="mode-learn-toggle"
                onClick={() => onSetAppMode('learn')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  appMode === 'learn'
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Interactive Step-by-Step Learning: Click as fast as you can in rhythm!"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>LEARN</span>
              </button>
              <button
                id="mode-play-toggle"
                onClick={() => onSetAppMode('midi_play')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  appMode === 'midi_play'
                    ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Continuous Audio Playback"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </button>
            </div>

            {/* View Mode: Touch vs Roll */}
            <div className="hidden sm:flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/10">
              <button
                onClick={() => onSetViewMode('touch')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all ${
                  viewMode === 'touch'
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                STAGE
              </button>
              <button
                onClick={() => onSetViewMode('roll')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-all ${
                  viewMode === 'roll'
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ROLL
              </button>
            </div>

            {/* Quick settings drawer button */}
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`p-1.5 rounded-xl border transition-all ${
                showSettingsDrawer
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white border-white/10'
              }`}
              title="Song Options, Mixer & Difficulty"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Master Mute */}
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors border border-white/10 hidden sm:flex"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Fullscreen */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors border border-white/10 hidden md:flex"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Mode-Specific Interactive Streamlined HUD */}
        {appMode === 'learn' ? (
          /* ========================================================
             INTERACTIVE LEARN MODE: STREAMLINED FAST RHYTHM HUD
             ======================================================== */
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 flex-wrap">
            {/* Step Target Note Display & Visual Cue */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Target Note Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 shadow-sm animate-pulse">
                <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold text-xs sm:text-sm font-mono tracking-wider">
                  {currentNoteName}
                </span>
                {currentSwara && (
                  <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-serif font-bold">
                    {currentSwara}
                  </span>
                )}
                {targetMap && targetMap.fret !== undefined && (
                  <span className="text-[10px] text-zinc-300 font-mono hidden xs:inline">
                    &bull; Fret {targetMap.fret}
                  </span>
                )}
              </div>

              {/* Next Note Cue */}
              {nextNoteName && (
                <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono hidden sm:flex">
                  <span className="text-zinc-600">➔</span>
                  <span className="text-zinc-300 font-semibold">{nextNoteName}</span>
                </div>
              )}

              {/* Rhythm Combo Streak Counter */}
              {streak > 1 && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 text-orange-300 text-xs font-mono font-bold animate-bounce">
                  <Flame className="w-3.5 h-3.5 text-orange-400 fill-current" />
                  <span>{streak}x STREAK</span>
                </div>
              )}

              {/* Rhythm Speed BPM */}
              {currentBpm > 0 && (
                <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.04] text-zinc-400 text-[10px] font-mono">
                  <Zap className="w-3 h-3 text-sky-400" />
                  <span>{currentBpm} BPM</span>
                </div>
              )}

              {/* Instant Feedback Flash */}
              {feedback && (
                <div
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg transition-all animate-fade-in ${
                    feedback.status === 'correct'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {feedback.text}
                </div>
              )}
            </div>

            {/* Right: Step Transport Controls & Step Counter */}
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Step counter */}
              <span className="text-[11px] font-mono text-zinc-400 mr-1">
                {stepIndex + 1} / {totalSteps || 1}
              </span>

              {/* Prev Step */}
              <button
                onClick={() => midiLessonEngine.prevStep()}
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors"
                title="Previous Note (Rewind Step)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Hear Note Audio Preview */}
              <button
                onClick={() => midiLessonEngine.playStepPreview()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-semibold transition-all active:scale-95 shadow-sm"
                title="Hear how this target note sounds"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Hear</span>
              </button>

              {/* Next Step */}
              <button
                onClick={() => midiLessonEngine.nextStep()}
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors"
                title="Next Note (Skip Step)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================
             CONTINUOUS PLAY MODE: SCRUBBER & TRANSPORT HUD
             ======================================================== */
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
            {/* Play/Pause & Restart */}
            <div className="flex items-center gap-1.5">
              <button
                id="midi-play-pause-btn"
                onClick={handleTogglePlay}
                className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-zinc-950 font-bold hover:bg-zinc-100 transition-transform active:scale-95 shadow-md cursor-pointer"
                title={playbackState === 'playing' ? 'Pause' : 'Play'}
              >
                {playbackState === 'playing' ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              <button
                id="midi-restart-btn"
                onClick={handleRestart}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Restart from beginning"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Time display */}
              <span className="text-[11px] font-mono text-zinc-400 ml-1">
                {formatTime(currentTimeMs)} / {formatTime(song.durationMs)}
              </span>
            </div>

            {/* Clickable Scrubber Timeline */}
            <div
              id="midi-timeline-track"
              onClick={handleSeek}
              className="relative flex-1 h-2 sm:h-2.5 bg-white/10 hover:bg-white/20 rounded-full overflow-hidden cursor-pointer group transition-all mx-2"
            >
              <div
                className="absolute top-0 bottom-0 left-0 bg-sky-400 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* A-B Loop toggle */}
            <button
              onClick={() => {
                const next = !isLooping;
                setIsLooping(next);
                midiPlaybackEngine.setLoop(next, loopA, loopB);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-mono transition-all border ${
                isLooping
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-white/[0.04] text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span className="hidden sm:inline">LOOP</span>
            </button>
          </div>
        )}
      </div>

      {/* Slide-Down Quick Settings & Track Mixer Drawer */}
      {showSettingsDrawer && (
        <div className="border-t border-white/10 bg-[#0e0e14] px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 animate-fade-in text-xs">
          {/* Difficulty selector (Learn mode) */}
          {appMode === 'learn' && onSelectDifficulty && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                Difficulty:
              </span>
              <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/10">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      onSelectDifficulty(d.id);
                      midiLessonEngine.setDifficulty(d.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono tracking-wider transition-all ${
                      learnDifficulty === d.id
                        ? 'bg-amber-500 text-zinc-950 font-bold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ghost Touch Hand Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
              Ghost Hand:
            </span>
            <button
              onClick={onToggleGhostHand}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono transition-all border ${
                ghostHandEnabled
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                  : 'bg-white/[0.04] text-zinc-500 border-white/5 hover:text-zinc-300'
              }`}
            >
              <Hand className="w-3 h-3" />
              <span>{ghostHandEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Track Mixer button */}
          <button
            onClick={() => setShowTrackMixer(!showTrackMixer)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 font-mono text-xs"
          >
            <SlidersHorizontal className="w-3 h-3 text-zinc-400" />
            <span>MIDI Tracks ({song.tracks.length})</span>
          </button>
        </div>
      )}

      {/* Multi-Track Mixer Modal */}
      {showTrackMixer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#12121a] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                MIDI Track Mixer & Sound Assignment
              </h3>
              <button
                onClick={() => setShowTrackMixer(false)}
                className="p-1 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {song.tracks.map((trk) => {
                const state = midiPlaybackEngine.getTrackState(trk.index);
                return (
                  <div
                    key={trk.index}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col truncate max-w-[180px]">
                        <span className="text-xs font-bold text-zinc-200 truncate font-mono">
                          {trk.name || `Track ${trk.index + 1}`}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {trk.notes.length} notes
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            midiPlaybackEngine.setTrackState(trk.index, {
                              solo: !state.solo,
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            state.solo
                              ? 'bg-amber-500 text-black font-bold'
                              : 'bg-white/5 text-zinc-400'
                          }`}
                        >
                          S
                        </button>
                        <button
                          onClick={() =>
                            midiPlaybackEngine.setTrackState(trk.index, {
                              muted: !state.muted,
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            state.muted
                              ? 'bg-rose-500 text-white font-bold'
                              : 'bg-white/5 text-zinc-400'
                          }`}
                        >
                          M
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <select
                        value={state.assignedInstrument || 'concert_grand'}
                        onChange={(e) =>
                          midiPlaybackEngine.setTrackState(trk.index, {
                            assignedInstrument: e.target.value as InstrumentId,
                          })
                        }
                        className="bg-black/60 border border-white/10 rounded px-2 py-0.5 text-[11px] font-mono text-zinc-300 w-36 truncate focus:outline-none"
                      >
                        {Object.values(INSTRUMENTS).map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.icon} {inst.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.volume}
                        onChange={(e) =>
                          midiPlaybackEngine.setTrackState(trk.index, {
                            volume: parseFloat(e.target.value),
                          })
                        }
                        className="w-20 h-1 accent-sky-400"
                        title="Track Volume"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
