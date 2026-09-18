import { InstrumentId, LearnStep, MidiNoteEvent, ParsedMidiSong } from '../types';
import { INSTRUMENTS, getSargamNote } from '../instruments/instrumentRegistry';
import { getNoteInfo } from '../utils/musicTheory';

export interface NoteInstrumentMapping {
  originalMidi: number;
  adaptedMidi: number;
  octaveShift: number;
  stringIndex?: number;
  stringName?: string;
  fret?: number;
  keyIndex?: number;
  isBlackKey?: boolean;
  sargam: string;
  noteName: string;
  octave: number;
  targetDescription: string;
  horizontalPercent: number; // 0 to 100% position on the visual instrument
}

export interface ChordCenteringInfo {
  centerPercent: number;
  minPercent: number;
  maxPercent: number;
  targetFrets?: number[];
  targetKeys?: number[];
  targetStrings?: number[];
  suggestedOctaveStart?: number;
  description: string;
}

// Veena string definitions for accurate mapping
const VEENA_STRINGS = [
  { index: 0, name: 'Sarani', swara: 'Sa', baseMidi: 60 },     // C4
  { index: 1, name: 'Panchama', swara: 'Pa', baseMidi: 55 },   // G3
  { index: 2, name: 'Mandra', swara: 'Sa', baseMidi: 48 },     // C3
  { index: 3, name: 'Anumandra', swara: 'Pa', baseMidi: 43 },  // G2
];

// Sitar string definitions for accurate mapping
const SITAR_STRINGS = [
  { index: 0, name: 'Baj Tar', swara: 'Ma', baseMidi: 53 },    // F3
  { index: 1, name: 'Jor', swara: 'Sa', baseMidi: 48 },        // C3
  { index: 2, name: 'Laraj', swara: 'Pa', baseMidi: 43 },      // G2
  { index: 3, name: 'Kharaj', swara: 'Sa', baseMidi: 36 },     // C2
];

export class InstrumentMidiConverter {
  /**
   * Intelligently fold an incoming piano/general MIDI note into the playable sweet spot of an instrument
   */
  public static adaptMidiNote(note: number, instrumentId: InstrumentId): { adaptedNote: number; octaveShift: number } {
    const inst = INSTRUMENTS[instrumentId] || INSTRUMENTS.veena;
    const minMidi = inst.minMidi;
    const maxMidi = inst.maxMidi;

    let adapted = note;
    let octaveShift = 0;

    // Fold upward if note is below instrument range
    while (adapted < minMidi && adapted + 12 <= 127) {
      adapted += 12;
      octaveShift += 1;
    }

    // Fold downward if note is above instrument range
    while (adapted > maxMidi && adapted - 12 >= 0) {
      adapted -= 12;
      octaveShift -= 1;
    }

    return { adaptedNote: adapted, octaveShift };
  }

  /**
   * Maps a note to its physical coordinates and visual target on the specified instrument
   */
  public static mapNoteToInstrument(
    midiNote: number,
    instrumentId: InstrumentId
  ): NoteInstrumentMapping {
    const { adaptedNote, octaveShift } = this.adaptMidiNote(midiNote, instrumentId);
    const noteInfo = getNoteInfo(adaptedNote);
    const sargam = getSargamNote(adaptedNote);

    switch (instrumentId) {
      case 'veena': {
        // Veena has 24 frets (0 to 23). Find best matching melodic string
        let bestString = 0;
        let bestFret = 0;
        let minFret = 999;

        // Try to find a string where fret is between 0 and 23
        for (const s of VEENA_STRINGS) {
          const diff = adaptedNote - s.baseMidi;
          if (diff >= 0 && diff < 24) {
            // Favor strings with moderate fret positions (lower frets are easier to reach)
            if (diff < minFret) {
              minFret = diff;
              bestString = s.index;
              bestFret = diff;
            }
          }
        }

        // If no string found within 24 frets, clamp to nearest available fret on Sarani or Anumandra
        if (minFret === 999) {
          if (adaptedNote > VEENA_STRINGS[0].baseMidi + 23) {
            bestString = 0;
            bestFret = 23;
          } else {
            bestString = 3;
            bestFret = 0;
          }
        }

        // Horizontal position across 24 frets (fret 0 is at ~5% to fret 23 at ~95%)
        const horizontalPercent = Math.max(5, Math.min(95, 5 + (bestFret / 23) * 90));
        const strDef = VEENA_STRINGS[bestString];

        return {
          originalMidi: midiNote,
          adaptedMidi: adaptedNote,
          octaveShift,
          stringIndex: bestString,
          stringName: strDef.name,
          fret: bestFret,
          sargam,
          noteName: noteInfo.name,
          octave: noteInfo.octave,
          targetDescription: `${strDef.name} String (${strDef.swara}) • Fret ${bestFret} (${sargam} / ${noteInfo.name})`,
          horizontalPercent,
        };
      }

      case 'sitar': {
        // Sitar has 20 frets
        let bestString = 0;
        let bestFret = 0;
        let minFret = 999;

        for (const s of SITAR_STRINGS) {
          const diff = adaptedNote - s.baseMidi;
          if (diff >= 0 && diff < 20) {
            if (diff < minFret) {
              minFret = diff;
              bestString = s.index;
              bestFret = diff;
            }
          }
        }

        if (minFret === 999) {
          bestString = 0;
          bestFret = Math.max(0, Math.min(19, adaptedNote - SITAR_STRINGS[0].baseMidi));
        }

        const horizontalPercent = Math.max(5, Math.min(95, 6 + (bestFret / 19) * 88));
        const strDef = SITAR_STRINGS[bestString];

        return {
          originalMidi: midiNote,
          adaptedMidi: adaptedNote,
          octaveShift,
          stringIndex: bestString,
          stringName: strDef.name,
          fret: bestFret,
          sargam,
          noteName: noteInfo.name,
          octave: noteInfo.octave,
          targetDescription: `${strDef.name} String • Fret ${bestFret} (${sargam} / ${noteInfo.name})`,
          horizontalPercent,
        };
      }

      case 'concert_grand':
      case 'studio_piano':
      case 'upright_piano':
      case 'electric_piano':
      case 'soft_piano':
      case 'vintage_piano':
      case 'synth_piano': {
        const isBlackKey = [1, 3, 6, 8, 10].includes(adaptedNote % 12);
        // Map 36 keys (e.g. standard 3-octave view C3=48 to B5=83)
        const keyIndex = Math.max(0, Math.min(35, adaptedNote - 48));
        const horizontalPercent = Math.max(2, Math.min(98, (keyIndex / 35) * 100));

        return {
          originalMidi: midiNote,
          adaptedMidi: adaptedNote,
          octaveShift,
          keyIndex,
          isBlackKey,
          sargam,
          noteName: noteInfo.name,
          octave: noteInfo.octave,
          targetDescription: `${isBlackKey ? 'Black' : 'White'} Key ${noteInfo.name} (${sargam})`,
          horizontalPercent,
        };
      }

      case 'bansuri': {
        // Bansuri 7-hole mapping across octave 4-5
        const normHole = Math.max(0, Math.min(6, Math.floor(((adaptedNote - 60) / 16) * 7)));
        const horizontalPercent = Math.max(10, Math.min(90, 15 + (normHole / 6) * 70));

        return {
          originalMidi: midiNote,
          adaptedMidi: adaptedNote,
          octaveShift,
          fret: normHole,
          sargam,
          noteName: noteInfo.name,
          octave: noteInfo.octave,
          targetDescription: `Hole ${normHole + 1} • ${sargam} (${noteInfo.name})`,
          horizontalPercent,
        };
      }

      default: {
        // Generic / Touchpad mapping
        const horizontalPercent = Math.max(5, Math.min(95, ((adaptedNote - 36) / 60) * 100));
        return {
          originalMidi: midiNote,
          adaptedMidi: adaptedNote,
          octaveShift,
          sargam,
          noteName: noteInfo.name,
          octave: noteInfo.octave,
          targetDescription: `${sargam} (${noteInfo.name})`,
          horizontalPercent,
        };
      }
    }
  }

