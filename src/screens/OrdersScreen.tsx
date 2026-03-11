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
import { Order, OrderStatus } from '../constants/types';
import { api } from '../services/api';
import { connectRealtime } from '../services/realtime';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

export default function OrdersScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tableMap, setTableMap] = useState<Record<string, string>>({});

  const loadOrders = async () => {
    try {
      const [orderData, restData, tablesData] = await Promise.all([
        api.orders.list(),
        api.restaurant.get(),
        api.tables.list().catch(() => [] as any[]),
      ]);
      setOrders(orderData);
      setRestaurant(restData);
      // Build id → name map for quick lookup in cards
      const map: Record<string, string> = {};
      for (const tbl of tablesData) { map[tbl.id] = tbl.name || tbl.tableNumber || tbl.id; }
      setTableMap(map);
    } catch (e) { console.error('Failed to load orders', e); }
  };

  useEffect(() => {
    loadOrders();

    // WebSocket for instant notifications
    const disconnect = connectRealtime((msg) => {
      if (
        msg.type === 'new_order' ||
        msg.type === 'order_updated' ||
        msg.type === 'order_status_changed' ||
        msg.type === 'data_changed'
      ) {
        loadOrders();
      }
    });

    // Polling fallback: refresh every 15 s in case WebSocket misses an event
    const poll = setInterval(loadOrders, 15000);

    return () => {
      disconnect();
      clearInterval(poll);
    };
  }, []);

  const STATUS_MAP: Record<OrderStatus, { label: string; color: string; bg: string }> = {
    created: { label: language === 'ar' ? 'منشأ' : 'Created', color: colors.amber, bg: colors.amberBg },
    pending: { label: t('pending'), color: colors.amber, bg: colors.amberBg },
    confirmed: { label: language === 'ar' ? 'مؤكد' : 'Confirmed', color: colors.blue, bg: colors.blueBg },
    preparing: { label: t('preparing'), color: colors.blue, bg: colors.blueBg },
    ready: { label: t('ready'), color: colors.emerald, bg: colors.emeraldBg },
    completed: { label: t('completed'), color: colors.textMuted, bg: 'rgba(255,255,255,0.05)' },
    delivered: { label: language === 'ar' ? 'تم التسليم' : 'Delivered', color: colors.textMuted, bg: 'rgba(255,255,255,0.05)' },
    cancelled: { label: t('cancelled'), color: colors.rose, bg: colors.roseBg },
  };

  const filteredOrders = orders.filter((o) => filter === 'all' || o.status === filter);

  const updateOrderStatus = async (id: string, newStatus: OrderStatus) => {
    // Optimistic update
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
    try {
      await api.orders.updateStatus(id, newStatus);
    } catch (e) {
      console.error('Failed to update order status', e);
      // Reload orders on failure to revert
      try {
        loadOrders();
      } catch (_) {}
    }
  };

  const s = dynStyles(colors, isRTL);

  const num = (value: any, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const renderOrder = ({ item: order }: { item: Order }) => {
    const statusCfg = STATUS_MAP[order.status];
    const isDineIn = order.orderType === 'dine_in';
    const tableName = isDineIn && order.tableId ? (tableMap[order.tableId] || order.tableId) : null;
    
    // If Kitchen Screen is disabled, we should allow "completing" or "serving" orders directly from Pending
    const isKdsDisabled = restaurant?.serviceKitchenScreen === false;

    return (
      <View style={[
        s.orderCard,
        isDineIn && { borderLeftWidth: 4, borderLeftColor: colors.info },
      ]}>
        {/* Table badge — shown only for dine_in */}
        {isDineIn && tableName && (
          <View style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.infoLight,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.infoBorder,
          }}>
            <Ionicons name='restaurant-outline' size={14} color={colors.info} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.info }}>
              {language === 'ar' ? `طاولة: ${tableName}` : `Table: ${tableName}`}
            </Text>
          </View>
        )}
        <View style={s.orderHeader}>
          <View style={s.orderHeaderRight}>
            <View style={[s.orderIcon, isDineIn && { backgroundColor: colors.infoLight }]}>
              <Ionicons
                name={isDineIn ? 'restaurant' : order.status === 'completed' ? 'checkmark-circle' : 'receipt-outline'}
                size={20}
                color={isDineIn ? colors.info : order.status === 'completed' ? colors.emerald : colors.textSecondary}
              />
            </View>
            <View>
              <Text style={s.orderNumber}>{order.orderNumber}</Text>
              <Text style={s.orderType}>
                {order.orderType === 'dine_in'
                  ? (language === 'ar' ? 'طلب طاولة' : 'Table Order')
                  : order.orderType === 'takeaway'
                    ? `${t('takeaway')} - ${order.customerName || t('guest')}`
                    : t('deliveryType')}
              </Text>
              {isKdsDisabled && order.status !== 'completed' && order.status !== 'cancelled' && (
                <Text style={{ fontSize: 10, color: colors.amber, marginTop: 2 }}>
                  {language === 'ar' ? 'طباعة تلقائية (بدون شاشة مطبخ)' : 'Auto-Print (No KDS)'}
                </Text>
              )}
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        <View style={s.itemsBox}>
          <View style={s.itemsHeader}>
            <Ionicons name="bag-outline" size={14} color={colors.textMuted} />
            <Text style={s.itemsCount}>{t('items')} ({order.items.length})</Text>
          </View>
          {order.items.map((item, idx) => (
            <View key={item.id + idx} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>
                  <Text style={s.itemQty}>{item.quantity}x</Text> {item.itemName}
                </Text>

                {/* Variant Display */}
                {item.selectedVariant && (
                  <Text style={[s.itemName, { fontSize: 11, color: colors.primary, marginTop: 2, paddingHorizontal: 16 }]}>
                    {language === 'ar' ? `الحجم: ${item.selectedVariant.nameAr || ''}` : `Size: ${item.selectedVariant.nameEn || ''}`}
                  </Text>
                )}

                {/* Customizations Display */}
                {item.selectedCustomizations && item.selectedCustomizations.length > 0 && (
                  <View style={{ marginTop: 2, paddingHorizontal: 16 }}>
                    {item.selectedCustomizations.map((c, i) => (
                      <Text key={i} style={[s.itemName, { fontSize: 10, color: colors.textMuted }]}>
                        • {language === 'ar' ? c.nameAr || '' : c.nameEn || ''}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Notes Display */}
                {item.notes && (
                   <Text style={[s.itemName, { fontSize: 10, color: colors.amber, marginTop: 2, paddingHorizontal: 16, fontStyle: 'italic' }]}>
                      {language === 'ar' ? `ملاحظة: ${item.notes}` : `Note: ${item.notes}`}
                   </Text>
                )}
              </View>

              <Text style={s.itemPrice}>{num(item.totalPrice).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={s.orderFooter}>
          <View style={s.timeRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={s.timeText}>
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: language === 'ar' ? ar : enUS })}
            </Text>
          </View>
          <Text style={s.orderTotal}>
            {num(order.total).toFixed(2)} <Text style={s.currency}>{t('sar')}</Text>
          </Text>
        </View>
        
        {/* Action Buttons Logic */}
        
        {/* Standard KDS Flow: Pending -> Preparing */}
        {!isKdsDisabled && (order.status === 'created' || order.status === 'pending' || order.status === 'confirmed') && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.blueBg, borderColor: colors.blueBorder }]}
            onPress={() => updateOrderStatus(order.id, 'preparing')}
          >
            <Text style={[s.actionText, { color: colors.blue }]}>{language === 'ar' ? 'إرسال للمطبخ' : 'Send to Kitchen'}</Text>
          </TouchableOpacity>
        )}

        {/* No KDS Flow: Pending -> Ready/Completed directly */}
        {isKdsDisabled && (order.status === 'created' || order.status === 'pending' || order.status === 'confirmed') && (
           <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[s.actionBtn, { flex: 1, backgroundColor: colors.emeraldBg, borderColor: colors.emeraldBorder }]}
                onPress={() => updateOrderStatus(order.id, 'ready')}
              >
                <Text style={[s.actionText, { color: colors.emerald }]}>{language === 'ar' ? 'جاهز' : 'Ready'}</Text>
              </TouchableOpacity>
           </View>
        )}

        {/* Universal Flow: Preparing -> Ready */}
        {(order.status === 'preparing') && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.emeraldBg, borderColor: colors.emeraldBorder }]}
            onPress={() => updateOrderStatus(order.id, 'ready')}
          >
            <Text style={[s.actionText, { color: colors.emerald }]}>{language === 'ar' ? 'تم التجهيز' : 'Mark Ready'}</Text>
          </TouchableOpacity>
        )}
        
        {/* Universal Flow: Ready -> Completed */}
        {order.status === 'ready' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.borderLight }]}
            onPress={() => updateOrderStatus(order.id, 'completed')}
          >
            <Text style={[s.actionText, { color: colors.textSecondary }]}>{language === 'ar' ? 'تسليم وإنهاء' : 'Serve & Complete'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const filters: { key: OrderStatus | 'all'; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'created', label: language === 'ar' ? 'منشأ' : 'Created' },
    { key: 'pending', label: t('pending') },
    { key: 'confirmed', label: language === 'ar' ? 'مؤكد' : 'Confirmed' },
    { key: 'preparing', label: t('preparing') },
    { key: 'ready', label: t('ready') },
    { key: 'completed', label: t('completed') },
    { key: 'delivered', label: language === 'ar' ? 'تم التسليم' : 'Delivered' },
  ];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }}>
          <DrawerMenuButton />
          <Text style={[s.title, { paddingHorizontal: 0, marginBottom: 0 }]}>{t('orders')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, filter === f.key && s.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              {f.key !== 'all' && (
                <View style={[s.filterDot, { backgroundColor: STATUS_MAP[f.key as OrderStatus].color }]} />
              )}
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
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
            <Ionicons name="bag-outline" size={48} color={colors.textDark} />
            <Text style={s.emptyText}>{t('noOrders')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.white, paddingHorizontal: 20, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.white },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: '#000' },
  list: { padding: 16 },
  orderCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  orderHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderHeaderRight: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
  orderIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  orderNumber: { fontSize: 16, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  orderType: { fontSize: 12, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  itemsBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  itemsHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  itemsCount: { fontSize: 12, color: colors.textMuted },
  itemRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemQty: { color: colors.primary, fontWeight: '800' },
  itemName: { fontSize: 14, color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
  itemPrice: { fontSize: 14, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  orderFooter: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  timeRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, color: colors.textMuted },
  orderTotal: { fontSize: 20, fontWeight: '900', color: colors.emerald },
  currency: { fontSize: 12, color: 'rgba(52,211,153,0.5)' },
  actionBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  actionText: { fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
});
