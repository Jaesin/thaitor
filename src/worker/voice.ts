export type DefaultVoice = 'female' | 'female2' | 'male';

export const VOICE_NAME: Record<DefaultVoice, string> = {
  female: 'th-TH-PremwadeeNeural',
  female2: 'th-TH-AcharaNeural',
  male: 'th-TH-NiwatNeural',
};

const STORAGE_KEY = 'thaitor_default_voice';

const VALID: DefaultVoice[] = ['female', 'female2', 'male'];

export function getDefaultVoice(): DefaultVoice {
  const stored = localStorage.getItem(STORAGE_KEY) as DefaultVoice | null;
  return stored && VALID.includes(stored) ? stored : 'female';
}

export function setDefaultVoice(voice: DefaultVoice): void {
  localStorage.setItem(STORAGE_KEY, voice);
}

export type DefaultEnVoice = 'male' | 'male2' | 'female' | 'female2' | 'kid';

export const EN_VOICE_NAME: Record<DefaultEnVoice, string> = {
  male:    'en-GB-RyanNeural',
  male2:   'en-US-KaiNeural',
  female:  'en-US-LunaNeural',
  female2: 'en-GB-OliviaNeural',
  kid:     'en-GB-MaisieNeural',
};

const EN_VOICE_KEY = 'thaitor_default_en_voice';

export function getDefaultEnVoice(): DefaultEnVoice {
  return (localStorage.getItem(EN_VOICE_KEY) as DefaultEnVoice) || 'female';
}

export function setDefaultEnVoice(v: DefaultEnVoice): void {
  localStorage.setItem(EN_VOICE_KEY, v);
}
