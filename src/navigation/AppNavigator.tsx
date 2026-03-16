import React, { useState, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  Alert,
  Image,
  Modal,
} from 'react-native';

const drawerLogo = (() => {
  try { return require('../../assets/logo.png'); } catch { return null; }
})();
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { DrawerContext, useDrawer } from '../context/DrawerContext';
import { connectRealtime } from '../services/realtime';
import { api } from '../services/api';

import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TablesScreen from '../screens/TablesScreen';
import POSScreen from '../screens/POSScreen';
import OrdersScreen from '../screens/OrdersScreen';
import KitchenScreen from '../screens/KitchenScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import ReservationsScreen from '../screens/ReservationsScreen';
import QueueScreen from '../screens/QueueScreen';
import CustomersScreen from '../screens/CustomersScreen';
import DaySessionScreen from '../screens/DaySessionScreen';
import DeliveryScreen from '../screens/DeliveryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoyaltyScreen from '../screens/LoyaltyScreen';
import OfflineCenterScreen from '../screens/OfflineCenterScreen';

const Stack = createNativeStackNavigator();
const DRAWER_WIDTH = 280;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// useDrawer is re-exported from DrawerContext for backward compatibility
export { useDrawer };

interface DrawerSection {
  title: string;
  items: { name: string; label: string; icon: string }[];
}

