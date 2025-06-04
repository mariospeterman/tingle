import * as mediasoupClient from 'mediasoup-client';
import { Device, types } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';
import { isBrowser } from '../lib/utils';
import { handleError } from '../utils/error';

export type MediaSoupConfig = {
  serverUrl: string;
  roomId: string;
  userId: string;
};

export type MediaSoupState = {
  device: Device | null;
  sendTransport: types.Transport | null;
  recvTransport: types.Transport | null;
  producers: Map<string, types.Producer>;
  consumers: Map<string, types.Consumer>;
  socket: Socket | null;
  screenShareProducer: types.Producer | null;
  cameraVideoTrack: MediaStreamTrack | null;
};

export class MediaSoupService {
  private config: MediaSoupConfig;
  private state: MediaSoupState = {
    device: null,
    sendTransport: null,
    recvTransport: null,
    producers: new Map(),
    consumers: new Map(),
    socket: null,
    screenShareProducer: null,
    cameraVideoTrack: null,
  };

  constructor(config: MediaSoupConfig) {
    this.config = config;
  }

  async initialize() {
    try {
      if (!isBrowser) {
        throw new Error('MediaSoupService can only be used in a browser environment');
      }

      // Check for core WebRTC APIs
      const requiredApis = [
        'RTCPeerConnection',
        'RTCSessionDescription',
        'MediaStream',
        'getUserMedia'
      ];

      const missingApis = requiredApis.filter(api => !(api in window));
      if (missingApis.length > 0) {
        throw new Error(`Missing required WebRTC APIs: ${missingApis.join(', ')}`);
      }

      console.log('MediaSoupService: Core WebRTC APIs detected.');

      // Enhanced device detection for Telegram WebView
      const handlerName = await mediasoupClient.detectDeviceAsync();
      if (!handlerName) {
        console.warn('MediaSoupService: mediasoupClient.detectDeviceAsync() returned undefined. Attempting to proceed with default handler.');
      } else {
        console.log(`MediaSoupService: mediasoupClient.detectDeviceAsync() detected handler: ${handlerName}`);
      }

      // Connect to signaling server
      if (!this.config.serverUrl) {
        console.error('MediaSoupService: Signaling server URL is not provided.');
        throw new Error('Signaling server URL is not configured.');
      }

      console.log(`MediaSoupService: Connecting to signaling server at ${this.config.serverUrl}`);
      this.state.socket = io(this.config.serverUrl, {
        query: {
          roomId: this.config.roomId,
          userId: this.config.userId,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true,
      });

      // Initialize MediaSoup device with enhanced options
      console.log('MediaSoupService: Initializing mediasoup-client Device.');
      this.state.device = new Device({
        handlerName: handlerName || undefined,
      });

      // Set up socket event handlers
      this.setupSocketHandlers();
      console.log('MediaSoupService: Socket handlers set up.');

      console.log('MediaSoupService: Initialization complete.');
    } catch (error) {
      console.error('MediaSoupService: Initialization failed:', error);
      handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.initialize' });
      throw error;
    }
  }

  private setupSocketHandlers() {
    if (!this.state.socket) return;

    this.state.socket.on('connect', () => {
      console.log('Connected to signaling server');
      // Once connected, request router capabilities
      this.state.socket?.emit('getRtpCapabilities', {}, (rtpCapabilities: any) => {
         if (this.state.device && !this.state.device.loaded) {
             try {
                 this.state.device.load({ routerRtpCapabilities: rtpCapabilities });
                 console.log('Device loaded with router capabilities');
                 // After device is loaded, create transports
                 this.createSendTransport();
                 this.createRecvTransport();
             } catch (error) {
                 console.error('Error loading device after getting capabilities:', error);
                 handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.loadDevice' });
             }
         } else if (this.state.device?.loaded) {
              console.log('Device already loaded.');
               // Transports might need to be recreated or re-established on reconnect
              this.createSendTransport(); // Attempt to recreate if needed
              this.createRecvTransport(); // Attempt to recreate if needed
         }
      });
    });

    this.state.socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      // Potentially clean up transports and producers here or rely on the hook's cleanup
    });

