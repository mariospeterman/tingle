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
    const { roomId, transportId, kind, rtpParameters } = req.body;
    if (!roomId || !transportId || !kind || !rtpParameters) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const redis = await createRedisClient();
    const roomData = await redis.get(`room:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = JSON.parse(roomData);
    const transportData = room.transports?.[transportId];
    if (!transportData) {
      return res.status(404).json({ error: 'Transport not found' });
    }

    const worker = await createMediaSoupWorker();
    const router = await worker.createRouter({ mediaCodecs: room.mediaCodecs });
    const transport = await router.createWebRtcTransport({
      id: transportId,
    });

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    // Store the producer in Redis
    if (!room.producers) {
      room.producers = {};
    }
    room.producers[producer.id] = {
      id: producer.id,
      transportId,
      kind,
    };
    await redis.set(`room:${roomId}`, JSON.stringify(room));

    return res.status(200).json({
      id: producer.id,
    });
  } catch (error) {
    console.error('Error producing:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 