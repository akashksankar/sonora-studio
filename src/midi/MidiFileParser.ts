import { MidiNoteEvent, ParsedMidiSong, ParsedMidiTrack } from '../types';
import { getNoteInfo } from '../utils/musicTheory';

export class MidiFileParser {
  /**
   * Parse an ArrayBuffer or Uint8Array of a Standard MIDI File (.mid / .midi)
   */
  public static parse(buffer: ArrayBuffer, fileName: string): ParsedMidiSong {
    const data = new Uint8Array(buffer);
    let pos = 0;

    // Helper reader functions
    const readString = (len: number): string => {
      let str = '';
      for (let i = 0; i < len; i++) {
        str += String.fromCharCode(data[pos++]);
      }
      return str;
    };

    const readUint16 = (): number => {
      const val = (data[pos] << 8) | data[pos + 1];
      pos += 2;
      return val;
    };

    const readUint32 = (): number => {
      const val =
        (data[pos] << 24) |
        (data[pos + 1] << 16) |
        (data[pos + 2] << 8) |
        data[pos + 3];
      pos += 4;
      return val;
    };

    const readVarLen = (): number => {
      let val = 0;
      let b = 0;
      do {
        b = data[pos++];
        val = (val << 7) | (b & 0x7f);
      } while (b & 0x80);
      return val;
    };

    // 1. Verify "MThd" header
    if (data.length < 14) {
      throw new Error('File is too small to be a valid MIDI file.');
    }

    const headerChunk = readString(4);
    if (headerChunk !== 'MThd') {
      throw new Error('Invalid MIDI header: missing MThd signature.');
    }

    const headerLength = readUint32();
    if (headerLength < 6) {
      throw new Error('Invalid MThd header length.');
    }

    const format = readUint16(); // 0, 1, or 2
    const numTracks = readUint16();
    const division = readUint16(); // Ticks per quarter note (PPQ)

    if (division & 0x8000) {
      throw new Error('SMPTE timecode division in MIDI is not supported.');
    }
    const ppq = division;

    // Skip any extra header bytes
    if (headerLength > 6) {
      pos += headerLength - 6;
    }

    let defaultTempoBpm = 120;
    let timeSignature = '4/4';
    let songTitle = fileName.replace(/\.(midi|mid)$/i, '').replace(/[_-]/g, ' ');

    interface RawNoteOn {
      id: string;
      trackIndex: number;
      channel: number;
      note: number;
      velocity: number;
      startTick: number;
    }

    interface TempoChange {
      tick: number;
      tempoBpm: number;
      microsecPerQuarter: number;
      timeMs: number;
    }

    const tempoMap: TempoChange[] = [
      {
        tick: 0,
        tempoBpm: 120,
        microsecPerQuarter: 500000,
        timeMs: 0,
      },
    ];

    const tracksData: {
      name: string;
      instrument?: string;
      notes: MidiNoteEvent[];
    }[] = [];

    // Parse all tracks
    for (let t = 0; t < numTracks && pos < data.length; t++) {
      const trackSig = readString(4);
      if (trackSig !== 'MTrk') {
        // Skip unexpected chunk or break if end
        break;
      }

      const trackLen = readUint32();
      const trackEnd = pos + trackLen;

      let currentTick = 0;
      let runningStatus = 0;
      let trackName = `Track ${t + 1}`;
      let instrumentName = '';
      const pendingNotes: Map<string, RawNoteOn> = new Map();
      const trackNotes: MidiNoteEvent[] = [];

      while (pos < trackEnd && pos < data.length) {
        const delta = readVarLen();
        currentTick += delta;

        let status = data[pos];
        if (status < 0x80) {
          // Running status
          status = runningStatus;
        } else {
          pos++;
          runningStatus = status;
        }

        const msgType = status & 0xf0;
        const channel = status & 0x0f;

        if (status === 0xff) {
          // Meta Event
          const metaType = data[pos++];
          const metaLen = readVarLen();
          const metaData = data.subarray(pos, pos + metaLen);
          pos += metaLen;

          if (metaType === 0x03) {
            // Sequence / Track Name
            let name = '';
            for (let i = 0; i < metaData.length; i++) name += String.fromCharCode(metaData[i]);
            if (name.trim()) {
              trackName = name.trim();
              if (t === 0 && !songTitle) songTitle = trackName;
            }
          } else if (metaType === 0x04) {
            // Instrument Name
            let inst = '';
            for (let i = 0; i < metaData.length; i++) inst += String.fromCharCode(metaData[i]);
            if (inst.trim()) instrumentName = inst.trim();
          } else if (metaType === 0x51 && metaLen === 3) {
            // Set Tempo
            const mpq = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
            const bpm = Math.round(60000000 / mpq);
            if (t === 0) defaultTempoBpm = bpm;

            // Add tempo change to map
            tempoMap.push({
              tick: currentTick,
              tempoBpm: bpm,
              microsecPerQuarter: mpq,
              timeMs: 0, // Calculated after sorting
            });
          } else if (metaType === 0x58 && metaLen >= 2) {
            // Time Signature
            const numerator = metaData[0];
            const denominator = Math.pow(2, metaData[1]);
            timeSignature = `${numerator}/${denominator}`;
          } else if (metaType === 0x2f) {
            // End of Track
            break;
          }
        } else if (msgType === 0x90) {
          // Note On
          const note = data[pos++];
          const vel = data[pos++] / 127;
          const key = `${channel}_${note}`;

          if (vel > 0) {
            pendingNotes.set(key, {
              id: `m_${t}_${currentTick}_${note}`,
              trackIndex: t,
              channel,
              note,
              velocity: vel,
              startTick: currentTick,
            });
          } else {
            // Note On with vel 0 is Note Off
            const active = pendingNotes.get(key);
            if (active) {
              pendingNotes.delete(key);
              const info = getNoteInfo(note);
              trackNotes.push({
                id: active.id,
                track: t,
                channel,
                note,
                noteName: info.name,
                octave: info.octave,
                velocity: active.velocity,
                startTime: active.startTick, // temporarily ticks, converted below
                duration: Math.max(ppq / 8, currentTick - active.startTick),
                endTime: currentTick,
              });
            }
          }
        } else if (msgType === 0x80) {
          // Note Off
          const note = data[pos++];
          pos++; // skip off velocity
          const key = `${channel}_${note}`;
          const active = pendingNotes.get(key);
          if (active) {
            pendingNotes.delete(key);
            const info = getNoteInfo(note);
            trackNotes.push({
              id: active.id,
              track: t,
              channel,
              note,
              noteName: info.name,
              octave: info.octave,
              velocity: active.velocity,
              startTime: active.startTick,
              duration: Math.max(ppq / 8, currentTick - active.startTick),
              endTime: currentTick,
            });
          }
        } else if (msgType === 0xc0) {
          // Program Change
          pos += 1;
        } else if (msgType === 0xb0 || msgType === 0xe0 || msgType === 0xa0) {
          // 2-byte messages (CC, Pitch Bend, Poly Key Pressure)
          pos += 2;
        } else if (status === 0xf0 || status === 0xf7) {
          // SysEx
          const len = readVarLen();
          pos += len;
        }
      }

      // Close any dangling unclosed notes with a default quarter note duration
      pendingNotes.forEach((active) => {
        const info = getNoteInfo(active.note);
        trackNotes.push({
          id: active.id,
          track: t,
          channel: active.channel,
          note: active.note,
          noteName: info.name,
          octave: info.octave,
          velocity: active.velocity,
          startTime: active.startTick,
          duration: ppq,
          endTime: active.startTick + ppq,
        });
      });

      tracksData.push({
        name: trackName,
        instrument: instrumentName,
        notes: trackNotes,
      });

      // Ensure position matches track chunk boundary
      pos = trackEnd;
    }

    // Sort and calculate tempo map time in milliseconds
    tempoMap.sort((a, b) => a.tick - b.tick);
    for (let i = 1; i < tempoMap.length; i++) {
      const prev = tempoMap[i - 1];
      const deltaTicks = tempoMap[i].tick - prev.tick;
      const msPerTick = prev.microsecPerQuarter / (ppq * 1000);
      tempoMap[i].timeMs = prev.timeMs + deltaTicks * msPerTick;
    }

    // Function to convert tick to ms based on tempo map
    const tickToMs = (tick: number): number => {
      let tIdx = 0;
      for (let i = tempoMap.length - 1; i >= 0; i--) {
        if (tick >= tempoMap[i].tick) {
          tIdx = i;
          break;
        }
      }
      const entry = tempoMap[tIdx];
      const deltaTicks = tick - entry.tick;
      const msPerTick = entry.microsecPerQuarter / (ppq * 1000);
      return entry.timeMs + deltaTicks * msPerTick;
    };

    // Convert all note tick values to milliseconds
    const allNotes: MidiNoteEvent[] = [];
    let maxDurationMs = 1000;

    const parsedTracks: ParsedMidiTrack[] = tracksData.map((tData, idx) => {
      const convertedNotes: MidiNoteEvent[] = tData.notes.map((n) => {
        const startMs = tickToMs(n.startTime);
        const endMs = tickToMs(n.endTime);
        const durMs = Math.max(40, endMs - startMs);

        if (endMs > maxDurationMs) {
          maxDurationMs = endMs;
        }

        const noteEvent: MidiNoteEvent = {
          ...n,
          startTime: Math.round(startMs),
          duration: Math.round(durMs),
          endTime: Math.round(startMs + durMs),
        };
        allNotes.push(noteEvent);
        return noteEvent;
      });

      convertedNotes.sort((a, b) => a.startTime - b.startTime);

      return {
        index: idx,
        name: tData.name,
        instrument: tData.instrument,
        notes: convertedNotes,
        muted: false,
        solo: false,
        volume: 1.0,
      };
    });

    allNotes.sort((a, b) => a.startTime - b.startTime);

    if (allNotes.length === 0) {
      throw new Error('This MIDI file contains no playable note events.');
    }

    return {
      id: `midi_${Date.now()}`,
      title: songTitle.toUpperCase(),
      fileName,
      durationMs: Math.round(maxDurationMs + 500),
      tempoBpm: defaultTempoBpm,
      timeSignature,
      tracks: parsedTracks.filter((t) => t.notes.length > 0),
      allNotes,
    };
  }

