import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryGlow: string;
  white: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDark: string;
  emerald: string;
  emeraldBg: string;
  emeraldBorder: string;
  rose: string;
  roseBg: string;
  roseBorder: string;
  amber: string;
  amberBg: string;
  amberBorder: string;
  blue: string;
  blueBg: string;
  blueBorder: string;
  indigo: string;
  indigoBg: string;
  // Semantic aliases (maps to the named colors above)
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  warningBorder: string;
  danger: string;
  dangerLight: string;
  dangerBorder: string;
  info: string;
  infoLight: string;
  infoBorder: string;
  primaryBorder: string;
  indigoBorder: string;
}

export type ThemeMode = 'dark' | 'light';

export const darkColors: ThemeColors = {
  // Deep navy-black base — richer than pure black
  background: '#080C14',
  surface: '#0F1623',
  surfaceLight: '#161E30',
  border: 'rgba(255,255,255,0.07)',
  borderLight: 'rgba(255,255,255,0.13)',

  // Vivid violet-indigo primary
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4F46E5',
  primaryGlow: 'rgba(108,99,255,0.35)',

  white: '#FFFFFF',
  // High-contrast text — near white for primary content
  text: '#F0F4FF',
  textSecondary: '#A8B4CC',
  textMuted: '#5C6B88',
  textDark: '#3A4660',

  // Bright mint-green for prices / success
  emerald: '#2DDBA0',
  emeraldBg: 'rgba(45,219,160,0.12)',
  emeraldBorder: 'rgba(45,219,160,0.25)',

  // Vivid coral-red for errors / delete
  rose: '#FF5C7C',
  roseBg: 'rgba(255,92,124,0.12)',
  roseBorder: 'rgba(255,92,124,0.25)',

  // Warm gold for warnings / held orders
  amber: '#FFB930',
  amberBg: 'rgba(255,185,48,0.12)',
  amberBorder: 'rgba(255,185,48,0.25)',

  // Sky blue for info / split
  blue: '#5BB8FF',
  blueBg: 'rgba(91,184,255,0.12)',
  blueBorder: 'rgba(91,184,255,0.25)',

  indigo: '#9B8FFF',
  indigoBg: 'rgba(155,143,255,0.12)',
  // Semantic aliases
  success: '#2DDBA0',
  successLight: 'rgba(45,219,160,0.12)',
  warning: '#FFB930',
  warningLight: 'rgba(255,185,48,0.12)',
  warningBorder: 'rgba(255,185,48,0.25)',
  danger: '#FF5C7C',
  dangerLight: 'rgba(255,92,124,0.12)',
  dangerBorder: 'rgba(255,92,124,0.25)',
  info: '#5BB8FF',
  infoLight: 'rgba(91,184,255,0.12)',
  infoBorder: 'rgba(91,184,255,0.25)',
  primaryBorder: 'rgba(108,99,255,0.25)',
  indigoBorder: 'rgba(155,143,255,0.25)',
};

export const lightColors: ThemeColors = {
  // Clean white-grey base
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceLight: '#EEF2FA',
  border: 'rgba(0,0,0,0.07)',
  borderLight: 'rgba(0,0,0,0.12)',

  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4F46E5',
  primaryGlow: 'rgba(108,99,255,0.18)',

  white: '#FFFFFF',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  textDark: '#D1D5DB',

  emerald: '#059669',
  emeraldBg: 'rgba(5,150,105,0.09)',
  emeraldBorder: 'rgba(5,150,105,0.22)',

  rose: '#E11D48',
  roseBg: 'rgba(225,29,72,0.09)',
  roseBorder: 'rgba(225,29,72,0.22)',

  amber: '#B45309',
  amberBg: 'rgba(180,83,9,0.09)',
  amberBorder: 'rgba(180,83,9,0.22)',

  blue: '#1D4ED8',
  blueBg: 'rgba(29,78,216,0.09)',
  blueBorder: 'rgba(29,78,216,0.22)',

  indigo: '#4F46E5',
  indigoBg: 'rgba(79,70,229,0.09)',
  // Semantic aliases
  success: '#059669',
  successLight: 'rgba(5,150,105,0.09)',
  warning: '#B45309',
  warningLight: 'rgba(180,83,9,0.09)',
  warningBorder: 'rgba(180,83,9,0.22)',
  danger: '#E11D48',
  dangerLight: 'rgba(225,29,72,0.09)',
  dangerBorder: 'rgba(225,29,72,0.22)',
  info: '#1D4ED8',
  infoLight: 'rgba(29,78,216,0.09)',
  infoBorder: 'rgba(29,78,216,0.22)',
  primaryBorder: 'rgba(108,99,255,0.22)',
  indigoBorder: 'rgba(79,70,229,0.22)',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkColors,
  isDark: true,
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setModeState(saved);
      }
    });
  }, []);

  const isDark = mode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem('app_theme', newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
