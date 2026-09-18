import React, { useState, useEffect } from 'react';
import { X, Touchpad, Hand, Waves } from 'lucide-react';

interface OnboardingHintsProps {
  pointerCount: number;
}

export const OnboardingHints: React.FC<OnboardingHintsProps> = ({ pointerCount }) => {
  const [step, setStep] = useState<number>(0);
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('touchpad_intro_seen');
      if (!seen) {
        setDismissed(false);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Advance step automatically when user touches
  useEffect(() => {
    if (dismissed) return;
    if (pointerCount === 1 && step === 0) {
      setStep(1);
    } else if (pointerCount >= 2 && step <= 2) {
      setStep(3);
    }
  }, [pointerCount, step, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('touchpad_intro_seen', 'true');
    } catch {
      // Ignore
    }
  };

  if (dismissed) return null;

  const HINTS = [
    { title: 'TOUCH', desc: 'Touch anywhere to generate sound and trigger voice' },
    { title: 'GLIDE', desc: 'Drag across horizontally for melodies and vertically for expression' },
    { title: 'SWIPE', desc: 'Fast swipe creates dynamic pitch bend and particle trails' },
    { title: 'POLYPHONY', desc: 'Multi-touch supported — play simultaneous voices and chords' },
  ];

  const currentHint = HINTS[Math.min(step, HINTS.length - 1)];

  return (
    <div
      id="onboarding-guide-pill"
      className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#111116]/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-2xl text-xs text-white max-w-sm pointer-events-auto transition-all animate-fade-in"
    >
      <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
      <div>
        <span className="font-semibold text-sky-400 uppercase mr-1.5">{currentHint.title}:</span>
        <span className="text-zinc-300 text-[11px]">{currentHint.desc}</span>
      </div>
      <button
        onClick={handleDismiss}
        className="ml-2 text-zinc-500 hover:text-white transition-colors"
        title="Dismiss guide"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
