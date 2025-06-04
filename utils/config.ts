export type Environment = 'development' | 'staging' | 'production';

export type Config = {
  environment: Environment;
  telegram: {
    botToken: string;
    botUsername: string;
  };
  ton: {
    network: 'mainnet' | 'testnet';
    apiKey: string;
    commission: number;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  mediasoup: {
    serverUrl: string;
    iceServers: RTCIceServer[];
  };
  redis: {
    url: string;
    password?: string;
  };
};

const requiredEnvVars = [
  'NEXT_PUBLIC_TELEGRAM_BOT_TOKEN',
  'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME',
  'NEXT_PUBLIC_TON_NETWORK',
  'NEXT_PUBLIC_TON_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_MEDIASOUP_SERVER_URL',
  'NEXT_PUBLIC_REDIS_URL',
] as const;

function validateEnvVars() {
  const environment = (process.env.NODE_ENV || 'development') as Environment;
  
  // Skip validation in development mode
  if (environment === 'development') {
    return;
  }

  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

export function getConfig(): Config {
  validateEnvVars();

  const environment = (process.env.NODE_ENV || 'development') as Environment;

  return {
    environment,
    telegram: {
      botToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || 'dummy-token',
      botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'dummy-bot',
    },
    ton: {
      network: (process.env.NEXT_PUBLIC_TON_NETWORK || 'testnet') as 'mainnet' | 'testnet',
      apiKey: process.env.NEXT_PUBLIC_TON_API_KEY || 'dummy-key',
      commission: 0.1, // 10% commission
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key',
    },
    mediasoup: {
      serverUrl: process.env.NEXT_PUBLIC_MEDIASOUP_SERVER_URL || 'http://localhost:3001',
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
          ],
        },
      ],
    },
    redis: {
      url: process.env.NEXT_PUBLIC_REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
    },
  };
}

export const config = getConfig();

export function isDevelopment(): boolean {
  return config.environment === 'development';
}

export function isStaging(): boolean {
  return config.environment === 'staging';
}

export function isProduction(): boolean {
  return config.environment === 'production';
}

export function getApiUrl(): string {
  switch (config.environment) {
    case 'development':
      return 'http://localhost:3000/api';
    case 'staging':
      return 'https://staging-api.tingle.app/api';
    case 'production':
      return 'https://api.tingle.app/api';
    default:
      return 'http://localhost:3000/api';
  }
}

export function getWebSocketUrl(): string {
  switch (config.environment) {
    case 'development':
      return 'ws://localhost:3000/ws';
    case 'staging':
      return 'wss://staging-ws.tingle.app/ws';
    case 'production':
      return 'wss://ws.tingle.app/ws';
    default:
      return 'ws://localhost:3000/ws';
  }
} 