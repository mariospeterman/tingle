import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useMediaSoup } from '../hooks/useMediaSoup';
import { PostMatchFlow } from './PostMatchFlow';
import { Button } from './ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export const VideoChat: React.FC = () => {
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    startCall,
    endCall: endMediaSoupCall,
    localStream,
    remoteStream,
    error,
  } = useMediaSoup();

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
      startCall(currentRoomId, matchedUser)
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

  if (!isInCall) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video containers */}
      <div className="flex-1 relative">
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
          className="absolute bottom-4 right-4 w-32 h-48 object-cover rounded-lg"
        />
      </div>

      {/* Controls */}
      <div className="bg-black/50 p-4 flex justify-center space-x-4">
        <Button
          onClick={toggleMute}
          variant="ghost"
          size="icon"
          className="text-white"
        >
          {isMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button
          onClick={toggleVideo}
          variant="ghost"
          size="icon"
          className="text-white"
        >
          {isVideoOff ? <VideoOff /> : <Video />}
        </Button>
        <Button
          onClick={handleEndCall}
          variant="ghost"
          size="icon"
          className="text-red-500"
        >
          <PhoneOff />
        </Button>
      </div>

      {/* Like button */}
      {!hasLiked && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <Button
            onClick={sendLike}
            className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-full"
          >
            Like
          </Button>
        </div>
      )}

      {/* Post-match flow */}
      <PostMatchFlow />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-xl">Connecting...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-red-500 text-xl">{error}</div>
        </div>
      )}
    </div>
  );
}; 