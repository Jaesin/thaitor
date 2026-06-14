/*
 * Thaitor design tokens — the three visual directions as typed theme objects.
 * TA = Paper & Ink, TB = Temple Gold, TC = Night Market.
 * Ported from design_handoff_thaitor/src/tokens/themes.js. See DESIGN-TOKENS.md.
 */

export type ThemeKey = 'paper' | 'temple' | 'market';

export interface Theme {
  key: ThemeKey;

  // Type / fonts
  thai: string;
  thaiDisplay?: string;
  ui: string;
  mono: string;
  display: string;

  // Surfaces
  bg: string;
  surface: string;
  raise: string;

  // Ink
  ink: string;
  muted: string;
  faint: string;

  // Hairlines
  hair: string;
  hair2: string;

  // Accent
  accent: string;
  accentInk: string;
  accentSoft: string;

  // Gold (Paper + Temple)
  gold?: string;
  goldSoft?: string;

  // Temple-only extras
  jade?: string;
  teak?: string;

  // Tone glyph ink / chrome
  toneInk: string;
  navBg: string;
  bezel: string;

  // Night Market neon set
  neonPink?: string;
  neonCyan?: string;
  neonLime?: string;
  neonGold?: string;
  neonViolet?: string;
}

// A · PAPER & INK — restrained, near-monochrome, warm paper, one jade accent.
export const TA: Theme = {
  key: 'paper',
  thai: "'Noto Sans Thai', sans-serif",
  ui: "'Hanken Grotesk', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  display: "'Hanken Grotesk', sans-serif",
  bg: '#f5f3ec', surface: '#ffffff', raise: '#fbfaf5',
  ink: '#1c1915', muted: '#8d867a', faint: '#b6afa2',
  hair: 'rgba(28,25,21,0.10)', hair2: 'rgba(28,25,21,0.055)',
  accent: '#3f7d72', accentInk: '#2c5b53', accentSoft: 'rgba(63,125,114,0.10)',
  toneInk: '#46544f', navBg: 'rgba(245,243,236,0.9)', bezel: '#181410',
  gold: '#a98b4e',
};

// B · TEMPLE GOLD — full-on Thai: cream, terracotta, teak, gold leaf, jade.
export const TB: Theme = {
  key: 'temple',
  thai: "'Noto Sans Thai', sans-serif",
  thaiDisplay: "'Noto Serif Thai', serif",
  ui: "'Hanken Grotesk', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  display: "'Newsreader', serif",
  bg: '#f1e7d4', surface: '#fbf5ea', raise: '#fffaf1',
  ink: '#2b2017', muted: '#9b8a6f', faint: '#bcab8d',
  hair: 'rgba(43,32,23,0.12)', hair2: 'rgba(43,32,23,0.06)',
  accent: '#b3502b', accentInk: '#923c1c', accentSoft: 'rgba(179,80,43,0.10)',
  gold: '#c08a2f', goldSoft: 'rgba(192,138,47,0.14)', jade: '#2f6f5b', teak: '#7a5230',
  toneInk: '#7a5230', navBg: 'rgba(241,231,212,0.94)', bezel: '#1a130b',
};

// C · NIGHT MARKET — vivid dark indigo, neon tone curves, playful.
export const TC: Theme = {
  key: 'market',
  thai: "'Noto Sans Thai', sans-serif",
  ui: "'Hanken Grotesk', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  display: "'Bricolage Grotesque', sans-serif",
  bg: '#15101f', surface: '#221a33', raise: '#2b2240',
  ink: '#f3eeff', muted: '#a79dc2', faint: '#766b93',
  hair: 'rgba(255,255,255,0.12)', hair2: 'rgba(255,255,255,0.06)',
  accent: '#ff5aa6', accentInk: '#ff7ab6', accentSoft: 'rgba(255,90,166,0.16)',
  toneInk: '#3fe6d2', navBg: 'rgba(21,16,31,0.94)', bezel: '#0c0814',
  neonPink: '#ff5aa6', neonCyan: '#3fe6d2', neonLime: '#cdf24f', neonGold: '#ffc24b', neonViolet: '#b388ff',
};

export const THEMES: Record<ThemeKey, Theme> = { paper: TA, temple: TB, market: TC };