    this.state.socket.on('newProducer', ({ producerId, userId: remoteUserId, kind }: { producerId: string, userId: string, kind: 'audio' | 'video' }) => {
        console.log(`Received newProducer event: producerId=${producerId}, userId=${remoteUserId}, kind=${kind}`);
        // When a new producer is announced, create a consumer for it
        this.createConsumer(producerId, kind)
            .then(consumer => {
                 if(consumer && isBrowser) {
                     console.log(`Created consumer for producer ${producerId}. Dispatching newProducer event.`);
                      // Dispatch a custom event to notify the hook
                     window.dispatchEvent(new CustomEvent('newProducer', {
                         detail: {
                             producerId: consumer.producerId, // Use consumer's producerId
                             userId: remoteUserId, // Pass the original remote userId
                             kind: consumer.kind,
                             track: consumer.track, // Pass the consumer's track
                         }
                     }));
                 }
            })
            .catch(error => { 
              console.error('Error creating consumer on newProducer event:', error);
              handleError(error, { action: 'MediaSoupService.newProducerEvent' });
            });
    });

    this.state.socket.on('producerClosed', ({ producerId }: { producerId: string }) => {
        console.log(`Producer closed: ${producerId}`);
        // Find and close the corresponding consumer
        const consumer = this.state.consumers.get(producerId);
        if(consumer) {
            consumer.close();
            this.state.consumers.delete(producerId);
            console.log(`Closed consumer for producer ${producerId}`);
             // Signal UI to remove remote stream
             if (isBrowser) {
                 window.dispatchEvent(new CustomEvent('producerClosed', {
                     detail: { producerId }
                 }));
             }
        }
    });

