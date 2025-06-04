import React from 'react';
import { Button, ButtonProps } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Slider } from './ui/slider';
import { UserPreferences } from '../services/matchmaking';
import { motion } from 'framer-motion';
import { Wallet, User, Heart, Settings } from 'lucide-react';

interface ProfileSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: UserPreferences) => void;
  initialPreferences?: UserPreferences;
}

export const ProfileSetup: React.FC<ProfileSetupProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPreferences,
}) => {
  const [step, setStep] = React.useState(1);
  const [preferences, setPreferences] = React.useState<UserPreferences>({
    gender: initialPreferences?.gender || 'any',
    lookingFor: initialPreferences?.lookingFor || 'any',
    ageRange: initialPreferences?.ageRange || { min: 18, max: 99 },
    wallet_address: initialPreferences?.wallet_address || null,
    isMuted: initialPreferences?.isMuted,
    isVideoOff: initialPreferences?.isVideoOff,
    language: initialPreferences?.language,
    interests: initialPreferences?.interests,
  } as UserPreferences);

  const handleSave = () => {
    onSave(preferences);
    onClose();
  };

  const steps = [
    {
      title: 'Welcome to Tingle!',
      icon: <User className="w-8 h-8" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Let's set up your profile to help you find the perfect match.
          </p>
          <Button
            className="w-full bg-pink-500 hover:bg-pink-600"
            onClick={() => setStep(2)}
          >
            Get Started
          </Button>
        </div>
      ),
    },
    {
      title: 'Your Preferences',
      icon: <Heart className="w-8 h-8" />,
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium">I am</label>
            <div className="flex space-x-2">
              {(['male', 'female', 'any'] as const).map((genderOption) => (
                <Button
                  key={genderOption}
                  variant={(preferences.gender === genderOption ? 'default' : 'outline') as ButtonProps['variant']}
                  className="flex-1"
                  onClick={() =>
                    setPreferences((prev) => ({ ...prev, gender: genderOption } as UserPreferences))
                  }
                >
                  {genderOption.charAt(0).toUpperCase() + genderOption.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium">Looking for</label>
            <div className="flex space-x-2">
              {(['male', 'female', 'any'] as const).map((lookingForOption) => (
                <Button
                  key={lookingForOption}
                  variant={(preferences.lookingFor === lookingForOption ? 'default' : 'outline') as ButtonProps['variant']}
                  className="flex-1"
                  onClick={() =>
                    setPreferences((prev) => ({ ...prev, lookingFor: lookingForOption } as UserPreferences))
                  }
                >
                  {lookingForOption.charAt(0).toUpperCase() + lookingForOption.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium">Age Range</label>
            <div className="px-2">
              <Slider
                defaultValue={[preferences.ageRange?.min ?? 18, preferences.ageRange?.max ?? 99]}
                min={18}
                max={99}
                step={1}
                onValueChange={([min, max]: [number, number]) =>
                  setPreferences((prev) => ({
                    ...prev,
                    ageRange: { min, max },
                  }) as UserPreferences)
                }
              />
              <div className="flex justify-between text-sm text-gray-400 mt-2">
                <span>{preferences.ageRange?.min ?? 18} years</span>
                <span>{preferences.ageRange?.max ?? 99} years</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-pink-500 hover:bg-pink-600"
              onClick={() => setStep(3)}
            >
              Next
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: 'Connect Wallet',
      icon: <Wallet className="w-8 h-8" />,
      content: (
        <div className="space-y-6">
          <p className="text-gray-300">
            Connect your TON wallet to enable additional features and rewards.
          </p>
          <Button
            className="w-full bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              // Handle wallet connection logic here
              // For now, just move to the next step
              setStep(4);
            }}
          >
            Connect Wallet
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setStep(4)}
          >
            Skip for Now
          </Button>
        </div>
      ),
    },
    {
      title: 'All Set!',
      icon: <Settings className="w-8 h-8" />,
      content: (
        <div className="space-y-6">
          <p className="text-gray-300">
            Your profile is ready! You can start matching with other users now.
          </p>
          <Button
            className="w-full bg-pink-500 hover:bg-pink-600"
            onClick={handleSave}
          >
            Start Matching
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-black/90 border border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {steps[step - 1].title}
          </DialogTitle>
        </DialogHeader>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="py-6"
        >
          <div className="flex justify-center mb-6">
            {steps[step - 1].icon}
          </div>
          {steps[step - 1].content}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}; 