/** @type {import('tailwindcss').Config} */
export default {
  content: ['src/assets/app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {
      primary: 'rgb(var(--color-primary) / <alpha-value>)',
    },
    extend: {},
  },
  plugins: [],
}
