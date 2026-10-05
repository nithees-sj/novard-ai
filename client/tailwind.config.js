const plugin = require('tailwindcss/plugin');
const { variables, colorMap } = require('./src/theme/palette');

// Colours are CSS variables that switch with the `dark` class on <html>; see
// src/theme/palette.js for how the light and dark palettes are built.
const surfaceColors = colorMap('surface');
const textColors = colorMap('text');
const c = (name) => `rgb(var(--${name}))`;

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    colors: surfaceColors,
    textColor: textColors,
    fill: { none: 'none', ...textColors },
    stroke: { none: 'none', ...textColors },
    // Type scale: 11 · 12 · 13 · 14 · 16 · 20 · 28 (+ 44 for the landing hero),
    // each step with its own line height and tracking.
    // The Tailwind names (xs…6xl) are kept as aliases onto the scale so older
    // markup lands on a step; new code uses the named steps.
    fontSize: (() => {
      const scale = {
        micro: ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }], // 11/14: chart axes, overlines
        caption: ['0.75rem', { lineHeight: '1rem' }], // 12/16
        small: ['0.8125rem', { lineHeight: '1.125rem' }], // 13/18
        body: ['0.875rem', { lineHeight: '1.375rem' }], // 14/22
        lead: ['1rem', { lineHeight: '1.5rem' }], // 16/24
        title: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.012em' }], // 20/28
        display: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.022em' }], // 28/34
        hero: ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.032em' }], // 44/48, landing only
      };
      return {
        ...scale,
        xs: scale.caption,
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: scale.lead,
        lg: scale.lead,
        xl: scale.title,
        '2xl': scale.display,
        '3xl': scale.display,
        '4xl': scale.hero,
        '5xl': scale.hero,
        '6xl': scale.hero,
      };
    })(),
    // Restrained corners: 6px controls, 8–10px containers. No 2xl/3xl.
    borderRadius: {
      none: '0',
      sm: '0.25rem',
      DEFAULT: '0.375rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.625rem',
      full: '9999px',
    },
    // Shadows are for real elevation only (menus, popovers, dialogs). The old
    // names stay as aliases so nothing loses its shadow without a decision.
    boxShadow: (() => {
      const k = (alpha) => `rgb(var(--shadow-color) / calc(${alpha} * var(--shadow-strength)))`;
      const raised = `0 1px 2px ${k(0.05)}`;
      const popover = `0 0 0 1px ${k(0.04)}, 0 4px 12px ${k(0.08)}, 0 1px 3px ${k(0.06)}`;
      const modal = `0 0 0 1px ${k(0.04)}, 0 16px 40px ${k(0.16)}, 0 4px 12px ${k(0.08)}`;
      return {
        none: 'none',
        raised,
        popover,
        modal,
        sm: raised,
        DEFAULT: raised,
        md: popover,
        lg: popover,
        xl: modal,
        '2xl': modal,
        soft: popover,
        medium: popover,
        hard: modal,
        inner: `inset 0 1px 2px ${k(0.06)}`,
      };
    })(),
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // The NOVARD-AI wordmark only.
        display: ['Raleway', 'Geist', 'sans-serif'],
      },
      // The app shell's left navigation (Sidebar, AppShell, AdminLayout, RouteFallback).
      spacing: { sidebar: '17.5rem' },
      transitionDuration: { DEFAULT: '150ms', 150: '150ms', 200: '200ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)', out: 'cubic-bezier(0.2, 0, 0, 1)' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.98)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            // Every colour prose uses, as theme variables, so Markdown flips with the theme.
            '--tw-prose-body': c('fg'),
            '--tw-prose-headings': c('fg'),
            '--tw-prose-lead': c('fg-muted'),
            '--tw-prose-links': c('accent-fg'),
            '--tw-prose-bold': c('fg'),
            '--tw-prose-counters': c('fg-subtle'),
            '--tw-prose-bullets': c('line-strong'),
            '--tw-prose-hr': c('line'),
            '--tw-prose-quotes': c('fg'),
            '--tw-prose-quote-borders': c('line'),
            '--tw-prose-captions': c('fg-subtle'),
            '--tw-prose-kbd': c('fg'),
            '--tw-prose-code': c('accent-fg'),
            '--tw-prose-pre-code': c('code-fg'),
            '--tw-prose-pre-bg': c('code'),
            '--tw-prose-th-borders': c('line-strong'),
            '--tw-prose-td-borders': c('line'),
            color: c('fg'),
            maxWidth: 'none',
            a: { color: c('accent-fg'), textDecoration: 'none', fontWeight: '500' },
            'a:hover': { textDecoration: 'underline' },
            'h1, h2, h3, h4': { color: c('fg'), fontWeight: '600', letterSpacing: '-0.012em' },
            h1: { fontSize: '1.5em', marginTop: '1.2em', marginBottom: '0.6em' },
            h2: { fontSize: '1.25em', marginTop: '1.2em', marginBottom: '0.5em' },
            h3: { fontSize: '1.1em', marginTop: '1em', marginBottom: '0.4em' },
            strong: { color: c('fg'), fontWeight: '600' },
            hr: { borderColor: c('line'), marginTop: '1.5em', marginBottom: '1.5em' },
            code: {
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              color: c('fg'),
              backgroundColor: c('sunken'),
              padding: '0.15em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            pre: {
              backgroundColor: c('code'),
              color: c('code-fg'),
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
            },
            'pre code': { backgroundColor: 'transparent', color: 'inherit', padding: '0' },
            blockquote: { borderLeftColor: c('line-strong'), color: c('fg-muted'), fontStyle: 'normal' },
            'ul > li::marker': { color: c('fg-subtle') },
            'ol > li::marker': { color: c('fg-subtle') },
            table: { fontSize: '0.9em' },
            'thead th': { color: c('fg'), backgroundColor: c('sunken'), fontWeight: '600' },
            'td, th': { padding: '0.5em 0.75em', borderColor: c('line') },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    plugin(({ addBase }) => {
      const { light, dark } = variables();
      addBase({ ':root': light, '.dark': dark });
    }),
  ],
};