import React, { useRef, useState } from 'react';
import {
  Upload,
  FileMusic,
  Sparkles,
  AlertCircle,
  X,
  Music2,
  CheckCircle2,
  Play,
  BookOpen,
  Layers,
} from 'lucide-react';
import { MidiFileParser } from '../midi/MidiFileParser';
import { InstrumentId, ParsedMidiSong } from '../types';
import { INSTRUMENTS } from '../instruments/instrumentRegistry';

interface MidiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongLoaded: (
    song: ParsedMidiSong,
    targetMode: 'play' | 'learn',
    targetInstrument?: InstrumentId
  ) => void;
}

type ImportPhase = 'idle' | 'importing' | 'analyzing' | 'mapping' | 'ready' | 'error';

const CONVERSION_INSTRUMENTS: { id: InstrumentId; name: string; icon: string; desc: string }[] = [
  {
    id: 'veena',
    name: 'Saraswati Veena',
    icon: '🪕',
    desc: 'Authentic 24 brass frets & Kudam resonance',
  },
  {
    id: 'sitar',
    name: 'Classical Sitar',
    icon: '🪕',
    desc: 'Curved frets, Jawari buzz & deep Meend glides',
  },
  {
    id: 'bansuri',
    name: 'Bansuri Flute',
    icon: '🪈',
    desc: 'Warm acoustic North Indian bamboo flute',
  },
  {
    id: 'concert_grand',
    name: 'Concert Grand Piano',
    icon: '🎹',
    desc: 'Steinway 9-foot acoustic grand',
  },
  {
    id: 'santoor',
    name: 'Kashmiri Santoor',
    icon: '🪘',
    desc: '100-string walnut hammered dulcimer',
  },
  {
    id: 'acoustic_guitar',
    name: 'Acoustic Guitar',
    icon: '🎸',
    desc: 'Steel-string acoustic timbre',
  },
  {
    id: 'violin',
    name: 'Classical Violin',
    icon: '🎻',
    desc: 'Expressive bowed string sound',
  },
];

