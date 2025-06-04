import { Device, Transport, Producer, Consumer, RtpCapabilities, RtpParameters } from 'mediasoup-client';
import { Socket } from 'socket.io-client';

export interface MediaSoupState {
  device: Device | null;
  sendTransport: Transport | null;
  recvTransport: Transport | null;
  producer: Producer | null;
  consumer: Consumer | null;
  socket: Socket | null;
  stream: MediaStream | null;
  roomId: string | null;
  userId: string | null;
  isConnected: boolean;
  error: string | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  streamQuality: 'high' | 'medium' | 'low';
}

export interface UseMediaSoupProps {
  roomId?: string;
  userId: string;
}

export interface TransportInfo {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
  sctpParameters?: any;
}

export interface ProduceOptions {
  kind: 'audio' | 'video';
  rtpParameters: RtpParameters;
}

export interface MediaSoupConfig {
  serverUrl: string;
  roomId: string;
  userId: string;
}

export interface MediaSoupError extends Error {
  code?: string;
  type?: string;
  details?: any;
}

export interface TransportEvents {
  connect: (params: { dtlsParameters: any }, callback: () => void, errback: (error: Error) => void) => void;
  produce: (params: { kind: 'audio' | 'video', rtpParameters: RtpParameters }, callback: (data: { id: string }) => void, errback: (error: Error) => void) => void;
}

export interface ExtendedTransport extends Transport {
  id: string;
  on: <K extends keyof TransportEvents>(event: K, listener: TransportEvents[K]) => void;
  close: () => Promise<void>;
}

export interface ExtendedProducer extends Producer {
  close: () => Promise<void>;
}

export interface ExtendedConsumer extends Consumer {
  close: () => Promise<void>;
}

export interface ExtendedDevice extends Device {
  rtpCapabilities: RtpCapabilities;
}

export interface ProducerOptions {
  track: MediaStreamTrack;
  encodings?: Array<{
    maxBitrate: number;
    scalabilityMode?: string;
  }>;
  codecOptions?: {
    videoGoogleStartBitrate?: number;
  };
}

export interface ConsumerOptions {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: RtpParameters;
} 