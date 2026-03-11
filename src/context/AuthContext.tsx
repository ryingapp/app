import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setApiToken, setOnUnauthorized } from '../services/api';

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
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
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
    await AsyncStorage.setItem('auth_token', newToken);
    await AsyncStorage.setItem('auth_user', JSON.stringify(newUser));
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setApiToken('');
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
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
