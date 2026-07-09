import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#ead189',
          'gold-dark': '#c9a94e',
          'gold-light': '#f5e8b8',
          brown: '#806639',
          'brown-light': '#a88659',
          dark: '#1c1913',
          'dark-2': '#2a2823',
          'dark-3': '#14140f',
          cream: '#f5f0e6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
