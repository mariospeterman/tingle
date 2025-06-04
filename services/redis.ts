import { createClient, RedisClientType } from 'redis';
import { config } from '../utils/config';

interface QueueEntry {
  preferences: any;
  timestamp: number;
}

interface MatchEntry {
  users: string[];
  roomId: string;
  timestamp: number;
}

export class RedisService {
  private client: RedisClientType;
  private subscriber: RedisClientType;
  private isConnected: boolean = false;
  private static instance: RedisService;

  private constructor() {
    if (!config.redis.url) {
      throw new Error('Redis URL is not configured. Please set NEXT_PUBLIC_REDIS_URL in your environment variables.');
    }

    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis connection lost. Max retries reached.');
            return new Error('Max retries reached');
          }
          return Math.min(retries * 100, 3000);
        },
        keepAlive: true,
        noDelay: true
      }
    });

    this.subscriber = this.client.duplicate();

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    this.subscriber.on('connect', () => console.log('Redis Subscriber Connected'));
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  async connect() {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        await this.subscriber.connect();
        console.log('Redis connection established');
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  async disconnect() {
    if (this.isConnected) {
      try {
        await this.client.disconnect();
        await this.subscriber.disconnect();
        this.isConnected = false;
        console.log('Redis connection closed');
      } catch (error) {
        console.error('Error disconnecting from Redis:', error);
        throw error;
      }
    }
  }

  // Matchmaking queue operations
  async addToMatchmakingQueue(userId: string, preferences: any) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    const entry: QueueEntry = {
      preferences,
      timestamp: Date.now(),
    };

    await this.client.hSet('matchmaking:queue', userId, JSON.stringify(entry));
  }

  async removeFromMatchmakingQueue(userId: string) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    await this.client.hDel('matchmaking:queue', userId);
  }

  async getMatchmakingQueue(): Promise<Array<{ userId: string } & QueueEntry>> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    const queue = await this.client.hGetAll('matchmaking:queue');
    return Object.entries(queue).map(([userId, data]) => ({
      userId,
      ...JSON.parse(data as string) as QueueEntry,
    }));
  }

  // Active matches operations
  async addActiveMatch(matchId: string, users: string[], roomId: string) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    const entry: MatchEntry = {
      users,
      roomId,
      timestamp: Date.now(),
    };

    await this.client.hSet('matches:active', matchId, JSON.stringify(entry));
  }

  async removeActiveMatch(matchId: string) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    await this.client.hDel('matches:active', matchId);
  }

  async getActiveMatches(): Promise<Array<{ matchId: string } & MatchEntry>> {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    const matches = await this.client.hGetAll('matches:active');
    return Object.entries(matches).map(([matchId, data]) => ({
      matchId,
      ...JSON.parse(data as string) as MatchEntry,
    }));
  }

  // Pub/Sub operations
  async publish(channel: string, message: any) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    await this.subscriber.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        console.error('Error parsing Redis message:', error);
      }
    });
  }

  async unsubscribe(channel: string) {
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    await this.subscriber.unsubscribe(channel);
  }
}

// Create a singleton instance
export const redisService = RedisService.getInstance(); 