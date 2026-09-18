import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, RotateCcw, Circle, Trash2, Download } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';
import { midiManager } from '../midi/MidiManager';
import { PerformanceRecording } from '../types';

interface MelodyRecorderProps {
  isRecording: boolean;
  onToggleRecord: () => void;
  activeRecording: PerformanceRecording | null;
  onClearRecording: () => void;
  onReplayTimeChange: (timeMs: number | null) => void;
  onOpenMidiModal: () => void;
}

export const MelodyRecorder: React.FC<MelodyRecorderProps> = ({
  isRecording,
  onToggleRecord,
  activeRecording,
  onClearRecording,
  onReplayTimeChange,
  onOpenMidiModal,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const replayTimerRef = useRef<number | null>(null);

  // Live recording elapsed counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      setRecordingElapsed(0);
      const start = performance.now();
      interval = setInterval(() => {
        setRecordingElapsed(performance.now() - start);
      }, 50);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Replay playback handler
  useEffect(() => {
    if (!isPlaying || !activeRecording || activeRecording.events.length === 0) {
      onReplayTimeChange(null);
      return;
    }

    const startTime = performance.now();
    const duration = Math.max(1000, activeRecording.durationMs);

    // Schedule audio playback for note events
    const timeouts: NodeJS.Timeout[] = [];
    const sorted = [...activeRecording.events].sort((a, b) => a.timestamp - b.timestamp);

    sorted.forEach((ev) => {
      const t = setTimeout(() => {
        if (ev.type === 'note_on') {
          audioEngine.triggerNoteOn(`replay_${ev.pointerId}`, ev.frequency, ev.velocity, ev.x * 2 - 1);
          midiManager.sendNoteOn(ev.midiNote, ev.velocity);
        } else if (ev.type === 'note_off') {
          audioEngine.triggerNoteOff(`replay_${ev.pointerId}`);
          midiManager.sendNoteOff(ev.midiNote);
        }
      }, ev.timestamp);
      timeouts.push(t);
    });

    const updateFrame = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        setIsPlaying(false);
        setPlayTime(0);
        onReplayTimeChange(null);
        audioEngine.releaseAllVoices();
      } else {
        setPlayTime(elapsed);
        onReplayTimeChange(elapsed);
        animFrameRef.current = requestAnimationFrame(updateFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      timeouts.forEach(clearTimeout);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioEngine.releaseAllVoices();
    };
  }, [isPlaying, activeRecording, onReplayTimeChange]);

  const handleTogglePlay = () => {
    if (isRecording) return;
    if (isPlaying) {
      setIsPlaying(false);
      onReplayTimeChange(null);
      audioEngine.releaseAllVoices();
    } else if (activeRecording && activeRecording.events.length > 0) {
      setIsPlaying(true);
    }
  };

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  const hasNotes = activeRecording && activeRecording.events.length > 0;

  return (
    <div
      id="melody-recorder-bar"
      className="flex items-center gap-2 sm:gap-3 bg-[#111116]/85 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full shadow-lg text-xs"
    >
      {/* Record button */}
      <button
        id="toggle-record-btn"
        onClick={onToggleRecord}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all ${
          isRecording
            ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/50 shadow-md'
            : 'bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10'
        }`}
        title={isRecording ? 'Stop Recording' : 'Record Gesture Performance'}
      >
        {isRecording ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span className="font-mono-num">{formatMs(recordingElapsed)}</span>
          </>
        ) : (
          <>
            <Circle className="w-3 h-3 fill-rose-500 text-rose-500" />
            <span className="hidden sm:inline">REC</span>
          </>
        )}
      </button>

      {/* Playback button */}
      {hasNotes && !isRecording && (
        <button
          id="replay-performance-btn"
          onClick={handleTogglePlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all ${
            isPlaying
              ? 'bg-sky-500 text-white shadow-sky-500/40 shadow-md'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isPlaying ? 'Stop Replay' : 'Replay Performance'}
        >
          {isPlaying ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span className="font-mono-num">{formatMs(playTime)}</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">REPLAY</span>
            </>
          )}
        </button>
      )}

      {/* Mini piano roll timeline visualization */}
      {hasNotes && !isRecording && (
        <div className="hidden md:flex items-center gap-1.5 pl-1 pr-2">
          <div className="w-24 h-4 bg-zinc-900 border border-white/10 rounded overflow-hidden relative">
            {/* Progress playhead */}
            {isPlaying && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-10"
                style={{
                  left: `${Math.min(100, (playTime / (activeRecording?.durationMs || 1)) * 100)}%`,
                }}
              />
            )}
            {/* Mini notes dots */}
            {activeRecording?.events
              .filter((e) => e.type === 'note_on')
              .slice(0, 30)
              .map((ev, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-white/40"
                  style={{
                    left: `${((ev.timestamp / (activeRecording.durationMs || 1)) * 100).toFixed(1)}%`,
                    top: `${((1 - ev.y) * 100).toFixed(1)}%`,
                  }}
                />
              ))}
          </div>
          <span className="text-[10px] text-zinc-400 font-mono-num">
            {formatMs(activeRecording?.durationMs || 0)}
          </span>
        </div>
      )}

      {/* Clear Recording */}
      {hasNotes && !isRecording && (
        <button
          id="clear-recording-btn"
          onClick={onClearRecording}
          className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-white/5 rounded-full transition-colors"
          title="Clear recording"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Export Button */}
      {hasNotes && !isRecording && (
        <button
          id="open-export-modal-btn"
          onClick={onOpenMidiModal}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          title="Export MIDI or JSON file"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
