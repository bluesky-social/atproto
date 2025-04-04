/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  // See rollup.config.js for classes used in the HTML template
  safelist: ['bg-white', 'dark:bg-slate-800'],
}
