import React from 'react';
import {
  GhostTouchPoint,
  InstrumentConfig,
  InstrumentId,
  MidiNoteEvent,
  ParsedMidiSong,
  PerformanceRecording,
} from '../../types';
import { TouchSurface } from '../TouchSurface';
import { VeenaSurface } from './VeenaSurface';
import { SitarSurface } from './SitarSurface';
import { BansuriSurface } from './BansuriSurface';
import { ViolinSurface } from './ViolinSurface';
import { PercussionSurface } from './PercussionSurface';
import { SantoorSurface } from './SantoorSurface';
import { TanpuraSurface } from './TanpuraSurface';
import { PianoSurface } from './PianoSurface';
import { GuitarHarpSurface } from './GuitarHarpSurface';
import { midiLessonEngine } from '../../midi/MidiLessonEngine';

interface MultiInstrumentStageProps {
  instrumentId: InstrumentId;
  surfaceType: 'instrument' | 'touchpad';
  config: InstrumentConfig;
  activeMidiSong: ParsedMidiSong | null;
  activeMidiNotes: MidiNoteEvent[];
  ghostTouch: GhostTouchPoint | null;
  isRecording: boolean;
  onRecordEvent: (event: any) => void;
  activeRecording: PerformanceRecording | null;
  replayTimeMs: number;
  onPointerCountChange: (count: number) => void;
  appMode: 'play' | 'record' | 'midi_play' | 'learn';
  currentLearnStep: any;
  isComparingOriginal: boolean;
  userPerformanceEvents: any[];
}

export const MultiInstrumentStage: React.FC<MultiInstrumentStageProps> = ({
  instrumentId,
  surfaceType,
  config,
  activeMidiSong,
  activeMidiNotes,
  ghostTouch,
  isRecording,
  onRecordEvent,
  activeRecording,
  replayTimeMs,
  onPointerCountChange,
  appMode,
  currentLearnStep,
  isComparingOriginal,
  userPerformanceEvents,
}) => {
  // If user chooses standard 2D continuous touchpad surface:
  if (surfaceType === 'touchpad') {
    return (
      <TouchSurface
        config={config}
        isRecording={isRecording}
        onRecordEvent={onRecordEvent}
        activeRecording={activeRecording}
        replayTimeMs={replayTimeMs}
        onPointerCountChange={onPointerCountChange}
        appMode={appMode}
        activeMidiSong={activeMidiSong}
        activeMidiNotes={activeMidiNotes}
        ghostTouch={ghostTouch}
        currentLearnStep={currentLearnStep}
        isComparingOriginal={isComparingOriginal}
        userPerformanceEvents={userPerformanceEvents}
      />
    );
  }

  const handleUserNotePlayed = (midi: number, vel: number, x: number, y: number) => {
    onRecordEvent?.({
      type: 'note_on',
      midiNote: midi,
      velocity: vel,
      x,
      y,
      timestamp: performance.now(),
    });
    midiLessonEngine.handleUserNote(midi, vel, x, y);
  };

  // Otherwise, route to the dedicated physical virtual instrument surface
  switch (instrumentId) {
    case 'veena':
      return (
        <VeenaSurface
          config={config}
          activeMidiNotes={activeMidiNotes}
          currentLearnStep={currentLearnStep}
          onUserNotePlayed={handleUserNotePlayed}
        />
      );

    case 'sitar':
      return (
        <SitarSurface
          config={config}
          activeMidiNotes={activeMidiNotes}
          currentLearnStep={currentLearnStep}
          onUserNotePlayed={handleUserNotePlayed}
        />
      );

    case 'bansuri':
      return <BansuriSurface config={config} activeMidiNotes={activeMidiNotes} />;

    case 'violin':
      return <ViolinSurface config={config} activeMidiNotes={activeMidiNotes} isCello={false} />;

    case 'cello':
      return <ViolinSurface config={config} activeMidiNotes={activeMidiNotes} isCello={true} />;

    case 'tabla':
      return <PercussionSurface config={config} activeMidiNotes={activeMidiNotes} mode="tabla" />;

    case 'mridangam':
      return (
        <PercussionSurface config={config} activeMidiNotes={activeMidiNotes} mode="mridangam" />
      );

    case 'ghatam':
      return <PercussionSurface config={config} activeMidiNotes={activeMidiNotes} mode="ghatam" />;

    case 'santoor':
      return <SantoorSurface config={config} activeMidiNotes={activeMidiNotes} />;

    case 'tanpura':
      return <TanpuraSurface config={config} activeMidiNotes={activeMidiNotes} />;

    case 'concert_grand':
    case 'studio_piano':
    case 'upright_piano':
    case 'electric_piano':
    case 'soft_piano':
    case 'vintage_piano':
    case 'synth_piano':
      return (
        <PianoSurface
          config={config}
          activeMidiNotes={activeMidiNotes}
          pianoId={instrumentId}
          currentLearnStep={currentLearnStep}
          onUserNotePlayed={handleUserNotePlayed}
        />
      );

    case 'acoustic_guitar':
    case 'electric_guitar':
    case 'harp':
      return (
        <GuitarHarpSurface
          config={config}
          activeMidiNotes={activeMidiNotes}
          instrumentId={instrumentId}
        />
      );

    default:
      return (
        <TouchSurface
          config={config}
          isRecording={isRecording}
          onRecordEvent={onRecordEvent}
          activeRecording={activeRecording}
          replayTimeMs={replayTimeMs}
          onPointerCountChange={onPointerCountChange}
          appMode={appMode}
          activeMidiSong={activeMidiSong}
          activeMidiNotes={activeMidiNotes}
          ghostTouch={ghostTouch}
          currentLearnStep={currentLearnStep}
          isComparingOriginal={isComparingOriginal}
          userPerformanceEvents={userPerformanceEvents}
        />
      );
  }
};
