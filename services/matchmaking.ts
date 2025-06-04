import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';

export interface UserPreferences {
  isMuted?: boolean;
  isVideoOff?: boolean;
  language?: string;
  interests?: string[];
  gender?: 'male' | 'female' | 'any';
  lookingFor?: 'male' | 'female' | 'any';
  ageRange?: { min: number; max: number };
  wallet_address?: string | null;
}

interface MatchmakingConfig {
  serverUrl: string;
  userId: string;
  preferences: UserPreferences;
}

export class MatchmakingService {
  private socket: Socket | null = null;
  private config: MatchmakingConfig;
  private isInitialized: boolean = false;
  private matchTimeout: NodeJS.Timeout | null = null;

  constructor(config: MatchmakingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Matchmaking service already initialized');
      return;
    }

    try {
      console.log('Initializing matchmaking service...');
      this.socket = io(this.config.serverUrl, {
        query: {
          userId: this.config.userId,
          preferences: JSON.stringify(this.config.preferences),
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.setupSocketHandlers();
      this.isInitialized = true;
      console.log('Matchmaking service initialized successfully');
    } catch (error) {
      console.error('Error initializing matchmaking service:', error);
      throw error;
    }
  }

  async startMatching(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    try {
      console.log('Starting matchmaking...');
      this.socket.emit('startMatching');
      
      // Set a timeout for matchmaking
      this.matchTimeout = setTimeout(() => {
        console.log('Matchmaking timeout reached');
        this.stopMatching();
      }, 30000); // 30 seconds timeout

      console.log('Matchmaking started successfully');
    } catch (error) {
      console.error('Error starting matchmaking:', error);
      throw error;
    }
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to matchmaking server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from matchmaking server');
      this.cleanup();
    });

    this.socket.on('matchFound', ({ roomId, matchedUserId }) => {
      console.log(`Match found! Room: ${roomId}, Matched with: ${matchedUserId}`);
      
      // Clear the matchmaking timeout
      if (this.matchTimeout) {
        clearTimeout(this.matchTimeout);
        this.matchTimeout = null;
      }

      // Update store with match information
      useStore.getState().setCurrentRoom(roomId);
      useStore.getState().setMatchedUser(matchedUserId);
    });

    this.socket.on('matchError', (error) => {
      console.error('Matchmaking error:', error);
      this.cleanup();
    });

    this.socket.on('userLeft', ({ userId }) => {
      console.log(`User ${userId} left the room`);
      useStore.getState().setCurrentRoom(null);
      useStore.getState().setMatchedUser(null);
    });
  }

  async stopMatching(): Promise<void> {
    if (!this.socket) {
      console.warn('No active matchmaking to stop');
      return;
    }

    try {
      console.log('Stopping matchmaking...');
      this.socket.emit('stopMatching');
      
      // Clear the matchmaking timeout
      if (this.matchTimeout) {
        clearTimeout(this.matchTimeout);
        this.matchTimeout = null;
      }

      console.log('Matchmaking stopped successfully');
    } catch (error) {
      console.error('Error stopping matchmaking:', error);
      throw error;
    }
  }

  cleanup(): void {
    if (this.matchTimeout) {
      clearTimeout(this.matchTimeout);
      this.matchTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isInitialized = false;
  }
} 