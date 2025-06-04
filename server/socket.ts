import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import { initializeWorkers, createRouter, createWebRtcTransport, createProducer, createConsumer, getRouterRtpCapabilities } from './mediasoup';

// Matchmaking queue
const matchmakingQueue: Map<string, {
  socket: any;
  preferences: any;
  timestamp: number;
}> = new Map();

// Active matches
const activeMatches: Map<string, {
  users: string[];
  roomId: string;
}> = new Map();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Initialize MediaSoup workers
initializeWorkers().catch(console.error);

io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  const { userId, preferences } = socket.handshake.query;
  if (!userId) {
    socket.disconnect();
    return;
  }

  // Handle matchmaking
  socket.on('startMatching', () => {
    const userPreferences = JSON.parse(preferences as string);
    matchmakingQueue.set(socket.id, {
      socket,
      preferences: userPreferences,
      timestamp: Date.now(),
    });
    findMatch(socket.id);
  });

  socket.on('stopMatching', () => {
    matchmakingQueue.delete(socket.id);
  });

  socket.on('skipMatch', (matchId) => {
    const match = activeMatches.get(matchId);
    if (match) {
      match.users.forEach(userId => {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) {
          userSocket.emit('matchEnded');
          userSocket.leave(match.roomId);
        }
      });
      activeMatches.delete(matchId);
    }
  });

  socket.on('reportUser', ({ userId, reason }) => {
    // Handle user reporting
    console.log(`User ${socket.id} reported ${userId} for: ${reason}`);
    // Implement reporting logic here
  });

  // Handle MediaSoup room creation and joining
  socket.on('joinRoom', async ({ roomId }, callback) => {
    try {
      socket.join(roomId);
      const router = await createRouter(roomId);
      const rtpCapabilities = router.rtpCapabilities;
      callback({ rtpCapabilities });
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ error: 'Failed to join room' });
    }
  });

  // Handle transport creation
  socket.on('createTransport', async ({ roomId }, callback) => {
    try {
      const transport = await createWebRtcTransport(roomId);
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      console.error('Error creating transport:', error);
      callback({ error: 'Failed to create transport' });
    }
  });

  // Handle transport connection
  socket.on('connectTransport', async ({ roomId, transportId, dtlsParameters }, callback) => {
    try {
      const transport = await createWebRtcTransport(roomId);
      await transport.connect({ dtlsParameters });
      callback();
    } catch (error) {
      console.error('Error connecting transport:', error);
      callback({ error: 'Failed to connect transport' });
    }
  });

  // Handle producer creation
  socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
    try {
      const producer = await createProducer(transportId, kind, rtpParameters);
      callback({ id: producer.id });
    } catch (error) {
      console.error('Error creating producer:', error);
      callback({ error: 'Failed to create producer' });
    }
  });

  // Handle consumer creation
  socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
    try {
      const consumer = await createConsumer(transportId, producerId, rtpCapabilities);
      callback({
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerId: consumer.producerId,
      });
    } catch (error) {
      console.error('Error creating consumer:', error);
      callback({ error: 'Failed to create consumer' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    matchmakingQueue.delete(socket.id);
    
    // Clean up active matches
    for (const [matchId, match] of activeMatches.entries()) {
      if (match.users.includes(socket.id)) {
        match.users.forEach(userId => {
          const userSocket = io.sockets.sockets.get(userId);
          if (userSocket) {
            userSocket.emit('matchEnded');
            userSocket.leave(match.roomId);
          }
        });
        activeMatches.delete(matchId);
      }
    }
  });
});

function findMatch(userId: string) {
  const user = matchmakingQueue.get(userId);
  if (!user) return;

  for (const [otherId, otherUser] of matchmakingQueue.entries()) {
    if (otherId === userId) continue;

    if (isCompatible(user.preferences, otherUser.preferences)) {
      // Create a match
      const matchId = `${userId}-${otherId}`;
      const roomId = `room-${matchId}`;

      activeMatches.set(matchId, {
        users: [userId, otherId],
        roomId,
      });

      // Remove both users from queue
      matchmakingQueue.delete(userId);
      matchmakingQueue.delete(otherId);

      // Notify both users
      user.socket.emit('matchFound', matchId);
      otherUser.socket.emit('matchFound', matchId);

      break;
    }
  }
}

function isCompatible(prefs1: any, prefs2: any): boolean {
  // Check if users are looking for each other's gender
  const genderMatch1 = prefs1.lookingFor === 'all' || prefs1.lookingFor === prefs2.gender;
  const genderMatch2 = prefs2.lookingFor === 'all' || prefs2.lookingFor === prefs1.gender;

  // Check age range compatibility
  const ageMatch1 = prefs1.ageRange.min <= prefs2.ageRange.max && prefs1.ageRange.max >= prefs2.ageRange.min;
  const ageMatch2 = prefs2.ageRange.min <= prefs1.ageRange.max && prefs2.ageRange.max >= prefs1.ageRange.min;

  return genderMatch1 && genderMatch2 && ageMatch1 && ageMatch2;
}

const port = process.env.PORT || 3001;
httpServer.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
}); 