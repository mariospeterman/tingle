import { NextApiRequest, NextApiResponse } from 'next';
import { createRedisClient } from '../../../lib/redis';
import { createMediaSoupWorker } from '../../../server/mediasoup';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    const redis = await createRedisClient();
    const roomData = await redis.get(`room:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = JSON.parse(roomData);
    const worker = await createMediaSoupWorker();
    const router = await worker.createRouter({ mediaCodecs: room.mediaCodecs });

    const transport = await router.createWebRtcTransport({
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    // Store the transport in Redis
    if (!room.transports) {
      room.transports = {};
    }
    room.transports[transport.id] = {
      id: transport.id,
      routerId: router.id,
      direction: 'send',
    };
    await redis.set(`room:${roomId}`, JSON.stringify(room));

    return res.status(200).json({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  } catch (error) {
    console.error('Error creating send transport:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 