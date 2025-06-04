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
    const { roomId, consumerId } = req.body;
    if (!roomId || !consumerId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const redis = await createRedisClient();
    const roomData = await redis.get(`room:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = JSON.parse(roomData);
    const consumerData = room.consumers?.[consumerId];
    if (!consumerData) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const worker = await createMediaSoupWorker();
    const router = await worker.createRouter({ mediaCodecs: room.mediaCodecs });
    const transport = await router.createWebRtcTransport({
      id: consumerData.transportId,
    });

    const consumer = await transport.consume({
      id: consumerId,
      producerId: consumerData.producerId,
    });

    await consumer.resume();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error resuming consumer:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 