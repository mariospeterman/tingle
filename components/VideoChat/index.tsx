import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store';
import { useMediaSoup } from '../../hooks/useMediaSoup';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Mic, MicOff, Video, VideoOff, Share, RotateCcw, Flag, PhoneOff, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoChatProps {
  roomId: string;
  serverUrl?: string;
  userId: string;
  initialPreferences?: {
    isMuted?: boolean;
    isVideoOff?: boolean;
  };
  isMatching?: boolean;
  isInCall?: boolean;
  onStartMatching?: () => void;
  onStopMatching?: () => void;
  onOpenProfile?: () => void;
}

const VideoChat: React.FC<VideoChatProps> = ({ 
  roomId, 
  serverUrl = process.env.NEXT_PUBLIC_MEDIASOUP_SERVER_URL || '',
  userId,
  initialPreferences,
  isMatching,
  isInCall,
  onStartMatching,
  onStopMatching,
  onOpenProfile,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocalVideoMinimized, setIsLocalVideoMinimized] = useState(false);

  const [isMediaInitialized, setIsMediaInitialized] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const { isMuted, isVideoOff, toggleMute, toggleVideo, endCall, currentRoomId, matchedUser } = useStore();

  const {
    device,
    sendTransport,
    recvTransport,
    producer,
    consumer,
    localStream,
    remoteStream,
    error,
  } = useMediaSoup();

  // Determine the effective room ID based on call status
  const effectiveRoomId = isInCall && currentRoomId ? currentRoomId : roomId;

  // Initialize local media when component mounts
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      setIsMediaInitialized(true);
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle call end
  const handleEndCall = async () => {
    try {
      await endCall();
      if (onStopMatching) {
        onStopMatching();
      }
    } catch (error: unknown) {
      console.error('Error ending call:', error);
      setErrorState('Failed to end call');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream, remoteStream]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (errorState || error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{errorState || error}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Remote video */}
      <div className="w-full h-full">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Local video */}
      <AnimatePresence>
        {localStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 right-4 w-32 h-48 object-cover rounded-lg shadow-lg"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center space-x-6 bg-gradient-to-t from-black/80 to-transparent">
        <Button
          onClick={toggleMute}
          variant="ghost"
          size="icon"
          className={`rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'} transition-colors`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button
          onClick={toggleVideo}
          variant="ghost"
          size="icon"
          className={`rounded-full ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'} transition-colors`}
        >
          {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>
        <Button
          onClick={handleEndCall}
          variant="ghost"
          size="icon"
          className="rounded-full bg-red-500 hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
        <Button
          onClick={toggleFullscreen}
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          {isFullscreen ? <Minimize2 className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
        </Button>
      </div>

      {/* Connection status */}
      {isMatching && !isInCall && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-white">Finding Match...</span>
          </div>
        </div>
      )}

      {/* Matched user info */}
      {matchedUser && (
        <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-full">
          <span className="text-white">Connected with User {matchedUser}</span>
        </div>
      )}
    </div>
  );
};

export default VideoChat; 