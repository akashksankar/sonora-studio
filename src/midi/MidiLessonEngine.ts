import {
  InstrumentId,
  LearnDifficulty,
  LearnStep,
  LearnSummary,
  MidiNoteEvent,
  ParsedMidiSong,
  RecordedEvent,
} from '../types';
import { getChordName, getNoteInfo, midiToFrequency } from '../utils/musicTheory';
import { audioEngine } from '../audio/AudioEngine';
import { InstrumentMidiConverter } from './InstrumentMidiConverter';
import { midiPlaybackEngine } from './MidiPlaybackEngine';

export interface LessonEngineSubscriber {
  onStepChange: (step: LearnStep | null, stepIndex: number, totalSteps: number) => void;
  onLessonComplete: (summary: LearnSummary) => void;
  onFeedback: (
    status: 'correct' | 'try_again' | 'chord_complete',
    text: string,
    timingRating?: 'PERFECT' | 'EARLY' | 'LATE',
    streak?: number,
    bpm?: number
  ) => void;
}

export class MidiLessonEngine {
  private static instance: MidiLessonEngine | null = null;

  private currentSong: ParsedMidiSong | null = null;
  private steps: LearnStep[] = [];
  private currentStepIndex: number = 0;
  private difficulty: LearnDifficulty = 'beginner';
  private targetInstrument: InstrumentId = 'veena';
  private isActive: boolean = false;

  private lessonStartTime: number = 0;
  private stepPresentedTime: number = 0;
  private userRecordedEvents: RecordedEvent[] = [];

  // Performance metrics & Fast Rhythm
  private correctCount: number = 0;
  private missedCount: number = 0;
  private earlyCount: number = 0;
  private lateCount: number = 0;
  private totalPitchDeviations: number = 0;
  private velocityDeviations: number = 0;
  private streak: number = 0;
  private maxStreak: number = 0;
  private lastHitTime: number = 0;
  private currentBpm: number = 0;

  // Active chord tracking
  private activeChordNotesPlayed: Set<number> = new Set();

  private subscribers: Set<LessonEngineSubscriber> = new Set();

  private constructor() {}

  public static getInstance(): MidiLessonEngine {
    if (!MidiLessonEngine.instance) {
      MidiLessonEngine.instance = new MidiLessonEngine();
    }
    return MidiLessonEngine.instance;
  }

  public setTargetInstrument(inst: InstrumentId) {
    this.targetInstrument = inst;
    if (this.currentSong) {
      this.prepareLesson(this.currentSong, this.difficulty, inst);
      if (this.isActive) {
        this.startLesson();
      }
    }
  }

  public getTargetInstrument(): InstrumentId {
    return this.targetInstrument;
  }

  public getStreak(): number {
    return this.streak;
  }

  public getMaxStreak(): number {
    return this.maxStreak;
  }

  public getCurrentBpm(): number {
    return this.currentBpm;
  }

  public prepareLesson(
    song: ParsedMidiSong,
    difficulty: LearnDifficulty = 'beginner',
    targetInstrument: InstrumentId = 'veena'
  ) {
    this.currentSong = song;
    this.difficulty = difficulty;
    this.targetInstrument = targetInstrument;
    this.isActive = false;
    this.currentStepIndex = 0;
    this.userRecordedEvents = [];
    this.correctCount = 0;
    this.missedCount = 0;
    this.earlyCount = 0;
    this.lateCount = 0;
    this.totalPitchDeviations = 0;
    this.velocityDeviations = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.lastHitTime = 0;
    this.currentBpm = 0;
    this.activeChordNotesPlayed.clear();

    // STRICT: Ensure background MIDI playback is paused so user plays one-by-one
    midiPlaybackEngine.pause();

    // Adapt song notes for the target instrument so they fit its authentic playable range
    const adaptedSong = InstrumentMidiConverter.adaptSongForInstrument(song, targetInstrument);

    // Group notes into steps. Notes starting within 45ms of each other are grouped as chords
    const chordThresholdMs = 45;
    const sorted = [...adaptedSong.allNotes].sort((a, b) => a.startTime - b.startTime);

    const generatedSteps: LearnStep[] = [];
    let currentGroup: MidiNoteEvent[] = [];
    let groupStart = 0;

    for (const note of sorted) {
      if (currentGroup.length === 0) {
        currentGroup.push(note);
        groupStart = note.startTime;
      } else if (Math.abs(note.startTime - groupStart) <= chordThresholdMs) {
        currentGroup.push(note);
      } else {
        // Finalize previous step
        const isChord = currentGroup.length > 1;
        const chordName = isChord
          ? getChordName(currentGroup.map((n) => n.note))
          : undefined;

        generatedSteps.push({
          stepIndex: generatedSteps.length,
          timestamp: groupStart,
          expectedNotes: [...currentGroup],
          isChord,
          chordName,
          status: 'pending',
        });

        currentGroup = [note];
        groupStart = note.startTime;
      }
    }

    if (currentGroup.length > 0) {
      const isChord = currentGroup.length > 1;
      const chordName = isChord
        ? getChordName(currentGroup.map((n) => n.note))
        : undefined;

      generatedSteps.push({
        stepIndex: generatedSteps.length,
        timestamp: groupStart,
        expectedNotes: currentGroup,
        isChord,
        chordName,
        status: 'pending',
      });
    }

    this.steps = generatedSteps;
    if (this.steps.length > 0) {
      midiPlaybackEngine.seek(this.steps[0].timestamp);
    }
    this.notifyStepChange();
  }

