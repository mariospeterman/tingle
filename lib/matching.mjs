import { createRedisClient } from './redis.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Redis key patterns
const MATCHING_POOL = 'matching_pool';
const USER_STATUS = 'user:status:';
const USER_PREFERENCES = 'user:preferences:';
const ACTIVE_CALLS = 'active_calls';

export async function startMatching(userId) {
  const redis = createRedisClient();
  
  try {
    // Get user preferences from Supabase
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('matching_preferences')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Update user status in Redis
    await redis.hset(USER_STATUS + userId, {
      status: 'searching',
      preferences: JSON.stringify(profile.matching_preferences),
      timestamp: Date.now()
    });

    // Add user to matching pool
    await redis.sadd(MATCHING_POOL, userId);

    // Try to find an immediate match
    const matchedUserId = await findMatch(userId, profile.matching_preferences);
    
    if (matchedUserId) {
      // Match found immediately
      await createMatch(userId, matchedUserId);
      return matchedUserId;
    }
    
    return null;
  } catch (error) {
    console.error('Error in matching:', error);
    throw error;
  }
}

async function findMatch(userId, preferences) {
  const redis = createRedisClient();
  
  try {
    // Get all users in matching pool
    const matchingPool = await redis.smembers(MATCHING_POOL);
    
    // Filter out self and users in calls
    const availableUsers = matchingPool.filter(id => id !== userId);
    
    // Get status of all available users
    const userStatuses = await Promise.all(
      availableUsers.map(async (id) => {
        const status = await redis.hgetall(USER_STATUS + id);
        return { id, ...status };
      })
    );

    // Filter users by preferences and status
    const potentialMatches = userStatuses.filter(user => {
      if (user.status !== 'searching') return false;
      
      const userPrefs = JSON.parse(user.preferences);
      
      // Check gender preferences
      if (preferences.looking_for && userPrefs.gender !== preferences.looking_for) return false;
      if (userPrefs.looking_for && preferences.gender !== userPrefs.looking_for) return false;
      
      return true;
    });

    if (potentialMatches.length > 0) {
      // Select a random match
      const match = potentialMatches[Math.floor(Math.random() * potentialMatches.length)];
      
      // Remove both users from matching pool
      await redis.srem(MATCHING_POOL, userId);
      await redis.srem(MATCHING_POOL, match.id);
      
      // Update user statuses
      await redis.hset(USER_STATUS + userId, 'status', 'in_call');
      await redis.hset(USER_STATUS + match.id, 'status', 'in_call');
      
      // Add to active calls
      await redis.sadd(ACTIVE_CALLS, `${userId}:${match.id}`);
      
      return match.id;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding match:', error);
    throw error;
  }
}

async function createMatch(user1Id, user2Id) {
  try {
    // Create match record in Supabase
    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        user1_id: user1Id,
        user2_id: user2Id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update user stats
    await Promise.all([
      supabase.rpc('increment_total_matches', { user_id: user1Id }),
      supabase.rpc('increment_total_matches', { user_id: user2Id })
    ]);

    return match;
  } catch (error) {
    console.error('Error creating match:', error);
    throw error;
  }
}

export async function stopMatching(userId) {
  const redis = createRedisClient();
  
  try {
    // Get user's current status
    const status = await redis.hgetall(USER_STATUS + userId);
    
    if (status.status === 'in_call') {
      // Find the active call
      const activeCalls = await redis.smembers(ACTIVE_CALLS);
      const call = activeCalls.find(c => c.includes(userId));
      
      if (call) {
        const [user1Id, user2Id] = call.split(':');
        const otherUserId = user1Id === userId ? user2Id : user1Id;
        
        // End the match in Supabase
        await supabase
          .from('matches')
          .update({
            ended_at: new Date().toISOString(),
            duration: Math.floor((Date.now() - new Date(status.timestamp).getTime()) / 1000)
          })
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .is('ended_at', null);

        // Remove from active calls
        await redis.srem(ACTIVE_CALLS, call);
        
        // Update other user's status
        await redis.hset(USER_STATUS + otherUserId, 'status', 'searching');
        
        // Try to find a new match for the other user
        const otherUserPrefs = JSON.parse(await redis.hget(USER_STATUS + otherUserId, 'preferences'));
        const newMatch = await findMatch(otherUserId, otherUserPrefs);
        
        if (newMatch) {
          // Notify other user of new match
          await redis.publish(`match:${otherUserId}`, JSON.stringify(newMatch));
        }
      }
    }
    
    // Remove user from matching pool and clear status
    await redis.srem(MATCHING_POOL, userId);
    await redis.del(USER_STATUS + userId);
  } catch (error) {
    console.error('Error stopping matching:', error);
    throw error;
  }
}

export async function subscribeToMatches(userId, callback) {
  const redis = createRedisClient();
  const subscriber = redis.duplicate();
  
  try {
    await subscriber.subscribe(`match:${userId}`, (message) => {
      const matchedUserId = JSON.parse(message);
      callback(matchedUserId);
    });
    
    return subscriber;
  } catch (error) {
    console.error('Error subscribing to matches:', error);
    throw error;
  }
}

export async function likeUser(likerId, likedId) {
  try {
    // Create like record
    const { error } = await supabase
      .from('likes')
      .insert({
        liker_id: likerId,
        liked_id: likedId
      });

    if (error) throw error;

    // Check for mutual like
    const { data: mutualLike, error: checkError } = await supabase
      .from('likes')
      .select()
      .eq('liker_id', likedId)
      .eq('liked_id', likerId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') throw checkError;

    if (mutualLike) {
      // Update match record to indicate mutual like
      await supabase
        .from('matches')
        .update({ mutual_like: true })
        .or(`user1_id.eq.${likerId},user2_id.eq.${likerId}`)
        .or(`user1_id.eq.${likedId},user2_id.eq.${likedId}`)
        .is('ended_at', null);
    }

    return { mutualLike: !!mutualLike };
  } catch (error) {
    console.error('Error liking user:', error);
    throw error;
  }
} 