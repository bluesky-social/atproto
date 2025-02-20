/** @type {import('tailwindcss').Config} */
export default {
  content: ['src/assets/app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ],
      mono: ['Monaco', 'mono'],
    },
    extend: {
      colors: {
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-c': 'rgb(var(--color-brand-c) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        'error-c': 'rgb(var(--color-error-c) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-c': 'rgb(var(--color-warning-c) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-c': 'rgb(var(--color-success-c) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
