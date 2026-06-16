// Ear-training minimal pairs for the Tone Pair Dojo.
// Each item gives 2-3 Thai words that differ only by tone or vowel length,
// plus matching English glosses. The Dojo plays one word's TTS and asks the
// learner to pick which one they heard.

export type TonePair = {
  id: string;
  words: string[]; // Thai words, index-aligned with `en`
  en: string[]; // English glosses, index-aligned with `words`
};

export const TONE_PAIRS: TonePair[] = [
  // --- Tonal minimal pairs ---
  {
    id: 'suea',
    words: ['เสือ', 'เสื่อ', 'เสื้อ'],
    en: ['tiger', 'mat', 'shirt'],
  },
  {
    id: 'khaaw',
    words: ['ขาว', 'ข้าว'],
    en: ['white', 'rice'],
  },
  {
    id: 'klai',
    words: ['ใกล้', 'ไกล'],
    en: ['near', 'far'],
  },
  {
    id: 'maa',
    words: ['ม้า', 'หมา'],
    en: ['horse', 'dog'],
  },
  {
    id: 'mai',
    words: ['ไม้', 'ไม่', 'ใหม่', 'ไหม'],
    en: ['wood', 'not', 'new', 'silk'],
  },
  {
    id: 'paa',
    words: ['ป่า', 'ผ้า'],
    en: ['forest', 'cloth'],
  },
  {
    id: 'naa',
    words: ['นา', 'หน้า', 'น่า'],
    en: ['rice field', 'face', 'worthy'],
  },

  // --- Vowel-length minimal pairs ---
  {
    id: 'khao',
    words: ['เข้า', 'เขา'],
    en: ['to enter', 'he/she'],
  },
  {
    id: 'khaw-long',
    words: ['ขาว', 'เขา'],
    en: ['white', 'mountain'],
  },
  {
    id: 'kaew',
    words: ['แก้ว', 'เก้า'],
    en: ['glass', 'nine'],
  },
  {
    id: 'phet',
    words: ['เพชร', 'เผ็ด'],
    en: ['diamond', 'spicy'],
  },
  {
    id: 'kai',
    words: ['ไก่', 'ใกล้'],
    en: ['chicken', 'near'],
  },
];
