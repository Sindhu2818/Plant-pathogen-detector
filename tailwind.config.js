/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f5f7ef',
          100: '#e8eddb',
          200: '#d4dfc0',
          300: '#C1CFA1',
          400: '#a3b87a',
          500: '#8aa35e',
          600: '#6f8348',
          700: '#566637',
        },
        cream: {
          DEFAULT: '#FFF8F0',
          50: '#FFFCF7',
          100: '#FFF8F0',
          200: '#FFF0E0',
        },
        peach: {
          50: '#FFF8F2',
          100: '#FFF3E6',
          200: '#FFE8CC',
          300: '#FFDAB9',
          400: '#FFc88a',
        },
        lavender: {
          50: '#F5F0FA',
          100: '#EBE0F3',
          200: '#E0D3E9',
          300: '#D5C6E0',
          400: '#BFA8CF',
        },
        powder: {
          50: '#F0F6FA',
          100: '#E2EDF4',
          200: '#CDE0EC',
          300: '#B8D4E3',
          400: '#8FBDD5',
        },
        blush: {
          50: '#FEF6F7',
          100: '#FCEDEF',
          200: '#FAE3E6',
          300: '#F8E1E4',
          400: '#F0C4CA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px rgba(0, 0, 0, 0.04)',
        'soft-md': '0 4px 20px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};
