import { createClient } from 'redis';

export function createRedisClient() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  client.on('error', (err) => console.error('Redis Client Error:', err));
  client.on('connect', () => console.log('Redis Client Connected'));

  return client;
} 