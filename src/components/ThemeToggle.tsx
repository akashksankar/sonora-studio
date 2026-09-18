import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { ThemeMode } from '../types';

interface ThemeToggleProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const cycleTheme = () => {
    if (currentTheme === 'dark') onThemeChange('light');
    else if (currentTheme === 'light') onThemeChange('system');
    else onThemeChange('dark');
  };

  const getIcon = () => {
    if (currentTheme === 'dark') return <Moon className="w-3.5 h-3.5" />;
    if (currentTheme === 'light') return <Sun className="w-3.5 h-3.5" />;
    return <Laptop className="w-3.5 h-3.5" />;
  };

  const getLabel = () => {
    if (currentTheme === 'dark') return 'DARK';
    if (currentTheme === 'light') return 'LIGHT';
    return 'SYS';
  };

  return (
    <button
      id="theme-toggle-btn"
      onClick={cycleTheme}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-current border border-white/10 text-xs font-mono transition-all active:scale-95 cursor-pointer"
      title={`Current Theme: ${currentTheme.toUpperCase()} (Click to toggle)`}
    >
      {getIcon()}
      <span className="text-[10px] hidden sm:inline">{getLabel()}</span>
    </button>
  );
};
