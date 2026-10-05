/**
 * The colour palette for the light and dark themes (tailwind.config.js).
 *
 * Every page is written with ordinary Tailwind colour classes (bg-white,
 * text-gray-900, bg-red-50 ...). Rather than adding a `dark:` twin to each of
 * them, the colours those classes resolve to are CSS variables that change
 * when <html> has the `dark` class:
 *
 *   gray        the whole ramp inverts (gray-50 is the page, gray-900 the text)
 *   hues 50-200 as backgrounds, borders and rings: pale tints become dark tints
 *   hues 600+   as text, fill and stroke: dark text becomes light text
 *   hues 300+   as backgrounds stay as they are (bg-blue-600 buttons, dots, bars)
 *   white/black and slate never change (slate is the "always dark" palette)
 *
 * plus a few named colours for what a ramp cannot express: surface (cards),
 * surface-overlay (menus, dialogs), ink (dark buttons), tooltip, code, chart.
 *
 * New code uses the semantic tokens instead of ramps (SEMANTIC below):
 *   canvas / raised / sunken / overlay        page, cards, wells, menus
 *   line-subtle / line / line-strong          dividers and borders
 *   fg / fg-muted / fg-subtle / fg-disabled   text
 *   accent (+ hover, soft, fg), on-accent     the one blue accent
 *   success / warning / danger / info         each with soft (fill) and fg (text)
 * The neutrals are tinted towards blue-slate in both themes, and the dark
 * theme is its own palette, not an inversion of the light one.
 *
 * CommonJS, because tailwind.config.js runs in Node.
 */
const colors = require('tailwindcss/colors');

const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
// Custom names for existing hues. `primary` used to be sky; it is blue now, so
// the brand blue is the same everywhere (primary-600 === blue-600).
// `accent` is the semantic brand accent now (SEMANTIC), not an alias of fuchsia.
const ALIASES = { primary: 'blue' };
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const TINT_STEPS = { 50: 0.12, 100: 0.18, 200: 0.3 }; // dark tint = hue-500 mixed into the surface
const TEXT_STEPS = { 600: '400', 700: '300', 800: '200', 900: '100', 950: '50' }; // dark text step

// Neutral ramps, tinted towards blue-slate. gray-50 is the page in both themes.
const LIGHT_GRAY = {
  50: '#f7f8fa', 100: '#eff1f4', 200: '#e3e6eb', 300: '#cdd2da', 400: '#8a93a1', 500: '#656d7b',
  600: '#4f5664', 700: '#3b414d', 800: '#262b34', 900: '#171a21', 950: '#0d0f14',
};
const DARK_GRAY = {
  50: '#0e1217', 100: '#1a2029', 200: '#262d38', 300: '#343c49', 400: '#5d6676', 500: '#8b94a3',
  600: '#a6aebb', 700: '#c0c7d1', 800: '#d9dee5', 900: '#e8ebf0', 950: '#f4f6f9',
};

const SURFACE = { light: '#ffffff', dark: '#151a21' };

const BLUE = '#2563eb';
/** A soft status fill in the dark theme: the hue mixed into the card colour. */
const soft = (hex, amount = 0.16) => mix(hex, SURFACE.dark, amount);

/** Semantic colours: [light, dark]. Text pairs meet WCAG AA on canvas, raised and their soft fill. */
const SEMANTIC = {
  canvas: [LIGHT_GRAY[50], DARK_GRAY[50]],
  raised: [SURFACE.light, SURFACE.dark],
  sunken: ['#f0f2f5', '#0a0d11'],
  overlay: ['#ffffff', '#1b212a'],
  'line-subtle': ['#ebedf1', '#1f252e'],
  line: ['#dee2e8', '#29303b'],
  'line-strong': ['#c4cad3', '#3a4250'],
  fg: ['#14171d', '#e8ebf0'],
  'fg-muted': ['#4f5664', '#a6aebb'],
  'fg-subtle': ['#656d7b', '#949dab'],
  'fg-disabled': ['#a3aab5', '#4a5260'],
  accent: [BLUE, BLUE],
  'accent-hover': ['#1d4ed8', '#1d4ed8'],
  'accent-soft': ['#ebf1fe', soft(BLUE, 0.2)],
  'accent-fg': ['#1d4ed8', '#84aefc'],
  'on-accent': ['#ffffff', '#ffffff'],
  focus: [BLUE, '#6b9cf8'],
  success: ['#16a34a', '#22c55e'],
  'success-soft': ['#e9f6ee', soft('#22c55e')],
  'success-fg': ['#137a3a', '#5fd68c'],
  warning: ['#d97706', '#f59e0b'],
  'warning-soft': ['#fdf4e4', soft('#f59e0b')],
  'warning-fg': ['#a2490a', '#f6bd4f'],
  danger: ['#dc2626', '#ef4444'],
  'danger-soft': ['#fdeded', soft('#ef4444')],
  'danger-fg': ['#b91c1c', '#f98a8a'],
  info: ['#0284c7', '#38bdf8'],
  'info-soft': ['#e8f4fb', soft('#38bdf8')],
  'info-fg': ['#036596', '#7dcff8'],
};

