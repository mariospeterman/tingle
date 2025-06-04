import * as mediasoup from 'mediasoup';
import { createRedisClient } from './redis.js';

const config = {
  // Worker settings
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 10000,
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 10100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  // Router settings
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  },
  // WebRtcTransport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
};

let worker;
let router;
const producers = new Map();
const consumers = new Map();
const transports = new Map();

export async function initializeMediaSoup() {
  try {
    // Create a Worker
    worker = await mediasoup.createWorker({
      logLevel: config.worker.logLevel,
      logTags: config.worker.logTags,
      rtcMinPort: config.worker.rtcMinPort,
      rtcMaxPort: config.worker.rtcMaxPort,
    });

    console.log('mediasoup worker created');

    // Create a Router
    router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
    console.log('mediasoup router created');

    return { worker, router };
  } catch (error) {
    console.error('Error initializing MediaSoup:', error);
    throw error;
  }
}

export async function createWebRtcTransport(socketId) {
  try {
    const transport = await router.createWebRtcTransport(config.webRtcTransport);
    console.log('transport created', transport.id);

    transport.observer.on('close', () => {
      console.log('transport closed', transport.id);
      transports.delete(transport.id);
    });

    transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  } catch (error) {
    console.error('Error creating WebRTC transport:', error);
    throw error;
  }
}

export async function connectTransport(transportId, dtlsParameters) {
  try {
    const transport = transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    await transport.connect({ dtlsParameters });
    console.log('transport connected', transportId);
  } catch (error) {
    console.error('Error connecting transport:', error);
    throw error;
  }
}

export async function produce(transportId, kind, rtpParameters) {
  try {
    const transport = transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = await transport.produce({ kind, rtpParameters });
    console.log('producer created', producer.id);

    producer.observer.on('close', () => {
      console.log('producer closed', producer.id);
      producers.delete(producer.id);
    });

    producers.set(producer.id, producer);

    return { id: producer.id };
  } catch (error) {
    console.error('Error creating producer:', error);
    throw error;
  }
}

export async function consume(transportId, producerId, rtpCapabilities) {
  try {
    const transport = transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume this producer');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    console.log('consumer created', consumer.id);

    consumer.observer.on('close', () => {
      console.log('consumer closed', consumer.id);
      consumers.delete(consumer.id);
    });

    consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerId: consumer.producerId,
    };
  } catch (error) {
    console.error('Error creating consumer:', error);
    throw error;
  }
}

export async function resumeConsumer(consumerId) {
  try {
    const consumer = consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }

    await consumer.resume();
    console.log('consumer resumed', consumerId);
  } catch (error) {
    console.error('Error resuming consumer:', error);
    throw error;
  }
}

export async function closeTransport(transportId) {
  try {
    const transport = transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    transport.close();
    console.log('transport closed', transportId);
  } catch (error) {
    console.error('Error closing transport:', error);
    throw error;
  }
}

export async function getRouterRtpCapabilities() {
  return router.rtpCapabilities;
} 