  /**
   * Generates built-in classical/popular demo songs for instant testing without file upload
   */
  public static getBuiltinSongs(): ParsedMidiSong[] {
    return [
      createCanonInD(),
      createClairDeLune(),
      createFurElise(),
    ];
  }
}

// Built-in Demo 1: Canon in D (Johann Pachelbel)
function createCanonInD(): ParsedMidiSong {
  const bpm = 84;
  const beatMs = (60 / bpm) * 1000;
  const notes: MidiNoteEvent[] = [];

  // Melody theme: D4, C#4, B3, A3, G3, F#3, G3, A3, etc.
  const pattern = [
    { note: 62, dur: 2 }, // D4
    { note: 61, dur: 2 }, // C#4
    { note: 59, dur: 2 }, // B3
    { note: 57, dur: 2 }, // A3
    { note: 55, dur: 2 }, // G3
    { note: 54, dur: 2 }, // F#3
    { note: 55, dur: 2 }, // G3
    { note: 57, dur: 2 }, // A3
    // Second octave melody
    { note: 74, dur: 1 }, // D5
    { note: 73, dur: 1 }, // C#5
    { note: 74, dur: 2 }, // D5
    { note: 73, dur: 1 }, // C#5
    { note: 69, dur: 1 }, // A4
    { note: 71, dur: 1 }, // B4
    { note: 73, dur: 1 }, // C#5
    { note: 74, dur: 2 }, // D5
    { note: 71, dur: 2 }, // B4
    { note: 69, dur: 2 }, // A4
    { note: 67, dur: 2 }, // G4
    { note: 69, dur: 2 }, // A4
    { note: 62, dur: 4 }, // D4
  ];

  let currentMs = 0;
  pattern.forEach((p, idx) => {
    const info = getNoteInfo(p.note);
    const durMs = p.dur * beatMs;
    notes.push({
      id: `canon_${idx}`,
      track: 0,
      channel: 0,
      note: p.note,
      noteName: info.name,
      octave: info.octave,
      velocity: 0.85,
      startTime: Math.round(currentMs),
      duration: Math.round(durMs * 0.9),
      endTime: Math.round(currentMs + durMs * 0.9),
    });
    currentMs += durMs;
  });

  return {
    id: 'builtin_canon_in_d',
    title: 'CANON IN D',
    fileName: 'canon_in_d.mid',
    durationMs: Math.round(currentMs + 1000),
    tempoBpm: bpm,
    timeSignature: '4/4',
    tracks: [
      {
        index: 0,
        name: 'Violin Melody',
        instrument: 'Acoustic Strings',
        notes,
        muted: false,
        solo: false,
        volume: 1.0,
      },
    ],
    allNotes: notes,
  };
}

