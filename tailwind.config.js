const palette = require('./src/theme/palette');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: { lexa: palette },
      fontFamily: {
        display: ['Fredoka_600SemiBold'],
        sans: ['Nunito_400Regular'],
        mono: ['JetBrainsMono_400Regular'],
      },
      borderRadius: { pill: '9999px' },
    },
  },
  plugins: [],
};
