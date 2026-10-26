/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3fb',
          100: '#dbe6f7',
          200: '#b9cdee',
          300: '#8fade0',
          400: '#5f85cc',
          500: '#3a63b3',
          600: '#2556b3',
          700: '#1b428f',
          800: '#12306e',
          900: '#0b1f4b',
        },
        saffron: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
