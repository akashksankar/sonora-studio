import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Volume2 } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';

interface IntroScreenProps {
  onEnter: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onEnter }) => {
  const [isEntering, setIsEntering] = useState(false);

  const handleStart = async () => {
    if (isEntering) return;
    setIsEntering(true);

    // Initialize AudioContext upon user gesture
    await audioEngine.init();
    audioEngine.playConfirmationChime();

    // Smooth transition
    setTimeout(() => {
      onEnter();
    }, 450);
  };

  return (
    <AnimatePresence>
      <motion.div
        id="intro-screen-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 sm:p-12 bg-[#060608] text-white select-none touch-none overflow-hidden"
      >
        {/* Background subtle atmospheric wave */}
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-sky-900/30 via-violet-900/20 to-transparent rounded-full blur-3xl animate-pulse" />
        </div>

        {/* Minimal top branding badge */}
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-zinc-500 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
          Web Audio &bull; MIDI Controller
        </div>

        {/* Center Typography & Enter Action */}
        <div className="flex flex-col items-center text-center max-w-lg z-10 my-auto">
          {/* Hardware-like minimalist touch-wave logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center mb-8 relative"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-sky-400 shadow-lg shadow-sky-400/50" />
            </div>
            <div className="absolute inset-0 rounded-full border border-sky-400/30 animate-ping" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-4xl sm:text-6xl font-light tracking-[0.2em] uppercase font-sans text-white mb-3"
          >
            TOUCHPAD
          </motion.h1>

          {/* Subtitles */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="space-y-1.5 text-zinc-400 font-mono text-xs sm:text-sm tracking-widest uppercase mb-10"
          >
            <p className="text-zinc-300">PLAY SOUND.</p>
            <p className="text-zinc-500">MOVE FREELY.</p>
          </motion.div>

          {/* Enter Button */}
          <motion.button
            id="enter-instrument-btn"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            disabled={isEntering}
            className="group relative px-8 py-3.5 rounded-full bg-white text-zinc-950 font-semibold text-xs sm:text-sm uppercase tracking-widest flex items-center gap-3 shadow-xl hover:shadow-2xl hover:bg-zinc-100 transition-all cursor-pointer"
          >
            <span>ENTER</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>

        {/* Bottom subtle note */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono tracking-wider">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Use headphones or studio monitors for rich low-end bass</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