// Built-in Demo 2: Clair de Lune (Claude Debussy)
function createClairDeLune(): ParsedMidiSong {
  const bpm = 60;
  const beatMs = (60 / bpm) * 1000;
  const notes: MidiNoteEvent[] = [];

  const pattern = [
    { note: 65, dur: 2 }, // F4
    { note: 68, dur: 2 }, // Ab4
    { note: 72, dur: 3 }, // C5
    { note: 70, dur: 1 }, // Bb4
    { note: 68, dur: 2 }, // Ab4
    { note: 65, dur: 2 }, // F4
    { note: 63, dur: 2 }, // Eb4
    { note: 65, dur: 4 }, // F4
    { note: 72, dur: 2 }, // C5
    { note: 75, dur: 3 }, // Eb5
    { note: 73, dur: 1 }, // Db5
    { note: 72, dur: 2 }, // C5
    { note: 68, dur: 4 }, // Ab4
  ];

  let currentMs = 0;
  pattern.forEach((p, idx) => {
    const info = getNoteInfo(p.note);
    const durMs = p.dur * beatMs;
    notes.push({
      id: `clair_${idx}`,
      track: 0,
      channel: 0,
      note: p.note,
      noteName: info.name,
      octave: info.octave,
      velocity: 0.8,
      startTime: Math.round(currentMs),
      duration: Math.round(durMs * 0.92),
      endTime: Math.round(currentMs + durMs * 0.92),
    });
    currentMs += durMs;
  });

  return {
    id: 'builtin_clair_de_lune',
    title: 'CLAIR DE LUNE',
    fileName: 'clair_de_lune.mid',
    durationMs: Math.round(currentMs + 1000),
    tempoBpm: bpm,
    timeSignature: '9/8',
    tracks: [
      {
        index: 0,
        name: 'Piano Expressive',
        instrument: 'Grand Piano',
        notes,
        muted: false,
        solo: false,
        volume: 1.0,
      },
    ],
    allNotes: notes,
  };
}

