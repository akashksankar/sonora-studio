import React, { useState } from 'react';
import { Check, Music, Search, Volume2, X } from 'lucide-react';
import {
  INSTRUMENTS,
  INSTRUMENT_CATEGORIES,
} from '../../instruments/instrumentRegistry';
import { InstrumentCategory, InstrumentDefinition, InstrumentId } from '../../types';
import { audioEngine } from '../../audio/AudioEngine';
import { midiToFrequency } from '../../utils/musicTheory';

interface InstrumentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInstrument: InstrumentId;
  onSelectInstrument: (id: InstrumentId) => void;
}

export const InstrumentSelectorModal: React.FC<InstrumentSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedInstrument,
  onSelectInstrument,
}) => {
  const [activeCategory, setActiveCategory] = useState<InstrumentCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [auditioningId, setAuditioningId] = useState<InstrumentId | null>(null);

  if (!isOpen) return null;

  const instrumentsList = Object.values(INSTRUMENTS);

  const filteredInstruments = instrumentsList.filter((inst) => {
    const matchesCategory =
      activeCategory === 'all' || inst.category === activeCategory;
    const matchesSearch =
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inst.nativeName && inst.nativeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inst.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAudition = async (e: React.MouseEvent, inst: InstrumentDefinition) => {
    e.stopPropagation();
    await audioEngine.init();
    setAuditioningId(inst.id);

    // Play a lovely 3-note ascending arpeggio or representative chord
    const baseMidi = inst.defaultOctave * 12 + 12; // e.g. C4 = 60
    const notes =
      inst.category === 'percussion'
        ? [48, 60, 52] // drum hits
        : [baseMidi, baseMidi + 4, baseMidi + 7]; // major arpeggio

    notes.forEach((m, idx) => {
      setTimeout(() => {
        const freq = midiToFrequency(m);
        const voiceKey = `audition_${inst.id}_${idx}`;
        audioEngine.triggerNoteOn(voiceKey, freq, 0.75, 0, inst.id);
        setTimeout(() => {
          audioEngine.triggerNoteOff(voiceKey);
        }, 500);
      }, idx * 160);
    });

    setTimeout(() => {
      setAuditioningId(null);
    }, 900);
  };

  return (
    <div
      id="instrument-selector-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="instrument-selector-modal"
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0d14] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-white/15 flex items-center justify-center text-xl shadow-inner">
              🪕
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Instrument Library
                <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                  {instrumentsList.length} Models
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Choose an authentic Indian classical, orchestral, or piano instrument
              </p>
            </div>
          </div>
          <button
            id="close-instrument-selector"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 sm:px-8 py-3 border-b border-white/5 bg-white/[0.01] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {INSTRUMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search instruments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/30 transition-all"
            />
          </div>
        </div>

        {/* Instruments Grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredInstruments.map((inst) => {
            const isSelected = selectedInstrument === inst.id;
            const isAuditioning = auditioningId === inst.id;

            return (
              <div
                key={inst.id}
                id={`instrument-card-${inst.id}`}
                onClick={() => {
                  onSelectInstrument(inst.id);
                  onClose();
                }}
                className={`group relative p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'bg-white/[0.08] border-sky-400/60 shadow-lg shadow-sky-500/10'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                {/* Accent glow corner */}
                <div
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40 transition-opacity group-hover:opacity-70"
                  style={{ backgroundColor: inst.color }}
                />

                <div>
                  {/* Top row: Icon + Names + Selected Check */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                        {inst.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-white group-hover:text-sky-300 transition-colors">
                            {inst.name}
                          </span>
                          {inst.nativeName && (
                            <span className="text-[10px] font-sans text-amber-400/90 font-medium px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                              {inst.nativeName}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-1">{inst.subtitle}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="p-1 rounded-full bg-sky-500 text-white shadow-sm flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                    {inst.description}
                  </p>

                  {/* Features Badges */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {inst.features.slice(0, 3).map((feat, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-zinc-300 font-mono"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom row: Audition & Select Button */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/5 mt-auto">
                  <button
                    id={`audition-btn-${inst.id}`}
                    onClick={(e) => handleAudition(e, inst)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      isAuditioning
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                    title="Audition sample sound"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{isAuditioning ? 'Playing...' : 'Audition'}</span>
                  </button>

                  <span
                    className={`text-[11px] font-medium transition-colors ${
                      isSelected ? 'text-sky-400 font-semibold' : 'text-zinc-400 group-hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Active Instrument' : 'Select →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500">
          <span>Instruments adapt in real time to touch gestures and MIDI playback.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white text-zinc-950 font-semibold hover:bg-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
