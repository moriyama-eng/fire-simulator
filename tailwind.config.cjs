/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './docs.html', './src/**/*.{ts,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
