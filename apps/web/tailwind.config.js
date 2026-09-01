module.exports = {
  mode: 'jit',
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    'node_modules/daisyui/dist/**/*.js',
    'node_modules/react-daisyui/dist/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Libre Baskerville', 'Georgia', 'serif'],
      },
      colors: {
        ui: {
          canvas: 'rgb(var(--ui-canvas) / <alpha-value>)',
          surface: 'rgb(var(--ui-surface) / <alpha-value>)',
          'surface-muted': 'rgb(var(--ui-surface-muted) / <alpha-value>)',
          border: 'rgb(var(--ui-border) / <alpha-value>)',
          text: 'rgb(var(--ui-text) / <alpha-value>)',
          muted: 'rgb(var(--ui-muted) / <alpha-value>)',
          heading: 'rgb(var(--ui-heading) / <alpha-value>)',
          accent: 'rgb(var(--ui-accent) / <alpha-value>)',
        },
        tivmark: {
          navy: '#1a2744',
          deep: '#111c33',
          slate: '#3d4f6b',
          cream: '#f7f5f0',
          sand: '#ece8df',
          gold: '#b08d57',
          'gold-light': '#c9a96e',
          ink: '#2a2a2a',
          muted: '#646464',
        },
      },
    },
  },
  daisyui: {
    themes: [
      {
        'tivmark-light': {
          primary: '#1a2744',
          secondary: '#3d4f6b',
          accent: '#795f2b',
          neutral: '#111c33',
          'base-100': '#f7f5f0',
          'base-200': '#ece8df',
          'base-300': '#8b8373',
          'base-content': '#2a2a2a',
          info: '#3d4f6b',
          success: '#2b704e',
          warning: '#795f2b',
          error: '#a83d3d',
        },
      },
      {
        'tivmark-dark': {
          primary: '#c9a96e',
          secondary: '#3d4f6b',
          accent: '#c9a96e',
          neutral: '#0b1222',
          'base-100': '#111c33',
          'base-200': '#1a2744',
          'base-300': '#6f82a0',
          'base-content': '#f7f5f0',
          info: '#8aa5c7',
          success: '#67b58d',
          warning: '#c9a96e',
          error: '#e47777',
        },
      },
    ],
  },
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
};
