import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import * as mediasoup from 'mediasoup';
import { createRedisClient } from './lib/redis.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Mediasoup configuration
const config = {
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 10000,
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 10100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
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

// Store active rooms and users
const rooms = new Map();
const users = new Map();
let worker;
let router;

// Initialize mediasoup
async function initializeMediaSoup() {
  try {
    worker = await mediasoup.createWorker({
      logLevel: config.worker.logLevel,
      logTags: config.worker.logTags,
      rtcMinPort: config.worker.rtcMinPort,
      rtcMaxPort: config.worker.rtcMaxPort,
    });

    router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
    console.log('MediaSoup worker and router created');
  } catch (error) {
    console.error('Error initializing MediaSoup:', error);
    throw error;
  }
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  // Send router RTP capabilities to the client
  socket.emit('routerRtpCapabilities', router.rtpCapabilities);

  // Handle WebRTC transport creation
  socket.on('createWebRtcTransport', async (callback) => {
    try {
      const transport = await router.createWebRtcTransport(config.webRtcTransport);
      
      transport.observer.on('close', () => {
        console.log('transport closed', transport.id);
      });

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      });
    } catch (error) {
      console.error('Error creating WebRTC transport:', error);
      callback({ error: error.message });
    }
  });

  // Handle transport connection
  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      const transport = router.transports.get(transportId);
      if (!transport) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (error) {
      console.error('Error connecting transport:', error);
      callback({ error: error.message });
    }
  });

  // Handle producer creation
  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
    try {
      const transport = router.transports.get(transportId);
      if (!transport) {
        throw new Error(`Transport not found: ${transportId}`);
      }

      const producer = await transport.produce({ kind, rtpParameters });
      callback({ id: producer.id });

      producer.observer.on('close', () => {
        console.log('producer closed', producer.id);
      });
    } catch (error) {
      console.error('Error creating producer:', error);
      callback({ error: error.message });
    }
  });

  // Handle consumer creation
  socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const transport = router.transports.get(transportId);
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

      callback({
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerId: consumer.producerId,
      });

      consumer.observer.on('close', () => {
        console.log('consumer closed', consumer.id);
      });
    } catch (error) {
      console.error('Error creating consumer:', error);
      callback({ error: error.message });
    }
  });

  // Handle consumer resume
  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const consumer = router.consumers.get(consumerId);
      if (!consumer) {
        throw new Error(`Consumer not found: ${consumerId}`);
      }

      await consumer.resume();
      callback({ success: true });
    } catch (error) {
      console.error('Error resuming consumer:', error);
      callback({ error: error.message });
    }
  });

  // Handle matchmaking
  socket.on('startMatching', ({ userId, preferences }) => {
    try {
      // Find or create a room
      let roomId = null;
      for (const [id, room] of rooms.entries()) {
        if (room.users.size === 1) {
          roomId = id;
          break;
        }
      }

      if (!roomId) {
        roomId = uuidv4();
        rooms.set(roomId, {
          users: new Map(),
        });
      }

      // Add user to room
      const room = rooms.get(roomId);
      room.users.set(socket.id, { userId, socket });

      // Notify users
      if (room.users.size === 2) {
        const roomUsers = Array.from(room.users.values());
        const [user1, user2] = roomUsers;
        
        // Notify both users about the match
        user1.socket.emit('matchFound', {
          roomId,
          matchedUserId: user2.userId,
        });
        user2.socket.emit('matchFound', {
          roomId,
          matchedUserId: user1.userId,
        });
      }
    } catch (error) {
      console.error('Error in matchmaking:', error);
      socket.emit('matchError', { message: 'Failed to find match' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up rooms and notify peers
    for (const [roomId, room] of rooms.entries()) {
      const user = room.users.get(socket.id);
      if (user) {
        room.users.delete(socket.id);
        
        // Notify other users
        for (const peer of room.users.values()) {
          peer.socket.emit('userLeft', { userId: user.userId });
        }

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

// Initialize MediaSoup and start server
initializeMediaSoup().then(() => {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize MediaSoup:', error);
  process.exit(1);
}); 