/*
 * Script/Reading track curriculum — static data, no API calls.
 * Covers the 44 Thai consonants, ~28 vowel forms, tone-rule cards, and the
 * curriculum rungs (r0–r4, plus t0 which is owned by Tone Pop).
 */

import type { ClassKey } from '../themes/constants';

export type ConsonantClass = ClassKey; // 'mid' | 'high' | 'low'

export interface Consonant {
  id: string; // stable key for SRS, e.g. 'cons-ko-kai'
  glyph: string; // Thai consonant glyph
  rtgs: string; // Royal Thai General System romanisation of the consonant name
  name: string; // acrophonic name, e.g. 'ko kai'
  class: ConsonantClass;
  initial: string; // sound when used as a syllable initial
  final?: string; // sound when used as a syllable final (if it can be one)
  example: string; // a common Thai word using the consonant
}

export interface VowelForm {
  id: string;
  form: string; // vowel pattern, ◌ marks the consonant slot
  phoneme: string; // IPA-ish phoneme
  length: 'short' | 'long';
  position: 'pre' | 'post' | 'above' | 'below' | 'wrap';
}

export interface ToneRuleCard {
  id: string;
  title: string;
  body: string; // plain-text description of the rule
}

// ── The 44 consonants, in traditional dictionary order ──────────────────────
// Class is the load-bearing field for tone rules; each tile is hue-coded by it.

