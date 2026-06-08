/** @type {import('tailwindcss').Config} */
export default {
  // Cobre todos os arquivos que podem conter classes Tailwind.
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
};