function CustomDrawerContent({
  navigation,
  activeRoute,
  onClose,
  pendingTableOrdersCount,
}: {
  navigation: any;
  activeRoute: string;
  onClose: () => void;
  pendingTableOrdersCount: number;
}) {
  const { colors, isDark } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const { user, selectedBranchId, setSelectedBranchId } = useAuth();
  const insets = useSafeAreaInsets();

  const isOwnerLike = user?.role === 'owner' || user?.role === 'platform_admin';
  const [branches, setBranches] = useState<any[]>([]);
  const [branchPickerVisible, setBranchPickerVisible] = useState(false);

  React.useEffect(() => {
    if (isOwnerLike) {
      api.branches.list().then(setBranches).catch(() => {});
    }
  }, [isOwnerLike]);

  const selectedBranchName = selectedBranchId
    ? (branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId)
    : (language === 'ar' ? 'كل الفروع' : 'All Branches');

  const sections: DrawerSection[] = [
    {
      title: language === 'ar' ? 'الرئيسية' : 'Main',
      items: [
        { name: 'Dashboard', label: t('home'), icon: 'home' },
        { name: 'POS', label: t('pos'), icon: 'cart' },
        { name: 'Orders', label: t('orders'), icon: 'clipboard' },
        { name: 'Tables', label: t('tables'), icon: 'grid' },
      ],
    },
    {
      title: language === 'ar' ? 'العمليات' : 'Operations',
      items: [
        { name: 'Kitchen', label: t('kitchen'), icon: 'flame-outline' },
        { name: 'Delivery', label: t('delivery'), icon: 'bicycle-outline' },
        { name: 'Reservations', label: t('reservations'), icon: 'calendar-outline' },
        { name: 'Queue', label: t('queue'), icon: 'people-outline' },
      ],
    },
    {
      title: language === 'ar' ? 'الإدارة' : 'Management',
      items: [
        { name: 'Customers', label: t('customers'), icon: 'person-outline' },
        { name: 'Loyalty', label: t('loyalty'), icon: 'heart-outline' },
      ],
    },
    {
      title: language === 'ar' ? 'المالية والتقارير' : 'Finance & Reports',
      items: [
        { name: 'Invoices', label: t('invoices'), icon: 'receipt-outline' },
        { name: 'DaySession', label: t('daySession'), icon: 'cash-outline' },
        { name: 'OfflineCenter', label: t('offlineCenter'), icon: 'cloud-offline-outline' },
      ],
    },
    {
      title: '',
      items: [
        { name: 'Settings', label: t('settings'), icon: 'settings-outline' },
      ],
    },
  ];

  // isOwnerLike is already declared above

  const screenPermissions: Record<string, keyof NonNullable<typeof user> | null> = {
    Dashboard: 'permDashboard',
    POS: 'permPos',
    Orders: 'permOrders',
    Tables: 'permTables',
    Kitchen: 'permKitchen',
    Delivery: 'permOrders',
    Reservations: 'permTables',
    Queue: 'permTables',
    Customers: 'permOrders',
    Loyalty: 'permMarketing',
    Invoices: 'permReports',
    DaySession: 'permReports',
    OfflineCenter: 'permReports',
    Settings: 'permSettings',
  };

  const canAccessScreen = (screenName: string) => {
    if (!user) return false;
    if (isOwnerLike) return true;

    const permissionField = screenPermissions[screenName];
    if (!permissionField) return true;
    return Boolean((user as any)[permissionField]);
  };

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessScreen(item.name)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <View
      style={[ds.drawerContainer, {
          backgroundColor: colors.surface,
          borderRightColor: isRTL ? 'transparent' : colors.borderLight,
          borderLeftColor: isRTL ? colors.borderLight : 'transparent',
          borderRightWidth: isRTL ? 0 : 1,
          borderLeftWidth: isRTL ? 1 : 0,
          paddingTop: insets.top,
        }]}
    >
      <View style={[ds.drawerHeader, { borderBottomColor: colors.borderLight, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {drawerLogo ? (
          <Image source={drawerLogo} style={ds.drawerLogoImg} resizeMode="contain" />
        ) : (
          <View style={[ds.logoContainer, { backgroundColor: colors.primary }]}>
            <Ionicons name="restaurant" size={22} color="#FFF" />
          </View>
        )}
        {!drawerLogo && (
          <View style={{ flex: 1 }}>
            <Text style={[ds.drawerTitle, { color: colors.text }]} data-testid="text-drawer-title">
              TryingPOS
            </Text>
            <Text style={[ds.drawerSubtitle, { color: colors.textMuted }]}>
              {language === 'ar' ? 'نظام نقاط البيع' : 'Point of Sale'}
            </Text>
          </View>
        )}
        {drawerLogo && (
          <View style={{ flex: 1 }}>
            <Text style={[ds.drawerSubtitle, { color: colors.textMuted }]}>
              {language === 'ar' ? 'نظام نقاط البيع' : 'Point of Sale'}
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onClose}
          style={[ds.closeBtn, { backgroundColor: colors.surfaceLight }]}
          data-testid="button-close-drawer"
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Branch picker for owners only */}
      {isOwnerLike && branches.length > 0 && (
        <>
          <TouchableOpacity
            onPress={() => setBranchPickerVisible(true)}
            style={[ds.branchPickerBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="git-branch-outline" size={16} color={colors.primary} />
            <Text style={[ds.branchPickerLabel, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
              {selectedBranchName}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
          <Modal
            visible={branchPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setBranchPickerVisible(false)}
          >
            <Pressable style={ds.modalOverlay} onPress={() => setBranchPickerVisible(false)}>
              <View style={[ds.branchModal, { backgroundColor: colors.surface }]}>
                <Text style={[ds.branchModalTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'اختر الفرع' : 'Select Branch'}
                </Text>
                {/* "All Branches" option */}
                <TouchableOpacity
                  style={[ds.branchOption, !selectedBranchId && { backgroundColor: colors.primaryGlow }]}
                  onPress={() => { setSelectedBranchId(null); setBranchPickerVisible(false); }}
                >
                  <Text style={[ds.branchOptionText, { color: !selectedBranchId ? colors.primary : colors.text }]}>
                    {language === 'ar' ? 'كل الفروع' : 'All Branches'}
                  </Text>
                  {!selectedBranchId && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
                {branches.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[ds.branchOption, selectedBranchId === b.id && { backgroundColor: colors.primaryGlow }]}
                    onPress={() => { setSelectedBranchId(b.id); setBranchPickerVisible(false); }}
                  >
                    <Text style={[ds.branchOptionText, { color: selectedBranchId === b.id ? colors.primary : colors.text }]}>
                      {b.name || b.nameAr || b.id}
                    </Text>
                    {selectedBranchId === b.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Modal>
        </>
      )}

      <ScrollView
        style={ds.drawerScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {visibleSections.map((section, sIdx) => (
          <View key={sIdx} style={ds.drawerSection}>
            {section.title ? (
              <Text
                style={[
                  ds.sectionTitle,
                  { color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {section.title}
              </Text>
            ) : (
              <View style={[ds.sectionDivider, { backgroundColor: colors.borderLight }]} />
            )}
            {section.items.map((item) => {
              const isActive = activeRoute === item.name;
              const showOrdersBadge = item.name === 'Orders' && pendingTableOrdersCount > 0;
              return (
                <TouchableOpacity
                  key={item.name}
                  style={[
                    ds.drawerItem,
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                    isActive && { backgroundColor: colors.primaryGlow },
                  ]}
                  onPress={() => {
                    onClose();
                    setTimeout(() => {
                      navigation.navigate(item.name);
                    }, 220);
                  }}
                  data-testid={`link-drawer-${item.name.toLowerCase()}`}
                >
                  <View
                    style={[
                      ds.drawerItemIcon,
                      {
                        backgroundColor: isActive ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={isActive ? '#FFF' : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      ds.drawerItemLabel,
                      {
                        color: isActive ? colors.primary : colors.text,
                        fontWeight: isActive ? '700' : '500',
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {showOrdersBadge && (
                    <View style={[ds.countBadge, { backgroundColor: colors.rose }]}> 
                      <Text style={ds.countBadgeText}>
                        {pendingTableOrdersCount > 99 ? '99+' : pendingTableOrdersCount}
                      </Text>
                    </View>
                  )}
                  {isActive && (
                    <View
                      style={[
                        ds.activeDot,
                        {
                          backgroundColor: colors.primary,
                          [isRTL ? 'left' : 'right']: 0,
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function ScreenHeader({
  title,
  showBack,
  onBack,
  rightContent,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        ds.screenHeader,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderLight,
          paddingTop: insets.top + 8,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <View style={[ds.headerLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {showBack && onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[ds.headerBtn, { backgroundColor: colors.surfaceLight }]}
            data-testid="button-back"
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={openDrawer}
            style={[ds.headerBtn, { backgroundColor: colors.surfaceLight }]}
            data-testid="button-open-drawer"
          >
            <Ionicons name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text
          style={[
            ds.headerTitle,
            { color: colors.text, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {rightContent && (
        <View style={[ds.headerRight, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {rightContent}
        </View>
      )}
    </View>
  );
}

function DrawerOverlay({ isOpen, closeDrawer, navigationRef, pendingTableOrdersCount }: { isOpen: boolean; closeDrawer: () => void; navigationRef: React.RefObject<any>; pendingTableOrdersCount: number }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { isRTL } = useLanguage();
  const { colors } = useTheme();

  let activeRoute = 'Dashboard';
  try {
    const navState = navigationRef?.current?.getRootState?.();
    if (navState?.routes && navState.index != null) {
      activeRoute = navState.routes[navState.index]?.name || 'Dashboard';
    }
  } catch (e) {}

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 1 : 0,
      duration: isOpen ? 250 : 200,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isRTL ? DRAWER_WIDTH : -DRAWER_WIDTH, 0],
  });

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  if (!isOpen) return null;

  return (
    <>
      <Animated.View style={[ds.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      <Animated.View
        style={[
          ds.drawerWrapper,
          {
            [isRTL ? 'right' : 'left']: 0,
            transform: [{ translateX }],
            width: DRAWER_WIDTH,
          },
        ]}
      >
        <CustomDrawerContent
          navigation={navigationRef.current}
          activeRoute={activeRoute}
          onClose={closeDrawer}
          pendingTableOrdersCount={pendingTableOrdersCount}
        />
      </Animated.View>
    </>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { token, isLoading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingTableOrdersCount, setPendingTableOrdersCount] = useState(0);
  const navigationRef = useRef<any>(null);
  const lastNotifiedOrderIdRef = useRef<string | null>(null);

  const openDrawer = React.useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  const refreshPendingTableOrders = React.useCallback(async () => {
    if (!token) {
      setPendingTableOrdersCount(0);
      return;
    }

    try {
      const pendingOrders = await api.orders.list({ status: 'pending' });
      const tablePending = (pendingOrders || []).filter((order: any) => order?.orderType === 'dine_in' && !!order?.tableId);
      setPendingTableOrdersCount(tablePending.length);
    } catch (e) {
      console.error('Failed to load pending table orders count', e);
    }
  }, [token]);

  React.useEffect(() => {
    refreshPendingTableOrders();
  }, [refreshPendingTableOrders]);

  React.useEffect(() => {
    if (!token) return;

    const disconnect = connectRealtime((msg) => {
      if (msg.type !== 'new_order') return;

      const payload = msg?.payload || {};
      const orderId = payload?.id;
      if (orderId && lastNotifiedOrderIdRef.current === orderId) return;
      lastNotifiedOrderIdRef.current = orderId || null;

      const orderNumber = payload?.orderNumber || (language === 'ar' ? 'طلب جديد' : 'New Order');
      const isTableQrOrder = payload?.orderType === 'dine_in' && !!payload?.tableId && payload?.status === 'pending';
      const tableLabel = payload?.tableId
        ? `${language === 'ar' ? 'طاولة' : 'Table'} ${payload.tableId}`
        : (payload?.orderType || '');
      const customerLine = payload?.customerName
        ? `\n${language === 'ar' ? 'العميل' : 'Customer'}: ${payload.customerName}`
        : '';

      const title = isTableQrOrder
        ? (language === 'ar' ? '🔔 طلب طاولة جديد' : '🔔 New Table Order')
        : (language === 'ar' ? '🔔 طلب جديد' : '🔔 New Order');

      const actionLine = isTableQrOrder
        ? (language === 'ar' ? '\nبانتظار قبول الكاشير' : '\nWaiting cashier acceptance')
        : '';

      Alert.alert(
        title,
        `${orderNumber}${tableLabel ? `\n${tableLabel}` : ''}${customerLine}${actionLine}`,
        [
          { text: language === 'ar' ? 'لاحقاً' : 'Later', style: 'cancel' },
          {
            text: language === 'ar' ? 'فتح الطلبات' : 'Open Orders',
            onPress: () => navigationRef.current?.navigate?.('Orders'),
          },
        ]
      );

      if (
        msg.type === 'new_order' ||
        msg.type === 'order_updated' ||
        msg.type === 'order_status_changed' ||
        msg.type === 'data_changed'
      ) {
        refreshPendingTableOrders();
      }
    });

    return disconnect;
  }, [token, language, refreshPendingTableOrders]);

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer, isOpen: drawerOpen }}>
      {/* Show loading spinner while auth state is being read from SecureStore */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={ds.layoutContainer}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'none',
          }}
        >
          {/* Auth guard: only show protected screens when authenticated */}
          {!token ? (
            <Stack.Screen name="Auth" component={AuthScreen} />
          ) : (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="POS" component={POSScreen} />
              <Stack.Screen name="Orders" component={OrdersScreen} />
              <Stack.Screen name="Tables" component={TablesScreen} />
              <Stack.Screen name="Kitchen" component={KitchenScreen} />
              <Stack.Screen name="Invoices" component={InvoicesScreen} />
              <Stack.Screen name="Reservations" component={ReservationsScreen} />
              <Stack.Screen name="Queue" component={QueueScreen} />
              <Stack.Screen name="Customers" component={CustomersScreen} />
              <Stack.Screen name="DaySession" component={DaySessionScreen} />
              <Stack.Screen name="OfflineCenter" component={OfflineCenterScreen} />
              <Stack.Screen name="Delivery" component={DeliveryScreen} />
              <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          )}
        </Stack.Navigator>
        <NavigationCapture ref={navigationRef} />
        {!!token && (
          <DrawerOverlay
            isOpen={drawerOpen}
            closeDrawer={closeDrawer}
            navigationRef={navigationRef}
            pendingTableOrdersCount={pendingTableOrdersCount}
          />
        )}
      </View>
      )}
    </DrawerContext.Provider>
  );
}

const NavigationCapture = React.forwardRef((_props, ref: any) => {
  const navigation = useNavigation();
  React.useImperativeHandle(ref, () => navigation, [navigation]);
  return null;
});

const ds = StyleSheet.create({
  layoutContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 998,
  },
  drawerWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  drawerContainer: {
    flex: 1,
    width: DRAWER_WIDTH,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerLogoImg: {
    width: 100,
    height: 44,
    marginRight: 4,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  drawerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerScroll: {
    flex: 1,
  },
  branchPickerBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchPickerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  branchModal: {
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    gap: 4,
  },
  branchModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  branchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  branchOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  drawerSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  drawerItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 12,
    marginBottom: 2,
    position: 'relative',
  },
  drawerItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemLabel: {
    fontSize: 14,
    flex: 1,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  activeDot: {
    position: 'absolute',
    top: '50%',
    width: 4,
    height: 20,
    borderRadius: 2,
    marginTop: -10,
  },
  screenHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  headerRight: {
    alignItems: 'center',
    gap: 8,
  },
});
