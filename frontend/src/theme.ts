/**
 * Tema principal: rosa (FinOps)
 */
export const t = {
  bg: '#1a0d14',
  bgElevated: '#2d1822',
  surface: '#3d1f2e',
  border: '#5c2d45',
  text: '#fef1f5',
  textMuted: '#f9a8d4',
  textSubtle: '#9d4a6c',
  accent: '#ec4899',
  accentHover: '#f472b6',
  accentSoft: 'rgba(236, 72, 153, 0.15)',
  accentBorder: 'rgba(236, 72, 153, 0.4)',
  income: '#4ade80',
  expense: '#f472b6',
  inputBg: '#150a0f',
  ring: '#ec4899',
} as const;

export type Theme = typeof t;
