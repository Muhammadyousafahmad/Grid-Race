import type { Difficulty } from '../logic/BotAI';

/**
 * Shared design tokens (colour, type) used by MenuScene and GameScene so the
 * whole game keeps one consistent, modern visual language.
 */
export const THEME = {
  colors: {
    // Surfaces
    bg: 0x0a0c15,
    bgDeep: 0x070810,
    surface: 0x12151f,
    surfaceRaised: 0x1a1f30,
    border: 0x2b3557,
    borderSoft: 0x232a42,

    // Accents
    accent: 0x38bdf8,
    accentHex: '#38bdf8',
    danger: 0xf87171,
    dangerHex: '#f87171',
    success: 0x4ade80,
    successHex: '#4ade80',
    neutral: 0x94a3b8,
    neutralHex: '#94a3b8',

    // Text
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',

    // Text drawn on top of a bright accent fill (e.g. primary buttons)
    onAccent: '#08101c'
  },
  fonts: {
    heading: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
    body: "'Inter', 'Segoe UI', system-ui, sans-serif"
  },
  difficulty: {
    EASY: { accent: 0x4ade80, hex: '#4ade80' },
    MEDIUM: { accent: 0x38bdf8, hex: '#38bdf8' },
    HARD: { accent: 0xf87171, hex: '#f87171' }
  } as Record<Difficulty, { accent: number; hex: string }>
} as const;

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