export const CONSONANTS: Consonant[] = [
  { id: 'cons-ko-kai', glyph: 'ก', rtgs: 'ko kai', name: 'ko kai', class: 'mid', initial: 'k', final: 'k', example: 'ไก่ (chicken)' },
  { id: 'cons-kho-khai', glyph: 'ข', rtgs: 'kho khai', name: 'kho khai', class: 'high', initial: 'kh', final: 'k', example: 'ไข่ (egg)' },
  { id: 'cons-kho-khuat', glyph: 'ฃ', rtgs: 'kho khuat', name: 'kho khuat', class: 'high', initial: 'kh', final: 'k', example: 'ขวด (bottle, obsolete)' },
  { id: 'cons-kho-khwai', glyph: 'ค', rtgs: 'kho khwai', name: 'kho khwai', class: 'low', initial: 'kh', final: 'k', example: 'ควาย (buffalo)' },
  { id: 'cons-kho-khon', glyph: 'ฅ', rtgs: 'kho khon', name: 'kho khon', class: 'low', initial: 'kh', final: 'k', example: 'คน (person, obsolete)' },
  { id: 'cons-kho-rakhang', glyph: 'ฆ', rtgs: 'kho rakhang', name: 'kho rakhang', class: 'low', initial: 'kh', final: 'k', example: 'ระฆัง (bell)' },
  { id: 'cons-ngo-ngu', glyph: 'ง', rtgs: 'ngo ngu', name: 'ngo ngu', class: 'low', initial: 'ng', final: 'ng', example: 'งู (snake)' },
  { id: 'cons-cho-chan', glyph: 'จ', rtgs: 'cho chan', name: 'cho chan', class: 'mid', initial: 'ch', final: 't', example: 'จาน (plate)' },
  { id: 'cons-cho-ching', glyph: 'ฉ', rtgs: 'cho ching', name: 'cho ching', class: 'high', initial: 'ch', example: 'ฉิ่ง (cymbals)' },
  { id: 'cons-cho-chang', glyph: 'ช', rtgs: 'cho chang', name: 'cho chang', class: 'low', initial: 'ch', final: 't', example: 'ช้าง (elephant)' },
  { id: 'cons-so-so', glyph: 'ซ', rtgs: 'so so', name: 'so so', class: 'low', initial: 's', final: 't', example: 'โซ่ (chain)' },
  { id: 'cons-cho-choe', glyph: 'ฌ', rtgs: 'cho choe', name: 'cho choe', class: 'low', initial: 'ch', example: 'เฌอ (tree)' },
  { id: 'cons-yo-ying', glyph: 'ญ', rtgs: 'yo ying', name: 'yo ying', class: 'low', initial: 'y', final: 'n', example: 'หญิง (woman)' },
  { id: 'cons-do-chada', glyph: 'ฎ', rtgs: 'do chada', name: 'do chada', class: 'mid', initial: 'd', final: 't', example: 'ชฎา (headdress)' },
  { id: 'cons-to-patak', glyph: 'ฏ', rtgs: 'to patak', name: 'to patak', class: 'mid', initial: 't', final: 't', example: 'ปฏัก (goad)' },
  { id: 'cons-tho-than', glyph: 'ฐ', rtgs: 'tho than', name: 'tho than', class: 'high', initial: 'th', final: 't', example: 'ฐาน (base)' },
  { id: 'cons-tho-montho', glyph: 'ฑ', rtgs: 'tho montho', name: 'tho montho', class: 'low', initial: 'th', final: 't', example: 'มณฑล (region)' },
  { id: 'cons-tho-phuthao', glyph: 'ฒ', rtgs: 'tho phu thao', name: 'tho phu thao', class: 'low', initial: 'th', final: 't', example: 'ผู้เฒ่า (elder)' },
  { id: 'cons-no-nen', glyph: 'ณ', rtgs: 'no nen', name: 'no nen', class: 'low', initial: 'n', final: 'n', example: 'เณร (novice monk)' },
  { id: 'cons-do-dek', glyph: 'ด', rtgs: 'do dek', name: 'do dek', class: 'mid', initial: 'd', final: 't', example: 'เด็ก (child)' },
  { id: 'cons-to-tao', glyph: 'ต', rtgs: 'to tao', name: 'to tao', class: 'mid', initial: 't', final: 't', example: 'เต่า (turtle)' },
  { id: 'cons-tho-thung', glyph: 'ถ', rtgs: 'tho thung', name: 'tho thung', class: 'high', initial: 'th', final: 't', example: 'ถุง (bag)' },
  { id: 'cons-tho-thahan', glyph: 'ท', rtgs: 'tho thahan', name: 'tho thahan', class: 'low', initial: 'th', final: 't', example: 'ทหาร (soldier)' },
  { id: 'cons-tho-thong', glyph: 'ธ', rtgs: 'tho thong', name: 'tho thong', class: 'low', initial: 'th', final: 't', example: 'ธง (flag)' },
  { id: 'cons-no-nu', glyph: 'น', rtgs: 'no nu', name: 'no nu', class: 'low', initial: 'n', final: 'n', example: 'หนู (mouse)' },
  { id: 'cons-bo-baimai', glyph: 'บ', rtgs: 'bo baimai', name: 'bo baimai', class: 'mid', initial: 'b', final: 'p', example: 'ใบไม้ (leaf)' },
  { id: 'cons-po-pla', glyph: 'ป', rtgs: 'po pla', name: 'po pla', class: 'mid', initial: 'p', final: 'p', example: 'ปลา (fish)' },
  { id: 'cons-pho-phueng', glyph: 'ผ', rtgs: 'pho phueng', name: 'pho phueng', class: 'high', initial: 'ph', example: 'ผึ้ง (bee)' },
  { id: 'cons-fo-fa', glyph: 'ฝ', rtgs: 'fo fa', name: 'fo fa', class: 'high', initial: 'f', example: 'ฝา (lid)' },
  { id: 'cons-pho-phan', glyph: 'พ', rtgs: 'pho phan', name: 'pho phan', class: 'low', initial: 'ph', final: 'p', example: 'พาน (tray)' },
  { id: 'cons-fo-fan', glyph: 'ฟ', rtgs: 'fo fan', name: 'fo fan', class: 'low', initial: 'f', final: 'p', example: 'ฟัน (teeth)' },
  { id: 'cons-pho-samphao', glyph: 'ภ', rtgs: 'pho samphao', name: 'pho samphao', class: 'low', initial: 'ph', final: 'p', example: 'สำเภา (junk boat)' },
  { id: 'cons-mo-ma', glyph: 'ม', rtgs: 'mo ma', name: 'mo ma', class: 'low', initial: 'm', final: 'm', example: 'ม้า (horse)' },
  { id: 'cons-yo-yak', glyph: 'ย', rtgs: 'yo yak', name: 'yo yak', class: 'low', initial: 'y', final: 'y', example: 'ยักษ์ (giant)' },
  { id: 'cons-ro-ruea', glyph: 'ร', rtgs: 'ro ruea', name: 'ro ruea', class: 'low', initial: 'r', final: 'n', example: 'เรือ (boat)' },
  { id: 'cons-lo-ling', glyph: 'ล', rtgs: 'lo ling', name: 'lo ling', class: 'low', initial: 'l', final: 'n', example: 'ลิง (monkey)' },
  { id: 'cons-wo-waen', glyph: 'ว', rtgs: 'wo waen', name: 'wo waen', class: 'low', initial: 'w', final: 'w', example: 'แหวน (ring)' },
  { id: 'cons-so-sala', glyph: 'ศ', rtgs: 'so sala', name: 'so sala', class: 'high', initial: 's', final: 't', example: 'ศาลา (pavilion)' },
  { id: 'cons-so-ruesi', glyph: 'ษ', rtgs: 'so ruesi', name: 'so ruesi', class: 'high', initial: 's', final: 't', example: 'ฤๅษี (hermit)' },
  { id: 'cons-so-suea', glyph: 'ส', rtgs: 'so suea', name: 'so suea', class: 'high', initial: 's', final: 't', example: 'เสือ (tiger)' },
  { id: 'cons-ho-hip', glyph: 'ห', rtgs: 'ho hip', name: 'ho hip', class: 'high', initial: 'h', example: 'หีบ (chest)' },
  { id: 'cons-lo-chula', glyph: 'ฬ', rtgs: 'lo chula', name: 'lo chula', class: 'low', initial: 'l', final: 'n', example: 'จุฬา (kite)' },
  { id: 'cons-o-ang', glyph: 'อ', rtgs: 'o ang', name: 'o ang', class: 'mid', initial: '(silent)', example: 'อ่าง (basin)' },
  { id: 'cons-ho-nokhuk', glyph: 'ฮ', rtgs: 'ho nokhuk', name: 'ho nokhuk', class: 'low', initial: 'h', example: 'นกฮูก (owl)' },
];

