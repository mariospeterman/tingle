import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device, Transport, Producer, Consumer, RtpCapabilities, RtpParameters } from 'mediasoup-client';
import { 
  TransportInfo,
  ProducerOptions,
  MediaSoupError,
  ExtendedTransport,
  ExtendedProducer,
  ExtendedConsumer,
  ExtendedDevice,
  ConsumerOptions
} from '../types/mediasoup';

interface MediaSoupState {
  device: ExtendedDevice | null;
  sendTransport: ExtendedTransport | null;
  recvTransport: ExtendedTransport | null;
  producer: ExtendedProducer | null;
  consumer: ExtendedConsumer | null;
  error: string | null;
  streamQuality: 'high' | 'medium' | 'low';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  routerRtpCapabilities: RtpCapabilities | null;
}

interface UseMediaSoupReturn {
  initializeDevice: (routerRtpCapabilities: RtpCapabilities) => Promise<ExtendedDevice | null>;
  createSendTransport: () => Promise<ExtendedTransport | null>;
  createRecvTransport: () => Promise<ExtendedTransport | null>;
  produce: (transport: ExtendedTransport, track: MediaStreamTrack) => Promise<ExtendedProducer | null>;
  consume: (transport: ExtendedTransport, id: string, kind: 'audio' | 'video', rtpParameters: RtpParameters) => Promise<ExtendedConsumer | null>;
  closeProducer: (producer: ExtendedProducer) => void;
  closeConsumer: (consumer: ExtendedConsumer) => void;
  closeTransport: (transport: ExtendedTransport) => void;
  closeDevice: () => void;
  device: ExtendedDevice | null;
  sendTransport: ExtendedTransport | null;
  recvTransport: ExtendedTransport | null;
  producer: ExtendedProducer | null;
  consumer: ExtendedConsumer | null;
  error: string | null;
  streamQuality: 'high' | 'medium' | 'low';
  setStreamQuality: (quality: 'high' | 'medium' | 'low') => void;
  startCall: (roomId: string, userId: string) => Promise<void>;
  endCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cleanup: () => Promise<void>;
}

