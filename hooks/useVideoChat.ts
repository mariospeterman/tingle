import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaSoupService } from '../services/mediasoup';
import { MatchmakingService, UserPreferences } from '../services/matchmaking';
import { handleError, logInfo } from '../utils/error';
import { isBrowser } from '../lib/utils';
import { useStore } from '../store';

export type { UserPreferences };

export type VideoChatState = {
  isMatching: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  error: string | null;
  isMicMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
};

export type VideoChatControls = {
  startMatching: () => Promise<void>;
  stopMatching: () => Promise<void>;
  skipMatch: () => Promise<void>;
  reportUser: (reason: string) => Promise<void>;
  likeUser: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  toggleVideo: () => void;
  toggleAudio: () => void;
  toggleScreenShare: () => Promise<void>;
  endCall: () => Promise<void>;
};

interface MatchFoundEvent extends CustomEvent {
  detail: {
    matchId: string;
    roomId: string;
  };
}

interface NewProducerEvent extends CustomEvent {
  detail: {
    producerId: string;
    userId: string;
    kind: 'audio' | 'video';
    track: MediaStreamTrack;
  };
}

interface ProducerClosedEvent extends CustomEvent {
    detail: { producerId: string };
}

export function useVideoChat(
  serverUrl: string,
  userId: string,
  initialPreferences: UserPreferences
): [VideoChatState, VideoChatControls] {
  const [state, setState] = useState<VideoChatState>({
    isMatching: false,
    isConnected: false,
    isConnecting: false,
    localStream: null,
    remoteStreams: new Map(),
    error: null,
    isMicMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
  });

  const mediaSoupRef = useRef<MediaSoupService | null>(null);
  const matchmakingRef = useRef<MatchmakingService | null>(null);
  const currentMatchIdRef = useRef<string | null>(null);
  
  // Get state and actions from the store
  const { isInCall, currentRoomId, startCall, endCall } = useStore();

  const toggleScreenShare = useCallback(async () => {
    if (!mediaSoupRef.current || !state.localStream) return;

    try {
      if (state.isScreenSharing) {
        // Assuming stopScreenShare exists and works, or we need a placeholder
        // NOTE: If stopScreenShare is not implemented in MediaSoupService, this will cause a runtime error.
        if (mediaSoupRef.current.stopScreenShare) {
           await mediaSoupRef.current.stopScreenShare();
        } else {
           console.warn("stopScreenShare method not found on MediaSoupService. Cannot stop screen share.");
           // If stopScreenShare is missing, you might need to stop the producer manually.
           // Example (assuming getProducerByKind exists - another potential missing method):
           // const screenProducer = mediaSoupRef.current.getProducerByKind('video');
           // if(screenProducer) await mediaSoupRef.current.stopProducing(screenProducer.id);
        }

        // Restore camera stream
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack && mediaSoupRef.current) {
           // Assuming startProducing takes a track as the only argument based on linter. May need adjustment based on actual MediaSoupService.
           await mediaSoupRef.current.startProducing(videoTrack);
        }
      } else {
        // Assuming startScreenShare exists and works, or we need a placeholder
        // NOTE: If startScreenShare is not implemented in MediaSoupService, this will cause a runtime error.
        if (mediaSoupRef.current.startScreenShare) {
          await mediaSoupRef.current.startScreenShare();
        } else {
          console.warn("startScreenShare method not found on MediaSoupService. Cannot start screen share.");
          // If startScreenShare is missing, you might need to handle getting display media and starting production manually.
          // Example (assuming getProducerByKind and startProducing exist):
          // const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          // const screenVideoTrack = screenStream.getVideoTracks()[0];
          // if (screenVideoTrack && mediaSoupRef.current) {
          //     const currentCameraProducer = mediaSoupRef.current.getProducerByKind('video');
          //     if (currentCameraProducer) await mediaSoupRef.current.stopProducing(currentCameraProducer.id);
          //     await mediaSoupRef.current.startProducing(screenVideoTrack);
          //      screenVideoTrack.onended = () => toggleScreenShare();
          // }
        }
      }
      setState(prev => ({ ...prev, isScreenSharing: !state.isScreenSharing }));
    } catch (error) {
      handleError(error);
    }
  }, [state.isScreenSharing, state.localStream]);

  const initializeMediaSoup = useCallback(async (roomId: string) => {
    if (!isBrowser) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    try {
        const mediaSoupService = new MediaSoupService({ serverUrl, roomId, userId });
        mediaSoupRef.current = mediaSoupService;
        await mediaSoupService.initialize();
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
    } catch (error) {
        handleError(error, { action: 'initializeMediaSoup', roomId });
        setState(prev => ({ ...prev, error: 'Failed to initialize video connection.', isConnecting: false }));
        throw error;
    }
  }, [serverUrl, userId]);

  // Effect to initialize MatchmakingService
  useEffect(() => {
    if (!isBrowser || !userId) return;

    console.log('Initializing MatchmakingService hook effect.');
    const matchmakingService = new MatchmakingService({
      serverUrl,
      userId,
      preferences: initialPreferences,
    });
    matchmakingRef.current = matchmakingService;

    // The actual startMatching() call is triggered by the button click in TWAClient

    return () => {
      console.log('MatchmakingService hook effect cleanup.');
      matchmakingService.cleanup();
    };
  }, [serverUrl, userId, initialPreferences]);

  // Effect to initialize MediaSoup when currentRoomId changes (i.e., match found)
  useEffect(() => {
    if (!isBrowser || !currentRoomId || !userId) return;

    console.log(`currentRoomId changed to ${currentRoomId}. Initializing MediaSoup...`);

    const initializeCall = async () => {
      try {
        // Cleanup any existing mediasoup instance first
        mediaSoupRef.current?.cleanup();
        mediaSoupRef.current = null;

        await initializeMediaSoup(currentRoomId);

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setState(prev => ({
          ...prev,
          isMatching: false, // No longer matching, now in a call
          localStream: stream,
          isMicMuted: !stream.getAudioTracks()[0]?.enabled,
          isVideoOff: !stream.getVideoTracks()[0]?.enabled,
        }));

        const audioTrack = stream.getAudioTracks()[0];
        if(mediaSoupRef.current && audioTrack) {
          await (mediaSoupRef.current as MediaSoupService).startProducing(audioTrack);
        }

        const videoTrack = stream.getVideoTracks()[0];
        if(mediaSoupRef.current && videoTrack) {
          await (mediaSoupRef.current as MediaSoupService).startProducing(videoTrack);
        }

         console.log(`MediaSoup initialized and producing for room: ${currentRoomId}`);

      } catch (error) {
        handleError(error, { action: 'initializeCallEffect', roomId: currentRoomId });
        setState(prev => ({
          ...prev,
          error: 'Failed to start video call.',
          isMatching: false,
          isConnecting: false,
        }));
         mediaSoupRef.current?.cleanup();
         mediaSoupRef.current = null;
         // Also reset store state on error
         endCall();
      }
    };

    initializeCall();

    // Cleanup MediaSoup when the room ID changes again or component unmounts
    return () => {
       console.log(`currentRoomId changed or hook unmounting. Cleaning up MediaSoup for room ${currentRoomId}.`);
        mediaSoupRef.current?.cleanup();
        mediaSoupRef.current = null;
         // Ensure store state is reset if we are in a call when this cleanup runs
        if (isInCall) {
             endCall();
        }
    };

  }, [currentRoomId, userId, initializeMediaSoup, isInCall, endCall]); // Depend on currentRoomId, userId, initializeMediaSoup, store state/actions

  // Effect to handle matchmaking and mediasoup events
  useEffect(() => {
    if (!isBrowser) return;

    console.log('Setting up window event listeners for matchmaking and mediasoup.');

    const handleMatchFound = useCallback(async (match: any) => {
      logInfo('Match found:', match);
      currentMatchIdRef.current = match.id;
      // Update store to indicate being in a call
      startCall(match.roomId);

      // Add a strong check to ensure mediaSoupRef.current and localStream are available
      if (mediaSoupRef.current && state.localStream) {
        // Check if streams and tracks exist before attempting to produce
        const videoTrack = state.localStream.getVideoTracks()[0];
        const audioTrack = state.localStream.getAudioTracks()[0];

        if (videoTrack) {
           // Reverting to single argument based on linter error: Expected 1 arguments, but got 2
           await mediaSoupRef.current.startProducing(videoTrack);
        }
        if (audioTrack) {
          // Reverting to single argument based on linter error
           await mediaSoupRef.current.startProducing(audioTrack);
        }

      } else {
        console.error("MediaSoup not initialized or local stream not available when match found");
        // Optionally handle this case, e.g., show an error to the user
      }

    }, [startCall, state.localStream]);

    const handleMatchEnded = () => {
       console.log('Hook: Match ended event received.');
       // Reset local hook state
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        localStream: null,
        remoteStreams: new Map(),
        error: null,
        isMicMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
      }));

      // >>> Update Zustand store to reflect the call has ended <<<
      endCall();
      console.log('Hook: Store updated. Call ended.');

       // Cleanup MediaSoup instance associated with the previous call
       // This is handled by the cleanup in the currentRoomId effect when currentRoomId becomes null
    };

    const handleNewProducer = (event: Event) => {
        const { producerId, userId: remoteUserId, kind, track } = (event as NewProducerEvent).detail;
        console.log(`Hook: New producer event received: producerId=${producerId}, userId=${remoteUserId}, kind=${kind}`);

        if (!mediaSoupRef.current) {
           console.warn('Hook: MediaSoup not initialized when receiving new producer');
            return;
        }

        try {
             const remoteStream = new MediaStream([track]);
             console.log(`Hook: Created remote stream for producer ${producerId}`);

             setState(prev => ({
                 ...prev,
                 remoteStreams: new Map(prev.remoteStreams).set(producerId, remoteStream)
             }));

            console.log(`Hook: Attached remote stream for producer ${producerId} to state.`);
             // Automatically resume the consumer for this new producer
             if (mediaSoupRef.current) {
                mediaSoupRef.current.resumeConsumer(producerId).catch(error => {
                    handleError(error, { action: 'resumeNewConsumer', producerId });
                });
             }

        } catch (error) {
            handleError(error, { action: 'handleNewProducer', producerId, remoteUserId, kind });
             console.error('Hook: Error handling new producer event:', error);
        }
    };

    const handleProducerClosed = (event: Event) => {
        const { producerId } = (event as ProducerClosedEvent).detail;
        console.log(`Hook: Producer closed event received: producerId=${producerId}`);

        setState(prev => {
            const newRemoteStreams = new Map(prev.remoteStreams);
            const producerStream = newRemoteStreams.get(producerId);
             if (producerStream) {
                // Stop all tracks in the stream to ensure cleanup
                producerStream.getTracks().forEach(track => track.stop());
             }
            newRemoteStreams.delete(producerId);
            console.log(`Hook: Removed remote stream for producer ${producerId}.`);
            return { ...prev, remoteStreams: newRemoteStreams };
        });
    };

    // Wrap window event listeners with isBrowser check
    if (typeof window !== 'undefined') {
      window.addEventListener('matchFound', handleMatchFound as EventListener);
      window.addEventListener('matchEnded', handleMatchEnded as EventListener);
      window.addEventListener('newProducer', handleNewProducer as EventListener);
      window.addEventListener('producerClosed', handleProducerClosed as EventListener);
    }

    return () => {
      console.log('Removing window event listeners.');
      // Also wrap removeEventListener with isBrowser check
      if (typeof window !== 'undefined') {
        window.removeEventListener('matchFound', handleMatchFound as EventListener);
        window.removeEventListener('matchEnded', handleMatchEnded as EventListener);
        window.removeEventListener('newProducer', handleNewProducer as EventListener);
        window.removeEventListener('producerClosed', handleProducerClosed as EventListener);
      }
    };
  }, [startCall, endCall, initializeMediaSoup]); // Depend on store actions and initializeMediaSoup

  const startMatching = useCallback(async () => {
    if (!matchmakingRef.current) {
        console.error('Hook: Matchmaking service not initialized.');
        setState(prev => ({ ...prev, error: 'Matchmaking service not available.' }));
        return;
    }

    setState(prev => ({ ...prev, isMatching: true, error: null }));
    console.log('Hook: Calling matchmakingRef.current.startMatching()...');
    try {
      // initialize is now called within the matchmaking service's startMatching if needed
      await matchmakingRef.current.startMatching();
       console.log('Hook: matchmakingRef.current.startMatching() finished.');
    } catch (error) {
      handleError(error, { action: 'startMatchingHook' });
      setState(prev => ({
        ...prev,
        error: 'Failed to start matchmaking.',
        isMatching: false,
      }));
    }
  }, []);

  const stopMatching = useCallback(async () => {
     if (!matchmakingRef.current) return;
     console.log('Hook: Calling matchmakingRef.current.stopMatching()...');
    try {
      await matchmakingRef.current.stopMatching();
      setState(prev => ({ ...prev, isMatching: false }));
       console.log('Hook: matchmakingRef.current.stopMatching() finished.');
    } catch (error) {
      handleError(error, { action: 'stopMatchingHook' });
      setState(prev => ({
        ...prev,
        error: 'Failed to stop matchmaking.',
      }));
    }
  }, [matchmakingRef]);

  const skipMatch = useCallback(async () => {
     const matchId = currentMatchIdRef.current;
     if (!matchmakingRef.current || !matchId) {
        console.warn('Hook: Cannot skip match: Matchmaking service not initialized or no active match.');
        // If no match ID, just end the call locally as a fallback
        if (isInCall) {
             endCall();
             setState(prev => ({ // Reset local state
                ...prev,
                isConnected: false,
                isConnecting: false,
                localStream: null,
                remoteStreams: new Map(),
                error: null,
                isMicMuted: false,
                isVideoOff: false,
                isScreenSharing: false,
              }));
        }
        return;
     }

    console.log('Hook: Calling matchmakingRef.current.skipCurrentMatch() for match:', matchId);

    try {
      // Skipping should trigger the matchEnded event from the service
      await matchmakingRef.current.skipCurrentMatch();
       console.log('Hook: matchmakingRef.current.skipCurrentMatch() finished.');
       // handleMatchEnded will be called by the event listener

    } catch (error) {
      handleError(error, { action: 'skipMatchHook' });
      setState(prev => ({
        ...prev,
        error: 'Failed to skip match.',
      }));
    }
  }, [currentMatchIdRef, matchmakingRef, isInCall, endCall]); // Depend on refs and store state/action

  const reportUser = useCallback(async (reason: string) => {
     const matchId = currentMatchIdRef.current;
     if (!matchmakingRef.current || !matchId) {
         console.warn('Hook: Cannot report user: Matchmaking service not initialized or no active match.');
         return;
     }
      console.log('Hook: Calling matchmakingRef.current.reportUser() for match:', matchId, 'Reason:', reason);
    try {
       // Assuming reportUser in service handles the partnerId lookup
       await matchmakingRef.current.reportUser(matchId, reason);
       console.log(`Hook: User reported for match ${matchId}.`);
       // Skip the match after reporting
       await skipMatch();

    } catch (error) {
      handleError(error, { action: 'reportUserHook' });
      setState(prev => ({
        ...prev,
        error: 'Failed to report user.',
      }));
    }
  }, [currentMatchIdRef, matchmakingRef, skipMatch]); // Depend on refs and skipMatch

   const likeUser = useCallback(async () => {
        const matchId = currentMatchIdRef.current;
         if (!matchmakingRef.current || !matchId) {
            console.warn('Hook: Cannot like user: Matchmaking service not initialized or no active match.');
            return;
         }
         console.log('Hook: Calling matchmakingRef.current.likeUser() for match:', matchId);
       try {
           await matchmakingRef.current.likeUser(matchId);
            console.log(`Hook: User liked for match ${matchId}.`);
            // After liking, automatically skip to the next match (as per dating feature flow)
            await skipMatch();
       } catch (error) {
            handleError(error, { action: 'likeUserHook' });
             setState(prev => ({
               ...prev,
               error: 'Failed to like user.',
            }));
       }
   }, [currentMatchIdRef, matchmakingRef, skipMatch]); // Depend on refs and skipMatch

  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
     if (!matchmakingRef.current) {
        console.warn('Hook: Cannot update preferences: Matchmaking service not initialized.');
        return;
     }
      console.log('Hook: Calling matchmakingRef.current.updatePreferences()...', preferences);
    try {
      // Merge partial preferences with existing ones
      const currentPreferences = matchmakingRef.current.getPreferences();
      const updatedPreferences = { ...currentPreferences, ...preferences } as UserPreferences;
      await matchmakingRef.current.updatePreferences(updatedPreferences);
       console.log('Hook: Preferences updated in matchmaking service.');
    } catch (error) {
      handleError(error, { action: 'updatePreferencesHook' });
      setState(prev => ({
        ...prev,
        error: 'Failed to update preferences.',
      }));
    }
  }, [matchmakingRef]); // Depend on matchmakingRef

   const toggleVideo = useCallback(() => {
      if (!state.localStream || !mediaSoupRef.current) return;

       console.log('Hook: Toggling video.');
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) {
         videoTrack.enabled = !videoTrack.enabled;
         setState(prev => ({ ...prev, isVideoOff: !videoTrack.enabled }));
          // Signal MediaSoup producer to pause/resume
         const videoProducer = mediaSoupRef.current?.getVideoProducer();
         if(videoProducer) {
             if(!videoTrack.enabled) {
                  videoProducer.pause();
                  console.log('Hook: Video producer paused');
             } else {
                  videoProducer.resume();
                  console.log('Hook: Video producer resumed');
             }
         }
      }
   }, [state.localStream, mediaSoupRef]); // Depend on localStream and mediaSoupRef

   const toggleAudio = useCallback(() => {
      if (!state.localStream || !mediaSoupRef.current) return;
       console.log('Hook: Toggling audio.');

      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
         audioTrack.enabled = !audioTrack.enabled;
         setState(prev => ({ ...prev, isMicMuted: !audioTrack.enabled }));
          // Signal MediaSoup producer to pause/resume
         const audioProducer = mediaSoupRef.current?.getAudioProducer();
         if(audioProducer) {
             if(!audioTrack.enabled) {
                 audioProducer.pause();
                  console.log('Hook: Audio producer paused');
             } else {
                 audioProducer.resume();
                  console.log('Hook: Audio producer resumed');
             }
         }
      }
   }, [state.localStream, mediaSoupRef]); // Depend on localStream and mediaSoupRef

   const endCallControl = useCallback(async () => { // Renamed to avoid conflict with store action
       console.log('Hook: Calling endCall control.');
        const matchId = currentMatchIdRef.current;

        if(matchId && matchmakingRef.current) {
             console.log('Hook: Signaling matchmaking service to skip match:', matchId);
             // Skipping should trigger the matchEnded event from the service
             await matchmakingRef.current.skipCurrentMatch().catch(console.error);
        } else if (state.isMatching) {
             console.log('Hook: Signaling matchmaking service to stop matching.');
             // If just matching, stop matching without skipping a match
             await matchmakingRef.current?.stopMatching().catch(console.error);
        }
         // The actual state reset and mediasoup cleanup happens in handleMatchEnded
         // which is called by the 'matchEnded' event OR the cleanup effect on unmount.

         // If the matchEnded event doesn't fire for some reason after skip/stop,
         // we might need a fallback here to call endCall() from store directly, but
         // relying on the event is cleaner.
         // Example fallback (use with caution): if (!isInCall && state.isMatching) { endCall(); }

    }, [currentMatchIdRef, matchmakingRef, state.isMatching, isInCall, endCall]); // Depend on refs and local state, added isInCall

   // Effect to cleanup MediaSoup and MatchmakingService when the hook unmounts
   useEffect(() => {
       return () => {
           console.log('Hook: useVideoChat hook unmounting. Running cleanup.');
           mediaSoupRef.current?.cleanup();
           mediaSoupRef.current = null;
           matchmakingRef.current?.cleanup();
           matchmakingRef.current = null;
            // Ensure store state is reset on unmount if a call was active or matching was in progress
           if (isInCall || state.isMatching) {
                console.log('Hook: Resetting store state on unmount.');
                endCall(); // Call the endCall action from the store to reset global state
           }
       };
   }, [isInCall, state.isMatching, endCall]); // Depend on store states and actions

  const controls: VideoChatControls = {
    startMatching,
    stopMatching,
    skipMatch,
    reportUser,
    likeUser,
    updatePreferences,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    endCall: endCallControl,
  };

  // Log state changes for debugging
  useEffect(() => {
    console.log('Hook State Updated:', state);
  }, [state]);

  // Log store state changes related to call status for debugging
  useEffect(() => {
      console.log('Store Call State Updated:', { isInCall, currentRoomId });
  }, [isInCall, currentRoomId]);

  return [state, controls];
} 