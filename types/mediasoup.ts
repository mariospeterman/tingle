import { Device, Transport, Producer, Consumer, RtpCapabilities, RtpParameters } from 'mediasoup-client';
import { Socket } from 'socket.io-client';

export interface ExtendedDevice extends Device {
  close(): void;
  load(routerRtpCapabilities: RtpCapabilities): Promise<void>;
}

export interface ExtendedTransport extends Transport {
  close(): void;
  id: string;
  on(event: 'connect', handler: (params: { dtlsParameters: RtpParameters }, callback: () => void, errback: (error: Error) => void) => void): void;
  on(event: 'produce', handler: (params: { kind: 'audio' | 'video', rtpParameters: RtpParameters }, callback: (params: { id: string }) => void, errback: (error: Error) => void) => void): void;
}

export interface ExtendedProducer extends Producer {
  close(): void;
}

export interface ExtendedConsumer extends Consumer {
  close(): void;
}

export interface MediaSoupError extends Error {
  code?: string;
  type?: string;
}

export interface TransportInfo {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
}

export interface ProducerOptions {
  track: MediaStreamTrack;
  encodings?: any[];
  codecOptions?: {
    videoGoogleStartBitrate?: number;
  };
}

export interface ConsumerOptions {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
}

export interface MediaSoupState {
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

export interface UseMediaSoupReturn {
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