module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
      },
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
            color: '#1f2937',
            maxWidth: 'none',
            a: { color: '#0284c7', textDecoration: 'none', fontWeight: '500' },
            'a:hover': { textDecoration: 'underline' },
            'h1, h2, h3, h4': { color: '#111827', fontWeight: '700' },
            h1: { fontSize: '1.5em', marginTop: '1.2em', marginBottom: '0.6em' },
            h2: { fontSize: '1.25em', marginTop: '1.2em', marginBottom: '0.5em' },
            h3: { fontSize: '1.1em', marginTop: '1em', marginBottom: '0.4em' },
            strong: { color: '#111827', fontWeight: '600' },
            hr: { borderColor: '#e5e7eb', marginTop: '1.5em', marginBottom: '1.5em' },
            code: {
              color: '#0369a1',
              backgroundColor: '#f0f9ff',
              padding: '0.15em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            pre: {
              backgroundColor: '#111827',
              color: '#f9fafb',
              borderRadius: '0.5rem',
            },
            'pre code': { backgroundColor: 'transparent', color: 'inherit', padding: '0' },
            blockquote: { borderLeftColor: '#0ea5e9', color: '#4b5563', fontStyle: 'normal' },
            'ul > li::marker': { color: '#0ea5e9' },
            'ol > li::marker': { color: '#0ea5e9' },
            table: { fontSize: '0.9em' },
            'thead th': { color: '#111827', backgroundColor: '#f9fafb' },
            'td, th': { padding: '0.5em 0.75em', borderColor: '#e5e7eb' },
          },
        },
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0, 0, 0, 0.08)',
        medium: '0 8px 30px rgba(0, 0, 0, 0.12)',
        hard: '0 20px 48px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};