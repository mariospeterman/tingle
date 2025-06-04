import * as mediasoup from 'mediasoup';

type Worker = mediasoup.types.Worker;
type Router = mediasoup.types.Router;
type WebRtcTransport = mediasoup.types.WebRtcTransport;
type Producer = mediasoup.types.Producer;
type Consumer = mediasoup.types.Consumer;
type MediaKind = mediasoup.types.MediaKind;
type AppData = mediasoup.types.AppData;
type WorkerLogLevel = mediasoup.types.WorkerLogLevel;
type WorkerLogTag = mediasoup.types.WorkerLogTag;

interface TransportAppData extends AppData {
  roomId: string;
}

const workers: Worker[] = [];
const routers: Map<string, Router> = new Map();
const transports: Map<string, WebRtcTransport> = new Map();
const producers: Map<string, Producer> = new Map();
const consumers: Map<string, Consumer> = new Map();

const MEDIASOUP_CONFIG = {
  worker: {
    logLevel: 'warn' as WorkerLogLevel,
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'] as WorkerLogTag[],
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '10000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '10100'),
    workerBin: process.env.MEDIASOUP_WORKER_BIN || undefined,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio' as MediaKind,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1
        }
      },
      {
        kind: 'video' as MediaKind,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
          'x-google-min-bitrate': 500,
          'x-google-max-bitrate': 3000
        }
      },
      {
        kind: 'video' as MediaKind,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1
        }
      }
    ]
  }
};

export const initializeWorkers = async () => {
  const numWorkers = process.env.MEDIASOUP_NUM_WORKERS ? parseInt(process.env.MEDIASOUP_NUM_WORKERS) : 1;

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(MEDIASOUP_CONFIG.worker);

    worker.on('died', () => {
      console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }

  return workers;
};

export const createRouter = async (roomId: string) => {
  const worker = workers[Math.floor(Math.random() * workers.length)];
  const router = await worker.createRouter(MEDIASOUP_CONFIG.router);

  routers.set(roomId, router);
  return router;
};

export const createWebRtcTransport = async (roomId: string) => {
  const router = routers.get(roomId);
  if (!router) {
    throw new Error('Router not found for room: ' + roomId);
  }

  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || process.env.SFU_PUBLIC_IP,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    numSctpStreams: { OS: 1024, MIS: 1024 },
    appData: { roomId } as TransportAppData,
  });

  transports.set(transport.id, transport);
  return transport;
};

export const createProducer = async (transportId: string, kind: MediaKind, rtpParameters: any) => {
  const transport = transports.get(transportId);
  if (!transport) {
    throw new Error('Transport not found: ' + transportId);
  }

  const producer = await transport.produce({
    kind,
    rtpParameters,
  });

  producers.set(producer.id, producer);
  return producer;
};

export const createConsumer = async (
  transportId: string,
  producerId: string,
  rtpCapabilities: any
) => {
  const transport = transports.get(transportId);
  if (!transport) {
    throw new Error('Transport not found: ' + transportId);
  }

  const producer = producers.get(producerId);
  if (!producer) {
    throw new Error('Producer not found: ' + producerId);
  }

  const appData = transport.appData as unknown as TransportAppData;
  const router = routers.get(appData.roomId);
  if (!router) {
    throw new Error('Router not found for transport');
  }

  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Cannot consume this producer');
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true,
  });

  consumers.set(consumer.id, consumer);
  return consumer;
};

export const getRouterRtpCapabilities = (roomId: string) => {
  const router = routers.get(roomId);
  if (!router) {
    throw new Error('Router not found for room: ' + roomId);
  }
  return router.rtpCapabilities;
};

export const closeTransport = (transportId: string) => {
  const transport = transports.get(transportId);
  if (transport) {
    transport.close();
    transports.delete(transportId);
  }
};

export const closeProducer = (producerId: string) => {
  const producer = producers.get(producerId);
  if (producer) {
    producer.close();
    producers.delete(producerId);
  }
};

export const closeConsumer = (consumerId: string) => {
  const consumer = consumers.get(consumerId);
  if (consumer) {
    consumer.close();
    consumers.delete(consumerId);
  }
};

export const closeRouter = (roomId: string) => {
  const router = routers.get(roomId);
  if (router) {
    router.close();
    routers.delete(roomId);
  }
}; 