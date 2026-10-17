// JS-side mirror of the Tailwind palette in tailwind.config.js.
// Use these where a className can't be used (icon colors, navigation options, etc.).

export const palette = {
  light: {
    primary: '#4F46E5',
    secondary: '#059669',
    accent: '#D97706',
    danger: '#E11D48',
    background: '#F5F6FA',
    surface: '#FFFFFF',
    muted: '#F1F3F9',
    line: '#E4E7F0',
    text: '#0F172A',
    textLight: '#64748B',
    placeholder: '#94A3B8',
  },
  dark: {
    primary: '#818CF8',
    secondary: '#34D399',
    accent: '#FBBF24',
    danger: '#FB7185',
    background: '#0B1120',
    surface: '#151C2F',
    muted: '#1C2438',
    line: '#263049',
    text: '#E8ECF6',
    textLight: '#94A3B8',
    placeholder: '#64748B',
  },
};

export type Palette = typeof palette.light;
