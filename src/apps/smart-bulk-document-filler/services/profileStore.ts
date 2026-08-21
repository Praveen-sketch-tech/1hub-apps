import type { SavedProfileField } from '../types';

const PROFILE_KEY = 'smart_bulk_filler_profile';

export function loadProfile(): SavedProfileField[] {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProfile(fields: SavedProfileField[]): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(fields));
}

export function findProfileValue(profile: SavedProfileField[], normalizedLabel: string): string | undefined {
  return profile.find((f) => f.normalizedLabel === normalizedLabel)?.value;
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
}
