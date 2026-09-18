/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#101214', panel: '#181b1e', line: '#30363b', paper: '#f4f2ed', muted: '#a6afb8', signal: '#d3ee83' },
      fontFamily: { sans: ['Inter', 'Arial', 'sans-serif'], editorial: ['Georgia', 'serif'], mono: ['Consolas', 'monospace'] },
    },
  },
  plugins: [],
};
