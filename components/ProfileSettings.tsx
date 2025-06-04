import React from 'react';
import { UserPreferences } from '../services/matchmaking';
import { PreCallSetup } from './PreCallSetup';
import { TonConnectButton } from '@tonconnect/ui-react';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  preferences: UserPreferences | null;
  onPreferencesUpdate: (prefs: UserPreferences) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  isOpen,
  onClose,
  userId,
  preferences,
  onPreferencesUpdate,
}) => {
  return (
    <div
      className={`fixed inset-y-0 right-0 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Profile Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-4">Wallet</h3>
            <div className="flex justify-center">
              <TonConnectButton />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-4">Preferences</h3>
            <PreCallSetup
              userId={userId}
              onSetupComplete={(prefs) => {
                console.log('PreCallSetup onSetupComplete called with:', prefs);
                onPreferencesUpdate(prefs);
              }}
              initialPreferences={preferences}
            />
          </div>
        </div>
      </div>
    </div>
  );
}; 