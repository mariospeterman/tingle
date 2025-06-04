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
    const { roomId, transportId, producerId, rtpCapabilities } = req.body;
    if (!roomId || !transportId || !producerId || !rtpCapabilities) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const redis = await createRedisClient();
    const roomData = await redis.get(`room:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = JSON.parse(roomData);
    const transportData = room.transports?.[transportId];
    const producerData = room.producers?.[producerId];
    if (!transportData || !producerData) {
      return res.status(404).json({ error: 'Transport or producer not found' });
    }

    const worker = await createMediaSoupWorker();
    const router = await worker.createRouter({ mediaCodecs: room.mediaCodecs });
    const transport = await router.createWebRtcTransport({
      id: transportId,
    });

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      return res.status(400).json({ error: 'Cannot consume this producer' });
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    // Store the consumer in Redis
    if (!room.consumers) {
      room.consumers = {};
    }
    room.consumers[consumer.id] = {
      id: consumer.id,
      transportId,
      producerId,
    };
    await redis.set(`room:${roomId}`, JSON.stringify(room));

    return res.status(200).json({
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  } catch (error) {
    console.error('Error consuming:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 