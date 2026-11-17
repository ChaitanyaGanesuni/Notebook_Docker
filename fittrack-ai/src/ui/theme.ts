import { Platform, useColorScheme, type ViewStyle } from 'react-native';

/**
 * Design tokens. "Night court": ink surfaces, one volt-lime energy colour,
 * amber for protein and sky blue for water. The light theme is warm paper with
 * ink buttons, so lime only ever sits on dark where it stays legible.
 */
export const LIME = '#C8F53C';

export const palettes = {
  light: {
    background: '#F3F2ED', surface: '#FFFFFF', sunken: '#ECEAE3', text: '#11141A', muted: '#646A75',
    hairline: '#DDDAD0',
    /** Text- and icon-safe brand colour on this theme's surfaces. */
    accent: '#3C7A00',
    /** Filled controls. */
    primary: '#11141A', onPrimary: LIME,
    accentSoft: '#E4F4C4',
    protein: '#B86A00', proteinSoft: '#FBEBD0',
    water: '#1F7FC4', waterSoft: '#DCEEFB',
    warning: '#C2410C', warningSoft: '#FCE6DA',
  },
  dark: {
    background: '#0B0D11', surface: '#151920', sunken: '#1E232C', text: '#F2F4F7', muted: '#8D95A3',
    hairline: '#2A303B',
    accent: LIME,
    primary: LIME, onPrimary: '#0B0D11',
    accentSoft: '#263010',
    protein: '#FFB13D', proteinSoft: '#33260F',
    water: '#4CC3FF', waterSoft: '#10293A',
    warning: '#FF8A65', warningSoft: '#3A1D14',
  },
} as const;

export type Palette = { [K in keyof (typeof palettes)['light']]: string };

/** The hero card is the same dark scoreboard in both themes. */
export const hero = {
  gradient: ['#2A3A16', '#161B20', '#11151A'] as const,
  text: '#F4F6F2', textMuted: 'rgba(244,246,242,0.64)', lime: LIME,
  track: 'rgba(255,255,255,0.13)', ghost: 'rgba(200,245,60,0.055)',
  ringCalories: LIME, ringProtein: '#FFB13D', ringWater: '#4CC3FF',
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
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
/** Minimum touch target (44 pt). */
export const TOUCH = 44;

/** Motion timings shared across the app. Reanimated honours the system reduce-motion setting. */
export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  stagger: 70,
  enter: 420,
} as const;

export interface Theme {
  dark: boolean;
  c: Palette;
  /** Soft elevation for cards: a shadow on light, nothing on dark (borders do the work there). */
  lift: ViewStyle;
}

export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  const lift: ViewStyle = dark ? {} : Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(17,20,26,0.04), 0 8px 24px rgba(17,20,26,0.06)' } as ViewStyle,
    default: { shadowColor: '#11141A', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  }) ?? {};
  return { dark, c: dark ? palettes.dark : palettes.light, lift };
}
