import React, { useEffect, useState } from 'react';
import {
  Cable,
  CheckCircle2,
  AlertCircle,
  Download,
  FileMusic,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  midiManager,
  MidiManager,
  MidiOutputDevice,
  MidiStatus,
} from '../midi/MidiManager';
import { PerformanceRecording } from '../types';

interface MidiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRecording: PerformanceRecording | null;
}

export const MidiModal: React.FC<MidiModalProps> = ({
  isOpen,
  onClose,
  activeRecording,
}) => {
  const [status, setStatus] = useState<MidiStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [devices, setDevices] = useState<MidiOutputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [channel, setChannel] = useState<number>(1);

  useEffect(() => {
    const unsubStatus = midiManager.subscribeStatus((s, msg) => {
      setStatus(s);
      setStatusMessage(msg);
    });

    const unsubDevices = midiManager.subscribeDevices((devs) => {
      setDevices(devs);
      if (devs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devs[0].id);
      }
    });

    setChannel(midiManager.getChannel());

    return () => {
      unsubStatus();
      unsubDevices();
    };
  }, [selectedDeviceId]);

  if (!isOpen) return null;

  const handleConnectMidi = async () => {
    await midiManager.enableMidi();
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    midiManager.selectOutput(deviceId);
  };

  const handleChannelChange = (newChan: number) => {
    setChannel(newChan);
    midiManager.setChannel(newChan);
  };

  const handleExportMidiFile = () => {
    if (!activeRecording || activeRecording.events.length === 0) return;
    const blob = MidiManager.exportToStandardMidi(activeRecording);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TouchPad_Performance_${new Date().toISOString().slice(0, 10)}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!activeRecording || activeRecording.events.length === 0) return;
    const blob = MidiManager.exportToJson(activeRecording);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TouchPad_Performance_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="midi-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        id="midi-modal-panel"
        className="w-full max-w-lg bg-[#0f0f13] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Cable className="w-5 h-5 text-white/80" />
            <div>
              <h2 className="text-sm font-semibold tracking-wider uppercase text-white">
                Web MIDI & Controller
              </h2>
              <p className="text-xs text-zinc-400">Stream touch gestures to hardware and DAWs</p>
            </div>
          </div>
          <button
            id="close-midi-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Section */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === 'connected' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : status === 'unsupported' ? (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-600 animate-pulse ml-1" />
            )}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white">
                {status === 'connected'
                  ? 'MIDI Connected'
                  : status === 'unsupported'
                  ? 'Browser Fallback'
                  : 'MIDI Inactive'}
              </div>
              <div className="text-xs text-zinc-400">{statusMessage}</div>
            </div>
          </div>

          {status !== 'unsupported' && status !== 'connected' && (
            <button
              id="enable-midi-btn"
              onClick={handleConnectMidi}
              className="px-3 py-1.5 bg-white text-zinc-950 font-semibold text-xs rounded-lg hover:bg-white/90 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Enable MIDI
            </button>
          )}
        </div>

        {/* Devices list */}
        {status === 'connected' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Select Output Destination
            </div>
            {devices.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No external MIDI hardware output found.</p>
            ) : (
              <div className="space-y-2">
                {devices.map((dev) => (
                  <button
                    key={dev.id}
                    onClick={() => handleSelectDevice(dev.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all ${
                      selectedDeviceId === dev.id
                        ? 'bg-white/10 border-white/30 text-white font-medium'
                        : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{dev.name}</div>
                      <div className="text-[10px] text-zinc-500">{dev.manufacturer}</div>
                    </div>
                    {selectedDeviceId === dev.id && (
                      <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* MIDI Channel */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-400">Transmit Channel:</span>
              <select
                value={channel}
                onChange={(e) => handleChannelChange(Number(e.target.value))}
                className="bg-zinc-800 border border-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                  <option key={ch} value={ch}>
                    Channel {ch}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Export Recorded Performance Section */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <FileMusic className="w-3.5 h-3.5" /> Performance File Export
          </div>
          <p className="text-xs text-zinc-400">
            Export your recorded melody notes, timing, and pitch gestures into standard files compatible with Ableton, Logic, FL Studio, or GarageBand.
          </p>

          <div className="flex items-center gap-3">
            <button
              id="export-midi-file-btn"
              onClick={handleExportMidiFile}
              disabled={!activeRecording || activeRecording.events.length === 0}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeRecording && activeRecording.events.length > 0
                  ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-md'
                  : 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Download .MID (SMF)
            </button>

            <button
              id="export-json-file-btn"
              onClick={handleExportJson}
              disabled={!activeRecording || activeRecording.events.length === 0}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeRecording && activeRecording.events.length > 0
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5'
              }`}
            >
              JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
