import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/constants/ThemeContext';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { initializeSoftPos, isSoftPosReady, logSoftPosDiagnostics } from './src/services/edfapaySoftpos';
import { processSyncQueue } from './src/services/syncEngine';
import { OfflineStorage } from './src/services/storage';
import { getOfflineRecoverySummary } from './src/services/offlineSales';
import { initLocalFinanceDb } from './src/services/localDb';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  state = { error: null as any };
  static getDerivedStateFromError(error: any) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 40, backgroundColor: '#0B0F19', justifyContent: 'center' }}>
          <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold' }}>App Error:</Text>
          <Text style={{ color: '#ff6666', fontSize: 14, marginTop: 10 }}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const { token } = useAuth();

  useEffect(() => {
    initLocalFinanceDb().catch((error) => {
      console.warn('Local finance DB init failed:', error?.message || error);
    });

    if (Platform.OS !== 'android') return;
    if (isSoftPosReady()) return;

    const authCode = process.env.EXPO_PUBLIC_EDFAPAY_AUTH_CODE;
    const merchantId = process.env.EXPO_PUBLIC_EDFAPAY_MERCHANT_ID;
    const email = process.env.EXPO_PUBLIC_EDFAPAY_EMAIL;
    const password = process.env.EXPO_PUBLIC_EDFAPAY_PASSWORD;

    // Only attempt eager initialization when credentials are configured.
    if (!authCode && !((merchantId || email) && password)) return;

    logSoftPosDiagnostics('app-startup:before-init');
    initializeSoftPos().catch((error) => {
      logSoftPosDiagnostics('app-startup:init-failed');
      console.warn('EdfaPay init on app startup failed:', error?.message || error);
    });
  }, []);

  useEffect(() => {
    if (!token) return;

    let stopped = false;
    let running = false;

    const runRecoverySync = async () => {
      if (stopped || running) return;
      running = true;

      try {
        const result = await processSyncQueue(20);
        const queueHealth = await OfflineStorage.getSyncQueueHealth();
        const summary = await getOfflineRecoverySummary();

        await OfflineStorage.saveRecoveryState({
          lastRecoveryAt: new Date().toISOString(),
          lastProcessedSyncItems: result.processed,
          queueBacklogAtRecovery: queueHealth.count,
          lastError: result.failed > 0 ? 'Sync batch contains failures' : undefined,
        });

        if (result.processed > 0 || queueHealth.status !== 'healthy') {
          console.log('Offline sync heartbeat', {
            result,
            queueHealth,
            summary,
          });
        }
      } catch (error: any) {
        await OfflineStorage.saveRecoveryState({
          lastRecoveryAt: new Date().toISOString(),
          lastError: error?.message || 'Recovery sync failed',
        });
      } finally {
        running = false;
      }
    };

    void runRecoverySync();
    const interval = setInterval(() => {
      void runRecoverySync();
    }, 20000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [token]);

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