  public startLesson() {
    if (this.steps.length === 0) return;
    this.isActive = true;
    this.currentStepIndex = 0;
    this.lessonStartTime = performance.now();
    this.stepPresentedTime = performance.now();
    this.activeChordNotesPlayed.clear();

    // STRICT: Background MIDI is paused - user plays step-by-step
    midiPlaybackEngine.pause();
    const cur = this.getCurrentStep();
    if (cur) {
      midiPlaybackEngine.seek(cur.timestamp);
    }
    this.notifyStepChange();
  }

  public stopLesson() {
    this.isActive = false;
    this.activeChordNotesPlayed.clear();
  }

  public goToStep(index: number) {
    if (index >= 0 && index < this.steps.length) {
      this.currentStepIndex = index;
      this.activeChordNotesPlayed.clear();
      this.stepPresentedTime = performance.now();
      midiPlaybackEngine.pause();
      const step = this.steps[index];
      if (step) {
        midiPlaybackEngine.seek(step.timestamp);
      }
      this.notifyStepChange();
    }
  }

  public nextStep() {
    if (this.currentStepIndex + 1 < this.steps.length) {
      this.goToStep(this.currentStepIndex + 1);
    }
  }

  public prevStep() {
    if (this.currentStepIndex > 0) {
      this.goToStep(this.currentStepIndex - 1);
    }
  }

  /**
   * Play an audible acoustic preview of the current step notes so the learner hears what to play!
   */
  public async playStepPreview() {
    const step = this.getCurrentStep();
    if (!step) return;

    await audioEngine.init();
    const inst = this.targetInstrument;

    step.expectedNotes.forEach((n, idx) => {
      const voiceKey = `learn_preview_${n.id || idx}_${Date.now()}`;
      const freq = midiToFrequency(n.note);
      const pan = (idx - (step.expectedNotes.length - 1) / 2) * 0.2;
      audioEngine.triggerNoteOn(voiceKey, freq, 0.85, pan, inst);

      setTimeout(() => {
        audioEngine.triggerNoteOff(voiceKey);
      }, Math.max(400, Math.min(1000, n.duration || 600)));
    });
  }

  public setDifficulty(diff: LearnDifficulty) {
    this.difficulty = diff;
    this.notifyStepChange();
  }

  public getCurrentStep(): LearnStep | null {
    if (!this.isActive || this.currentStepIndex >= this.steps.length) {
      return null;
    }
    return this.steps[this.currentStepIndex];
  }

  public getNextStep(): LearnStep | null {
    if (this.currentStepIndex + 1 < this.steps.length) {
      return this.steps[this.currentStepIndex + 1];
    }
    return null;
  }

  public getProgress(): { current: number; total: number } {
    return {
      current: this.currentStepIndex + 1,
      total: this.steps.length,
    };
  }

