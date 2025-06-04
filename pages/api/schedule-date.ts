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
    const { roomId, matchedUserId, date } = req.body;
    const userId = req.headers['x-user-id'] as string;

    // Get the match from Supabase
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .or(`user1_id.eq.${matchedUserId},user2_id.eq.${matchedUserId}`)
      .eq('status', 'matched')
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Update the match with the scheduled date
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        scheduled_date: date,
        status: 'scheduled',
      })
      .eq('id', match.id);

    if (updateError) throw updateError;

    // Notify both users about the scheduled date
    const redis = await createRedisClient();
    await redis.publish(`user:${userId}:events`, JSON.stringify({
      type: 'date_scheduled',
      matchId: match.id,
      date,
    }));

    await redis.publish(`user:${matchedUserId}:events`, JSON.stringify({
      type: 'date_scheduled',
      matchId: match.id,
      date,
    }));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error scheduling date:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 