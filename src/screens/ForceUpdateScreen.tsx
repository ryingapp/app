import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const logoSrc = (() => {
  try { return require('../../assets/logo.png'); } catch { return null; }
})();

interface ForceUpdateScreenProps {
  currentVersion: string;
  latestVersion: string;
  storeUrlAndroid?: string;
  storeUrlIos?: string;
  language?: string;
}

export default function ForceUpdateScreen({
  currentVersion,
  latestVersion,
  storeUrlAndroid,
  storeUrlIos,
  language = 'ar',
}: ForceUpdateScreenProps) {
  const isAr = language === 'ar';

  const openStore = () => {
    const url =
      Platform.OS === 'ios'
        ? (storeUrlIos || 'https://apps.apple.com')
        : (storeUrlAndroid || 'https://play.google.com');
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo */}
        {logoSrc ? (
          <Image source={logoSrc} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>T</Text>
          </View>
        )}

        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="arrow-up-circle" size={56} color="#6C63FF" />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isAr ? 'تحديث إجباري' : 'Update Required'}
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          {isAr
            ? 'يتطلب هذا التطبيق تحديثاً للاستمرار. يحتوي هذا التحديث على تحسينات أمنية مهمة.'
            : 'This app requires an update to continue. This update contains important security improvements.'}
        </Text>

        {/* Version Info */}
        <View style={styles.versionBox}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>
              {isAr ? 'نسختك الحالية' : 'Your version'}
            </Text>
            <Text style={[styles.versionValue, styles.versionOld]}>
              v{currentVersion}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>
              {isAr ? 'أحدث نسخة' : 'Latest version'}
            </Text>
            <Text style={[styles.versionValue, styles.versionNew]}>
              v{latestVersion}
            </Text>
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity style={styles.updateBtn} onPress={openStore} activeOpacity={0.85}>
          <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.updateBtnText}>
            {isAr ? 'تحديث الآن' : 'Update Now'}
          </Text>
        </TouchableOpacity>

        {/* Store label */}
        <Text style={styles.storeHint}>
          {isAr
            ? (Platform.OS === 'ios' ? 'متجر App Store' : 'متجر Google Play')
            : (Platform.OS === 'ios' ? 'App Store' : 'Google Play Store')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 20,
    borderRadius: 16,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(108,99,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F0F4FF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#A8B4CC',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  versionBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 28,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  versionLabel: {
    fontSize: 14,
    color: '#A8B4CC',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  versionOld: {
    color: '#F87171',
  },
  versionNew: {
    color: '#34D399',
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  updateBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  storeHint: {
    fontSize: 12,
    color: '#5C6B88',
  },
});
