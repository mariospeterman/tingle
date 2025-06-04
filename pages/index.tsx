import React, { useEffect, useState } from 'react';
import { VideoChat } from '../components/VideoChat/index';
import type { UserPreferences } from '../services/matchmaking';

export default function Home() {
  const [userId, setUserId] = useState<string>('');
  const [preferences, setPreferences] = useState<UserPreferences>({
    gender: 'all',
    lookingFor: 'all',
    ageRange: {
      min: 18,
      max: 99,
    },
  });

  useEffect(() => {
    // Generate a random user ID if not set
    if (!userId) {
      setUserId(Math.random().toString(36).substring(2, 15));
    }
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-900">
      <VideoChat
        serverUrl={process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'}
        userId={userId}
        initialPreferences={preferences}
      />
    </div>
  );
} 