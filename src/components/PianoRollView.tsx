import React, { useRef, useEffect } from 'react';
import { MidiNoteEvent, ParsedMidiSong, ThemeMode } from '../types';
import { midiPlaybackEngine } from '../midi/MidiPlaybackEngine';

interface PianoRollViewProps {
  song: ParsedMidiSong;
  theme: ThemeMode;
  accentColor: string;
}

export const PianoRollView: React.FC<PianoRollViewProps> = ({
  song,
  theme,
  accentColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Compute pitch range
    let minNote = 127;
    let maxNote = 0;
    song.allNotes.forEach((n) => {
      if (n.note < minNote) minNote = n.note;
      if (n.note > maxNote) maxNote = n.note;
    });
    // Add margin
    minNote = Math.max(0, minNote - 2);
    maxNote = Math.min(127, maxNote + 2);
    const pitchSpan = Math.max(12, maxNote - minNote + 1);

    const isLight = theme === 'light';

    const render = () => {
      const curTime = midiPlaybackEngine.getCurrentTime();
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = isLight ? '#F7F7F5' : '#070709';
      ctx.fillRect(0, 0, width, height);

      // Time window visible around current time: 6 seconds window (1.5s past, 4.5s future)
      const windowMs = 6000;
      const timeScale = width / windowMs;
      const playheadX = width * 0.25;

      // Note height
      const noteHeight = height / pitchSpan;

      // Draw subtle horizontal pitch grid lines
      for (let p = minNote; p <= maxNote; p++) {
        const y = height - (p - minNote + 1) * noteHeight;
        const isC = p % 12 === 0;
        const isBlackKey = [1, 3, 6, 8, 10].includes(p % 12);

        ctx.fillStyle = isBlackKey
          ? isLight
            ? 'rgba(0,0,0,0.03)'
            : 'rgba(255,255,255,0.02)'
          : 'transparent';
        ctx.fillRect(0, y, width, noteHeight);

        ctx.strokeStyle = isC
          ? isLight
            ? 'rgba(0,0,0,0.12)'
            : 'rgba(255,255,255,0.1)'
          : isLight
          ? 'rgba(0,0,0,0.04)'
          : 'rgba(255,255,255,0.03)';
        ctx.lineWidth = isC ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        if (isC) {
          ctx.fillStyle = isLight ? '#777777' : '#888888';
          ctx.font = '10px monospace';
          ctx.fillText(`C${Math.floor(p / 12) - 1}`, 6, y + noteHeight * 0.75);
        }
      }

      // Draw Notes
      song.allNotes.forEach((n) => {
        // Calculate X position relative to playhead
        const noteStartX = playheadX + (n.startTime - curTime) * timeScale;
        const noteWidth = Math.max(3, n.duration * timeScale);
        const noteY = height - (n.note - minNote + 1) * noteHeight;

        // Skip if outside viewport
        if (noteStartX + noteWidth < 0 || noteStartX > width) return;

        const isActive = curTime >= n.startTime && curTime < n.endTime;

        if (isActive) {
          ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
          ctx.shadowColor = isLight ? 'rgba(2, 132, 199, 0.4)' : '#38bdf8';
          ctx.shadowBlur = isLight ? 8 : 12;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = isLight
            ? 'rgba(30, 41, 59, 0.65)'
            : 'rgba(255, 255, 255, 0.4)';
        }

        // Draw rounded rectangle for note
        const radius = 3;
        ctx.beginPath();
        ctx.roundRect(noteStartX, noteY + 1, noteWidth - 1, noteHeight - 2, radius);
        ctx.fill();

        // Note label if space permits
        if (noteWidth > 20 && noteHeight > 10) {
          ctx.fillStyle = isActive
            ? '#ffffff'
            : isLight
            ? '#ffffff'
            : '#000000';
          ctx.font = '9px monospace';
          ctx.fillText(n.noteName, noteStartX + 3, noteY + noteHeight * 0.75);
        }
      });

      // Reset shadow blur
      ctx.shadowBlur = 0;

      // Draw Playhead line
      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead top triangle
      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [song, theme, accentColor]);

  return (
    <div
      id="piano-roll-container"
      className="relative w-full h-full overflow-hidden select-none touch-none"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
