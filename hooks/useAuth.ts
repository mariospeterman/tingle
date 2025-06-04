import { useState, useEffect } from 'react';
import { authService, AuthUser } from '../services/auth';

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      await authService.initialize();
      setUser(authService.getCurrentUser());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize auth');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = await authService.signInWithTelegram();
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const address = await authService.connectWallet();
      setUser(authService.getCurrentUser());
      return address;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      await authService.disconnectWallet();
      setUser(authService.getCurrentUser());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await authService.signOut();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    connectWallet,
    disconnectWallet,
    isAuthenticated: authService.isAuthenticated(),
    hasWallet: authService.hasWallet(),
  };
}; 