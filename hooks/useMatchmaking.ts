import { useState, useCallback, useEffect } from 'react';
import { MatchmakingService, UserPreferences } from '../services/matchmaking';
import { useStore } from '../store';

interface UseMatchmakingOptions {
  serverUrl?: string;
  userId: string;
  preferences?: UserPreferences;
}

export function useMatchmaking({ 
  serverUrl = process.env.NEXT_PUBLIC_MATCHMAKING_SERVER_URL || '',
  userId,
  preferences = {}
}: UseMatchmakingOptions) {
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [service, setService] = useState<MatchmakingService | null>(null);

  // Initialize service
  useEffect(() => {
    const matchmakingService = new MatchmakingService({
      serverUrl,
      userId,
      preferences,
    });

    setService(matchmakingService);

    return () => {
      if (matchmakingService) {
        matchmakingService.cleanup();
      }
    };
  }, [serverUrl, userId, preferences]);

  const startMatching = useCallback(async () => {
    if (!service) {
      setError(new Error('Matchmaking service not initialized'));
      return;
    }

    try {
      setError(null);
      await service.startMatching();
      setIsMatching(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start matching'));
      setIsMatching(false);
    }
  }, [service]);

  const stopMatching = useCallback(async () => {
    if (!service) {
      setError(new Error('Matchmaking service not initialized'));
      return;
    }

    try {
      setError(null);
      await service.stopMatching();
      setIsMatching(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to stop matching'));
    }
  }, [service]);

  return {
    isMatching,
    error,
    startMatching,
    stopMatching,
  };
} 