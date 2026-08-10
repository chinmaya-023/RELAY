/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { relay: { 50: '#f0f7ff', 300: '#8fc5ff', 400: '#48a1ff', 500: '#1c7df2', 600: '#0964d8', 950: '#06172d' } } } },
  plugins: []
};
