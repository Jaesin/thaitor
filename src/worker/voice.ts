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
