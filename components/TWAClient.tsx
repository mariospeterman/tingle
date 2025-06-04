import React, { useEffect, useState, useCallback } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { telegramUtils } from '../utils/telegram';
import { useStore } from '../store';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { MatchmakingService } from '../services/matchmaking';
import { UserPreferences } from '../services/matchmaking';
import { UserService } from '../services/user';
import type { User } from '../services/supabase';
import { webApp } from '../utils/telegram-sdk';
import { PreCallSetup } from './PreCallSetup';
import { ProfileSettings } from './ProfileSettings';

// Dynamically import VideoChat component with SSR disabled
const VideoChatDynamic = dynamic(() => import('./VideoChat/index'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

export default function TWAClient() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const { isInCall, currentRoomId, isMatching, startMatching, stopMatching } = useStore();
  const [error, setError] = useState<string | null>(null); // Add local error state for initialization
  const [isProfileOpen, setIsProfileOpen] = useState(false); // State to control profile slide-out

  const initialize = useCallback(async () => {
      try {
      const userData = await telegramUtils.getUser();
      if (userData) {
        // Use getOrCreateUser to handle fetching or creating the user in the DB
        const userService = new UserService();
        const user = await userService.getOrCreateUser();

        if (user) {
          setUser(user);
          // Use preferences from the fetched/created user, or set defaults if null
          const userPreferences = user.preferences || { gender: 'any', lookingFor: 'any', ageRange: { min: 18, max: 99 }, wallet_address: null };
          setPreferences(userPreferences);

          // Open profile settings automatically if preferences were null initially
          if (!user.preferences) { // Check if preferences were null in the fetched user
               setIsProfileOpen(true);
          }
        } else {
             // Handle case where getOrCreateUser returns null (shouldn't happen with current logic but good practice)
             setError('Failed to get or create user.');
        }
      }
      } catch (error) {
      console.error('Error initializing:', error);
      setError('Failed to initialize user data.'); // Set initialization error
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    // Ensure this effect only runs on the client side after the component mounts
    if (typeof window !== 'undefined') {
      initialize();
    }
  }, [initialize]);

   // Handle preferences update from the ProfileSettings modal
   const handlePreferencesUpdate = useCallback(async (prefs: UserPreferences) => {
     console.log('handlePreferencesUpdate called with:', prefs);
     if (!user) {
       setError('User not loaded, cannot save preferences');
       return;
     }
     try {
       // Save preferences to Supabase
      const userService = new UserService();
       await userService.updatePreferences(user.id, prefs);
       setPreferences(prefs); // Update local state with saved preferences
       setIsProfileOpen(false); // Close the profile settings modal
       console.log('Preferences saved successfully.');
     } catch (err) {
       console.error('Error updating preferences:', err);
       setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
   }, [user]);


  const handleStartMatching = useCallback(async () => {
    if (!user || !preferences) {
      setError('User data or preferences not available');
      return;
    }
    try {
      // The startMatching logic is now in the store, which uses the MatchmakingService instance
      await startMatching(user.id, preferences);
    } catch (error) {
      console.error('Error starting matchmaking:', error);
      setError('Failed to start matchmaking.');
    }
  }, [user, preferences, startMatching]);

  const handleStopMatching = useCallback(async () => {
    try {
      await stopMatching();
    } catch (error) {
      console.error('Error stopping matchmaking:', error);
      setError('Failed to stop matchmaking.');
    }
  }, [stopMatching]);

  // Show loading state during initial client-side render
  if (typeof window === 'undefined' || !isInitialized || !preferences) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2F5]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2F5]">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  // Render VideoChat and overlay UI
  return (
    <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_CONNECT_MANIFEST_URL}>
      <div className="relative h-screen w-screen overflow-hidden">
        {/* Video Chat Component (always rendered after initialization) */}
          <VideoChatDynamic
          roomId={currentRoomId || 'pre-call'} // Use a dummy room ID for pre-call
          serverUrl={process.env.NEXT_PUBLIC_MEDIASOUP_SERVER_URL || ''}
          userId={user?.id || 'anonymous'}
          initialPreferences={preferences}
          isMatching={isMatching}
          isInCall={isInCall}
          onStartMatching={handleStartMatching} // Pass handlers down
          onStopMatching={handleStopMatching}
          onOpenProfile={() => setIsProfileOpen(true)} // Pass handler to open profile
        />

        {/* Profile Settings Slide-out */}
        {user && preferences && ( // Ensure user and preferences are loaded before rendering
             <ProfileSettings
               isOpen={isProfileOpen}
               onClose={() => setIsProfileOpen(false)}
            userId={user.id}
               preferences={preferences}
               onPreferencesUpdate={handlePreferencesUpdate}
          />
        )}
      </div>
    </TonConnectUIProvider>
  );
} 