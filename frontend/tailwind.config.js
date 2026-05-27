/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f4ff',
                    100: '#d9e2ff',
                    200: '#b8caff',
                    300: '#8ca6ff',
                    400: '#5c78ff',
                    500: '#3b54ff', // Electric Indigo
                    600: '#2a3df2',
                    700: '#1d26c9',
                    800: '#171d9c',
                    900: '#0f146e',
                    950: '#080a4a',
                },
                secondary: {
                    50: '#f4f7fb',
                    100: '#e9eef6',
                    200: '#cedbec',
                    300: '#a3bdda',
                    400: '#7198c2',
                    500: '#4d76a7', // Slate Blue
                    600: '#3c5d88',
                    700: '#314c6e',
                    800: '#283c57',
                    900: '#24334a',
                    950: '#182131',
                },
                accent: {
                    50: '#fdf2ff',
                    100: '#f9e5ff',
                    200: '#f3ccff',
                    300: '#eda3ff',
                    400: '#e46fff',
                    500: '#d536ff', // Vibrant Purple
                    600: '#c010f2',
                    700: '#a207cc',
                    800: '#840a9c',
                    900: '#6d0e7e',
                    950: '#480054',
                },
                dark: {
                    50: '#f2f4f7',
                    100: '#e3e6ed',
                    200: '#c8ceda',
                    300: '#9eabbc',
                    400: '#6e7f94',
                    500: '#4d5c70',
                    600: '#3c4758',
                    700: '#2a323d',
                    800: '#1a1f26', // Deep Charcoal
                    900: '#0f1217',
                    950: '#080a0d',
                }
            },
            fontFamily: {
                sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
            },
            // Fluid typography — every text-* class scales smoothly from
            // ~375px viewport (min) up to ~1280px (max). No sm:/md: prefixes
            // needed in markup; just use text-xs/sm/base/lg/... as usual.
            // Linear interpolation: clamp(min, intercept + slopeVW, max).
            fontSize: {
                'xs':   ['clamp(0.6875rem, 0.661rem + 0.110vw, 0.75rem)',  { lineHeight: '1rem' }],
                'sm':   ['clamp(0.75rem,   0.698rem + 0.221vw, 0.875rem)', { lineHeight: '1.25rem' }],
                'base': ['clamp(0.875rem,  0.823rem + 0.221vw, 1rem)',     { lineHeight: '1.5rem' }],
                'lg':   ['clamp(0.9375rem, 0.860rem + 0.331vw, 1.125rem)', { lineHeight: '1.75rem' }],
                'xl':   ['clamp(1rem,      0.896rem + 0.442vw, 1.25rem)',  { lineHeight: '1.75rem' }],
                '2xl':  ['clamp(1.125rem,  0.969rem + 0.663vw, 1.5rem)',   { lineHeight: '2rem' }],
                '3xl':  ['clamp(1.375rem,  1.168rem + 0.884vw, 1.875rem)', { lineHeight: '2.25rem' }],
                '4xl':  ['clamp(1.625rem,  1.366rem + 1.105vw, 2.25rem)',  { lineHeight: '2.5rem' }],
                '5xl':  ['clamp(2rem,      1.586rem + 1.768vw, 3rem)',     { lineHeight: '1' }],
                '6xl':  ['clamp(2.5rem,    1.981rem + 2.210vw, 3.75rem)',  { lineHeight: '1' }],
                '7xl':  ['clamp(3rem,      2.378rem + 2.652vw, 4.5rem)',   { lineHeight: '1' }],
                '8xl':  ['clamp(3.75rem,   2.819rem + 3.978vw, 6rem)',     { lineHeight: '1' }],
                '9xl':  ['clamp(5rem,      3.757rem + 5.304vw, 8rem)',     { lineHeight: '1' }],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-subtle': 'bounceSubtle 2s infinite',
                'shimmer': 'shimmer 2s infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                bounceSubtle: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
            boxShadow: {
                'glass': '0 1px 2px rgba(15, 23, 42, 0.04), 0 14px 34px -28px rgba(15, 23, 42, 0.55)',
                'card': '0 1px 2px rgba(15, 23, 42, 0.06), 0 16px 36px -30px rgba(15, 23, 42, 0.65)',
                'card-hover': '0 2px 6px rgba(15, 23, 42, 0.08), 0 20px 42px -30px rgba(15, 23, 42, 0.75)',
                'premium': '0 0 0 1px rgba(15, 23, 42, 0.09), 0 16px 36px -28px rgba(15, 23, 42, 0.52)',
                'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.12)',
            },
            backdropBlur: {
                'glass': '12px',
            },
            gridTemplateColumns: {
                '15': 'repeat(15, minmax(0, 1fr))',
            },
        },
    },
    plugins: [],
}
