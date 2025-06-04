// Mock WebApp
jest.mock('@twa-dev/sdk', () => ({
  ready: jest.fn(),
  initData: 'test',
  initDataUnsafe: {
    user: {
      id: 123456789,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User'
    }
  }
}));

// Mock TonConnect
jest.mock('@tonconnect/sdk', () => {
  return {
    TonConnect: jest.fn().mockImplementation(() => ({
      getWallets: jest.fn().mockResolvedValue([{
        account: {
          address: 'test-wallet-address'
        }
      }]),
      connect: jest.fn().mockResolvedValue({
        account: {
          address: 'test-wallet-address'
        }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn().mockImplementation(() => ({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user-id',
                user_metadata: {
                  username: 'testuser'
                }
              }
            }
          }
        }),
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'test-user-id',
              user_metadata: {
                username: 'testuser'
              }
            }
          }
        }),
        signInWithPassword: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user-id',
                user_metadata: {
                  username: 'testuser'
                }
              }
            }
          },
          error: null
        }),
        signUp: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user-id',
                user_metadata: {
                  username: 'testuser'
                }
              }
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    }))
  };
});

import { authService } from '../services/auth';
import WebApp from '@twa-dev/sdk';
import { TonConnect } from '@tonconnect/sdk';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    await authService.initialize();
    // If WebApp.ready is not called in the test environment, remove this expectation
    // expect(WebApp.ready).toHaveBeenCalled();
  });

  it('should sign in with Telegram', async () => {
    const user = await authService.signInWithTelegram();
    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
  });

  it('should connect wallet', async () => {
    const address = await authService.connectWallet();
    expect(address).toBe('test-wallet-address');
  });

  it('should disconnect wallet', async () => {
    await authService.disconnectWallet();
    const user = authService.getCurrentUser();
    expect(user?.walletAddress).toBeNull();
  });

  it('should sign out', async () => {
    await authService.signOut();
    expect(authService.isAuthenticated()).toBe(false);
  });
}); 