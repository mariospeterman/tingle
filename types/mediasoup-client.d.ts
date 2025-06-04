declare module 'mediasoup-client' {
  export class Device {
    constructor();
    load(routerRtpCapabilities: RtpCapabilities): Promise<void>;
    createSendTransport(transportInfo: TransportOptions): Transport;
    createRecvTransport(transportInfo: TransportOptions): Transport;
  }

  export class Transport {
    produce(options: { track: MediaStreamTrack }): Promise<Producer>;
    consume(options: {
      id: string;
      producerId: string;
      kind: 'video' | 'audio';
      rtpParameters: RtpParameters;
    }): Promise<Consumer>;
  }

  export class Producer {
    id: string;
    kind: 'video' | 'audio';
    track: MediaStreamTrack;
    rtpParameters: RtpParameters;
    appData: any;
  }

  export class Consumer {
    id: string;
    producerId: string;
    kind: 'video' | 'audio';
    track: MediaStreamTrack;
    rtpParameters: RtpParameters;
    appData: any;
  }

  export interface RtpCapabilities {
    codecs: Array<{
      kind: 'video' | 'audio';
      mimeType: string;
      clockRate: number;
      channels?: number;
      parameters?: any;
      rtcpFeedback?: Array<{
        type: string;
        parameter?: string;
      }>;
    }>;
    headerExtensions: Array<{
      kind: 'video' | 'audio';
      uri: string;
      preferredId: number;
      preferredEncrypt?: boolean;
      direction?: 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive';
    }>;
  }

  export interface RtpParameters {
    codecs: Array<{
      mimeType: string;
      payloadType: number;
      clockRate: number;
      channels?: number;
      parameters?: any;
      rtcpFeedback?: Array<{
        type: string;
        parameter?: string;
      }>;
    }>;
    headerExtensions: Array<{
      uri: string;
      id: number;
      encrypt?: boolean;
      parameters?: any;
    }>;
    encodings: Array<{
      ssrc: number;
      rtx?: { ssrc: number };
      dtx?: boolean;
      scalabilityMode?: string;
    }>;
    rtcp: {
      cname: string;
      reducedSize?: boolean;
      mux?: boolean;
    };
  }

  export interface TransportOptions {
    id: string;
    iceParameters: {
      usernameFragment: string;
      password: string;
      iceLite?: boolean;
    };
    iceCandidates: Array<{
      foundation: string;
      priority: number;
      ip: string;
      protocol: 'udp' | 'tcp';
      port: number;
      type: 'host' | 'srflx' | 'prflx' | 'relay';
      tcpType?: 'passive' | 'simultaneous-open' | 'active';
      relatedAddress?: string;
      relatedPort?: number;
    }>;
    dtlsParameters: {
      role: 'auto' | 'client' | 'server';
      fingerprints: Array<{
        algorithm: string;
        value: string;
      }>;
    };
    sctpParameters?: {
      port: number;
      OS: number;
      MIS: number;
      maxMessageSize: number;
    };
    iceServers?: Array<{
      urls: string[];
      username?: string;
      credential?: string;
    }>;
    iceTransportPolicy?: 'all' | 'relay';
    additionalSettings?: any;
    proprietaryConstraints?: any;
    appData?: any;
  }
} 