  /**
   * Handle user playing a note on the TouchPad or Instrument Surface during Learn mode.
   * STRICT STEP-BY-STEP:
   * 1. Check if note satisfies current step.
   * 2. Give instant feedback and sound.
   * 3. Advance to the next step, where it PAUSES and waits for the next click!
   */
  public handleUserNote(
    playedMidiNote: number,
    velocity: number,
    x: number,
    y: number
  ): boolean {
    if (!this.isActive || this.currentStepIndex >= this.steps.length) {
      return false;
    }

    const now = performance.now();
    const elapsedSinceStart = now - this.lessonStartTime;

    // Record user performance event
    this.userRecordedEvents.push({
      timestamp: elapsedSinceStart,
      type: 'note_on',
      midiNote: playedMidiNote,
      frequency: 440 * Math.pow(2, (playedMidiNote - 69) / 12),
      velocity,
      x,
      y,
      pointerId: 0,
    });

    const step = this.steps[this.currentStepIndex];
    const expectedNotes = step.expectedNotes;
    const expectedMidiList = expectedNotes.map((n) => n.note);

    // Note pitch check (exact match, or pitch-class match for beginner/intermediate)
    let matchingTargetMidi: number | undefined = expectedMidiList.find((m) => m === playedMidiNote);
    if (matchingTargetMidi === undefined && (this.difficulty === 'beginner' || this.difficulty === 'intermediate')) {
      matchingTargetMidi = expectedMidiList.find((m) => (m % 12) === (playedMidiNote % 12));
    }

    const isNoteExpected = matchingTargetMidi !== undefined;

    if (isNoteExpected && matchingTargetMidi !== undefined) {
      // Correct note played
      this.activeChordNotesPlayed.add(matchingTargetMidi);

      // In Beginner difficulty, single touch or playing any chord note satisfies the step
      // In Intermediate & Advanced, all chord notes can be clicked sequentially or together
      const isBeginnerSinglePass = this.difficulty === 'beginner';
      const allChordSatisfied =
        isBeginnerSinglePass ||
        expectedMidiList.every((noteNum) => this.activeChordNotesPlayed.has(noteNum));

      if (allChordSatisfied) {
        this.correctCount++;
        step.status = 'success';
        step.playedNote = playedMidiNote;
        step.timingRating = 'PERFECT';
        step.playedVelocity = velocity;

        // Calculate rhythmic speed & streak
        if (this.lastHitTime > 0) {
          const deltaSec = (now - this.lastHitTime) / 1000;
          if (deltaSec > 0.03 && deltaSec < 3.0) {
            this.currentBpm = Math.round(60 / deltaSec);
          }
        }
        this.lastHitTime = now;
        this.streak++;
        this.maxStreak = Math.max(this.maxStreak, this.streak);

        // Velocity deviation calculation
        const avgExpectedVel =
          expectedNotes.reduce((acc, n) => acc + n.velocity, 0) / expectedNotes.length;
        this.velocityDeviations += Math.abs(avgExpectedVel - velocity);

        const streakBadge = this.streak > 1 ? ` 🔥 ${this.streak}x` : '';
        const feedbackText = step.isChord
          ? `✓ ${step.chordName || 'CHORD'}${streakBadge}`
          : `✓ ${step.expectedNotes[0].noteName}${streakBadge}`;

        this.notifyFeedback('correct', feedbackText, 'PERFECT', this.streak, this.currentBpm);

        // INSTANT ADVANCEMENT: User can tap in rhythm as fast as they can!
        this.advanceStep();
      } else {
        // Partial chord note played
        const playedInfo = getNoteInfo(playedMidiNote);
        this.notifyFeedback(
          'chord_complete',
          `${playedInfo.name} (${this.activeChordNotesPlayed.size}/${expectedMidiList.length})`,
          'PERFECT',
          this.streak,
          this.currentBpm
        );
      }

      return true;
    } else {
      // Incorrect note played - reset streak
      this.streak = 0;
      this.missedCount++;
      this.totalPitchDeviations += 1;
      const playedInfo = getNoteInfo(playedMidiNote);
      const targetName = expectedNotes.map((n) => n.noteName).join(' + ');

      this.notifyFeedback('try_again', `Miss (${playedInfo.name}) • Target: ${targetName}`, undefined, 0, this.currentBpm);
      return false;
    }
  }

  private advanceStep() {
    this.activeChordNotesPlayed.clear();
    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      // Completed lesson!
      this.finishLesson();
    } else {
      this.stepPresentedTime = performance.now();
      const nextStep = this.steps[this.currentStepIndex];
      // STRICT STEP-BY-STEP: Keep MIDI paused, but sync the timeline playhead to the new step!
      midiPlaybackEngine.pause();
      if (nextStep) {
        midiPlaybackEngine.seek(nextStep.timestamp);
      }
      this.notifyStepChange();
    }
  }

  private finishLesson() {
    this.isActive = false;

    const total = Math.max(1, this.steps.length);
    const timingAccuracy = Math.max(
      30,
      Math.round(100 - ((this.earlyCount + this.lateCount) / total) * 45)
    );
    const pitchAccuracy = Math.max(
      20,
      Math.round((this.correctCount / (this.correctCount + this.missedCount || 1)) * 100)
    );
    const expressionAccuracy = Math.max(
      40,
      Math.round(100 - (this.velocityDeviations / total) * 60)
    );

    const summary: LearnSummary = {
      totalNotes: total,
      correctNotes: this.correctCount,
      timingScorePct: timingAccuracy,
      pitchScorePct: pitchAccuracy,
      expressionScorePct: expressionAccuracy,
      missedCount: this.missedCount,
      earlyCount: this.earlyCount,
      lateCount: this.lateCount,
      userPerformanceEvents: [...this.userRecordedEvents],
    };

    for (const sub of this.subscribers) {
      sub.onLessonComplete(summary);
    }
  }

  public subscribe(sub: LessonEngineSubscriber): () => void {
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  private notifyStepChange() {
    const step = this.getCurrentStep();
    for (const sub of this.subscribers) {
      sub.onStepChange(step, this.currentStepIndex, this.steps.length);
    }
  }

  private notifyFeedback(
    status: 'correct' | 'try_again' | 'chord_complete',
    text: string,
    timingRating?: 'PERFECT' | 'EARLY' | 'LATE',
    streak?: number,
    bpm?: number
  ) {
    for (const sub of this.subscribers) {
      sub.onFeedback(status, text, timingRating, streak, bpm);
    }
  }
}

export const midiLessonEngine = MidiLessonEngine.getInstance();
