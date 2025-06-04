import { NextApiRequest, NextApiResponse } from 'next';
import { createRedisClient } from '../../../lib/redis';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
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
    if (!room.routerRtpCapabilities) {
      return res.status(404).json({ error: 'Router RTP capabilities not found' });
    }

    return res.status(200).json({ routerRtpCapabilities: room.routerRtpCapabilities });
  } catch (error) {
    console.error('Error getting router RTP capabilities:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 