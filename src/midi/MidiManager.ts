import { PerformanceRecording, RecordedEvent } from '../types';

export interface MidiOutputDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export type MidiStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error';

export class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutput: MIDIOutput | null = null;
  private status: MidiStatus = 'disconnected';
  private statusMessage: string = 'MIDI not enabled';
  private channel: number = 0; // MIDI channel 1 (0-indexed)
  private onStatusChangeCallbacks: Set<(status: MidiStatus, message: string) => void> = new Set();
  private onDevicesChangeCallbacks: Set<(devices: MidiOutputDevice[]) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      if (!('requestMIDIAccess' in navigator)) {
        this.status = 'unsupported';
        this.statusMessage = 'Web MIDI is not supported in this browser. Internal synth active.';
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public getStatus(): { status: MidiStatus; message: string } {
    return { status: this.status, message: this.statusMessage };
  }

  public subscribeStatus(cb: (status: MidiStatus, message: string) => void): () => void {
    this.onStatusChangeCallbacks.add(cb);
    cb(this.status, this.statusMessage);
    return () => this.onStatusChangeCallbacks.delete(cb);
  }

  public subscribeDevices(cb: (devices: MidiOutputDevice[]) => void): () => void {
    this.onDevicesChangeCallbacks.add(cb);
    cb(this.getAvailableOutputs());
    return () => this.onDevicesChangeCallbacks.delete(cb);
  }

  private notifyStatus(status: MidiStatus, message: string): void {
    this.status = status;
    this.statusMessage = message;
    this.onStatusChangeCallbacks.forEach((cb) => cb(status, message));
  }

  private notifyDevices(): void {
    const outputs = this.getAvailableOutputs();
    this.onDevicesChangeCallbacks.forEach((cb) => cb(outputs));
  }

  public async enableMidi(): Promise<boolean> {
    if (!this.isSupported()) {
      this.notifyStatus('unsupported', 'Web MIDI is not supported in this browser.');
      return false;
    }

    try {
      this.notifyStatus('connecting', 'Requesting MIDI access...');
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });

      // Handle device plug/unplug
      this.midiAccess.onstatechange = () => {
        this.notifyDevices();
      };

      const outputs = this.getAvailableOutputs();
      if (outputs.length > 0) {
        this.selectOutput(outputs[0].id);
      } else {
        this.notifyStatus('disconnected', 'Web MIDI active. No MIDI output hardware detected.');
      }

      this.notifyDevices();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Permission denied';
      this.notifyStatus('error', `MIDI access error: ${errorMsg}`);
      return false;
    }
  }

  public getAvailableOutputs(): MidiOutputDevice[] {
    if (!this.midiAccess) return [];
    const devices: MidiOutputDevice[] = [];
    this.midiAccess.outputs.forEach((output) => {
      devices.push({
        id: output.id,
        name: output.name || 'Unnamed MIDI Output',
        manufacturer: output.manufacturer || 'Generic',
        state: output.state || 'connected',
      });
    });
    return devices;
  }

  public selectOutput(deviceId: string): void {
    if (!this.midiAccess) return;
    const output = this.midiAccess.outputs.get(deviceId);
    if (output) {
      this.selectedOutput = output;
      this.notifyStatus('connected', `Connected: ${output.name || 'MIDI Device'}`);
    } else {
      this.selectedOutput = null;
      this.notifyStatus('disconnected', 'Selected MIDI device not found.');
    }
  }

  public sendNoteOn(midiNote: number, velocity: number = 0.8): void {
    if (!this.selectedOutput) return;
    const clampedNote = Math.max(0, Math.min(127, Math.round(midiNote)));
    const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    try {
      this.selectedOutput.send([0x90 | (this.channel & 0x0f), clampedNote, vel]);
    } catch {
      // Ignored if device disconnected
    }
  }

  public sendNoteOff(midiNote: number): void {
    if (!this.selectedOutput) return;
    const clampedNote = Math.max(0, Math.min(127, Math.round(midiNote)));
    try {
      this.selectedOutput.send([0x80 | (this.channel & 0x0f), clampedNote, 0]);
    } catch {
      // Ignored
    }
  }

  /**
   * Pitch bend (-1.0 to 1.0)
   */
  public sendPitchBend(bend: number): void {
    if (!this.selectedOutput) return;
    const clamped = Math.max(-1, Math.min(1, bend));
    // 14-bit pitch bend: center is 8192 (0x2000), range 0 to 16383
    const val = Math.floor((clamped + 1) * 8191.5);
    const lsb = val & 0x7f;
    const msb = (val >> 7) & 0x7f;
    try {
      this.selectedOutput.send([0xe0 | (this.channel & 0x0f), lsb, msb]);
    } catch {
      // Ignored
    }
  }

  /**
   * Send Control Change (CC)
   */
  public sendCC(controller: number, value: number): void {
    if (!this.selectedOutput) return;
    const ctrl = Math.max(0, Math.min(127, controller));
    const val = Math.max(0, Math.min(127, Math.round(value * 127)));
    try {
      this.selectedOutput.send([0xb0 | (this.channel & 0x0f), ctrl, val]);
    } catch {
      // Ignored
    }
  }

  /**
   * Send MIDI CC 123 (All Notes Off) and CC 120 (All Sound Off)
   */
  public allNotesOff(): void {
    if (!this.selectedOutput) return;
    try {
      this.selectedOutput.send([0xb0 | (this.channel & 0x0f), 123, 0]);
      this.selectedOutput.send([0xb0 | (this.channel & 0x0f), 120, 0]);
    } catch {
      // Ignored
    }
  }

  public setChannel(channel1to16: number): void {
    this.channel = Math.max(0, Math.min(15, channel1to16 - 1));
  }

  public getChannel(): number {
    return this.channel + 1;
  }

  /**
   * Standard MIDI File (SMF Format 0) Binary Generator
   */
  public static exportToStandardMidi(recording: PerformanceRecording): Blob {
    // Sort events by timestamp
    const sorted = [...recording.events].sort((a, b) => a.timestamp - b.timestamp);
    const trackBytes: number[] = [];

    // Helper to write variable-length quantity
    const writeVarLen = (val: number) => {
      let buffer = val & 0x7f;
      while ((val >>= 7)) {
        buffer <<= 8;
        buffer |= (val & 0x7f) | 0x80;
      }
      while (true) {
        trackBytes.push(buffer & 0xff);
        if (buffer & 0x80) buffer >>= 8;
        else break;
      }
    };

    // Ticks per quarter note
    const PPQ = 480;
    // 120 BPM -> 500,000 microseconds per quarter note -> 1 ms approx 0.96 ticks
    const msToTicks = (ms: number) => Math.max(0, Math.round((ms * PPQ * 2) / 1000));

    // Meta event: Set Tempo (120 BPM = 500,000 µs/beat)
    trackBytes.push(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);

    let lastTick = 0;

    sorted.forEach((event) => {
      const currentTick = msToTicks(event.timestamp);
      const deltaTick = currentTick - lastTick;
      lastTick = currentTick;

      writeVarLen(deltaTick);

      const note = Math.max(0, Math.min(127, Math.round(event.midiNote)));
      const vel = Math.max(1, Math.min(127, Math.round(event.velocity * 127)));

      if (event.type === 'note_on') {
        trackBytes.push(0x90, note, vel);
      } else if (event.type === 'note_off') {
        trackBytes.push(0x80, note, 0x40);
      } else if (event.type === 'pitch_bend') {
        // Bend mapping
        trackBytes.push(0xe0, 0x00, Math.max(0, Math.min(127, Math.round(event.velocity * 127))));
      } else if (event.type === 'cc') {
        trackBytes.push(0xb0, 0x01, Math.max(0, Math.min(127, Math.round(event.velocity * 127))));
      }
    });

    // End of Track Meta Event: Delta 0, 0xFF 0x2F 0x00
    writeVarLen(0);
    trackBytes.push(0xff, 0x2f, 0x00);

    // MThd Header:
    // "MThd" (4 bytes), length (4 bytes = 6), format (2 bytes = 0), tracks (2 bytes = 1), division (2 bytes = PPQ)
    const headerBytes = [
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // length 6
      0x00, 0x00,             // format 0
      0x00, 0x01,             // 1 track
      (PPQ >> 8) & 0xff, PPQ & 0xff,
    ];

    // MTrk Track Header:
    // "MTrk" (4 bytes), length (4 bytes)
    const trackLength = trackBytes.length;
    const trackHeader = [
      0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
      (trackLength >> 24) & 0xff,
      (trackLength >> 16) & 0xff,
      (trackLength >> 8) & 0xff,
      trackLength & 0xff,
    ];

    const fullFile = new Uint8Array([...headerBytes, ...trackHeader, ...trackBytes]);
    return new Blob([fullFile], { type: 'audio/midi' });
  }

  /**
   * Export performance recording as JSON
   */
  public static exportToJson(recording: PerformanceRecording): Blob {
    const jsonString = JSON.stringify(recording, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }
}

export const midiManager = new MidiManager();
