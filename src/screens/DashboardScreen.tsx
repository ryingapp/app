import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

// ==================== Types ====================
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface Stats {
  totalSales: number;
  totalOrders: number;
  activeOrders: number;
}

// ==================== Main Component ====================
export default function DashboardScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const { effectiveBranchId } = useAuth();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.orders.list({ branchId: effectiveBranchId ?? undefined });
      setOrders(data || []);
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadData'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calculate stats
  const stats: Stats = {
    totalSales: orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    totalOrders: orders.length,
    activeOrders: orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length,
  };

  // Status colors — use theme tokens so they work in both light & dark
  const getStatusColor = (status: string): string => {
    const map: Record<string, string> = {
      pending: colors.warning,
      preparing: colors.info,
      ready: colors.success,
      completed: colors.indigo,
      cancelled: colors.danger,
    };
    return map[status] || colors.textMuted;
  };

  const getStatusBg = (status: string): string => {
    const map: Record<string, string> = {
      pending: colors.warningLight,
      preparing: colors.infoLight,
      ready: colors.successLight,
      completed: colors.indigoBg,
      cancelled: colors.dangerLight,
    };
    return map[status] || colors.surfaceLight;
  };

  // Time ago (language-aware)
  const getTimeAgo = (date: string) => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (isRTL) {
      if (minutes < 1) return 'الآن';
      if (minutes < 60) return `منذ ${minutes} د`;
      if (minutes < 1440) return `منذ ${Math.floor(minutes / 60)} س`;
      return `منذ ${Math.floor(minutes / 1440)} ي`;
    }
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  // Loading
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.headerLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <DrawerMenuButton />
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {t('home')}
              </Text>
              <Text style={[styles.headerDate, { color: colors.textMuted }]}>
                {new Date().toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
            <Ionicons 
              name={refreshing ? 'sync' : 'refresh'} 
              size={22} 
              color={colors.textMuted} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="cash-outline" size={24} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {Number(stats.totalSales).toFixed(2)} {t('sar')}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('totalSales')}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="receipt-outline" size={24} color={colors.info} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.totalOrders}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('totalOrders')}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="time-outline" size={24} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.activeOrders}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('activeOrders')}
              </Text>
            </View>
          </View>

          {/* Recent Orders */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('recentOrders')}
            </Text>
            
            {orders.slice(0, 5).map((order) => (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              >
                <View style={[styles.orderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View>
                    <Text style={[styles.orderNumber, { color: colors.text }]}>
                      #{order.orderNumber}
                    </Text>
                    <Text style={[styles.orderTime, { color: colors.textMuted }]}>
                      {getTimeAgo(order.createdAt)}
                    </Text>
                  </View>
                  
                  <View style={[styles.orderRight, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusBg(order.status) }
                    ]}>
                      <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                        {t(order.status) || order.status}
                      </Text>
                    </View>
                    <Text style={[styles.orderTotal, { color: colors.success }]}>
                      {Number(order.total || 0).toFixed(2)} {t('sar')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* روح بسيطة - مسافة في النهاية */}
          <View style={{ height: 40 }} />

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== Styles ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerDate: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  newOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  newOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderTime: {
    fontSize: 12,
  },
  orderRight: {
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
});