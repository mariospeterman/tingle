import { User, UserPreferences } from '../services/supabase';

export type MatchmakingPreferences = {
  gender: string;
  ageRange: string;
  interests: string[];
};

export type MatchmakingResult = {
  matched: boolean;
  roomId?: string;
  error?: string;
};

export async function findMatch(
  userId: string,
  preferences: MatchmakingPreferences
): Promise<MatchmakingResult> {
  try {
    // In a real application, this would:
    // 1. Add the user to a Redis queue
    // 2. Check for potential matches based on preferences
    // 3. Create a room if a match is found
    // 4. Return the room ID or error

    // Simulate matchmaking delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate successful match
    const roomId = `room_${Date.now()}`;
    
    return {
      matched: true,
      roomId,
    };
  } catch (error) {
    console.error('Error in matchmaking:', error);
    return {
      matched: false,
      error: error instanceof Error ? error.message : 'Failed to find a match',
    };
  }
}

export function calculateCompatibility(user1: User, user2: User): number {
  const preferences1 = user1.preferences;
  const preferences2 = user2.preferences;

  let score = 0;

  // Gender preference match
  if (preferences1.gender === preferences2.gender) {
    score += 30;
  }

  // Age range compatibility
  const ageRange1 = preferences1.age_range.split('-').map(Number);
  const ageRange2 = preferences2.age_range.split('-').map(Number);
  
  if (
    (ageRange1[0] <= ageRange2[1] && ageRange1[1] >= ageRange2[0]) ||
    (ageRange2[0] <= ageRange1[1] && ageRange2[1] >= ageRange1[0])
  ) {
    score += 30;
  }

  // Interest overlap
  const commonInterests = preferences1.interests.filter(interest =>
    preferences2.interests.includes(interest)
  );
  score += (commonInterests.length / Math.max(preferences1.interests.length, preferences2.interests.length)) * 40;

  return score;
}

export function formatMatchmakingPreferences(preferences: UserPreferences): MatchmakingPreferences {
  return {
    gender: preferences.gender,
    ageRange: preferences.age_range,
    interests: preferences.interests,
  };
} 