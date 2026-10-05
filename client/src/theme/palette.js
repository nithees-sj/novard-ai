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
 * CommonJS, because tailwind.config.js runs in Node.
 */
const colors = require('tailwindcss/colors');

const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
// Custom names for existing hues. `primary` used to be sky; it is blue now, so
// the brand blue is the same everywhere (primary-600 === blue-600).
const ALIASES = { primary: 'blue', accent: 'fuchsia' };
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const TINT_STEPS = { 50: 0.12, 100: 0.18, 200: 0.3 }; // dark tint = hue-500 mixed into the surface
const TEXT_STEPS = { 600: '400', 700: '300', 800: '200', 900: '100', 950: '50' }; // dark text step

const DARK_GRAY = {
  50: '#0b0f14', 100: '#1a2230', 200: '#263041', 300: '#334155', 400: '#64748b', 500: '#94a3b8',
  600: '#a9b4c4', 700: '#c3ccd8', 800: '#dce2ea', 900: '#e6eaf0', 950: '#f4f6f9',
};

const SURFACE = { light: '#ffffff', dark: '#121821' };

/** Named colours: [light, dark]. */
const TOKENS = {
  surface: [SURFACE.light, SURFACE.dark],
  'surface-overlay': ['#ffffff', '#161d28'],
  ink: [colors.gray[900], '#e6eaf0'],
  'ink-hover': [colors.gray[800], '#c3ccd8'],
  'on-ink': ['#ffffff', '#0b0f14'],
  tooltip: [colors.gray[900], '#263041'],
  'tooltip-fg': ['#ffffff', '#f4f6f9'],
  'tooltip-muted': [colors.gray[300], '#94a3b8'],
  code: [colors.gray[900], '#070a0e'],
  'code-fg': [colors.gray[100], '#e6eaf0'],
  'chart-grid': [colors.gray[100], '#263041'],
  'chart-track': [colors.gray[200], '#263041'],
  'chart-axis': [colors.gray[400], '#64748b'],
  'chart-line': [colors.gray[300], '#334155'],
  'chart-brand': [colors.blue[600], colors.blue[500]],
  // Risk levels (admin console)
  'level-low': [colors.emerald[500], colors.emerald[500]],
  'level-medium': [colors.amber[500], colors.amber[500]],
  'level-high': [colors.red[500], colors.red[500]],
  'level-critical': [colors.red[700], colors.red[400]],
  'shadow-color': ['0 0 0', '0 0 0'],
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
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
    light[`--gray-${step}`] = channels(colors.gray[step]);
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
    ink: { DEFAULT: v('ink'), hover: v('ink-hover') },
    'on-ink': v('on-ink'),
    tooltip: { DEFAULT: v('tooltip'), fg: v('tooltip-fg'), muted: v('tooltip-muted') },
    code: { DEFAULT: v('code'), fg: v('code-fg') },
    chart: { grid: v('chart-grid'), track: v('chart-track'), axis: v('chart-axis'), line: v('chart-line'), brand: v('chart-brand') },
    level: { low: v('level-low'), medium: v('level-medium'), high: v('level-high'), critical: v('level-critical') },
  };
  HUES.forEach((hue) => { map[hue] = hueRamp(hue, role); });
  Object.entries(ALIASES).forEach(([alias, hue]) => { map[alias] = map[hue]; });
  return map;
}

module.exports = { variables, colorMap, mix };
