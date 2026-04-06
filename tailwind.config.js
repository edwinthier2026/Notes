/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dc-blue': {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd4ff',
          300: '#90b8ff',
          400: '#5b93ff',
          500: '#2872fa',
          600: '#1559ed',
          700: '#0f47c9',
          800: '#133ba3',
          900: '#153580',
        },
        'dc-navy': '#192a3d',
        'dc-gray': {
          50: '#f2f5f7',
          100: '#e8ecf0',
          200: '#d3dae1',
          300: '#b3bfc9',
          400: '#8d9dac',
          500: '#3A4F66',
          600: '#344862',
          700: '#2c3d53',
          800: '#273447',
          900: '#232e3d',
        },
      },
    },
  },
  plugins: [],
};
