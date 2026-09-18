import React, { useEffect, useState } from 'react';
import {
  RotateCcw,
  Play,
  Layers,
  Award,
  X,
} from 'lucide-react';
import {
  midiLessonEngine,
} from '../midi/MidiLessonEngine';
import {
  InstrumentId,
  LearnDifficulty,
  LearnSummary,
  ParsedMidiSong,
} from '../types';
import { INSTRUMENTS } from '../instruments/instrumentRegistry';

interface LearnModeOverlayProps {
  song: ParsedMidiSong;
  difficulty: LearnDifficulty;
  onSelectDifficulty: (diff: LearnDifficulty) => void;
  onReplayUserPerformance: () => void;
  onToggleCompareOriginal: () => void;
  isComparing: boolean;
  onClose: () => void;
  currentInstrument?: InstrumentId;
  onSelectInstrument?: (inst: InstrumentId) => void;
}

export const LearnModeOverlay: React.FC<LearnModeOverlayProps> = ({
  song,
  difficulty,
  onReplayUserPerformance,
  onToggleCompareOriginal,
  isComparing,
  onClose,
  currentInstrument = 'veena',
}) => {
  const [summary, setSummary] = useState<LearnSummary | null>(null);

  useEffect(() => {
    const inst = (currentInstrument || 'veena') as InstrumentId;
    midiLessonEngine.setTargetInstrument(inst);
  }, [currentInstrument]);

  useEffect(() => {
    const inst = (currentInstrument || 'veena') as InstrumentId;
    // Prepare and start lesson engine
    midiLessonEngine.prepareLesson(song, difficulty, inst);
    midiLessonEngine.startLesson();

    const unsub = midiLessonEngine.subscribe({
      onStepChange: () => {},
      onFeedback: () => {},
      onLessonComplete: (resSummary) => {
        setSummary(resSummary);
      },
    });

    return () => {
      unsub();
      midiLessonEngine.stopLesson();
    };
  }, [song, difficulty, currentInstrument]);

  const handleRestart = () => {
    setSummary(null);
    const inst = (currentInstrument || 'veena') as InstrumentId;
    midiLessonEngine.prepareLesson(song, difficulty, inst);
    midiLessonEngine.startLesson();
  };

  // If no summary yet (user is actively playing), DO NOT render any overlay over the instrument!
  // This completely eliminates overlay conflicts, giving the instrument full screen height!
  if (!summary) {
    return null;
  }

  const maxStreak = midiLessonEngine.getMaxStreak();

  return (
    <div
      id="learn-summary-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-[#101016] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-widest uppercase font-mono">
                LESSON COMPLETED
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                {song.title} &bull; {difficulty.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.05] text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Score Metric Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <div className="text-[9px] text-zinc-400 uppercase font-mono">Accuracy</div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {summary.accuracyPercentage}%
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <div className="text-[9px] text-zinc-400 uppercase font-mono">Timing</div>
            <div className="text-lg sm:text-xl font-bold font-mono text-sky-400 mt-0.5">
              {summary.timingScore}%
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <div className="text-[9px] text-zinc-400 uppercase font-mono">Streak</div>
            <div className="text-lg sm:text-xl font-bold font-mono text-orange-400 mt-0.5">
              {maxStreak}x
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <div className="text-[9px] text-zinc-400 uppercase font-mono">Score</div>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 mt-0.5">
              {summary.overallScore}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onReplayUserPerformance}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold font-mono tracking-wider transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>REPLAY MY TAKE</span>
            </button>

            <button
              onClick={onToggleCompareOriginal}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold font-mono tracking-wider transition-all border cursor-pointer ${
                isComparing
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>COMPARE MIDI</span>
            </button>
          </div>

          <button
            onClick={handleRestart}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs tracking-widest uppercase transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>PLAY AGAIN</span>
          </button>
        </div>
      </div>
    </div>
  );
};
