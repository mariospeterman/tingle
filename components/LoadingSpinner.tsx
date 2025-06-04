import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'small' }) => {
  const spinnerSize = size === 'large' ? 'h-16 w-16' : 'h-8 w-8';
  return (
    <div className={`flex items-center justify-center`}>
      <div className={`animate-spin rounded-full border-4 border-t-4 border-[#2AABEE] border-opacity-20 border-t-[#2AABEE] ${spinnerSize}`}></div>
    </div>
  );
}; 