// ── ~28 vowel forms (◌ = consonant slot) ────────────────────────────────────

export const VOWELS: VowelForm[] = [
  { id: 'vow-a-short', form: '◌ะ', phoneme: 'a', length: 'short', position: 'post' },
  { id: 'vow-a-long', form: '◌า', phoneme: 'aa', length: 'long', position: 'post' },
  { id: 'vow-i-short', form: '◌ิ', phoneme: 'i', length: 'short', position: 'above' },
  { id: 'vow-i-long', form: '◌ี', phoneme: 'ii', length: 'long', position: 'above' },
  { id: 'vow-ue-short', form: '◌ึ', phoneme: 'ɯ', length: 'short', position: 'above' },
  { id: 'vow-ue-long', form: '◌ือ', phoneme: 'ɯɯ', length: 'long', position: 'above' },
  { id: 'vow-u-short', form: '◌ุ', phoneme: 'u', length: 'short', position: 'below' },
  { id: 'vow-u-long', form: '◌ู', phoneme: 'uu', length: 'long', position: 'below' },
  { id: 'vow-e-short', form: 'เ◌ะ', phoneme: 'e', length: 'short', position: 'wrap' },
  { id: 'vow-e-long', form: 'เ◌', phoneme: 'ee', length: 'long', position: 'pre' },
  { id: 'vow-ae-short', form: 'แ◌ะ', phoneme: 'ɛ', length: 'short', position: 'wrap' },
  { id: 'vow-ae-long', form: 'แ◌', phoneme: 'ɛɛ', length: 'long', position: 'pre' },
  { id: 'vow-o-short', form: 'โ◌ะ', phoneme: 'o', length: 'short', position: 'wrap' },
  { id: 'vow-o-long', form: 'โ◌', phoneme: 'oo', length: 'long', position: 'pre' },
  { id: 'vow-aw-short', form: 'เ◌าะ', phoneme: 'ɔ', length: 'short', position: 'wrap' },
  { id: 'vow-aw-long', form: '◌อ', phoneme: 'ɔɔ', length: 'long', position: 'post' },
  { id: 'vow-oe-short', form: 'เ◌อะ', phoneme: 'ɤ', length: 'short', position: 'wrap' },
  { id: 'vow-oe-long', form: 'เ◌อ', phoneme: 'ɤɤ', length: 'long', position: 'wrap' },
  { id: 'vow-ia-short', form: 'เ◌ียะ', phoneme: 'ia', length: 'short', position: 'wrap' },
  { id: 'vow-ia-long', form: 'เ◌ีย', phoneme: 'iia', length: 'long', position: 'wrap' },
  { id: 'vow-uea-short', form: 'เ◌ือะ', phoneme: 'ɯa', length: 'short', position: 'wrap' },
  { id: 'vow-uea-long', form: 'เ◌ือ', phoneme: 'ɯɯa', length: 'long', position: 'wrap' },
  { id: 'vow-ua-short', form: '◌ัวะ', phoneme: 'ua', length: 'short', position: 'wrap' },
  { id: 'vow-ua-long', form: '◌ัว', phoneme: 'uua', length: 'long', position: 'above' },
  { id: 'vow-am', form: '◌ำ', phoneme: 'am', length: 'short', position: 'post' },
  { id: 'vow-ai-maimuan', form: 'ใ◌', phoneme: 'ai', length: 'short', position: 'pre' },
  { id: 'vow-ai-maimalai', form: 'ไ◌', phoneme: 'ai', length: 'short', position: 'pre' },
  { id: 'vow-ao', form: 'เ◌า', phoneme: 'ao', length: 'short', position: 'wrap' },
];

// ── Tone-rule cards (~10) ────────────────────────────────────────────────────

