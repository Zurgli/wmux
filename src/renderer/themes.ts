import type { CustomThemeColors } from '../shared/types';

// ─── Theme IDs ─────────────────────────────────────────────────────────────

export type BuiltinThemeId =
  | 'catppuccin-mocha' | 'monochrome' | 'stars-and-stripes'
  | 'red-dynasty' | 'nightowl' | 'void'
  | 'hinomaru' | 'taegeuk';

export type ThemeId = BuiltinThemeId | 'custom';

// ─── xterm terminal colors ─────────────────────────────────────────────────

export interface XtermThemeColors {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const XTERM_THEMES: Record<BuiltinThemeId, XtermThemeColors> = {
  'catppuccin-mocha': {
    background: '#1E1E2E',
    foreground: '#CDD6F4',
    cursor: '#F5E0DC',
    selectionBackground: '#585B70',
    black: '#45475A',
    red: '#F38BA8',
    green: '#A6E3A1',
    yellow: '#F9E2AF',
    blue: '#89B4FA',
    magenta: '#F5C2E7',
    cyan: '#94E2D5',
    white: '#BAC2DE',
    brightBlack: '#585B70',
    brightRed: '#F38BA8',
    brightGreen: '#A6E3A1',
    brightYellow: '#F9E2AF',
    brightBlue: '#89B4FA',
    brightMagenta: '#F5C2E7',
    brightCyan: '#94E2D5',
    brightWhite: '#A6ADC8',
  },
  monochrome: {
    background: '#080808',
    foreground: '#E0E0E0',
    cursor: '#FFFFFF',
    selectionBackground: '#2A2A2A',
    black: '#2A2A2A',
    red: '#FF5555',
    green: '#909090',
    yellow: '#C0C0C0',
    blue: '#A0A0A0',
    magenta: '#999999',
    cyan: '#888888',
    white: '#B0B0B0',
    brightBlack: '#404040',
    brightRed: '#FF5555',
    brightGreen: '#B0B0B0',
    brightYellow: '#D0D0D0',
    brightBlue: '#B0B0B0',
    brightMagenta: '#AAAAAA',
    brightCyan: '#999999',
    brightWhite: '#888888',
  },
  'stars-and-stripes': {
    background: '#0C1428',
    foreground: '#C8D6E8',
    cursor: '#5B8DEF',
    selectionBackground: '#2A3E5A',
    black: '#1E2E4A',
    red: '#E8554E',
    green: '#4EBF8B',
    yellow: '#F2C85B',
    blue: '#5B8DEF',
    magenta: '#C792EA',
    cyan: '#5BC0BE',
    white: '#A0B0C8',
    brightBlack: '#3A5070',
    brightRed: '#F06B65',
    brightGreen: '#66D4A0',
    brightYellow: '#F5D578',
    brightBlue: '#78A4F5',
    brightMagenta: '#D4A8F0',
    brightCyan: '#78D0CE',
    brightWhite: '#8090A8',
  },
  'red-dynasty': {
    background: '#1A0A0A',
    foreground: '#E8D0C0',
    cursor: '#E84040',
    selectionBackground: '#4A2A2A',
    black: '#3A1A1A',
    red: '#E84040',
    green: '#5AAE6A',
    yellow: '#F2C744',
    blue: '#6AA0CC',
    magenta: '#D4A0D0',
    cyan: '#5A9E8A',
    white: '#C0A898',
    brightBlack: '#5A3A30',
    brightRed: '#F06060',
    brightGreen: '#70C480',
    brightYellow: '#F5D566',
    brightBlue: '#80B4DD',
    brightMagenta: '#E0B4E0',
    brightCyan: '#70B4A0',
    brightWhite: '#A08878',
  },
  nightowl: {
    background: '#1E1B16',
    foreground: '#C8BFA8',
    cursor: '#C4A055',
    selectionBackground: '#38332A',
    black: '#2E2A22',
    red: '#CC6B5A',
    green: '#8AAA70',
    yellow: '#C89060',
    blue: '#C4A055',
    magenta: '#B0886E',
    cyan: '#8A9A6A',
    white: '#9A9080',
    brightBlack: '#5A5340',
    brightRed: '#DD7E6E',
    brightGreen: '#9EBE84',
    brightYellow: '#D8A474',
    brightBlue: '#D4B068',
    brightMagenta: '#C09880',
    brightCyan: '#9EAE7E',
    brightWhite: '#847A68',
  },
  void: {
    background: '#000000',
    foreground: '#C0C0C0',
    cursor: '#FFFFFF',
    selectionBackground: '#141414',
    black: '#0A0A0A',
    red: '#FF4444',
    green: '#909090',
    yellow: '#A0A0A0',
    blue: '#C0C0C0',
    magenta: '#808080',
    cyan: '#888888',
    white: '#909090',
    brightBlack: '#333333',
    brightRed: '#FF6666',
    brightGreen: '#A0A0A0',
    brightYellow: '#B0B0B0',
    brightBlue: '#D0D0D0',
    brightMagenta: '#909090',
    brightCyan: '#999999',
    brightWhite: '#707070',
  },
  hinomaru: {
    background: '#FAF8F5',
    foreground: '#2A2522',
    cursor: '#2A2522',
    selectionBackground: '#D4CFC6',
    black: '#2A2522',
    red: '#BC002D',
    green: '#5A7A6A',
    yellow: '#C4882D',
    blue: '#2C5F7C',
    magenta: '#A85060',
    cyan: '#4A8A7A',
    white: '#8A827A',
    brightBlack: '#A8A098',
    brightRed: '#D02040',
    brightGreen: '#6E8E7E',
    brightYellow: '#D49E44',
    brightBlue: '#3E7090',
    brightMagenta: '#BE6474',
    brightCyan: '#5EA08E',
    brightWhite: '#6A655E',
  },
  taegeuk: {
    background: '#F8F8FA',
    foreground: '#1A1A2E',
    cursor: '#1A1A2E',
    selectionBackground: '#CCCCD6',
    black: '#1A1A2E',
    red: '#C60C30',
    green: '#2D8A56',
    yellow: '#D4930D',
    blue: '#003478',
    magenta: '#A03060',
    cyan: '#1A7A7A',
    white: '#5A5A70',
    brightBlack: '#9A9AA8',
    brightRed: '#DA2848',
    brightGreen: '#40A06A',
    brightYellow: '#E4A824',
    brightBlue: '#1A4A90',
    brightMagenta: '#B44474',
    brightCyan: '#2E9090',
    brightWhite: '#6A6A7A',
  },
};

// ─── CSS variable definitions per theme ─────────────────────────────────────

export interface CssThemeVars {
  bgBase: string;
  bgMantle: string;
  bgSurface: string;
  bgOverlay: string;
  textMuted: string;
  textSubtle: string;
  textSub: string;
  textSub2: string;
  textMain: string;
  accentCursor: string;
  accentBlue: string;
  accentGreen: string;
  accentRed: string;
  accentYellow: string;
  accentPink: string;
  accentTeal: string;
  accentPurple: string;
}

export const CSS_THEME_VARS: Record<BuiltinThemeId, CssThemeVars> = {
  'catppuccin-mocha': {
    bgBase: '#1E1E2E', bgMantle: '#181825', bgSurface: '#313244', bgOverlay: '#45475A',
    textMuted: '#585B70', textSubtle: '#6C7086', textSub: '#BAC2DE', textSub2: '#A6ADC8',
    textMain: '#CDD6F4', accentCursor: '#F5E0DC',
    accentBlue: '#89B4FA', accentGreen: '#A6E3A1', accentRed: '#F38BA8',
    accentYellow: '#F9E2AF', accentPink: '#F5C2E7', accentTeal: '#94E2D5', accentPurple: '#CBA6F7',
  },
  monochrome: {
    bgBase: '#080808', bgMantle: '#050505', bgSurface: '#1A1A1A', bgOverlay: '#2A2A2A',
    textMuted: '#404040', textSubtle: '#606060', textSub: '#B0B0B0', textSub2: '#888888',
    textMain: '#E0E0E0', accentCursor: '#FFFFFF',
    accentBlue: '#A0A0A0', accentGreen: '#909090', accentRed: '#FF5555',
    accentYellow: '#C0C0C0', accentPink: '#999999', accentTeal: '#888888', accentPurple: '#959595',
  },
  'stars-and-stripes': {
    bgBase: '#0C1428', bgMantle: '#091020', bgSurface: '#1E2E4A', bgOverlay: '#2A3E5A',
    textMuted: '#3A5070', textSubtle: '#4A6080', textSub: '#A0B0C8', textSub2: '#8090A8',
    textMain: '#C8D6E8', accentCursor: '#5B8DEF',
    accentBlue: '#5B8DEF', accentGreen: '#4EBF8B', accentRed: '#E8554E',
    accentYellow: '#F2C85B', accentPink: '#C792EA', accentTeal: '#5BC0BE', accentPurple: '#9B7ED8',
  },
  'red-dynasty': {
    bgBase: '#1A0A0A', bgMantle: '#140808', bgSurface: '#3A1A1A', bgOverlay: '#4A2A2A',
    textMuted: '#5A3A30', textSubtle: '#6A4A3E', textSub: '#C0A898', textSub2: '#A08878',
    textMain: '#E8D0C0', accentCursor: '#E84040',
    accentBlue: '#6AA0CC', accentGreen: '#5AAE6A', accentRed: '#E84040',
    accentYellow: '#F2C744', accentPink: '#D4A0D0', accentTeal: '#5A9E8A', accentPurple: '#9A7AB8',
  },
  nightowl: {
    bgBase: '#1E1B16', bgMantle: '#161310', bgSurface: '#2E2A22', bgOverlay: '#38332A',
    textMuted: '#5A5340', textSubtle: '#6B6350', textSub: '#9A9080', textSub2: '#847A68',
    textMain: '#C8BFA8', accentCursor: '#C4A055',
    accentBlue: '#C4A055', accentGreen: '#8AAA70', accentRed: '#CC6B5A',
    accentYellow: '#C89060', accentPink: '#B0886E', accentTeal: '#8A9A6A', accentPurple: '#AA8A6A',
  },
  void: {
    bgBase: '#000000', bgMantle: '#000000', bgSurface: '#0A0A0A', bgOverlay: '#141414',
    textMuted: '#333333', textSubtle: '#505050', textSub: '#909090', textSub2: '#707070',
    textMain: '#C0C0C0', accentCursor: '#FFFFFF',
    accentBlue: '#C0C0C0', accentGreen: '#909090', accentRed: '#FF4444',
    accentYellow: '#A0A0A0', accentPink: '#808080', accentTeal: '#888888', accentPurple: '#858585',
  },
  hinomaru: {
    bgBase: '#FAF8F5', bgMantle: '#F0ECE6', bgSurface: '#E2DDD4', bgOverlay: '#D4CFC6',
    textMuted: '#A8A098', textSubtle: '#8A827A', textSub: '#4A4540', textSub2: '#6A655E',
    textMain: '#2A2522', accentCursor: '#2A2522',
    accentBlue: '#2C5F7C', accentGreen: '#5A7A6A', accentRed: '#BC002D',
    accentYellow: '#C4882D', accentPink: '#A85060', accentTeal: '#4A8A7A', accentPurple: '#7B6B8A',
  },
  taegeuk: {
    bgBase: '#F8F8FA', bgMantle: '#EEEEF2', bgSurface: '#DDDDE4', bgOverlay: '#CCCCD6',
    textMuted: '#9A9AA8', textSubtle: '#6A6A7A', textSub: '#3A3A50', textSub2: '#5A5A70',
    textMain: '#1A1A2E', accentCursor: '#1A1A2E',
    accentBlue: '#003478', accentGreen: '#2D8A56', accentRed: '#C60C30',
    accentYellow: '#D4930D', accentPink: '#A03060', accentTeal: '#1A7A7A', accentPurple: '#5A3D8A',
  },
};

// ─── Theme options for UI ───────────────────────────────────────────────────

export const THEME_OPTIONS: Array<{ value: ThemeId; label: string; preview: [string, string, string, string] }> = [
  { value: 'catppuccin-mocha',  label: 'Catppuccin',       preview: ['#1E1E2E', '#89B4FA', '#A6E3A1', '#F38BA8'] },
  { value: 'stars-and-stripes', label: 'Stars & Stripes',  preview: ['#0C1428', '#5B8DEF', '#4EBF8B', '#E8554E'] },
  { value: 'red-dynasty',       label: 'Red Dynasty',      preview: ['#1A0A0A', '#E84040', '#F2C744', '#6AA0CC'] },
  { value: 'nightowl',          label: 'Nightowl',         preview: ['#1E1B16', '#C4A055', '#8AAA70', '#CC6B5A'] },
  { value: 'void',              label: 'Void',             preview: ['#000000', '#C0C0C0', '#909090', '#FF4444'] },
  { value: 'monochrome',        label: 'Monochrome',       preview: ['#080808', '#A0A0A0', '#909090', '#FF5555'] },
  { value: 'hinomaru',          label: 'Hinomaru',         preview: ['#FAF8F5', '#BC002D', '#2C5F7C', '#5A7A6A'] },
  { value: 'taegeuk',           label: 'Taegeuk',          preview: ['#F8F8FA', '#C60C30', '#003478', '#2D8A56'] },
  { value: 'custom',            label: 'Custom',           preview: ['#1E1E2E', '#89B4FA', '#A6E3A1', '#F38BA8'] },
];

// ─── Custom theme utilities ─────────────────────────────────────────────────

/** Hex (#rrggbb) → "r, g, b" string for CSS rgb() usage */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Build a full CustomThemeColors from a builtin theme */
export function builtinToCustom(themeId: BuiltinThemeId): CustomThemeColors {
  const css = CSS_THEME_VARS[themeId];
  const xterm = XTERM_THEMES[themeId];
  return {
    bgBase: css.bgBase, bgMantle: css.bgMantle, bgSurface: css.bgSurface, bgOverlay: css.bgOverlay,
    textMuted: css.textMuted, textSubtle: css.textSubtle, textSub: css.textSub, textSub2: css.textSub2,
    textMain: css.textMain, accentCursor: css.accentCursor,
    accentBlue: css.accentBlue, accentGreen: css.accentGreen, accentRed: css.accentRed,
    accentYellow: css.accentYellow, accentPink: css.accentPink, accentTeal: css.accentTeal,
    accentPurple: css.accentPurple,
    xtermBackground: xterm.background, xtermForeground: xterm.foreground,
    xtermCursor: xterm.cursor, xtermSelection: xterm.selectionBackground,
    xtermBlack: xterm.black, xtermRed: xterm.red, xtermGreen: xterm.green, xtermYellow: xterm.yellow,
    xtermBlue: xterm.blue, xtermMagenta: xterm.magenta, xtermCyan: xterm.cyan, xtermWhite: xterm.white,
    xtermBrightBlack: xterm.brightBlack, xtermBrightRed: xterm.brightRed,
    xtermBrightGreen: xterm.brightGreen, xtermBrightYellow: xterm.brightYellow,
    xtermBrightBlue: xterm.brightBlue, xtermBrightMagenta: xterm.brightMagenta,
    xtermBrightCyan: xterm.brightCyan, xtermBrightWhite: xterm.brightWhite,
  };
}

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = builtinToCustom('catppuccin-mocha');

/** Extract XtermThemeColors from custom theme */
export function extractXtermColors(c: CustomThemeColors): XtermThemeColors {
  return {
    background: c.xtermBackground, foreground: c.xtermForeground,
    cursor: c.xtermCursor, selectionBackground: c.xtermSelection,
    black: c.xtermBlack, red: c.xtermRed, green: c.xtermGreen, yellow: c.xtermYellow,
    blue: c.xtermBlue, magenta: c.xtermMagenta, cyan: c.xtermCyan, white: c.xtermWhite,
    brightBlack: c.xtermBrightBlack, brightRed: c.xtermBrightRed,
    brightGreen: c.xtermBrightGreen, brightYellow: c.xtermBrightYellow,
    brightBlue: c.xtermBrightBlue, brightMagenta: c.xtermBrightMagenta,
    brightCyan: c.xtermBrightCyan, brightWhite: c.xtermBrightWhite,
  };
}

/** CSS variable name mapping */
const CSS_VAR_MAP: Record<string, string> = {
  bgBase: '--bg-base', bgMantle: '--bg-mantle', bgSurface: '--bg-surface', bgOverlay: '--bg-overlay',
  textMuted: '--text-muted', textSubtle: '--text-subtle', textSub: '--text-sub', textSub2: '--text-sub2',
  textMain: '--text-main', accentCursor: '--accent-cursor',
  accentBlue: '--accent-blue', accentGreen: '--accent-green', accentRed: '--accent-red',
  accentYellow: '--accent-yellow', accentPink: '--accent-pink', accentTeal: '--accent-teal',
  accentPurple: '--accent-purple',
};

/** Apply custom theme CSS variables to document root */
export function applyCustomCssVars(colors: CustomThemeColors): void {
  const root = document.documentElement;
  for (const [key, varName] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(varName, (colors as unknown as Record<string, string>)[key]);
  }
  // Computed RGB variants
  root.style.setProperty('--accent-blue-rgb', hexToRgb(colors.accentBlue));
  root.style.setProperty('--bg-surface-rgb', hexToRgb(colors.bgSurface));
  root.style.setProperty('--bg-base-rgb', hexToRgb(colors.bgBase));
}

/** Clear custom CSS variables (let [data-theme] rules take over) */
export function clearCustomCssVars(): void {
  const root = document.documentElement;
  for (const varName of Object.values(CSS_VAR_MAP)) {
    root.style.removeProperty(varName);
  }
  root.style.removeProperty('--accent-blue-rgb');
  root.style.removeProperty('--bg-surface-rgb');
  root.style.removeProperty('--bg-base-rgb');
}

/** Legacy theme ID migration — maps old IDs to new ones */
export function migrateThemeId(id: string): ThemeId {
  const LEGACY_MAP: Record<string, ThemeId> = {
    'catppuccin': 'catppuccin-mocha',
    'sandstone': 'hinomaru',
    'dracula': 'catppuccin-mocha',
    'nord': 'stars-and-stripes',
    'tokyo-night': 'catppuccin-mocha',
    'solarized-dark': 'stars-and-stripes',
    'gruvbox-dark': 'nightowl',
    'rose-pine': 'catppuccin-mocha',
  };
  return LEGACY_MAP[id] ?? (id as ThemeId);
}