  /**
   * Calculates the exact horizontal center and bounds of a step (single note or multi-note chord)
   * so the view can adjust and scroll to perfectly center the targets!
   */
  public static calculateStepCentering(
    step: LearnStep,
    instrumentId: InstrumentId
  ): ChordCenteringInfo {
    const mappings = step.expectedNotes.map((n) =>
      this.mapNoteToInstrument(n.note, instrumentId)
    );

    if (mappings.length === 0) {
      return {
        centerPercent: 50,
        minPercent: 50,
        maxPercent: 50,
        description: 'Center',
      };
    }

    const percents = mappings.map((m) => m.horizontalPercent);
    const minPercent = Math.min(...percents);
    const maxPercent = Math.max(...percents);
    const centerPercent = (minPercent + maxPercent) / 2;

    const targetFrets = mappings
      .map((m) => m.fret)
      .filter((f): f is number => f !== undefined);
    const targetStrings = mappings
      .map((m) => m.stringIndex)
      .filter((s): s is number => s !== undefined);
    const targetKeys = mappings
      .map((m) => m.keyIndex)
      .filter((k): k is number => k !== undefined);

    // Suggested piano octave start if keys are outside typical 3-octave window
    const avgNote =
      mappings.reduce((acc, m) => acc + m.adaptedMidi, 0) / mappings.length;
    const suggestedOctaveStart = Math.max(
      1,
      Math.min(6, Math.floor((avgNote - 18) / 12))
    );

    const chordTitle = step.isChord
      ? `${step.chordName || 'Chord'}: ${mappings.map((m) => m.sargam).join(' + ')} (${mappings.map((m) => m.noteName).join(' ' )})`
      : `${mappings[0].sargam} (${mappings[0].noteName}) - ${mappings[0].targetDescription}`;

    return {
      centerPercent,
      minPercent,
      maxPercent,
      targetFrets: Array.from(new Set(targetFrets)),
      targetStrings: Array.from(new Set(targetStrings)),
      targetKeys: Array.from(new Set(targetKeys)),
      suggestedOctaveStart,
      description: chordTitle,
    };
  }

  /**
   * Transforms a ParsedMidiSong so that all notes and tracks are pre-adapted to the target instrument's range
   */
  public static adaptSongForInstrument(
    song: ParsedMidiSong,
    targetInstrument: InstrumentId
  ): ParsedMidiSong {
    const adaptedAllNotes: MidiNoteEvent[] = song.allNotes.map((note) => {
      const { adaptedNote } = this.adaptMidiNote(note.note, targetInstrument);
      const info = getNoteInfo(adaptedNote);
      return {
        ...note,
        note: adaptedNote,
        noteName: info.name,
        octave: info.octave,
      };
    });

    const adaptedTracks = song.tracks.map((trk) => {
      const trkNotes = trk.notes.map((note) => {
        const { adaptedNote } = this.adaptMidiNote(note.note, targetInstrument);
        const info = getNoteInfo(adaptedNote);
        return {
          ...note,
          note: adaptedNote,
          noteName: info.name,
          octave: info.octave,
        };
      });

      return {
        ...trk,
        assignedInstrument: targetInstrument,
        notes: trkNotes,
      };
    });

    return {
      ...song,
      tracks: adaptedTracks,
      allNotes: adaptedAllNotes,
    };
  }
}
