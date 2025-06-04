import * as mediasoup from 'mediasoup';
import { redisService } from '../services/redis';
import { getSupabaseClient } from '../services/supabase';

async function checkServices() {
  // Check MediaSoup workers
  const worker = await mediasoup.createWorker({
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
  
  if (!worker) {
    throw new Error('Failed to create MediaSoup worker');
  }
  
  // Check Redis connection
  await redisService.connect();
  
  // Check Supabase connection
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('users').select('count').limit(1);
  if (error) throw error;
  
  // Check WebRTC connectivity
  // Add WebRTC connectivity test
}
