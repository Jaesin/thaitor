/*
 * Functional, app-wide, theme-constant systems.
 * CLASS — the three Thai consonant classes (hue-coded; label always rides along).
 * TONE  — the five tone-contour glyphs (SVG path `d` in a `0 0 48 40` viewBox).
 * Ported from design_handoff_thaitor/src/kit/kit.jsx.
 */

export type ClassKey = 'mid' | 'high' | 'low';

export interface ClassEntry {
  base: string;
  ink: string;
  soft: string;
  label: string; // Thai glyph
  name: string; // English
  nameThai: string;
}

export const CLASS: Record<ClassKey, ClassEntry> = {
  mid: {
    base: 'oklch(0.64 0.12 192)',
    ink: 'oklch(0.45 0.10 192)',
    soft: 'oklch(0.95 0.035 192)',
    label: 'ก',
    name: 'Mid',
    nameThai: 'อักษรกลาง',
  },
  high: {
    base: 'oklch(0.74 0.135 75)',
    ink: 'oklch(0.52 0.12 70)',
    soft: 'oklch(0.96 0.04 80)',
    label: 'ข',
    name: 'High',
    nameThai: 'อักษรสูง',
  },
  low: {
    base: 'oklch(0.63 0.15 25)',
    ink: 'oklch(0.50 0.15 25)',
    soft: 'oklch(0.95 0.035 25)',
    label: 'ค',
    name: 'Low',
    nameThai: 'อักษรต่ำ',
  },
};

export type ToneKey = 'mid' | 'low' | 'falling' | 'high' | 'rising';

export interface ToneEntry {
  label: string;
  thaiMark: string;
  example: string;
  d: string; // SVG path in a `0 0 48 40` viewBox
  shapeName: string;
}

export const TONE: Record<ToneKey, ToneEntry> = {
  mid: { label: 'Mid', thaiMark: 'สามัญ', example: 'a', d: 'M9 24 L39 24', shapeName: 'level' },
  low: { label: 'Low', thaiMark: 'เอก', example: 'à', d: 'M9 25 C18 27 30 30 39 31', shapeName: 'low, settling down' },
  falling: { label: 'Falling', thaiMark: 'โท', example: 'â', d: 'M9 17 C14 11 19 10 22 13 C27 17 33 29 39 33', shapeName: 'lift, then drop hard' },
  high: { label: 'High', thaiMark: 'ตรี', example: 'á', d: 'M9 29 C19 27 28 18 39 9', shapeName: 'climb to the top' },
  rising: { label: 'Rising', thaiMark: 'จัตวา', example: 'ǎ', d: 'M9 18 C13 27 19 30 24 28 C30 25 35 15 39 9', shapeName: 'dip, then soar' },
};

export const TONE_ORDER: ToneKey[] = ['mid', 'low', 'falling', 'high', 'rising'];
