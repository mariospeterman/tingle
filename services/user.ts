import { getSupabaseClient, getSupabaseAdminClient } from './supabase';
import type { User } from './supabase';
import type { UserPreferences } from './matchmaking';
import { webApp } from '../utils/telegram-sdk';

export class UserService {
  private supabase = getSupabaseClient();
  private supabaseAdmin = getSupabaseAdminClient();

  async getByTelegramId(telegramId: string): Promise<User | null> {
    const supabase = process.env.NODE_ENV === 'development' ? this.supabaseAdmin : this.supabase;
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('telegram_id', telegramId);

    if (error) {
      // If the error is due to no rows found, return null
      if (error.code === 'PGRST116') {
        console.log(`No user found with telegram_id: ${telegramId} (PGRST116)`);
        return null;
      }
      throw error; // Re-throw other errors
    }

    // If data is an empty array (no rows found)
    if (!data || data.length === 0) {
       console.log(`No user found with telegram_id: ${telegramId} (Empty data)`);
       return null;
    }

    // Assuming telegram_id is unique, we expect a single result if found
    return data[0] as User;
  }

  async create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const supabase = process.env.NODE_ENV === 'development' ? this.supabaseAdmin : this.supabase;
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ preferences })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePreference(userId: string, key: keyof UserPreferences, value: any): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ [key]: value })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  }

  async getOrCreateUser(): Promise<User | null> {
    if (!webApp?.initDataUnsafe?.user && process.env.NODE_ENV !== 'development') {
      throw new Error('Telegram user data is not available');
    }

    const telegramUser = process.env.NODE_ENV === 'development' ? { id: 'dev_user_1', username: 'dev_user', first_name: 'Development', last_name: 'User' } : webApp.initDataUnsafe!.user;
    
    let user = await this.getByTelegramId(telegramUser.id.toString());

    if (!user) {
      console.log('Development user not found, attempting to create...');
      user = await this.create({
        telegram_id: telegramUser.id.toString(),
        username: telegramUser.username || '',
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name || '',
        preferences: null,
      });
       console.log('Development user creation attempt finished.', user);
    }

    return user;
  }

  async initializeUser(): Promise<User | null> {
    return this.getOrCreateUser();
  }
} 