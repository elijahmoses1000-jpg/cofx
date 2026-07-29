import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                graphite: '#101418',
                slateInk: '#1C232B',
                steel: '#48525F',
                mute: '#8A94A2',
                hairline: '#DDE2E8',
                shell: '#F3F5F7',
                panel: '#FFFFFF',
                torque: '#F2751A',
                torqueDark: '#C25510',
                signal: '#0E7C66',
                alert: '#C0362C',
                caution: '#B4780A',
            },
            fontFamily: {
                display: ['Archivo', 'system-ui', 'sans-serif'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
        },
    },
    plugins: [],
};

export default config;