export const MidiImportModal: React.FC<MidiImportModalProps> = ({
  isOpen,
  onClose,
  onSongLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [parsedSong, setParsedSong] = useState<ParsedMidiSong | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentId>('veena');
  const [isDragOver, setIsDragOver] = useState(false);

  const demoSongs = MidiFileParser.getBuiltinSongs();

  const handleProcessBuffer = async (buffer: ArrayBuffer, fileName: string) => {
    try {
      setPhase('importing');
      await new Promise((r) => setTimeout(r, 180));

      setPhase('analyzing');
      await new Promise((r) => setTimeout(r, 220));

      const song = MidiFileParser.parse(buffer, fileName);

      setPhase('mapping');
      await new Promise((r) => setTimeout(r, 200));

      setParsedSong(song);
      setPhase('ready');
    } catch (err: any) {
      setPhase('error');
      setErrorMessage(
        err?.message || "This MIDI file couldn't be read. Try another .mid file."
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(mid|midi)$/i)) {
      setPhase('error');
      setErrorMessage('Please select a standard .mid or .midi file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        handleProcessBuffer(reader.result, file.name);
      }
    };
    reader.onerror = () => {
      setPhase('error');
      setErrorMessage('Could not read file from disk. Try another .mid file.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(mid|midi)$/i)) {
      setPhase('error');
      setErrorMessage('Please drop a standard .mid or .midi file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        handleProcessBuffer(reader.result, file.name);
      }
    };
    reader.onerror = () => {
      setPhase('error');
      setErrorMessage('Could not read file from disk. Try another .mid file.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSelectDemo = (song: ParsedMidiSong) => {
    setParsedSong(song);
    setPhase('ready');
  };

  const handleConfirmMode = (mode: 'play' | 'learn') => {
    if (!parsedSong) return;
    onSongLoaded(parsedSong, mode, selectedInstrument);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="midi-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="midi-import-modal-content"
        className="relative w-full max-w-xl bg-[#0f1016] border border-white/10 rounded-2xl p-6 shadow-2xl text-white flex flex-col gap-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <FileMusic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-wide">
                Import MIDI & Sound Conversion
              </h3>
              <p className="text-xs text-zinc-400">
                Play & learn any MIDI with Saraswati Veena, Sitar, Flute or Piano sounds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phase: Idle - Upload / Presets */}
        {phase === 'idle' && (
          <>
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-white/10 hover:border-amber-500/40 hover:bg-white/[0.02]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mid,.midi"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-zinc-200">
                Drop your MIDI file here, or{' '}
                <span className="text-amber-400 underline decoration-amber-400/50">browse</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                Supports Standard MIDI Format 0/1 files (.mid, .midi)
              </p>
            </div>

            {/* Built-in Classical & World Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono tracking-widest text-zinc-400 uppercase">
                  Featured Classical Presets
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  Instant Load
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {demoSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleSelectDemo(song)}
                    className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-amber-500/30 text-left transition-all group"
                  >
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300">
                      {song.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {song.tempoBpm} BPM &bull; {song.tracks[0]?.notes.length} notes
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Phase: Analyzing / Mapping */}
        {(phase === 'importing' || phase === 'analyzing' || phase === 'mapping') && (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
              <Sparkles className="w-6 h-6 text-amber-400 absolute" />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-mono tracking-widest uppercase text-amber-400 font-semibold">
                {phase.toUpperCase()} MIDI...
              </div>
              <div className="text-zinc-500 font-mono text-xs tracking-wider animate-pulse">
                ───────╱╲────╱╲──────
              </div>
            </div>
          </div>
        )}

        {/* Phase: Ready - Choose Instrument Conversion & Play/Learn mode */}
        {phase === 'ready' && parsedSong && (
          <div className="space-y-4 animate-fade-in">
            {/* Song details */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="truncate">
                <div className="text-sm font-semibold text-white truncate">
                  {parsedSong.title}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  {parsedSong.tempoBpm} BPM &bull; {parsedSong.tracks.length} track(s) &bull;{' '}
                  {parsedSong.allNotes.length} notes &bull;{' '}
                  {Math.round(parsedSong.durationMs / 1000)}s
                </div>
              </div>
            </div>

            {/* Instrument Sound Conversion Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Convert & Play with Instrument Sound:
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Music Logic Range Adaptation
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {CONVERSION_INSTRUMENTS.map((inst) => {
                  const isSelected = selectedInstrument === inst.id;
                  return (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedInstrument(inst.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                          : 'bg-white/[0.03] border-white/5 text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-xl shrink-0">{inst.icon}</span>
                      <div className="truncate">
                        <div className={`text-xs font-semibold ${isSelected ? 'text-amber-200' : 'text-zinc-200'}`}>
                          {inst.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {inst.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons: Play Mode or Interactive Learn Mode */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                id="start-midi-play-btn"
                onClick={() => handleConfirmMode('play')}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white text-zinc-950 font-semibold hover:bg-zinc-100 transition-all active:scale-95 group"
              >
                <Play className="w-5 h-5 mb-1 fill-current text-zinc-950" />
                <span className="text-xs tracking-wider uppercase">PLAY MODE</span>
                <span className="text-[10px] text-zinc-600 font-normal">
                  Listen & Watch Notes
                </span>
              </button>

              <button
                id="start-midi-learn-btn"
                onClick={() => handleConfirmMode('learn')}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold hover:brightness-110 transition-all active:scale-95 group shadow-lg shadow-amber-500/25"
              >
                <BookOpen className="w-5 h-5 mb-1 text-zinc-950" />
                <span className="text-xs tracking-wider uppercase">INTERACTIVE LEARN</span>
                <span className="text-[10px] text-amber-950 font-medium">
                  Step-by-Step Teaching
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Phase: Error */}
        {phase === 'error' && (
          <div className="py-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Import Failed</p>
              <p className="text-xs text-zinc-400 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => setPhase('idle')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold uppercase tracking-wider text-white transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
