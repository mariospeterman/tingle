import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { webApp } from '../utils/telegram-sdk';
import { getUser, initialize } from '../utils/telegram';
import { UserPreferences } from '../services/matchmaking';
import { useStore } from '../store';
import { ProfileSetup } from '../components/ProfileSetup';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MatchmakingService } from '../services/matchmaking';
import { db } from '../services/supabase';
import { useMediaSoup } from '../hooks/useMediaSoup';
import { PostMatchFlow } from '../components/PostMatchFlow';
import { Button } from '../components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Heart, Settings, User, Skip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '../components/ui/slider';
import { cn } from '../lib/utils';

// Dynamically import VideoChat with SSR disabled
const VideoChatDynamic = dynamic(() => import('../components/VideoChat').then((mod) => mod.VideoChat), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

// Mockup user for development
const MOCKUP_USER = {
  id: 'dev_user_1',
  telegram_id: 'dev_user_1', // Add telegram_id for database interaction
  username: 'dev_user',
  first_name: 'Development',
  last_name: 'User',
  language_code: 'en',
  is_premium: false,
  photo_url: 'https://t.me/i/userpic/320/random.jpg',
};

const TWA: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const {
    isInCall,
    currentRoomId,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    endCall,
    matchedUser,
    hasLiked,
    hasReceivedLike,
    sendLike,
    receiveLike,
  } = useStore();
  const [isClient, setIsClient] = useState(false);
  const [matchmakingService, setMatchmakingService] = useState<MatchmakingService | null>(null);

  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [streamQuality, setStreamQuality] = useState<'high' | 'medium' | 'low'>('high');

  const {
    startCall,
    endCall: endMediaSoupCall,
    localStream,
    remoteStream,
    error: mediaSoupError,
    setStreamQuality: setMediaSoupQuality,
  } = useMediaSoup();

  // Set isClient to true when component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize Telegram WebApp and user data
  useEffect(() => {
    if (!isClient) return;

    const init = async () => {
      try {
        await initialize();
        const tgUserData = getUser();
        if (!tgUserData) {
          throw new Error('Failed to get user data from Telegram WebApp');
        }

        // Try to fetch existing user by telegram_id
        const existingUser = await db.users.getByTelegramId(tgUserData.id.toString());
        if (existingUser) {
          setUser(existingUser);
          setPreferences(existingUser.preferences);
          setIsProfileOpen(!existingUser.preferences);
        } else {
          // Create new user
          const newUser = await db.users.create({
            telegram_id: tgUserData.id.toString(),
            username: tgUserData.username || '',
            first_name: tgUserData.first_name,
            last_name: tgUserData.last_name,
            preferences: null,
          });
          setUser(newUser);
          setIsProfileOpen(true);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [isClient]);

  const handlePreferencesUpdate = async (prefs: UserPreferences) => {
    if (!user) {
      setError('User not loaded, cannot save preferences');
      return;
    }
    try {
      await db.users.updatePreferences(user.id, prefs);
      setPreferences(prefs);
      setIsProfileOpen(false);
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  };

  const handleStartMatching = async () => {
    if (!user || !preferences) {
      setError('User data or preferences not available');
      return;
    }

    setIsMatching(true);
    try {
      const service = new MatchmakingService({
        serverUrl: process.env.NEXT_PUBLIC_MEDIASOUP_URL || '',
        userId: user.id,
        preferences: preferences,
      });

      await service.initialize();
      await service.startMatching();
      setMatchmakingService(service);
    } catch (err) {
      console.error('Matchmaking error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start matching');
      setIsMatching(false);
    }
  };

  const handleStopMatching = async () => {
    if (matchmakingService) {
      await matchmakingService.stopMatching();
      setMatchmakingService(null);
    }
    setIsMatching(false);
  };

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (currentRoomId && matchedUser) {
      startCall(currentRoomId, matchedUser.id)
        .then(() => setIsLoading(false))
        .catch((err) => {
          console.error('Error starting call:', err);
          setIsLoading(false);
        });
    }
  }, [currentRoomId, matchedUser, startCall]);

  const handleEndCall = () => {
    endMediaSoupCall();
    endCall();
  };

  const handleQualityChange = (value: number[]) => {
    const quality = value[0] === 0 ? 'low' : value[0] === 1 ? 'medium' : 'high';
    setStreamQuality(quality);
    setMediaSoupQuality(quality);
  };

  // Show loading state during SSR
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2F5]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2F5]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F2F5]">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Profile Setup */}
      <ProfileSetup
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSave={handlePreferencesUpdate}
        initialPreferences={preferences || undefined}
      />

      {/* Video containers */}
      <div 
        className="flex-1 relative"
        onClick={() => setShowControls(!showControls)}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute bottom-4 right-4 w-32 h-48 object-cover rounded-lg transition-all duration-300",
            showControls ? "translate-y-0" : "translate-y-20"
          )}
        />

        {/* Quality indicator */}
        <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
          {streamQuality === 'high' ? 'HD' : streamQuality === 'medium' ? 'SD' : 'LD'}
        </div>

        {/* Match info */}
        {matchedUser && (
          <div className="absolute top-4 right-4 bg-black/50 px-4 py-2 rounded-full text-white flex items-center space-x-2">
            <img
              src={matchedUser.photo_url || '/default-avatar.png'}
              alt={matchedUser.first_name}
              className="w-6 h-6 rounded-full"
            />
            <span>{matchedUser.first_name}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="bg-gradient-to-t from-black/90 to-transparent p-6"
          >
            <div className="max-w-md mx-auto space-y-6">
              {/* Quality slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-white text-sm">
                  <span>Quality</span>
                  <span className="capitalize">{streamQuality}</span>
                </div>
                <Slider
                  defaultValue={[2]}
                  max={2}
                  step={1}
                  onValueChange={handleQualityChange}
                  className="w-full"
                />
              </div>

              {/* Control buttons */}
              <div className="flex justify-center space-x-6">
                <Button
                  onClick={toggleMute}
                  variant="ghost"
                  size="icon"
                  className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </Button>
                <Button
                  onClick={toggleVideo}
                  variant="ghost"
                  size="icon"
                  className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </Button>
                <Button
                  onClick={handleEndCall}
                  variant="ghost"
                  size="icon"
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>

              {/* Like and Skip buttons */}
              <div className="flex justify-center space-x-4">
                {!hasLiked && (
                  <Button
                    onClick={sendLike}
                    className="w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 text-white"
                  >
                    <Heart className="w-6 h-6" />
                  </Button>
                )}
                <Button
                  onClick={handleEndCall}
                  className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <Skip className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-match flow */}
      <PostMatchFlow />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-xl">Connecting...</div>
        </div>
      )}

      {/* Error state */}
      {mediaSoupError && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-red-500 text-xl">{mediaSoupError}</div>
        </div>
      )}
    </div>
  );
};

// Export the page with SSR disabled
export default dynamic(() => Promise.resolve(TWA), {
  ssr: false,
});




