import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../services/supabase';
import { UserPreferences } from '../services/matchmaking';
import { WalletInfo } from '../services/ton';
import { MatchmakingService } from '../services/matchmaking';

interface AppState {
  // User state
  user: User | null;
  preferences: UserPreferences | null;
  walletInfo: WalletInfo | null;
  
  // Video chat state
  isInCall: boolean;
  currentRoomId: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isMatching: boolean;
  matchmakingService: MatchmakingService | null;
  matchedUser: User | null;
  
  // Mutual like state
  hasLiked: boolean;
  hasReceivedLike: boolean;
  isMatch: boolean;
  scheduledDate: Date | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setPreferences: (preferences: UserPreferences) => void;
  setWalletInfo: (walletInfo: WalletInfo | null) => void;
  startCall: (roomId: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  startMatching: (userId: string, preferences: UserPreferences) => Promise<void>;
  stopMatching: () => Promise<void>;
  setCurrentRoom: (roomId: string | null) => void;
  setMatchedUser: (user: User | null) => void;
  
  // Mutual like actions
  sendLike: () => Promise<void>;
  receiveLike: () => void;
  scheduleDate: (date: Date) => Promise<void>;
  resetMatchState: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User state
      user: null,
      preferences: null,
      walletInfo: null,
      setUser: (user) => set({ user }),
      setPreferences: (preferences) => set({ preferences }),
      setWalletInfo: (walletInfo) => set({ walletInfo }),

      // Matchmaking state
      isMatching: false,
      matchmakingService: null,
      matchedUser: null,
      startMatching: async (userId, preferences) => {
        const matchmakingService = new MatchmakingService({
          serverUrl: process.env.NEXT_PUBLIC_MEDIASOUP_SERVER_URL || '',
          userId,
          preferences,
        });
        await matchmakingService.startMatching();
        set({ matchmakingService, isMatching: true });
      },
      stopMatching: async () => {
        const { matchmakingService } = get();
        if (matchmakingService) {
          await matchmakingService.stopMatching();
        }
        set({ matchmakingService: null, isMatching: false });
      },

      // Video call state
      isMuted: false,
      isVideoOff: false,
      currentRoomId: null,
      isInCall: false,
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleVideo: () => set((state) => ({ isVideoOff: !state.isVideoOff })),
      endCall: () => set({ isInCall: false, currentRoomId: null, matchedUser: null }),
      setCurrentRoom: (roomId) => set({ currentRoomId: roomId, isInCall: true }),
      setMatchedUser: (user) => set({ matchedUser: user }),

      // Mutual like state
      hasLiked: false,
      hasReceivedLike: false,
      isMatch: false,
      scheduledDate: null,

      // Mutual like actions
      sendLike: async () => {
        const { currentRoomId, hasReceivedLike } = get();
        if (!currentRoomId) return;

        try {
          // Send like to server
          const response = await fetch('/api/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: currentRoomId }),
          });

          if (!response.ok) throw new Error('Failed to send like');

          set({ hasLiked: true });

          // If both users have liked, it's a match
          if (hasReceivedLike) {
            set({ isMatch: true });
          }
        } catch (error) {
          console.error('Error sending like:', error);
        }
      },

      receiveLike: () => {
        const { hasLiked } = get();
        set({ hasReceivedLike: true });

        // If both users have liked, it's a match
        if (hasLiked) {
          set({ isMatch: true });
        }
      },

      scheduleDate: async (date: Date) => {
        const { currentRoomId, matchedUser } = get();
        if (!currentRoomId || !matchedUser) return;

        try {
          const response = await fetch('/api/schedule-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: currentRoomId,
              matchedUserId: matchedUser.id,
              date: date.toISOString(),
            }),
          });

          if (!response.ok) throw new Error('Failed to schedule date');

          set({ scheduledDate: date });
        } catch (error) {
          console.error('Error scheduling date:', error);
        }
      },

      resetMatchState: () => {
        set({
          hasLiked: false,
          hasReceivedLike: false,
          isMatch: false,
          scheduledDate: null,
        });
      },

      startCall: (roomId: string) => set({ isInCall: true, currentRoomId: roomId }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
        walletInfo: state.walletInfo,
        isMuted: state.isMuted,
        isVideoOff: state.isVideoOff,
        scheduledDate: state.scheduledDate,
      }),
    }
  )
); 