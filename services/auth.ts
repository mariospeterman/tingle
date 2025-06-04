import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebApp from '@twa-dev/sdk';
import { TonConnect, WalletInfoRemote } from '@tonconnect/sdk';
import supabase from '../lib/supabase';

export interface AuthUser {
  id: string;
  username: string;
  walletAddress: string | null;
  session: any; // Supabase session
}

class AuthService {
  private static instance: AuthService;
  private supabase = supabase;
  private tonConnect: TonConnect;
  private currentUser: AuthUser | null = null;

  private constructor() {
    // TON Connect initialization only
    this.tonConnect = new TonConnect({
      manifestUrl: process.env.NEXT_PUBLIC_TON_CONNECT_MANIFEST_URL || '',
    });
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async initialize(): Promise<void> {
    // Initialize Telegram WebApp
    if (typeof window !== 'undefined') {
      WebApp.ready();
    }

    // Check for existing session
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session) {
      await this.setCurrentUser(session);
    }
  }

  private async setCurrentUser(session: any): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return;

    this.currentUser = {
      id: user.id,
      username: user.user_metadata?.username || '',
      walletAddress: null,
      session,
    };

    // Get wallet address if connected
    const wallets = await this.tonConnect.getWallets();
    if (wallets.length > 0) {
      const walletInfo = wallets[0];
      // Get the first account address from the wallet
      const address = this.tonConnect.connect(walletInfo);
      if (address) {
        this.currentUser.walletAddress = address;
      }
    }
  }

  public async signInWithTelegram(): Promise<AuthUser> {
    if (!WebApp.initData) {
      throw new Error('Telegram WebApp not initialized');
    }

    // Get Telegram user data
    const telegramUser = WebApp.initDataUnsafe.user;
    if (!telegramUser) {
      throw new Error('No Telegram user data available');
    }

    // Sign in with Supabase using Telegram data
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email: `${telegramUser.id}@telegram.user`,
      password: telegramUser.id.toString(),
    });

    if (authError) {
      // If user doesn't exist, create one
      const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
        email: `${telegramUser.id}@telegram.user`,
        password: telegramUser.id.toString(),
        options: {
          data: {
            telegram_id: telegramUser.id,
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
          },
        },
      });

      if (signUpError) throw signUpError;
      await this.setCurrentUser(signUpData.session);
    } else {
      await this.setCurrentUser(authData.session);
    }

    return this.currentUser!;
  }

  public async connectWallet(): Promise<string> {
    try {
      const wallets = await this.tonConnect.getWallets();
      if (wallets.length === 0) {
        throw new Error('No wallets available');
      }
      
      const walletInfo = wallets[0];
      // Get the first account address from the wallet
      const address = this.tonConnect.connect(walletInfo);
      if (!address) {
        throw new Error('Failed to get wallet address');
      }

      if (this.currentUser) {
        this.currentUser.walletAddress = address;
      }
      return address;
    } catch (error) {
      throw new Error('Failed to connect wallet');
    }
  }

  public async disconnectWallet(): Promise<void> {
    await this.tonConnect.disconnect();
    if (this.currentUser) {
      this.currentUser.walletAddress = null;
    }
  }

  public async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.tonConnect.disconnect();
    this.currentUser = null;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  public hasWallet(): boolean {
    return !!this.currentUser?.walletAddress;
  }
}

export const authService = AuthService.getInstance(); 