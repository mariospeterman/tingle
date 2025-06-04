import { UserPreferences } from '../services/supabase';

export type PreferenceCategory = 'matching' | 'wallet';

export type PreferenceUpdate = {
  category: PreferenceCategory;
  key: keyof UserPreferences;
  value: any;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  gender: 'any',
  age_range: '18-99',
  interests: [],
  wallet_address: undefined,
};

export function validatePreferences(preferences: Partial<UserPreferences>): string[] {
  const errors: string[] = [];

  if (preferences.gender && !['male', 'female', 'any'].includes(preferences.gender)) {
    errors.push('Invalid gender preference');
  }

  if (preferences.age_range) {
    const [min, max] = preferences.age_range.split('-').map(Number);
    if (isNaN(min) || isNaN(max) || min < 18 || max > 99 || min > max) {
      errors.push('Invalid age range');
    }
  }

  if (preferences.interests) {
    if (!Array.isArray(preferences.interests)) {
      errors.push('Interests must be an array');
    } else if (preferences.interests.some(interest => typeof interest !== 'string')) {
      errors.push('All interests must be strings');
    }
  }

  if (preferences.wallet_address) {
    try {
      // Validate TON wallet address format
      if (!/^[0-9a-zA-Z_-]{48}$/.test(preferences.wallet_address)) {
        errors.push('Invalid wallet address format');
      }
    } catch {
      errors.push('Invalid wallet address');
    }
  }

  return errors;
}

export function mergePreferences(
  current: UserPreferences,
  updates: Partial<UserPreferences>
): UserPreferences {
  return {
    ...current,
    ...updates,
  };
}

export function getPreferenceCategory(key: keyof UserPreferences): PreferenceCategory {
  const categoryMap: Record<keyof UserPreferences, PreferenceCategory> = {
    gender: 'matching',
    age_range: 'matching',
    interests: 'matching',
    wallet_address: 'wallet',
  };

  return categoryMap[key];
}

export function getPreferencesByCategory(
  preferences: UserPreferences
): Record<PreferenceCategory, Partial<UserPreferences>> {
  const result: Record<PreferenceCategory, Partial<UserPreferences>> = {
    matching: {},
    wallet: {},
  };

  Object.entries(preferences).forEach(([key, value]) => {
    const category = getPreferenceCategory(key as keyof UserPreferences);
    result[category][key as keyof UserPreferences] = value;
  });

  return result;
}

export function isPreferenceEnabled(
  preferences: UserPreferences,
  key: keyof UserPreferences
): boolean {
  const value = preferences[key];
  if (key === 'interests' && Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  return Boolean(value);
} 