export const TONE_RULES: ToneRuleCard[] = [
  {
    id: 'rule-live-dead',
    title: 'Live vs dead syllables',
    body: 'A live syllable ends in a long vowel or a sonorant (m, n, ng, y, w). A dead syllable ends in a short vowel or a stop (k, p, t). Live vs dead changes the tone.',
  },
  {
    id: 'rule-mid-live',
    title: 'Mid class, live, no mark',
    body: 'A mid-class consonant on a live syllable with no tone mark is the mid (level) tone. Example: กา = "gaa".',
  },
  {
    id: 'rule-mid-dead',
    title: 'Mid class, dead',
    body: 'A mid-class consonant on a dead syllable with no tone mark is the low tone. Example: กับ = "gàp".',
  },
  {
    id: 'rule-high-live',
    title: 'High class, live, no mark',
    body: 'A high-class consonant on a live syllable with no tone mark is the rising tone. Example: ขา = "khǎa".',
  },
  {
    id: 'rule-high-dead',
    title: 'High class, dead',
    body: 'A high-class consonant on a dead syllable with no tone mark is the low tone. Example: ขับ = "khàp".',
  },
  {
    id: 'rule-low-live',
    title: 'Low class, live, no mark',
    body: 'A low-class consonant on a live syllable with no tone mark is the mid tone. Example: คา = "khaa".',
  },
  {
    id: 'rule-low-dead-short',
    title: 'Low class, dead, short vowel',
    body: 'A low-class consonant on a dead syllable with a short vowel is the high tone. Example: คะ = "khá".',
  },
  {
    id: 'rule-low-dead-long',
    title: 'Low class, dead, long vowel',
    body: 'A low-class consonant on a dead syllable with a long vowel is the falling tone. Example: คาบ = "khâap".',
  },
  {
    id: 'rule-mai-ek',
    title: 'Mai ek (◌่)',
    body: 'The first tone mark makes low tone on mid and high class, but falling tone on low class.',
  },
  {
    id: 'rule-mai-tho',
    title: 'Mai tho (◌้)',
    body: 'The second tone mark makes falling tone on mid and high class, but high tone on low class.',
  },
];

// ── Curriculum rungs ─────────────────────────────────────────────────────────

export type RungKind = 'consonant' | 'vowel' | 'tonerule' | 'tone';

export interface Rung {
  id: string; // 'r0'..'r4', 't0'
  title: string;
  titleThai: string;
  subtitle: string;
  kind: RungKind;
  // For consonant rungs: the consonant ids in this rung.
  consonantIds?: string[];
  // t0 is owned by the existing Tone Pop arcade rather than Script Pop.
  external?: boolean;
}

function consIdsByClass(cls: ConsonantClass): string[] {
  return CONSONANTS.filter((c) => c.class === cls).map((c) => c.id);
}

const MID_IDS = consIdsByClass('mid'); // 9
const HIGH_IDS = consIdsByClass('high'); // 11
const LOW_IDS = consIdsByClass('low'); // 24
const LOW_FIRST = LOW_IDS.slice(0, 12);
const LOW_SECOND = LOW_IDS.slice(12);

export const RUNGS: Rung[] = [
  {
    id: 'r0',
    title: 'Mid consonants',
    titleThai: 'อักษรกลาง',
    subtitle: `${MID_IDS.length} mid-class letters`,
    kind: 'consonant',
    consonantIds: MID_IDS,
  },
  {
    id: 'r1',
    title: 'High consonants',
    titleThai: 'อักษรสูง',
    subtitle: `${HIGH_IDS.length} high-class letters`,
    kind: 'consonant',
    consonantIds: HIGH_IDS,
  },
  {
    id: 'r2',
    title: 'Low consonants',
    titleThai: 'อักษรต่ำ',
    subtitle: `${LOW_IDS.length} low-class letters`,
    kind: 'consonant',
    // Split into two passes but treated as one rung for progression.
    consonantIds: [...LOW_FIRST, ...LOW_SECOND],
  },
  {
    id: 'r3',
    title: 'Vowels',
    titleThai: 'สระ',
    subtitle: `${VOWELS.length} vowel forms`,
    kind: 'vowel',
  },
  {
    id: 'r4',
    title: 'Tone rules',
    titleThai: 'กฎวรรณยุกต์',
    subtitle: `${TONE_RULES.length} rules`,
    kind: 'tonerule',
  },
  {
    id: 't0',
    title: 'Tones',
    titleThai: 'วรรณยุกต์',
    subtitle: '5 tones · Tone Pop',
    kind: 'tone',
    external: true,
  },
];

export const RUNG_ORDER: string[] = RUNGS.map((r) => r.id);

// Quick lookups.
export const CONSONANT_BY_ID: Record<string, Consonant> = Object.fromEntries(
  CONSONANTS.map((c) => [c.id, c]),
);

export function getRung(id: string): Rung | undefined {
  return RUNGS.find((r) => r.id === id);
}

export function rungConsonants(id: string): Consonant[] {
  const rung = getRung(id);
  if (!rung?.consonantIds) return [];
  return rung.consonantIds.map((cid) => CONSONANT_BY_ID[cid]).filter(Boolean);
}