export const useMediaSoup = (): UseMediaSoupReturn => {
  const [state, setState] = useState<MediaSoupState>({
    device: null,
    sendTransport: null,
    recvTransport: null,
    producer: null,
    consumer: null,
    error: null,
    streamQuality: 'high',
    localStream: null,
    remoteStream: null,
    isConnected: false,
    routerRtpCapabilities: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Use the correct signaling server URL
    const socketUrl = process.env.NEXT_PUBLIC_MEDIASOUP_URL || 'http://localhost:4000';
    console.log('[MediaSoup] Connecting to signaling server:', socketUrl);
    try {
      const socket = io(socketUrl, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket connected');
        setState(prev => ({ ...prev, isConnected: true }));
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setState(prev => ({ ...prev, isConnected: false }));
      });

      socket.on('connect_error', (error: any) => {
        console.error('WebSocket connection error:', error);
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection failed. Please check your server and network.',
          isConnected: false
        }));
      });

      socket.on('error', (error: MediaSoupError) => {
        console.error('Socket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Socket connection error',
          isConnected: false 
        }));
      });

      socket.on('routerRtpCapabilities', (capabilities: RtpCapabilities) => {
        console.log('Received router RTP capabilities');
        setState(prev => ({ ...prev, routerRtpCapabilities: capabilities }));
      });

      return () => {
        socket.disconnect();
      };
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error initializing socket:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to initialize socket connection',
        isConnected: false 
      }));
    }
  }, []);

  // Initialize MediaSoup device with proper error handling
  const initializeDevice = useCallback(async (routerRtpCapabilities: RtpCapabilities) => {
    try {
      const newDevice = new Device() as ExtendedDevice;
      await newDevice.load(routerRtpCapabilities);
      setState(prev => ({ ...prev, device: newDevice, routerRtpCapabilities }));
      return newDevice;
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error loading device:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to initialize MediaSoup device' 
      }));
      return null;
    }
  }, []);

  // Create send transport with error handling
  const createSendTransport = useCallback(async () => {
    if (!state.device || !socketRef.current) {
      throw new Error('Device or socket not initialized');
    }

    try {
      const response = await fetch('/api/mediasoup/create-send-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const { id, iceParameters, iceCandidates, dtlsParameters } = await response.json();

      const transport = state.device.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      }) as ExtendedTransport;

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await fetch('/api/mediasoup/connect-transport', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transportId: transport.id,
              dtlsParameters,
            }),
          });
          callback();
        } catch (err) {
          errback(err instanceof Error ? err : new Error('Failed to connect transport'));
        }
      });

      transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const response = await fetch('/api/mediasoup/produce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transportId: transport.id,
              kind,
              rtpParameters,
            }),
          });
          const { id } = await response.json();
          callback({ id });
        } catch (err) {
          errback(err instanceof Error ? err : new Error('Failed to produce'));
        }
      });

      setState(prev => ({ ...prev, sendTransport: transport }));
      return transport;
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error creating send transport:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to create send transport' 
      }));
      return null;
    }
  }, [state.device]);

  // Create receive transport with error handling
  const createRecvTransport = useCallback(async () => {
    if (!state.device || !socketRef.current) {
      throw new Error('Device or socket not initialized');
    }

    try {
      const response = await fetch('/api/mediasoup/create-recv-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const { id, iceParameters, iceCandidates, dtlsParameters } = await response.json();

      const transport = state.device.createRecvTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      }) as ExtendedTransport;

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await fetch('/api/mediasoup/connect-transport', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transportId: transport.id,
              dtlsParameters,
            }),
          });
          callback();
        } catch (err) {
          errback(err instanceof Error ? err : new Error('Failed to connect transport'));
        }
      });

      setState(prev => ({ ...prev, recvTransport: transport }));
      return transport;
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error creating receive transport:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to create receive transport' 
      }));
      return null;
    }
  }, [state.device]);

  // Produce media with error handling
  const produce = useCallback(async (transport: ExtendedTransport, track: MediaStreamTrack) => {
    if (!transport) {
      throw new Error('Transport not initialized');
    }

    try {
      const producer = await transport.produce({ track }) as ExtendedProducer;
      setState(prev => ({ ...prev, producer }));
      return producer;
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error producing:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to produce media' 
      }));
      return null;
    }
  }, []);

  // Consume media with error handling
  const consume = useCallback(async (transport: ExtendedTransport, id: string, kind: 'audio' | 'video', rtpParameters: RtpParameters) => {
    if (!transport) {
      throw new Error('Transport not initialized');
    }

    try {
      const consumer = await transport.consume({
        id,
        producerId: id,
        kind,
        rtpParameters,
      }) as ExtendedConsumer;
      setState(prev => ({ ...prev, consumer }));
      return consumer;
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error consuming:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to consume media' 
      }));
      return null;
    }
  }, []);

  // Helper function for quality settings
  const getEncodingsForQuality = (quality: 'high' | 'medium' | 'low') => {
    switch (quality) {
      case 'high':
        return [
          { maxBitrate: 1000000, scalabilityMode: 'S3T3' },
          { maxBitrate: 300000, scalabilityMode: 'S2T3' },
          { maxBitrate: 150000, scalabilityMode: 'S1T3' }
        ];
      case 'medium':
        return [
          { maxBitrate: 500000, scalabilityMode: 'S2T3' },
          { maxBitrate: 150000, scalabilityMode: 'S1T3' }
        ];
      case 'low':
        return [
          { maxBitrate: 150000, scalabilityMode: 'S1T3' }
        ];
    }
  };

  // Enhanced cleanup with proper error handling
  const cleanup = useCallback(async () => {
    try {
      if (state.producer) {
        await state.producer.close();
      }

      if (state.consumer) {
        await state.consumer.close();
      }

      if (state.sendTransport) {
        await state.sendTransport.close();
      }

      if (state.recvTransport) {
        await state.recvTransport.close();
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      setState({
        device: null,
        sendTransport: null,
        recvTransport: null,
        producer: null,
        consumer: null,
        error: null,
        streamQuality: 'high',
        localStream: null,
        remoteStream: null,
        isConnected: false,
        routerRtpCapabilities: null
      });
    } catch (error) {
      const mediaSoupError = error as MediaSoupError;
      console.error('Error during cleanup:', mediaSoupError);
      setState(prev => ({ 
        ...prev, 
        error: mediaSoupError.message || 'Failed to cleanup resources' 
      }));
    }
  }, [state]);

  const closeProducer = useCallback((producer: ExtendedProducer) => {
    producer.close();
    setState(prev => ({ ...prev, producer: null }));
  }, []);

  const closeConsumer = useCallback((consumer: ExtendedConsumer) => {
    consumer.close();
    setState(prev => ({ ...prev, consumer: null }));
  }, []);

  const closeTransport = useCallback((transport: ExtendedTransport) => {
    transport.close();
    setState(prev => ({
      ...prev,
      sendTransport: transport === prev.sendTransport ? null : prev.sendTransport,
      recvTransport: transport === prev.recvTransport ? null : prev.recvTransport,
    }));
  }, []);

  const closeDevice = useCallback(() => {
    if (state.device) {
      state.device.close();
      setState(prev => ({ ...prev, device: null }));
    }
  }, [state.device]);

  const startCall = useCallback(async (roomId: string, userId: string) => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      setState(prev => ({ ...prev, localStream: stream }));

      // Initialize device
      const response = await fetch(`/api/mediasoup/router-rtp-capabilities?roomId=${roomId}`);
      const { routerRtpCapabilities } = await response.json();
      await initializeDevice(routerRtpCapabilities);

      // Create transports
      const sendTransport = await createSendTransport();
      const recvTransport = await createRecvTransport();

      if (!sendTransport || !recvTransport) {
        throw new Error('Failed to create transports');
      }

      // Produce audio and video
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (audioTrack) {
        await produce(sendTransport, audioTrack);
      }
      if (videoTrack) {
        await produce(sendTransport, videoTrack);
      }

      // Consume remote stream
      const consumeResponse = await fetch(`/api/mediasoup/consume?roomId=${roomId}&userId=${userId}`);
      const { producerId, kind, rtpParameters } = await consumeResponse.json();

      const consumer = await consume(recvTransport, producerId, kind, rtpParameters);
      if (consumer) {
        const remoteStream = new MediaStream();
        remoteStream.addTrack(consumer.track);
        setState(prev => ({ ...prev, remoteStream }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to start call' }));
    }
  }, [initializeDevice, createSendTransport, createRecvTransport, produce, consume]);

  const endCall = useCallback(() => {
    if (state.producer) {
      closeProducer(state.producer);
    }
    if (state.consumer) {
      closeConsumer(state.consumer);
    }
    if (state.sendTransport) {
      closeTransport(state.sendTransport);
    }
    if (state.recvTransport) {
      closeTransport(state.recvTransport);
    }
    if (state.device) {
      closeDevice();
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
      setState(prev => ({ ...prev, localStream: null, remoteStream: null }));
    }
  }, [state, closeProducer, closeConsumer, closeTransport, closeDevice]);

  return {
    initializeDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    consume,
    closeProducer,
    closeConsumer,
    closeTransport,
    closeDevice,
    device: state.device,
    sendTransport: state.sendTransport,
    recvTransport: state.recvTransport,
    producer: state.producer,
    consumer: state.consumer,
    error: state.error,
    streamQuality: state.streamQuality,
    setStreamQuality: (quality) => setState(prev => ({ ...prev, streamQuality: quality })),
    startCall,
    endCall,
    localStream: state.localStream,
    remoteStream: state.remoteStream,
    cleanup
  };
}; 