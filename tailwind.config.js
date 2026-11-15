import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        ink: '#172b3a',
        muted: '#71808b',
        canvas: '#f7f8f5',
        teal: { 50: '#eaf7f5', 100: '#d5efeb', 500: '#41998e', 600: '#287d73', 700: '#22665f' },
        sand: '#f1ede5',
      },
      boxShadow: { soft: '0 12px 36px rgba(23, 43, 58, 0.06)' },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.65rem' },
    },
  },
  plugins: [forms],
};
