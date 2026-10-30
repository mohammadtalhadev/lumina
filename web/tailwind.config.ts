import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C6CFF',
          dark: '#5B45E0',
          soft: '#EDEBFF',
        },
        accent: {
          cyan: '#22D3EE',
          pink: '#F472B6',
        },
        canvas: '#F4F6FF',
        ink: '#141828',
        slate2: '#5B6478',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(124,108,255,0.10)',
        card: '0 4px 20px 0 rgba(124,108,255,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
