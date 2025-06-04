import { useState, useEffect } from 'react';
import { mockUserService, MockUser } from '../services/mockUser';

export const useMockUser = (username?: string) => {
  const [mockUser, setMockUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (username) {
      createMockUser(username);
    }
  }, [username]);

  const createMockUser = async (username: string) => {
    try {
      setLoading(true);
      setError(null);
      const user = await mockUserService.createMockUser(username);
      setMockUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mock user');
    } finally {
      setLoading(false);
    }
  };

  const validateJWT = async (jwt: string) => {
    try {
      setLoading(true);
      setError(null);
      const isValid = await mockUserService.validateMockJWT(jwt);
      return isValid;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate JWT');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    mockUser,
    loading,
    error,
    createMockUser,
    validateJWT,
  };
}; 