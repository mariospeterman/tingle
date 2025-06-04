import React, { useState, useEffect } from 'react';
import { useTonConnectUI, TonConnectButton } from '@tonconnect/ui-react';
import type { UserPreferences } from '../../services/matchmaking';
import { db } from '../../services/supabase'; // Import db for saving preferences
import { handleError, logInfo } from '../../utils/error'; // Import error handling
import WalletConnect from '../WalletConnect'; // Import WalletConnect
import { useStore } from '../../store'; // Import useStore

interface PreCallSetupProps {
  userId?: string;
  onSetupComplete: (preferences: UserPreferences) => void;
  initialPreferences?: UserPreferences | null;
}

export function PreCallSetup({ userId, onSetupComplete, initialPreferences }: PreCallSetupProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    gender: initialPreferences?.gender || 'any',
    lookingFor: initialPreferences?.lookingFor || 'any',
    ageRange: initialPreferences?.ageRange || { min: 18, max: 99 },
    wallet_address: initialPreferences?.wallet_address || null,
  });

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialPreferences) {
      setPreferences(initialPreferences);
    }
  }, [initialPreferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      const userError = 'User ID is not available';
      setError(userError);
      handleError(userError, { action: 'savePreferences' }); // Pass string error
      return;
    }

    if (!preferences.gender || !preferences.lookingFor) {
      setError('Please select your gender and who you are looking for');
      return;
    }

    setIsSaving(true);
    try {
      await db.users.updatePreferences(userId, preferences);
      logInfo('User preferences saved successfully', { userId });
      onSetupComplete(preferences);
    } catch (err: unknown) { // Explicitly type as unknown
      const errorMessage = err instanceof Error ? err.message : String(err); // Handle potential non-Error types
      handleError(err instanceof Error ? err : errorMessage, { userId, action: 'savePreferences' }); // Pass Error object or string message
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            I am
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['male', 'female', 'any'].map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() => setPreferences(prev => ({ ...prev, gender: gender as 'male' | 'female' | 'any' }))}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  preferences.gender === gender
                    ? 'bg-[#2AABEE] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {gender.charAt(0).toUpperCase() + gender.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Looking for
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['male', 'female', 'any'].map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() => setPreferences(prev => ({ ...prev, lookingFor: gender as 'male' | 'female' | 'any' }))}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  preferences.lookingFor === gender
                    ? 'bg-[#2AABEE] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {gender.charAt(0).toUpperCase() + gender.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Age Range
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="number"
              min="18"
              max="99"
              value={preferences.ageRange.min}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                ageRange: { ...prev.ageRange, min: Math.max(18, Math.min(99, parseInt(e.target.value) || 18)) }
              }))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AABEE] focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="number"
              min="18"
              max="99"
              value={preferences.ageRange.max}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                ageRange: { ...prev.ageRange, max: Math.max(18, Math.min(99, parseInt(e.target.value) || 99)) }
              }))}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AABEE] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            TON Wallet (Optional)
          </label>
          <div className="bg-gray-50 p-4 rounded-lg">
            <TonConnectButton />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-[#2AABEE] text-white py-3 px-6 rounded-xl font-medium hover:bg-[#229ED9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Continue'}
      </button>
    </form>
  );
} 