/** Named colours: [light, dark]. */
const TOKENS = {
  ...SEMANTIC,
  surface: SEMANTIC.raised,
  'surface-overlay': SEMANTIC.overlay,
  ink: ['#171a21', '#e8ebf0'],
  'ink-hover': ['#262b34', '#c0c7d1'],
  'on-ink': ['#ffffff', '#0e1217'],
  tooltip: ['#171a21', '#262d38'],
  'tooltip-fg': ['#ffffff', '#f4f6f9'],
  'tooltip-muted': ['#cdd2da', '#a6aebb'],
  code: ['#171a21', '#0a0d11'],
  'code-fg': ['#eff1f4', '#e8ebf0'],
  'chart-grid': ['#eff1f4', '#222934'],
  'chart-track': ['#e3e6eb', '#262d38'],
  'chart-axis': ['#8a93a1', '#6b7484'],
  'chart-line': ['#cdd2da', '#343c49'],
  'chart-brand': [BLUE, '#4f86f7'],
  // Categorical series (one hue per series, never decorative): blue, teal, violet, amber, rose, slate.
  'chart-1': [BLUE, '#4f86f7'],
  'chart-2': ['#0d9488', '#2cc4b4'],
  'chart-3': ['#7c3aed', '#a07cf5'],
  'chart-4': ['#d97706', '#f2a93b'],
  'chart-5': ['#e11d48', '#f4708e'],
  'chart-6': ['#64748b', '#8b94a3'],
  // Risk levels (admin console)
  'level-low': [colors.emerald[500], colors.emerald[500]],
  'level-medium': [colors.amber[500], colors.amber[500]],
  'level-high': [colors.red[500], colors.red[500]],
  'level-critical': [colors.red[700], colors.red[400]],
  'shadow-color': ['0 0 0', '0 0 0'],
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const channels = (hex) => (hex.includes(' ') ? hex : hexToRgb(hex).join(' '));

/** `amount` of `hex` over `base`, as "r g b". */
function mix(hex, base, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(base);
  return a.map((c, i) => Math.round(c * amount + b[i] * (1 - amount))).join(' ');
}

const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** The CSS variables for :root (light) and .dark. */
function variables() {
  const light = {};
  const dark = {};
  STEPS.forEach((step) => {
    light[`--gray-${step}`] = channels(LIGHT_GRAY[step]);
    dark[`--gray-${step}`] = channels(DARK_GRAY[step]);
  });
  HUES.forEach((hue) => {
    Object.entries(TINT_STEPS).forEach(([step, amount]) => {
      light[`--${hue}-${step}`] = channels(colors[hue][step]);
      dark[`--${hue}-${step}`] = mix(colors[hue][500], SURFACE.dark, amount);
    });
    Object.entries(TEXT_STEPS).forEach(([step, darkStep]) => {
      light[`--${hue}-text-${step}`] = channels(colors[hue][step]);
      dark[`--${hue}-text-${step}`] = channels(colors[hue][darkStep]);
    });
  });
  Object.entries(TOKENS).forEach(([name, [l, d]]) => {
    light[`--${name}`] = channels(l);
    dark[`--${name}`] = channels(d);
  });
  dark['--shadow-strength'] = '3'; // shadows need more weight to show on a dark page
  light['--shadow-strength'] = '1';
  return { light, dark };
}

/** A hue ramp for backgrounds/borders/rings (tints themed) or text/fill/stroke (dark steps themed). */
function hueRamp(hue, role) {
  const ramp = {};
  STEPS.forEach((step) => {
    if (role === 'surface' && TINT_STEPS[step] !== undefined) ramp[step] = v(`${hue}-${step}`);
    else if (role === 'text' && TEXT_STEPS[step] !== undefined) ramp[step] = v(`${hue}-text-${step}`);
    else ramp[step] = colors[hue][step];
  });
  return ramp;
}

/** The Tailwind colour map for one role: 'surface' (bg, border, ring, gradients) or 'text' (text, fill, stroke). */
function colorMap(role) {
  const map = {
    inherit: 'inherit',
    current: 'currentColor',
    transparent: 'transparent',
    black: colors.black,
    white: colors.white,
    slate: colors.slate,
    gray: Object.fromEntries(STEPS.map((step) => [step, v(`gray-${step}`)])),
    surface: { DEFAULT: v('surface'), overlay: v('surface-overlay') },
    canvas: v('canvas'),
    raised: v('raised'),
    sunken: v('sunken'),
    overlay: v('overlay'),
    line: { DEFAULT: v('line'), subtle: v('line-subtle'), strong: v('line-strong') },
    fg: { DEFAULT: v('fg'), muted: v('fg-muted'), subtle: v('fg-subtle'), disabled: v('fg-disabled') },
    accent: { DEFAULT: v('accent'), hover: v('accent-hover'), soft: v('accent-soft'), fg: v('accent-fg') },
    'on-accent': v('on-accent'),
    focus: v('focus'),
    ...Object.fromEntries(['success', 'warning', 'danger', 'info'].map((tone) => [tone, { DEFAULT: v(tone), soft: v(`${tone}-soft`), fg: v(`${tone}-fg`) }])),
    ink: { DEFAULT: v('ink'), hover: v('ink-hover') },
    'on-ink': v('on-ink'),
    tooltip: { DEFAULT: v('tooltip'), fg: v('tooltip-fg'), muted: v('tooltip-muted') },
    code: { DEFAULT: v('code'), fg: v('code-fg') },
    chart: {
      grid: v('chart-grid'), track: v('chart-track'), axis: v('chart-axis'), line: v('chart-line'), brand: v('chart-brand'),
      ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, v(`chart-${n}`)])),
    },
    level: { low: v('level-low'), medium: v('level-medium'), high: v('level-high'), critical: v('level-critical') },
  };
  HUES.forEach((hue) => { map[hue] = hueRamp(hue, role); });
  Object.entries(ALIASES).forEach(([alias, hue]) => { map[alias] = map[hue]; });
  return map;
}

module.exports = { variables, colorMap, mix, SEMANTIC, TOKENS, LIGHT_GRAY, DARK_GRAY };