    this.state.socket.on('error', (error) => {
      console.error('Signaling server error:', error);
      handleError(error, { action: 'MediaSoupService.socketError' });
    });
  }

  private async createSendTransport() {
    if (!this.state.device || !this.state.socket || this.state.sendTransport || !isBrowser) return;

    try {
      const transportOptions = await this.request('createWebRtcTransport', { isConsumer: false });
      const transport = this.state.device.createSendTransport(transportOptions);

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.request('connectTransport', {
            transportId: transport.id,
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error instanceof Error ? error : new Error(String(error)));
          handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.sendTransportConnect' });
        }
      });

      transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await this.request('produce', {
            transportId: transport.id,
            kind,
            rtpParameters,
            appData,
          });
          callback({ id });
        } catch (error) {
          errback(error instanceof Error ? error : new Error(String(error)));
          handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.sendTransportProduce' });
        }
      });

      this.state.sendTransport = transport;
      console.log('Send transport created');
    } catch (error) {
      console.error('Error creating send transport:', error);
      handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.createSendTransport' });
      throw error;
    }
  }

  private async createRecvTransport() {
    if (!this.state.device || !this.state.socket || this.state.recvTransport || !isBrowser) return;

    try {
      const transportOptions = await this.request('createWebRtcTransport', { isConsumer: true });
      const transport = this.state.device.createRecvTransport(transportOptions);

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.request('connectTransport', {
            transportId: transport.id,
            dtlsParameters,
          });
          callback();
        } catch (error) {
          errback(error instanceof Error ? error : new Error(String(error)));
          handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.recvTransportConnect' });
        }
      });

      this.state.recvTransport = transport;
      console.log('Receive transport created');
    } catch (error) {
      console.error('Error creating receive transport:', error);
      handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.createRecvTransport' });
      throw error;
    }
  }

  async startProducing(track: MediaStreamTrack, options?: types.ProducerOptions): Promise<types.Producer | undefined> {
    if (!this.state.sendTransport || !this.state.device) {
      console.error('Send transport or device not initialized for producing');
      return undefined;
    }

    if (!this.state.device.canProduce(track.kind as types.MediaKind)) {
        console.warn(`Device cannot produce track kind: ${track.kind}`);
        return undefined;
    }

    try {
      const producer = await this.state.sendTransport.produce({
        track,
        ...options,
      });

      this.state.producers.set(producer.id, producer);

      producer.on('transportclose', () => console.log(`Producer ${producer.id} transport closed`));
      producer.on('trackended', () => {
          console.log(`Producer ${producer.id} track ended`);
          this.stopProducing(producer.id);
      });
      producer.on('@close', () => {
          console.log(`Producer ${producer.id} closed`);
          this.state.producers.delete(producer.id);
          if (this.state.screenShareProducer?.id === producer.id) {
              this.state.screenShareProducer = null;
          }
      });

      console.log(`Started producing ${track.kind} track with producer ID: ${producer.id}`);
      return producer;

    } catch (error) {
      console.error('Error starting producing:', error);
      handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.startProducing', trackKind: track.kind });
      throw error;
    }
  }

  async stopProducing(producerId: string) {
    const producer = this.state.producers.get(producerId);
    if(producer) {
        console.log(`Stopping producer ${producerId}`);
        producer.close();
        this.request('producerClosed', { producerId }).catch(error => { 
          console.error('Error signaling server about producer closed:', error);
          handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.signalProducerClosed', producerId });
        });
    } else {
        console.warn(`Producer with ID ${producerId} not found to stop.`);
    }
  }

  async startScreenShare(): Promise<types.Producer | undefined> {
    if (!isBrowser || !navigator.mediaDevices?.getDisplayMedia) {
        console.warn('Screen sharing not supported in this browser.');
        return undefined;
    }
    if (this.state.screenShareProducer) {
        console.warn('Screen sharing is already active.');
        return undefined;
    }
    
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        if (!screenVideoTrack) {
            throw new Error('No video track found in screen share stream.');
        }

        const cameraProducer = this.getVideoProducer();
        if (cameraProducer) {
            await this.stopProducing(cameraProducer.id);
            console.log('Stopped camera video producer for screen share.');
        }

        this.state.cameraVideoTrack = cameraProducer?.track || null;

        const screenProducer = await this.startProducing(screenVideoTrack, {
            appData: { share: 'screen' },
        });

        if (screenProducer) {
            this.state.screenShareProducer = screenProducer;
            console.log('Started producing screen share.', screenProducer.id);
            screenVideoTrack.onended = () => {
                console.log('Screen sharing ended via browser UI.');
                this.stopScreenShare().catch(error => { 
                  console.error('Error stopping screen share on track ended:', error);
                  handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.screenTrackEnded' });
                });
            };
            return screenProducer;
        }

        return undefined;

    } catch (error) {
        console.error('Error starting screen share:', error);
        handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.startScreenShare' });
        throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.state.screenShareProducer) {
        console.warn('Screen sharing is not active.');
        return;
    }

    try {
        const screenProducerId = this.state.screenShareProducer.id;
        console.log('Stopping screen share producer:', screenProducerId);
        await this.stopProducing(screenProducerId);

        if (this.state.cameraVideoTrack) {
            console.log('Attempting to restart camera video producer.');
            if (!this.state.cameraVideoTrack.readyState || this.state.cameraVideoTrack.readyState === 'ended') {
                console.warn('Stored camera track ended. Cannot restart camera producer.');
                this.state.cameraVideoTrack = null;
            } else {
                await this.startProducing(this.state.cameraVideoTrack, {});
                console.log('Restarted camera video producer.');
            }
        }

        this.state.screenShareProducer = null;
        this.state.cameraVideoTrack = null;

    } catch (error) {
        console.error('Error stopping screen share:', error);
        handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.stopScreenShare' });
        throw error;
    }
  }

  getProducerByKind(kind: types.MediaKind): types.Producer | undefined {
    return Array.from(this.state.producers.values()).find(producer => producer.kind === kind);
  }

  getVideoProducer(): types.Producer | undefined {
    return this.getProducerByKind('video');
  }

  getAudioProducer(): types.Producer | undefined {
    return this.getProducerByKind('audio');
  }

  getProducer(producerId: string): types.Producer | undefined {
    return this.state.producers.get(producerId);
  }

  async createConsumer(producerId: string, kind: 'audio' | 'video'): Promise<types.Consumer | undefined> {
    if (!this.state.device || !this.state.recvTransport || !isBrowser) {
        console.error('Device or receive transport not initialized for consuming or not in browser');
        return undefined;
    }

    const canConsume = this.state.device.rtpCapabilities && 
        this.state.device.rtpCapabilities.codecs && 
        this.state.device.rtpCapabilities.codecs.length > 0 &&
        (this.state.device as any).canConsume({ producerId, rtpCapabilities: this.state.device.rtpCapabilities });

    if (!canConsume) {
        console.warn(`Device cannot consume producer ${producerId}`);
        return undefined;
    }

    try {
        const consumerOptions = await this.request('consume', {
            transportId: this.state.recvTransport.id,
            producerId,
            rtpCapabilities: this.state.device.rtpCapabilities,
        });

        const consumer = await this.state.recvTransport.consume(consumerOptions);
        this.state.consumers.set(consumer.producerId, consumer);

        consumer.on('transportclose', () => console.log(`Consumer ${consumer.id} transport closed`));
        consumer.on('@close', () => {
            console.log(`Consumer ${consumer.id} producer closed`);
            consumer.close();
            this.state.consumers.delete(consumer.producerId);
            if (isBrowser) {
                window.dispatchEvent(new CustomEvent('producerClosed', { detail: { producerId: consumer.producerId } }));
            }
        });

        consumer.track.onended = () => {
            console.log(`Consumer track for producer ${consumer.producerId} ended.`);
        };

        console.log(`Consumer created with ID: ${consumer.id} for producer: ${producerId}`);
        return consumer;

    } catch (error) {
        console.error('Error creating consumer:', error);
        handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.createConsumer', producerId, kind });
        throw error;
    }
  }

  async resumeConsumer(consumerId: string) {
    if (!this.state.socket || !isBrowser) return;

    try {
        const consumer = this.state.consumers.get(consumerId);
        if (!consumer) {
            console.warn(`Consumer with id ${consumerId} not found.`);
            return;
        }

        await this.request('resumeConsumer', { consumerId: consumer.id });
        console.log(`Resumed consumer ${consumerId}`);
    } catch (error) {
        console.error(`Error resuming consumer ${consumerId}:`, error);
        handleError(error instanceof Error ? error : new Error(String(error)), { action: 'MediaSoupService.resumeConsumer', consumerId });
        throw error;
    }
  }

  private request(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!this.state.socket) {
            reject(new Error('Socket not initialized'));
            return;
        }
        console.log(`Sending socket request: ${event}`, data);
        this.state.socket.emit(event, data, (response: any) => {
            console.log(`Received socket response for ${event}:`, response);
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response);
            }
        });
    });
  }

  cleanup() {
    console.log('Cleaning up MediaSoupService');
    // Close producers
    this.state.producers.forEach(producer => producer.close());
    this.state.producers.clear();
    // Close consumers
    this.state.consumers.forEach(consumer => consumer.close());
    this.state.consumers.clear();
    // Close transports
    if (this.state.sendTransport) {
        this.state.sendTransport.close();
        this.state.sendTransport = null;
    }
     if (this.state.recvTransport) {
        this.state.recvTransport.close();
        this.state.recvTransport = null;
     }
    // Disconnect socket
    if (this.state.socket) {
      this.state.socket.disconnect(); // Use disconnect for clean shutdown
      this.state.socket = null;
    }
    this.state.device = null; // Reset device
    this.state.screenShareProducer = null;
    this.state.cameraVideoTrack = null;
  }
} 