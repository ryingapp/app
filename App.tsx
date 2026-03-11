import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AppNavigator from './src/navigation/AppNavigator';
import ForceUpdateScreen from './src/screens/ForceUpdateScreen';
import { ThemeProvider, useTheme } from './src/constants/ThemeContext';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { initializeSoftPos, isSoftPosReady, logSoftPosDiagnostics } from './src/services/edfapaySoftpos';
import { initErrorReporting, captureError } from './src/services/errorReporting';
import { processSyncQueue } from './src/services/syncEngine';
import { OfflineStorage } from './src/services/storage';
import { getOfflineRecoverySummary } from './src/services/offlineSales';
import { initLocalFinanceDb } from './src/services/localDb';

// Initialize error monitoring as early as possible
initErrorReporting();

// Semantic version comparison: returns true if `current` is older than `minimum`
function isVersionOutdated(current: string, minimum: string): boolean {
  const parse = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  const [mMaj = 0, mMin = 0, mPatch = 0] = parse(minimum);
  if (cMaj !== mMaj) return cMaj < mMaj;
  if (cMin !== mMin) return cMin < mMin;
  return cPatch < mPatch;
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
  ? process.env.EXPO_PUBLIC_API_BASE_URL.replace('/api', '')
  : 'https://tryingpos.com';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  state = { error: null as any };
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) {
    captureError(error, { componentStack: info?.componentStack });
  }
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

interface ForceUpdateState {
  latestVersion: string;
  storeUrlAndroid: string;
  storeUrlIos: string;
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const { token } = useAuth();
  const { language } = useLanguage();
  const [forceUpdate, setForceUpdate] = useState<ForceUpdateState | null>(null);

  // Version check — runs once on mount, fails silently to never block on network error
  useEffect(() => {
    const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
    fetch(`${API_BASE}/api/app-version`)
      .then((r) => r.json())
      .then((data: { minVersion: string; latestVersion: string; storeUrlAndroid: string; storeUrlIos: string }) => {
        if (isVersionOutdated(APP_VERSION, data.minVersion)) {
          setForceUpdate({
            latestVersion: data.latestVersion,
            storeUrlAndroid: data.storeUrlAndroid,
            storeUrlIos: data.storeUrlIos,
          });
        }
      })
      .catch(() => {}); // never block the app due to network failure
  }, []);

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

  if (forceUpdate) {
    const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
    return (
      <ForceUpdateScreen
        currentVersion={APP_VERSION}
        latestVersion={forceUpdate.latestVersion}
        storeUrlAndroid={forceUpdate.storeUrlAndroid}
        storeUrlIos={forceUpdate.storeUrlIos}
        language={language as 'ar' | 'en'}
      />
    );
  }

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
