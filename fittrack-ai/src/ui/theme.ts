import { useColorScheme } from 'react-native';

/** Design tokens (brief section 9). Light and dark match the web tracker. */
export const palettes = {
  light: {
    background: '#EEF2EC', surface: '#FFFFFF', sunken: '#E4EAE3', text: '#0F1D16', muted: '#5A6B61',
    hairline: '#D5DED6', court: '#0E5B3C', accent: '#12804F', protein: '#C96F17', water: '#2F7FC2',
    warning: '#B4541A', onAccent: '#FFFFFF',
  },
  dark: {
    background: '#0B110E', surface: '#141C18', sunken: '#1C2621', text: '#E6EEE8', muted: '#93A59A',
    hairline: '#27332D', court: '#0F4A33', accent: '#48C489', protein: '#F0A24E', water: '#5FA8E6',
    warning: '#F0935A', onAccent: '#0B110E',
  },
} as const;

export type Palette = { [K in keyof (typeof palettes)['light']]: string };

/** Hero-card colours are the same in both themes. */
export const hero = {
  text: '#F2F7F0', textMuted: 'rgba(242,247,240,0.72)', line: 'rgba(242,247,240,0.14)',
  ringCalories: '#F2F7F0', ringProtein: '#FFB45E', ringWater: '#7CC4FF',
} as const;

/** Barlow Condensed for headings and every numeral (scoreboard style); Inter for body text. */
export const fonts = {
  heading: 'BarlowCondensed_600SemiBold',
  headingBold: 'BarlowCondensed_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
/** Minimum touch target (44 pt). */
export const TOUCH = 44;

export interface Theme {
  dark: boolean;
  c: Palette;
}

export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  return { dark, c: dark ? palettes.dark : palettes.light };
}
