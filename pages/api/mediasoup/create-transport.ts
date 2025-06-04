import { NextApiRequest, NextApiResponse } from 'next';
import { createWebRtcTransport } from '../../../server/mediasoup';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const transport = await createWebRtcTransport(roomId);
    return res.status(200).json({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    });
  } catch (error) {
    console.error('Error creating transport:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 