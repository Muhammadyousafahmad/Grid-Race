import type { Difficulty } from '../logic/BotAI';

const LIGHT_COLORS = {
  bg: 0xf4f0e4,
  bgHex: '#f4f0e4',
  surfaceRaisedHex: '#e3e9dc',
  bgDeep: 0xe7e3d6,
  surface: 0xfaf8f0,
  surfaceRaised: 0xe3e9dc,
  map: 0xdfe7d8,
  border: 0x174a3f,
  borderSoft: 0x9cae9c,
  overlay: 0x174a3f,
  accent: 0x315ea8,
  accentHex: '#315ea8',
  danger: 0xb83d2d,
  dangerHex: '#b83d2d',
  success: 0x28724d,
  successHex: '#28724d',
  neutral: 0x607a69,
  neutralHex: '#607a69',
  textPrimary: '#173e37',
  textSecondary: '#405b4e',
  textMuted: '#587060',
  onAccent: '#f4f0e4'
};

const DARK_COLORS = {
  bg: 0x14241f,
  bgHex: '#14241f',
  surfaceRaisedHex: '#294338',
  bgDeep: 0x20372e,
  surface: 0x192d26,
  surfaceRaised: 0x294338,
  map: 0x263e34,
  border: 0xc3d3c3,
  borderSoft: 0x627d6e,
  overlay: 0x06100c,
  accent: 0x83b5ff,
  accentHex: '#83b5ff',
  danger: 0xff8875,
  dangerHex: '#ff8875',
  success: 0x8dd7a0,
  successHex: '#8dd7a0',
  neutral: 0xa3b9ab,
  neutralHex: '#a3b9ab',
  textPrimary: '#f3f5ed',
  textSecondary: '#d4e0d6',
  textMuted: '#b8cbbd',
  onAccent: '#14241f'
};

/** Shared tokens for the printed-route visual language across every scene. */
export const THEME = {
  colors: { ...LIGHT_COLORS },
  fonts: {
    heading: "'Space Grotesk', sans-serif",
    body: "'DM Sans', sans-serif"
  },
  difficulty: {
    EASY: { accent: 0x28724d, hex: '#28724d' },
    MEDIUM: { accent: 0x315ea8, hex: '#315ea8' },
    HARD: { accent: 0xb83d2d, hex: '#b83d2d' }
  } as Record<Difficulty, { accent: number; hex: string }>
} as const;

const THEME_STORAGE_KEY = 'grid-race-theme';
let darkMode = false;

export function isDarkMode(): boolean {
  return darkMode;
}

export function applyTheme(useDarkMode: boolean): void {
  darkMode = useDarkMode;
  Object.assign(THEME.colors, useDarkMode ? DARK_COLORS : LIGHT_COLORS);
  document.documentElement.style.colorScheme = useDarkMode ? 'dark' : 'light';
  document.documentElement.style.setProperty('--theme-bg', THEME.colors.bgHex);
  document.documentElement.style.setProperty('--theme-accent', THEME.colors.accentHex);
  document.documentElement.style.setProperty('--theme-selection-text', THEME.colors.onAccent);
  document.documentElement.style.backgroundColor = THEME.colors.bgHex;
  document.body.style.backgroundColor = THEME.colors.bgHex;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = THEME.colors.bgHex;
}

export function loadSavedTheme(): void {
  try {
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'dark');
  } catch (error) {
    console.error('Unable to load the saved game theme.', error);
    applyTheme(false);
  }
}

export function saveThemePreference(useDarkMode: boolean): void {
  applyTheme(useDarkMode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, useDarkMode ? 'dark' : 'light');
  } catch (error) {
    console.error('Unable to save the game theme preference.', error);
  }
}

/**
 * Linearly interpolates between two 0xRRGGBB colours (t clamped to [0, 1]).
 * Used for cheap vertical gradients on Graphics objects.
 */
export function mixColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}
