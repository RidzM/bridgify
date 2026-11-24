export const MODES = [
  { id: 'light', label: 'Light', note: 'Default Bridgify colours' },
  { id: 'dark', label: 'Dark', note: 'Less glare' },
  { id: 'high-contrast', label: 'High contrast', note: 'Black, white and yellow' },
  { id: 'solarized', label: 'Solarized', note: 'Soft, low strain' },
  { id: 'night-blue', label: 'Night blue', note: 'Dim, for night use' },
  { id: 'forest', label: 'Forest', note: 'Green, calm' },
  { id: 'sepia', label: 'Sepia', note: 'Warm paper' },
  { id: 'calm', label: 'Calm', note: 'Muted, no motion' },
  { id: 'focus', label: 'Focus', note: 'Only the tool you use' },
  { id: 'low-vision', label: 'Low vision', note: 'Larger, bolder' },
  { id: 'autism', label: 'Autism-friendly', note: 'Pastel, predictable, no motion' },
  { id: 'dyslexia', label: 'Dyslexia', note: 'OpenDyslexic, wide spacing' },
] as const

export type Mode = (typeof MODES)[number]['id']
export const NO_MOTION_MODES: readonly Mode[] = ['calm', 'focus', 'autism']

/** Swatch colours for the mode picker (bg, ink, brand), kept in sync with modes.css. */
export const MODE_SWATCH: Record<Mode, [string, string, string]> = {
  light: ['#f8f4ff', '#1a0833', '#3d0075'],
  dark: ['#0e0014', '#efe8fa', '#c9a6ff'],
  'high-contrast': ['#000000', '#ffffff', '#ffe600'],
  solarized: ['#fdf6e3', '#073642', '#3f45a8'],
  'night-blue': ['#0b1426', '#e6edf7', '#8db4ff'],
  forest: ['#f1f5ee', '#17301f', '#2e6b3f'],
  sepia: ['#f4ecd8', '#3b2a1a', '#6b3f1d'],
  calm: ['#eef3f6', '#24323d', '#3e6a86'],
  focus: ['#f8f4ff', '#1a0833', '#3d0075'],
  'low-vision': ['#ffffff', '#000000', '#2b0058'],
  autism: ['#eef4f1', '#283a33', '#3f6f62'],
  dyslexia: ['#faf3e3', '#2a2320', '#4a2a7a'],
}