// Built-in Demo 3: Für Elise (Ludwig van Beethoven)
function createFurElise(): ParsedMidiSong {
  const bpm = 130;
  const beatMs = (60 / bpm) * 1000;
  const notes: MidiNoteEvent[] = [];

  const pattern = [
    { note: 76, dur: 0.5 }, // E5
    { note: 75, dur: 0.5 }, // D#5
    { note: 76, dur: 0.5 }, // E5
    { note: 75, dur: 0.5 }, // D#5
    { note: 76, dur: 0.5 }, // E5
    { note: 71, dur: 0.5 }, // B4
    { note: 74, dur: 0.5 }, // D5
    { note: 72, dur: 0.5 }, // C5
    { note: 69, dur: 1.5 }, // A4
    { note: 60, dur: 0.5 }, // C4
    { note: 64, dur: 0.5 }, // E4
    { note: 69, dur: 0.5 }, // A4
    { note: 71, dur: 1.5 }, // B4
    { note: 64, dur: 0.5 }, // E4
    { note: 68, dur: 0.5 }, // G#4
    { note: 71, dur: 0.5 }, // B4
    { note: 72, dur: 1.5 }, // C5
    { note: 64, dur: 0.5 }, // E4
    { note: 76, dur: 0.5 }, // E5
    { note: 75, dur: 0.5 }, // D#5
    { note: 76, dur: 0.5 }, // E5
    { note: 75, dur: 0.5 }, // D#5
    { note: 76, dur: 0.5 }, // E5
    { note: 71, dur: 0.5 }, // B4
    { note: 74, dur: 0.5 }, // D5
    { note: 72, dur: 0.5 }, // C5
    { note: 69, dur: 2.0 }, // A4
  ];

  let currentMs = 0;
  pattern.forEach((p, idx) => {
    const info = getNoteInfo(p.note);
    const durMs = p.dur * beatMs;
    notes.push({
      id: `elise_${idx}`,
      track: 0,
      channel: 0,
      note: p.note,
      noteName: info.name,
      octave: info.octave,
      velocity: 0.82,
      startTime: Math.round(currentMs),
      duration: Math.round(durMs * 0.88),
      endTime: Math.round(currentMs + durMs * 0.88),
    });
    currentMs += durMs;
  });

  return {
    id: 'builtin_fur_elise',
    title: 'FÜR ELISE',
    fileName: 'fur_elise.mid',
    durationMs: Math.round(currentMs + 1000),
    tempoBpm: bpm,
    timeSignature: '3/8',
    tracks: [
      {
        index: 0,
        name: 'Piano Solo',
        instrument: 'Grand Piano',
        notes,
        muted: false,
        solo: false,
        volume: 1.0,
      },
    ],
    allNotes: notes,
  };
}
