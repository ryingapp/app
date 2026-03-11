import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { DeliveryOrder, DeliveryPlatform, DeliveryStatus } from '../constants/types';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

type PlatformFilter = DeliveryPlatform | 'all';

export default function DeliveryScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.orders.list({ type: 'delivery' });
        setOrders(data);
      } catch (e) { console.error('Failed to load delivery orders', e); }
    };
    loadData();
  }, []);

  const dateLocale = language === 'ar' ? ar : undefined;

  const PLATFORM_MAP: Record<DeliveryPlatform, { label: string; color: string; bg: string; icon: string }> = {
    hungerstation: { label: t('hungerstation'), color: '#E11D48', bg: 'rgba(225,29,72,0.1)', icon: '🟥' },
    jahez: { label: t('jahez'), color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: '🟨' },
    keeta: { label: t('keeta'), color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: '🟩' },
    ninja: { label: t('ninja'), color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', icon: '🟪' },
  };

  const STATUS_MAP: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
    new: { label: t('newDelivery'), color: colors.amber, bg: colors.amberBg },
    accepted: { label: t('accepted'), color: colors.blue, bg: colors.blueBg },
    preparing: { label: t('preparing'), color: colors.indigo, bg: colors.indigoBg },
    ready: { label: t('ready'), color: colors.emerald, bg: colors.emeraldBg },
    picked_up: { label: t('pickedUp'), color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
    delivered: { label: t('delivered'), color: colors.textMuted, bg: 'rgba(255,255,255,0.05)' },
    cancelled: { label: t('cancelled'), color: colors.rose, bg: colors.roseBg },
    rejected: { label: t('rejected'), color: colors.rose, bg: colors.roseBg },
  };

  const STATUS_FLOW: Partial<Record<DeliveryStatus, { next: DeliveryStatus; label: string; color: string; bg: string; borderColor: string }>> = {
    new: { next: 'accepted', label: t('accept'), color: colors.emerald, bg: colors.emeraldBg, borderColor: colors.emeraldBorder },
    accepted: { next: 'preparing', label: t('markPreparing'), color: colors.blue, bg: colors.blueBg, borderColor: colors.blueBorder },
    preparing: { next: 'ready', label: t('markReady'), color: colors.emerald, bg: colors.emeraldBg, borderColor: colors.emeraldBorder },
    ready: { next: 'picked_up', label: t('pickedUp'), color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.2)' },
  };

  const filteredOrders = orders.filter((o) => platformFilter === 'all' || o.platform === platformFilter);

  const updateStatus = (id: string, newStatus: DeliveryStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
  };

  const handleReject = (id: string) => {
    Alert.alert(t('reject'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('reject'), style: 'destructive', onPress: () => updateStatus(id, 'rejected') },
    ]);
  };

  const platformTabs: { key: PlatformFilter; label: string }[] = [
    { key: 'all', label: t('allPlatforms') },
    { key: 'hungerstation', label: t('hungerstation') },
    { key: 'jahez', label: t('jahez') },
    { key: 'keeta', label: t('keeta') },
    { key: 'ninja', label: t('ninja') },
  ];

  const activeCount = orders.filter((o) => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length;

  const s = dynStyles(colors, isRTL);

  const renderOrder = ({ item: order }: { item: DeliveryOrder }) => {
    const platformCfg = PLATFORM_MAP[order.platform] ?? { label: order.platform, color: colors.textMuted, bg: 'rgba(255,255,255,0.05)', icon: '📦' };
    const statusCfg = STATUS_MAP[order.status] ?? { label: order.status, color: colors.textMuted, bg: 'rgba(255,255,255,0.05)' };
    const nextAction = STATUS_FLOW[order.status];

    return (
      <View style={s.orderCard} data-testid={`card-delivery-${order.id}`}>
        <View style={s.orderHeader}>
          <View style={s.orderHeaderRight}>
            <View style={[s.platformBadge, { backgroundColor: platformCfg.bg }]}>
              <Text style={s.platformIcon}>{platformCfg.icon}</Text>
              <Text style={[s.platformLabel, { color: platformCfg.color }]}>{platformCfg.label}</Text>
            </View>
            <Text style={s.platformOrderId}>{order.platformOrderId}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        <View style={s.customerSection}>
          <View style={s.customerRow}>
            <Ionicons name="person-outline" size={14} color={colors.textMuted} />
            <Text style={s.customerName}>{order.customerName}</Text>
          </View>
          <View style={s.customerRow}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} />
            <Text style={s.customerPhone}>{order.customerPhone}</Text>
          </View>
          <View style={s.customerRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={s.customerAddress} numberOfLines={1}>{order.customerAddress}</Text>
          </View>
        </View>

        <View style={s.itemsBox}>
          <View style={s.itemsHeader}>
            <Ionicons name="bag-outline" size={14} color={colors.textMuted} />
            <Text style={s.itemsCount}>{t('items')} ({order.items.length})</Text>
          </View>
          {order.items.map((item) => (
            <View key={item.id} style={s.itemRow}>
              <Text style={s.itemName}>
                <Text style={s.itemQty}>{item.quantity}x</Text> {item.itemName}
              </Text>
              <Text style={s.itemPrice}>{item.totalPrice}</Text>
            </View>
          ))}
        </View>

        <View style={s.orderFooter}>
          <View style={s.footerLeft}>
            <View style={s.timeRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={s.timeText}>
                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: dateLocale })}
              </Text>
            </View>
            <Text style={s.feeText}>{t('platformFee')}: {order.platformFee} {t('sar')}</Text>
          </View>
          <Text style={s.orderTotal}>
            {order.total} <Text style={s.currency}>{t('sar')}</Text>
          </Text>
        </View>

        {order.notes && (
          <View style={s.notesRow}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
            <Text style={s.notesText}>{order.notes}</Text>
          </View>
        )}

        {(nextAction || order.status === 'new') && (
          <View style={s.actionsRow}>
            {nextAction && (
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnPrimary, { backgroundColor: nextAction.bg, borderColor: nextAction.borderColor }]}
                onPress={() => updateStatus(order.id, nextAction.next)}
                data-testid={`button-advance-${order.id}`}
              >
                <Text style={[s.actionText, { color: nextAction.color }]}>{nextAction.label}</Text>
              </TouchableOpacity>
            )}
            {order.status === 'new' && (
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnReject]}
                onPress={() => handleReject(order.id)}
                data-testid={`button-reject-${order.id}`}
              >
                <Text style={[s.actionText, { color: colors.rose }]}>{t('reject')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <View style={s.titleRow}>
          <DrawerMenuButton />
          <Text style={s.title}>{t('delivery')}</Text>
          <View style={s.activeCountBadge}>
            <Text style={s.activeCountText}>{activeCount} {t('active')}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
          {platformTabs.map((tab) => {
            const isActive = platformFilter === tab.key;
            const platformColor = tab.key !== 'all' ? PLATFORM_MAP[tab.key].color : undefined;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.filterBtn, isActive && s.filterBtnActive]}
                onPress={() => setPlatformFilter(tab.key)}
                data-testid={`button-platform-${tab.key}`}
              >
                {tab.key !== 'all' && (
                  <View style={[s.filterDot, { backgroundColor: platformColor }]} />
                )}
                <Text style={[s.filterText, isActive && s.filterTextActive]}>{tab.label}</Text>
                {tab.key !== 'all' && (
                  <View style={s.filterCountBadge}>
                    <Text style={s.filterCountText}>
                      {orders.filter((o) => o.platform === tab.key && !['delivered', 'cancelled', 'rejected'].includes(o.status)).length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="bicycle-outline" size={48} color={colors.textDark} />
            <Text style={s.emptyText}>{t('noDeliveryOrders')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 20, paddingBottom: 12 },
  titleRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  activeCountBadge: { backgroundColor: colors.emeraldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.emeraldBorder },
  activeCountText: { fontSize: 12, fontWeight: '700', color: colors.emerald },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.white },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: '#000' },
  filterCountBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginStart: 2 },
  filterCountText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  list: { padding: 16 },
  orderCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  orderHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderHeaderRight: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
  platformBadge: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  platformIcon: { fontSize: 12 },
  platformLabel: { fontSize: 12, fontWeight: '700' },
  platformOrderId: { fontSize: 14, fontWeight: '800', color: colors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  customerSection: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12, gap: 6 },
  customerRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
  customerName: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  customerPhone: { fontSize: 13, color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
  customerAddress: { fontSize: 13, color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', flex: 1 },
  itemsBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  itemsHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  itemsCount: { fontSize: 12, color: colors.textMuted },
  itemRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemQty: { color: colors.primary, fontWeight: '800' },
  itemName: { fontSize: 14, color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
  itemPrice: { fontSize: 14, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  orderFooter: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  footerLeft: { gap: 4 },
  timeRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: colors.textMuted },
  feeText: { fontSize: 11, color: colors.textDark, textAlign: isRTL ? 'right' : 'left' },
  orderTotal: { fontSize: 20, fontWeight: '900', color: colors.emerald },
  currency: { fontSize: 12, color: 'rgba(52,211,153,0.5)' },
  notesRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  notesText: { fontSize: 12, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' },
  actionsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  actionBtnPrimary: {},
  actionBtnReject: { backgroundColor: colors.roseBg, borderColor: colors.roseBorder },
  actionText: { fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
});
