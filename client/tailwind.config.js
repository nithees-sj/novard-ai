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
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Raleway', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            // Every colour prose uses, as theme variables, so Markdown flips with the theme.
            '--tw-prose-body': c('gray-800'),
            '--tw-prose-headings': c('gray-900'),
            '--tw-prose-lead': c('gray-600'),
            '--tw-prose-links': c('blue-text-600'),
            '--tw-prose-bold': c('gray-900'),
            '--tw-prose-counters': c('gray-500'),
            '--tw-prose-bullets': c('gray-300'),
            '--tw-prose-hr': c('gray-200'),
            '--tw-prose-quotes': c('gray-900'),
            '--tw-prose-quote-borders': c('gray-200'),
            '--tw-prose-captions': c('gray-500'),
            '--tw-prose-kbd': c('gray-900'),
            '--tw-prose-code': c('blue-text-700'),
            '--tw-prose-pre-code': c('code-fg'),
            '--tw-prose-pre-bg': c('code'),
            '--tw-prose-th-borders': c('gray-300'),
            '--tw-prose-td-borders': c('gray-200'),
            color: c('gray-800'),
            maxWidth: 'none',
            a: { color: c('blue-text-600'), textDecoration: 'none', fontWeight: '500' },
            'a:hover': { textDecoration: 'underline' },
            'h1, h2, h3, h4': { color: c('gray-900'), fontWeight: '700' },
            h1: { fontSize: '1.5em', marginTop: '1.2em', marginBottom: '0.6em' },
            h2: { fontSize: '1.25em', marginTop: '1.2em', marginBottom: '0.5em' },
            h3: { fontSize: '1.1em', marginTop: '1em', marginBottom: '0.4em' },
            strong: { color: c('gray-900'), fontWeight: '600' },
            hr: { borderColor: c('gray-200'), marginTop: '1.5em', marginBottom: '1.5em' },
            code: {
              color: c('blue-text-700'),
              backgroundColor: c('blue-50'),
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
            },
            'pre code': { backgroundColor: 'transparent', color: 'inherit', padding: '0' },
            blockquote: { borderLeftColor: '#3b82f6', color: c('gray-600'), fontStyle: 'normal' },
            'ul > li::marker': { color: '#3b82f6' },
            'ol > li::marker': { color: '#3b82f6' },
            table: { fontSize: '0.9em' },
            'thead th': { color: c('gray-900'), backgroundColor: c('gray-50') },
            'td, th': { padding: '0.5em 0.75em', borderColor: c('gray-200') },
          },
        },
      },
      boxShadow: {
        soft: '0 4px 20px rgb(0 0 0 / calc(0.08 * var(--shadow-strength)))',
        medium: '0 8px 30px rgb(0 0 0 / calc(0.12 * var(--shadow-strength)))',
        hard: '0 20px 48px rgb(0 0 0 / calc(0.15 * var(--shadow-strength)))',
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