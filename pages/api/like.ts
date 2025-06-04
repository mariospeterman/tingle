import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createRedisClient } from '../../lib/redis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomId } = req.body;
    const redis = await createRedisClient();

    // Get the room data from Redis
    const roomData = await redis.get(`room:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = JSON.parse(roomData);
    const { userId } = req.headers['x-user-id'] as string;

    // Add the like to the room
    if (!room.likes) {
      room.likes = [];
    }
    room.likes.push(userId);

    // Check if it's a mutual like
    const otherUserId = room.users.find((id: string) => id !== userId);
    const isMatch = room.likes.includes(otherUserId);

    // Update the room in Redis
    await redis.set(`room:${roomId}`, JSON.stringify(room));

    // If it's a match, create a match record in Supabase
    if (isMatch) {
      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          user1_id: userId,
          user2_id: otherUserId,
          status: 'matched',
          match_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Notify both users about the match
      await redis.publish(`user:${userId}:events`, JSON.stringify({
        type: 'match',
        matchId: match.id,
        matchedUserId: otherUserId,
      }));

      await redis.publish(`user:${otherUserId}:events`, JSON.stringify({
        type: 'match',
        matchId: match.id,
        matchedUserId: userId,
      }));
    }

    return res.status(200).json({ success: true, isMatch });
  } catch (error) {
    console.error('Error handling like:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 