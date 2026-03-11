import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setApiToken, setOnUnauthorized } from '../services/api';
import { setUserContext, clearUserContext } from '../services/errorReporting';

// Secure storage helpers — fall back to no-op on web (SecureStore is native only)
const secureGet = (key: string) =>
  SecureStore.getItemAsync(key).catch(() => null);
const secureSet = (key: string, value: string) =>
  SecureStore.setItemAsync(key, value).catch(() => {});
const secureDelete = (key: string) =>
  SecureStore.deleteItemAsync(key).catch(() => {});

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId: string;
  branchId?: string;
  permDashboard?: boolean;
  permPos?: boolean;
  permOrders?: boolean;
  permMenu?: boolean;
  permKitchen?: boolean;
  permInventory?: boolean;
  permReviews?: boolean;
  permMarketing?: boolean;
  permQr?: boolean;
  permReports?: boolean;
  permSettings?: boolean;
  permTables?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutRef = useRef<() => Promise<void>>();

  useEffect(() => {
    loadStoredAuth();
    // Auto-logout when server returns 401 (token expired or revoked)
    setOnUnauthorized(() => { logoutRef.current?.(); });
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await secureGet('auth_token');
      const storedUser = await secureGet('auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setApiToken(storedToken);
      }
    } catch (e) {
      console.error('Failed to load auth:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await api.auth.login(email, password);
    const { token: newToken, user: newUser } = data;
    setToken(newToken);
    setUser(newUser);
    setApiToken(newToken);
    setUserContext(newUser.id, newUser.email);
    await secureSet('auth_token', newToken);
    await secureSet('auth_user', JSON.stringify(newUser));
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setApiToken('');
    clearUserContext();
    await secureDelete('auth_token');
    await secureDelete('auth_user');
  }

  // Keep ref in sync so the onUnauthorized callback always calls the current logout
  useEffect(() => { logoutRef.current = logout; });

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
