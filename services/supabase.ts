import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UserPreferences } from './matchmaking'; // Import UserPreferences from matchmaking
import supabase from '../lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

// Singleton instances
let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

// Create Supabase client with retry configuration
export const getSupabaseClient = () => {
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const headers = {
    'x-application-name': 'tingle',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  console.log('Supabase client headers:', JSON.stringify(headers, null, 2));
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: headers
      }
    }
  );
};

// Create admin client with service role key for privileged operations
export const getSupabaseAdminClient = () => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'x-application-name': 'tingle-admin',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
      db: {
        schema: 'public',
      },
    });
  }
  return supabaseAdminInstance;
};

// Types for our database tables
export type User = {
  id: string;
  telegram_id: string;
  username: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  preferences: UserPreferences | null; // Allow preferences to be null
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  room_id: string;
  user1_id: string;
  user2_id: string;
  status: 'pending' | 'active' | 'ended';
  created_at: string;
  updated_at: string;
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to retry operations
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Operation failed (attempt ${i + 1}/${MAX_RETRIES}):`, error);
      if (i < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

// Database helper functions with retry mechanism
export const db = {
  users: {
    create: async (user: Omit<User, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    getByTelegramId: async (telegramId: string) => {
      const { data, error } = await supabase
        .from('users')
        .select()
        .eq('telegram_id', telegramId);
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`No user found with telegram_id: ${telegramId} (PGRST116)`);
          return null;
        }
        throw error;
      }
      if (!data || data.length === 0) {
         console.log(`No user found with telegram_id: ${telegramId} (Empty data)`);
         return null;
      }
      return data[0] as User;
    },
    update: async (userId: string, updates: Partial<User>) => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    updatePreferences: async (userId: string, preferences: Partial<UserPreferences>) => {
      const { data, error } = await supabase
        .from('users')
        .update({ preferences })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    deleteUser: async (userId: string) => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      if (error) throw error;
    },
  },
  matches: {
    create: async (match: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('matches')
        .insert(match)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    getActiveMatches: async (userId: string) => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
    deleteMatch: async (matchId: string) => {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);
      if (error) throw error;
    },
  },
}; 