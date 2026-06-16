// Multi-profile support — a shared family device can hold separate learning
// progress per person. The active profile id lives in localStorage so it can be
// read synchronously; the profile records themselves live in IndexedDB.

import {
  LOCAL_PROFILE_ID,
  getProfiles,
  getProfileById,
  putProfileEntry,
  deleteProfileEntry,
  type ProfileEntry,
  type SpeakerGender,
} from './store';

export const ACTIVE_PROFILE_KEY = 'thaitor_active_profile';

// localStorage mirror of each profile's Kid Mode flag, so synchronous callers
// (e.g. PlayHub render) don't need to await IndexedDB.
function kidModeKey(pid: string): string {
  return `thaitor_kid_mode_${pid}`;
}

export function getActiveProfileId(): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || LOCAL_PROFILE_ID;
  } catch {
    return LOCAL_PROFILE_ID;
  }
}

export function setActiveProfileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch {
    /* ignore storage failures */
  }
}

// Synchronous Kid Mode read for the active (or given) profile, backed by the
// localStorage mirror that putProfile keeps in sync.
export function getKidMode(profileId: string = getActiveProfileId()): boolean {
  try {
    return localStorage.getItem(kidModeKey(profileId)) === 'on';
  } catch {
    return false;
  }
}

export function setKidModeMirror(profileId: string, on: boolean): void {
  try {
    localStorage.setItem(kidModeKey(profileId), on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

export async function listProfiles(): Promise<ProfileEntry[]> {
  const profiles = await getProfiles();
  if (profiles.length === 0) {
    // Defensive: ensure a local profile always exists.
    const seed = await putProfileEntry({
      id: LOCAL_PROFILE_ID,
      name: 'Me',
      emoji: '🧑',
      kidMode: false,
      speakerGender: 'neutral',
    });
    setKidModeMirror(LOCAL_PROFILE_ID, false);
    return [seed];
  }
  return profiles;
}

export type CreateProfileOpts = {
  kidMode?: boolean;
  speakerGender?: SpeakerGender;
};

export async function createProfile(
  name: string,
  emoji: string,
  opts?: CreateProfileOpts,
): Promise<ProfileEntry> {
  const id = crypto.randomUUID();
  const entry = await putProfileEntry({
    id,
    name,
    emoji,
    kidMode: opts?.kidMode ?? false,
    speakerGender: opts?.speakerGender ?? 'neutral',
  });
  setKidModeMirror(id, entry.kidMode ?? false);
  return entry;
}

// Persist edits to a profile and keep the Kid Mode mirror in sync.
export async function saveProfile(
  entry: Omit<ProfileEntry, 'updatedAt'>,
): Promise<ProfileEntry> {
  const saved = await putProfileEntry(entry);
  setKidModeMirror(saved.id, saved.kidMode ?? false);
  return saved;
}

export async function getProfile(id: string): Promise<ProfileEntry | null> {
  return getProfileById(id);
}

export async function getActiveProfile(): Promise<ProfileEntry | null> {
  return getProfileById(getActiveProfileId());
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = await getProfiles();
  if (profiles.length <= 1) {
    throw new Error('Cannot delete the last profile.');
  }
  await deleteProfileEntry(id);
  try {
    localStorage.removeItem(kidModeKey(id));
  } catch {
    /* ignore */
  }
  // If the deleted profile was active, fall back to the first remaining one.
  if (getActiveProfileId() === id) {
    const remaining = profiles.find((p) => p.id !== id);
    if (remaining) setActiveProfileId(remaining.id);
  }
}

// Ensure the Kid Mode mirror reflects the active profile's stored value. Called
// on app boot so synchronous getKidMode() reads are correct after a reload.
export async function syncKidModeMirror(): Promise<void> {
  try {
    const active = await getActiveProfile();
    if (active) setKidModeMirror(active.id, active.kidMode ?? false);
  } catch {
    /* ignore */
  }
}

// Apply the active profile's stored voice preferences to the global voice keys
// so every consumer (which reads the global default) honours the active
// profile. Called on app boot, after a profile switch reload. Profiles with no
// stored voice fall through to whatever global default is already set.
export async function applyActiveProfileVoices(): Promise<void> {
  try {
    const active = await getActiveProfile();
    if (!active) return;
    if (active.defaultVoice) {
      localStorage.setItem('thaitor_default_voice', active.defaultVoice);
    }
    if (active.defaultEnVoice) {
      localStorage.setItem('thaitor_default_en_voice', active.defaultEnVoice);
    }
  } catch {
    /* ignore */
  }
}

export const PROFILE_EMOJIS = [
  '👩', '👨', '👧', '👦', '👵', '👴',
  '🧑', '👩‍💼', '👨‍💼', '🧒', '👶', '🦊',
];
