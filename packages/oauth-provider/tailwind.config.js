/** @type {import('tailwindcss').Config} */
export default {
  content: ['src/assets/app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
