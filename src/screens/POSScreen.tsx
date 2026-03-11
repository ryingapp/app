import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { MenuItem, CartItem, Variant, CustomizationOption, OrderType, HeldOrder } from '../constants/types';
import { api, ApiError } from '../services/api';
import { connectRealtime } from '../services/realtime';
import { DrawerMenuButton } from '../components/DrawerMenuButton';
import { purchaseWithSoftPos, logSoftPosDiagnostics } from '../services/edfapaySoftpos';
import { autoPrintOrderDocuments } from '../services/printer';
import { queueOfflineSale } from '../services/offlineSales';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== Types ====================
interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
}

interface RestaurantSettings {
  taxRate?: number;
  taxEnabled?: boolean;
  serviceQuickOrder?: boolean;
}

// ==================== Constants ====================
const HELD_PREFIX = '[HELD]';
const HELD_LOCAL_KEY = 'pos_held_orders_local';
const TAX_RATE_DEFAULT = 15;

// ==================== Main Component ====================
export default function POSScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();

  // ==================== State ====================
  // UI State
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid2' | 'grid3' | 'list'>('grid2');
  const [cartVisible, setCartVisible] = useState(false);
  const [heldOrdersVisible, setHeldOrdersVisible] = useState(false);
  const [splitBillVisible, setSplitBillVisible] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPendingPayModal, setShowPendingPayModal] = useState(false);
  const [pendingPayOrder, setPendingPayOrder] = useState<HeldOrder | null>(null);
  const [pendingPayMethod, setPendingPayMethod] = useState<'cash' | 'card' | 'online'>('cash');
  const [isPendingPaying, setIsPendingPaying] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Order State
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online'>('cash');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings | null>(null);

  // Product Customization State
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [currentVariant, setCurrentVariant] = useState<Variant | null>(null);
  const [currentCustomizations, setCurrentCustomizations] = useState<CustomizationOption[]>([]);

  // Split Bill State
  const [splitMode, setSplitMode] = useState<'equal' | 'items'>('equal');
  const [splitCount, setSplitCount] = useState(2);
  const [selectedSplitItems, setSelectedSplitItems] = useState<string[]>([]);

  // ==================== Refs ====================
  const flatListRef = useRef<FlatList>(null);

  // ==================== Helper Functions ====================
  const sanitizePhone = useCallback((phone: string): string | undefined => {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length >= 9 ? digits : undefined;
  }, []);

  const getItemPrice = useCallback((item: MenuItem): number => {
    const prices = item.multiPrices || [];
    const mp = prices.find((p: any) => p.menuItemId === item.id);
    if (!mp) return Number(item.price || 0);
    
    switch (orderType) {
      case 'dine_in': return Number(mp.dineIn || item.price || 0);
      case 'takeaway': return Number(mp.takeaway || item.price || 0);
      case 'delivery': return Number(mp.delivery || item.price || 0);
      default: return Number(item.price || 0);
    }
  }, [orderType]);

  const formatTimeAgo = useCallback((iso: string): string => {
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    
    if (mins < 1) return language === 'ar' ? 'الآن' : 'Now';
    if (mins < 60) return language === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
    
    const hrs = Math.floor(mins / 60);
    return language === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`;
  }, [language]);

  // ==================== Computed Values ====================
  const cartTotal = useMemo(() => 
    cart.reduce((sum, item) => sum + item.finalUnitPrice * item.quantity, 0),
    [cart]
  );

  const taxRate = restaurantSettings?.taxRate ?? TAX_RATE_DEFAULT;
  const taxEnabled = restaurantSettings?.taxEnabled !== false;
  const tax = taxEnabled ? cartTotal * (taxRate / 100) : 0;
  const grandTotal = cartTotal + tax;
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = activeCategory === 'all' || item.categoryId === activeCategory;
      const matchSearch = item.nameAr.includes(searchQuery) || 
                         item.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery, menuItems]);

  // ==================== Data Loading ====================
  const loadHeldOrders = useCallback(async () => {
    const mapOrder = (o: any): HeldOrder => {
      const note = String(o.notes || '');
      const holdMatch = note.match(/H-\d+/);
      return {
        id: o.id,
        holdNumber: holdMatch?.[0] || o.orderNumber || `H-${o.id?.slice?.(0, 4) || '0000'}`,
        items: (o.items || []).map((item: any) => ({
          id: item.menuItemId || item.id,
          categoryId: item.categoryId || '',
          nameEn: item.nameEn || item.itemName || 'Item',
          nameAr: item.nameAr || item.itemName || 'عنصر',
          price: Number(item.unitPrice || item.price || 0),
          image: item.image || '🍽️',
          isAvailable: true,
          cartId: Math.random().toString(),
          quantity: Number(item.quantity || 1),
          selectedVariant: item.selectedVariant,
          selectedCustomizations: item.selectedCustomizations || [],
          finalUnitPrice: Number(item.unitPrice || item.finalUnitPrice || item.price || 0),
        })),
        customerName: o.customerName,
        tableId: o.tableId,
        orderType: o.orderType || 'dine_in',
        subtotal: Number(o.subtotal || 0),
        heldAt: o.createdAt || new Date().toISOString(),
        heldBy: o.cashierName || (language === 'ar' ? 'كاشير' : 'Cashier'),
        notes: o.notes,
        isPaid: !!(o.isPaid),
      };
    };

    const results: (HeldOrder & { __local?: boolean; isPendingApproval?: boolean })[] = [];

    // 1) Load local held orders from AsyncStorage (work even without a day session)
    try {
      const raw = await AsyncStorage.getItem(HELD_LOCAL_KEY);
      if (raw) {
        const local = JSON.parse(raw) as (HeldOrder & { __local?: boolean })[];
        results.push(...local.map(h => ({ ...h, __local: true as const })));
      }
    } catch {}

    // 2) Load server held orders + pending table orders
    try {
      const [allOrders, allTables] = await Promise.all([
        api.orders.list(),
        api.tables.list().catch(() => [] as any[]),
      ]);

      // Build tableId → tableNumber map for display
      const tableNumberMap = new Map<string, string | number>();
      for (const t of (allTables || [])) {
        tableNumberMap.set(t.id, t.tableNumber ?? t.name ?? t.id);
      }
      const tableLabel = (tableId: string) =>
        `${language === 'ar' ? 'طاولة' : 'Table'} ${tableNumberMap.get(tableId) ?? tableId}`;

      const serverHeld = (allOrders || [])
        .filter((o: any) => o.status === 'created' && String(o.notes || '').includes(HELD_PREFIX))
        .map(mapOrder);
      const pendingTable = (allOrders || [])
        .filter((o: any) => o.status === 'pending' && o.orderType === 'dine_in' && o.tableId)
        .map((o: any) => ({ ...mapOrder(o), holdNumber: tableLabel(o.tableId), isPendingApproval: true }));
      // confirmed + preparing: stay visible in cashier until paid
      const inKitchenTable = (allOrders || [])
        .filter((o: any) => ['confirmed', 'preparing'].includes(o.status) && o.orderType === 'dine_in' && o.tableId && !o.isPaid)
        .map((o: any) => ({ ...mapOrder(o), holdNumber: tableLabel(o.tableId), isInKitchen: true, kitchenStatus: o.status }));
      const readyTable = (allOrders || [])
        .filter((o: any) => o.status === 'ready' && o.orderType === 'dine_in' && o.tableId)
        .map((o: any) => ({ ...mapOrder(o), holdNumber: tableLabel(o.tableId), isReadyToPay: true, isPaid: !!(o.isPaid) }));
      results.push(...readyTable, ...inKitchenTable, ...pendingTable, ...serverHeld);
    } catch {}

    setHeldOrders(results);
  }, [language]);

  const loadData = useCallback(async () => {
    try {
      const [cats, items, restaurant] = await Promise.all([
        api.categories.list(),
        api.menuItems.list(),
        api.restaurant.get(),
      ]);
      setCategories(cats || []);
      setMenuItems(items || []);
      setRestaurantSettings(restaurant || {});
      await loadHeldOrders();
    } catch (error) {
      console.error('Failed to load POS data:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data'
      );
    }
  }, [language, loadHeldOrders]);

  useEffect(() => {
    loadData();

    const disconnect = connectRealtime((msg) => {
      if (['new_order', 'order_updated', 'order_status_changed', 'data_changed'].includes(msg.type)) {
        loadHeldOrders();
      }
    });

    return disconnect;
  }, [loadData, loadHeldOrders]);

  // ==================== Cart Operations ====================
  const addToCart = useCallback((item: MenuItem, variant: Variant | null, customizations: CustomizationOption[]) => {
    let finalPrice = getItemPrice(item);
    if (variant) finalPrice += Number(variant.priceAdjustment || 0);
    customizations.forEach((c) => (finalPrice += Number(c.priceAdjustment || 0)));

    setCart((prev) => [
      ...prev,
      {
        ...item,
        cartId: Math.random().toString(),
        quantity: 1,
        selectedVariant: variant || undefined,
        selectedCustomizations: customizations,
        finalUnitPrice: finalPrice,
      },
    ]);
    setSelectedProduct(null);
  }, [getItemPrice]);

  const updateQuantity = useCallback((cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartVisible(false);
  }, []);

  // ==================== Product Selection ====================
  const handleProductPress = useCallback(async (item: MenuItem) => {
    if (item.variants?.length || item.customizationGroups?.length) {
      setSelectedProduct(item);
      setCurrentVariant(item.variants?.find((v) => v.isDefault) || item.variants?.[0] || null);
      setCurrentCustomizations([]);
      return;
    }

    setLoadingItemId(item.id);
    try {
      const [rawVariants, rawLinks] = await Promise.all([
        api.menuItems.getVariants(item.id).catch(() => []),
        api.menuItems.getCustomizationLinks(item.id).catch(() => []),
      ]);

      const groups = await Promise.all(
        rawLinks.map((link: any) =>
          api.customizationGroups.get(link.customizationGroupId).catch(() => null)
        )
      );
      const customizationGroups = groups.filter(Boolean);

      const enriched: MenuItem = {
        ...item,
        variants: rawVariants.length > 0 ? rawVariants : undefined,
        customizationGroups: customizationGroups.length > 0 ? customizationGroups : undefined,
      };

      setMenuItems((prev) => prev.map((m) => m.id === item.id ? enriched : m));

      if (enriched.variants?.length || enriched.customizationGroups?.length) {
        setSelectedProduct(enriched);
        setCurrentVariant(enriched.variants?.find((v: any) => v.isDefault) || enriched.variants?.[0] || null);
        setCurrentCustomizations([]);
      } else {
        addToCart(item, null, []);
      }
    } catch {
      addToCart(item, null, []);
    } finally {
      setLoadingItemId(null);
    }
  }, [addToCart]);

  const toggleCustomization = useCallback((option: CustomizationOption, groupType: 'single' | 'multiple') => {
    setCurrentCustomizations((prev) => {
      const exists = prev.find((o) => o.id === option.id);
      
      if (groupType === 'single') {
        const group = selectedProduct?.customizationGroups?.find((g) => 
          g.options.some((o) => o.id === option.id)
        );
        const filtered = prev.filter((o) => !group?.options.some((go) => go.id === o.id));
        return [...filtered, option];
      }
      
      return exists ? prev.filter((o) => o.id !== option.id) : [...prev, option];
    });
  }, [selectedProduct]);

  // ==================== Held Orders ====================
  const toHeldOrder = useCallback((order: any): HeldOrder => {
    const note = String(order.notes || '');
    const holdMatch = note.match(/H-\d+/);
    
    return {
      id: order.id,
      holdNumber: holdMatch?.[0] || order.orderNumber || `H-${order.id?.slice?.(0, 4) || '0000'}`,
      items: (order.items || []).map((item: any) => ({
        id: item.menuItemId || item.id,
        categoryId: item.categoryId || '',
        nameEn: item.nameEn || item.itemName || item.name || 'Item',
        nameAr: item.nameAr || item.itemName || item.name || 'عنصر',
        price: Number(item.unitPrice || item.price || 0),
        image: item.image || '🍽️',
        isAvailable: true,
        cartId: Math.random().toString(),
        quantity: Number(item.quantity || 1),
        selectedVariant: item.selectedVariant,
        selectedCustomizations: item.selectedCustomizations || [],
        finalUnitPrice: Number(item.unitPrice || item.finalUnitPrice || item.price || 0),
      })),
      customerName: order.customerName,
      tableId: order.tableId,
      orderType: order.orderType || 'dine_in',
      subtotal: Number(order.subtotal || 0),
      heldAt: order.createdAt || new Date().toISOString(),
      heldBy: order.cashierName || (language === 'ar' ? 'كاشير' : 'Cashier'),
      notes: order.notes,
    };
  }, [language]);

  const holdCurrentOrder = useCallback(async () => {
    if (cart.length === 0) return;

    const holdNum = `H-${String(heldOrders.length + 1).padStart(3, '0')}`;

    // Try to save on server first (requires open day session)
    let savedToServer = false;
    try {
      const payload = {
        orderType,
        paymentMethod,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.finalUnitPrice,
          totalPrice: item.finalUnitPrice * item.quantity,
          notes: '',
        })),
        subtotal: cartTotal,
        taxAmount: 0,
        taxRate: 0,
        total: cartTotal,
        tableId: orderType === 'dine_in' && tableNumber ? tableNumber : undefined,
        customerName: customerName || undefined,
        customerPhone: sanitizePhone(customerPhone),
        notes: `${HELD_PREFIX} ${holdNum}${orderNotes ? ` | ${orderNotes}` : ''}`,
        status: 'created',
      };
      await api.orders.create(payload);
      savedToServer = true;
    } catch {}

    // Fallback: save locally in AsyncStorage (works without day session / offline)
    if (!savedToServer) {
      try {
        const newLocal: HeldOrder & { __local: boolean } = {
          id: `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          holdNumber: holdNum,
          items: [...cart],
          customerName: customerName || undefined,
          tableId: orderType === 'dine_in' && tableNumber ? tableNumber : undefined,
          orderType,
          subtotal: cartTotal,
          heldAt: new Date().toISOString(),
          heldBy: language === 'ar' ? 'كاشير' : 'Cashier',
          notes: orderNotes || undefined,
          __local: true,
        };
        const existing = JSON.parse((await AsyncStorage.getItem(HELD_LOCAL_KEY)) || '[]');
        await AsyncStorage.setItem(HELD_LOCAL_KEY, JSON.stringify([...existing, newLocal]));
      } catch (e) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'فشل تعليق الطلب' : 'Failed to hold order'
        );
        return;
      }
    }

    await loadHeldOrders();
    clearCart();
    Alert.alert(
      language === 'ar' ? 'تم تعليق الطلب' : 'Order Held',
      language === 'ar' ? `تم تعليق الطلب ${holdNum}` : `Order ${holdNum} has been held`
    );
  }, [cart, cartTotal, orderType, paymentMethod, tableNumber, customerName, customerPhone, orderNotes, heldOrders.length, language, sanitizePhone, loadHeldOrders, clearCart]);

  const resumeHeldOrder = useCallback((held: HeldOrder & { __local?: boolean }) => {
    const doResume = async () => {
      setCart(held.items);
      setOrderType(held.orderType);
      setHeldOrdersVisible(false);
      setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));

      if (held.__local) {
        try {
          const existing = JSON.parse((await AsyncStorage.getItem(HELD_LOCAL_KEY)) || '[]');
          await AsyncStorage.setItem(HELD_LOCAL_KEY, JSON.stringify(existing.filter((h: any) => h.id !== held.id)));
        } catch {}
      } else {
        api.orders.delete(held.id).catch(console.error);
      }
    };

    if (cart.length > 0) {
      Alert.alert(
        language === 'ar' ? 'السلة غير فارغة' : 'Cart Not Empty',
        language === 'ar' ? 'هل تريد استبدال العناصر الحالية؟' : 'Replace current cart items?',
        [
          { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: language === 'ar' ? 'استبدال' : 'Replace', style: 'destructive', onPress: doResume },
        ]
      );
    } else {
      doResume();
    }
  }, [cart.length, language]);

  const deleteHeldOrder = useCallback(async (id: string, isLocal?: boolean) => {
    try {
      if (isLocal) {
        const existing = JSON.parse((await AsyncStorage.getItem(HELD_LOCAL_KEY)) || '[]');
        await AsyncStorage.setItem(HELD_LOCAL_KEY, JSON.stringify(existing.filter((h: any) => h.id !== id)));
      } else {
        await api.orders.delete(id);
      }
      setHeldOrders((prev) => prev.filter((h) => h.id !== id));
    } catch (error) {
      console.error('Failed to delete held order:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل حذف الطلب المعلق' : 'Failed to delete held order'
      );
    }
  }, [language]);

  const confirmPendingOrder = useCallback((order: HeldOrder) => {
    setPendingPayOrder(order);
    setPendingPayMethod('cash');
    setShowPendingPayModal(true);
  }, []);

  // Direct confirm for QR table orders (no payment needed yet — kitchen will handle then payment comes later)
  const [isConfirmingOrder, setIsConfirmingOrder] = useState<string | null>(null);
  const directConfirmTableOrder = useCallback(async (order: HeldOrder) => {
    if (isConfirmingOrder) return;
    setIsConfirmingOrder(order.id);
    try {
      await api.orders.updateStatus(order.id, 'confirmed');
      loadHeldOrders();
      Alert.alert(
        language === 'ar' ? 'تم التأكيد' : 'Confirmed',
        language === 'ar'
          ? `تم تأكيد ${order.holdNumber} وإرساله للمطبخ`
          : `${order.holdNumber} confirmed and sent to kitchen`
      );
    } catch (err: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        err?.message || (language === 'ar' ? 'فشل تأكيد الطلب' : 'Failed to confirm order')
      );
    } finally {
      setIsConfirmingOrder(null);
    }
  }, [isConfirmingOrder, language, loadHeldOrders]);

  const completePendingPayment = useCallback(async () => {
    if (!pendingPayOrder || isPendingPaying) return;
    setIsPendingPaying(true);
    try {
      // Already paid electronically (customer paid via QR): just close the order
      if ((pendingPayOrder as any).isPaid) {
        const isReadyToPay = (pendingPayOrder as any).isReadyToPay;
        await api.orders.updateStatus(pendingPayOrder.id, isReadyToPay ? 'completed' : 'confirmed');
        setShowPendingPayModal(false);
        setPendingPayOrder(null);
        loadHeldOrders();
        Alert.alert(
          language === 'ar' ? 'تم' : 'Done',
          language === 'ar' ? 'تم إغلاق الطلب بنجاح' : 'Order closed successfully'
        );
        return;
      }

      const subtotal = pendingPayOrder.subtotal;
      const calculatedTax = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + calculatedTax;
      let paymentMetaNote = '';

      if (pendingPayMethod === 'card') {
        logSoftPosDiagnostics('pos:card:pending-approval');
        const paymentResult = await purchaseWithSoftPos({
          amount: total.toFixed(2),
          orderId: pendingPayOrder.id,
        });
        paymentMetaNote = `[SOFTPOS] RRN:${paymentResult.rrn || '-'} AUTH:${paymentResult.authCode || '-'} TXN:${paymentResult.transactionNumber || '-'}`;
      }

      await api.orders.update(pendingPayOrder.id, {
        paymentMethod: pendingPayMethod,
        isPaid: pendingPayMethod !== 'online',
        ...(paymentMetaNote ? { notes: ([pendingPayOrder.notes, paymentMetaNote].filter(Boolean).join(' | ')) } : {}),
      });
      const isReadyToPay = (pendingPayOrder as any).isReadyToPay;
      await api.orders.updateStatus(pendingPayOrder.id, isReadyToPay ? 'completed' : 'confirmed');

      setShowPendingPayModal(false);
      setPendingPayOrder(null);
      loadHeldOrders();
      Alert.alert(
        language === 'ar' ? 'تم' : 'Success',
        isReadyToPay
          ? (language === 'ar' ? 'تم تحصيل الدفع وإغلاق الطلب' : 'Payment collected and order completed')
          : (language === 'ar' ? 'تم الدفع وإرسال الطلب للمطبخ' : 'Payment collected and order sent to kitchen')
      );
    } catch (error: any) {
      logSoftPosDiagnostics('pos:card:failed');
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        error?.message || (language === 'ar' ? 'فشل إتمام الدفع' : 'Payment failed')
      );
    } finally {
      setIsPendingPaying(false);
    }
  }, [pendingPayOrder, isPendingPaying, pendingPayMethod, taxEnabled, taxRate, language, loadHeldOrders]);

  // ==================== Order Operations ====================
  const checkout = useCallback(() => {
    if (cart.length === 0) return;

    if (restaurantSettings?.serviceQuickOrder) {
      confirmOrder('cash');
      return;
    }

    setShowPaymentModal(true);
  }, [cart.length, restaurantSettings?.serviceQuickOrder]);

  const confirmOrder = useCallback(async (quickPaymentMethod?: string) => {
    if (isPlacingOrder) return;
    
    setIsPlacingOrder(true);
    let orderData: any;

    try {
      const finalPaymentMethod = quickPaymentMethod || paymentMethod;
      const calculatedTax = taxEnabled ? cartTotal * (taxRate / 100) : 0;
      const total = cartTotal + calculatedTax;
      let paymentMetaNote = '';

      if (finalPaymentMethod === 'card') {
        logSoftPosDiagnostics('pos:card:before-purchase');
        const paymentResult = await purchaseWithSoftPos({
          amount: total.toFixed(2),
          orderId: `POS-${Date.now()}`,
        });

        paymentMetaNote = `[SOFTPOS] RRN:${paymentResult.rrn || '-'} AUTH:${paymentResult.authCode || '-'} TXN:${paymentResult.transactionNumber || '-'}`;
      }

      const mergedNotes = [orderNotes, paymentMetaNote].filter(Boolean).join(' | ');

      orderData = {
        orderType,
        paymentMethod: finalPaymentMethod,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.finalUnitPrice,
          totalPrice: item.finalUnitPrice * item.quantity,
          notes: '',
          variantId: item.selectedVariant?.id,
          variantName: item.selectedVariant ? (language === 'ar' ? item.selectedVariant.nameAr : item.selectedVariant.nameEn) : undefined,
          customizations: item.selectedCustomizations.map((c) => ({
            id: c.id,
            name: language === 'ar' ? c.nameAr : c.nameEn,
            priceAdjustment: c.priceAdjustment,
          })),
        })),
        subtotal: cartTotal,
        taxAmount: calculatedTax,
        taxRate,
        total,
        tableId: orderType === 'dine_in' && tableNumber ? tableNumber : undefined,
        customerName: customerName || undefined,
        customerPhone: sanitizePhone(customerPhone),
        notes: mergedNotes || undefined,
        status: 'confirmed',
      };

      const createdOrder = await api.orders.create(orderData);

      // Handle printing in background
      (async () => {
        try {
          let invoicePayload = null;
          try {
            invoicePayload = await api.invoices.getByOrder(createdOrder.id);
          } catch {
            console.warn('Invoice fetch failed, using order data');
          }

          if (!invoicePayload) {
            invoicePayload = {
              id: createdOrder.id,
              invoiceNumber: createdOrder.orderNumber || `ORD-${createdOrder.id}`,
              subtotal: cartTotal,
              taxAmount: calculatedTax,
              taxRate,
              total,
              paymentMethod: finalPaymentMethod,
              customerName: customerName || undefined,
              customerPhone: sanitizePhone(customerPhone),
              createdAt: new Date().toISOString(),
              qrCodeData: undefined,
              cashierName: '',
              isPaid: true,
              order: createdOrder,
            };
          }

          await autoPrintOrderDocuments({
            order: createdOrder,
            invoice: invoicePayload,
            orderItems: cart.map((item) => ({
              itemName: language === 'ar' ? item.nameAr : item.nameEn,
              quantity: item.quantity,
              categoryId: item.categoryId,
              categoryName: language === 'ar' ? item.categoryId || '' : item.categoryId || '',
              selectedCustomizations: item.selectedCustomizations,
              variantName: item.selectedVariant ? (language === 'ar' ? item.selectedVariant.nameAr : item.selectedVariant.nameEn) : undefined,
            })),
            restaurant: restaurantSettings,
            language,
          });
        } catch (printError) {
          console.warn('Auto print failed:', printError);
        }
      })();
      
      Alert.alert(
        language === 'ar' ? 'تم إرسال الطلب' : 'Order Placed',
        language === 'ar' ? 'تم إرسال الطلب بنجاح' : 'Order has been placed successfully'
      );
      
      clearCart();
      setShowPaymentModal(false);
      setCustomerName('');
      setCustomerPhone('');
      setTableNumber('');
      setOrderNotes('');
      setPaymentMethod('cash');
      
    } catch (error: any) {
      logSoftPosDiagnostics('pos:card:failed');
      console.error('Order placement failed:', error);

      const isNetworkFailure = error instanceof ApiError
        ? error.status === 0
        : /Network request failed|Failed to fetch|ERR_CONNECTION_REFUSED/i.test(String(error?.message || ''));

      if (isNetworkFailure && orderData) {
        try {
          const offlineSale = await queueOfflineSale(orderData);

          (async () => {
            try {
              await autoPrintOrderDocuments({
                order: {
                  ...orderData,
                  orderNumber: offlineSale.localOrderNumber,
                  createdAt: offlineSale.createdAt,
                },
                invoice: offlineSale.invoiceData || {
                  id: offlineSale.id,
                  invoiceNumber: offlineSale.localInvoiceNumber,
                  orderId: offlineSale.id,
                  invoiceType: 'simplified',
                  status: 'issued',
                  subtotal: Number(orderData.subtotal || 0),
                  taxAmount: Number(orderData.taxAmount || 0),
                  taxRate: Number(orderData.taxRate || 0),
                  total: Number(orderData.total || 0),
                  customerName: orderData.customerName,
                  customerPhone: orderData.customerPhone,
                  paymentMethod: orderData.paymentMethod,
                  isPaid: orderData.paymentMethod !== 'online',
                  qrCodeData: '',
                  cashierName: 'Offline Cashier',
                  createdAt: offlineSale.createdAt,
                },
                orderItems: cart.map((item) => ({
                  itemName: language === 'ar' ? item.nameAr : item.nameEn,
                  quantity: item.quantity,
                  categoryId: item.categoryId,
                  categoryName: language === 'ar' ? item.categoryId || '' : item.categoryId || '',
                  selectedCustomizations: item.selectedCustomizations,
                  variantName: item.selectedVariant ? (language === 'ar' ? item.selectedVariant.nameAr : item.selectedVariant.nameEn) : undefined,
                })),
                restaurant: restaurantSettings,
                language,
              });
            } catch (printError) {
              console.warn('Offline print failed:', printError);
            }
          })();

          Alert.alert(
            language === 'ar' ? 'تم حفظ الطلب محليًا' : 'Order Saved Offline',
            language === 'ar'
              ? `تم حفظ الطلب محليًا وسيرسل تلقائيًا عند عودة الاتصال. رقم الطلب: ${offlineSale.localOrderNumber}`
              : `The order was saved offline and will sync automatically. Order: ${offlineSale.localOrderNumber}`
          );
          
          clearCart();
          setShowPaymentModal(false);
          setCustomerName('');
          setCustomerPhone('');
          setTableNumber('');
          setOrderNotes('');
          setPaymentMethod('cash');
          
          return;
        } catch (offlineError: any) {
          console.error('Offline save failed:', offlineError);
          Alert.alert(
            language === 'ar' ? 'تعذر حفظ الطلب أوفلاين' : 'Offline Save Failed',
            offlineError?.message || (language === 'ar' ? 'حدث خطأ محلي' : 'Local error occurred')
          );
          return;
        }
      }

      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        error?.message || (language === 'ar' ? 'فشل في إرسال الطلب' : 'Failed to place order')
      );
    } finally {
      setIsPlacingOrder(false);
    }
  }, [
    isPlacingOrder,
    paymentMethod,
    taxEnabled,
    cartTotal,
    taxRate,
    orderNotes,
    orderType,
    cart,
    language,
    tableNumber,
    customerName,
    customerPhone,
    restaurantSettings,
    sanitizePhone,
    clearCart,
  ]);

  // ==================== Split Bill ====================
  const handleSplitBill = useCallback(async () => {
    if (cart.length === 0) return;

    const createSplitOrder = async (itemsChunk: CartItem[], orderIndex: number, totalParts: number) => {
      const subtotal = itemsChunk.reduce((sum, item) => sum + item.finalUnitPrice * item.quantity, 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + taxAmount;

      await api.orders.create({
        orderType,
        paymentMethod,
        items: itemsChunk.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.finalUnitPrice,
          totalPrice: item.finalUnitPrice * item.quantity,
          notes: '',
          variantId: item.selectedVariant?.id,
          customizations: item.selectedCustomizations.map((c) => ({
            id: c.id,
            name: language === 'ar' ? c.nameAr : c.nameEn,
            priceAdjustment: c.priceAdjustment,
          })),
        })),
        subtotal,
        taxAmount,
        taxRate,
        total,
        tableId: orderType === 'dine_in' && tableNumber ? tableNumber : undefined,
        customerName: customerName || undefined,
        customerPhone: sanitizePhone(customerPhone),
        notes: `${orderNotes ? `${orderNotes} | ` : ''}[SPLIT ${orderIndex + 1}/${totalParts}]`,
        status: 'confirmed',
      });
    };

    try {
      if (splitMode === 'items') {
        const first = cart.filter((i) => selectedSplitItems.includes(i.cartId));
        const second = cart.filter((i) => !selectedSplitItems.includes(i.cartId));

        if (first.length === 0 || second.length === 0) {
          Alert.alert(
            language === 'ar' ? 'تنبيه' : 'Notice',
            language === 'ar' ? 'اختر أصناف للفاتورة الأولى' : 'Select items for bill 1'
          );
          return;
        }

        await createSplitOrder(first, 0, 2);
        await createSplitOrder(second, 1, 2);
      } else {
        const parts = Math.max(2, splitCount);
        const bucketMaps: Array<Record<string, CartItem>> = Array.from({ length: parts }, () => ({}));

        const getItemKey = (item: CartItem) => {
          const variant = item.selectedVariant?.id || '';
          const custom = (item.selectedCustomizations || [])
            .map((c) => c.id)
            .sort()
            .join(',');
          return `${item.id}|${variant}|${custom}`;
        };

        let unitCounter = 0;
        for (const item of cart) {
          for (let qty = 0; qty < item.quantity; qty++) {
            const bucketIndex = unitCounter % parts;
            unitCounter++;
            const key = getItemKey(item);

            if (!bucketMaps[bucketIndex][key]) {
              bucketMaps[bucketIndex][key] = {
                ...item,
                cartId: Math.random().toString(),
                quantity: 0,
              };
            }
            bucketMaps[bucketIndex][key].quantity += 1;
          }
        }

        const buckets = bucketMaps.map((m) => Object.values(m)).filter((b) => b.length > 0);
        for (let idx = 0; idx < buckets.length; idx++) {
          await createSplitOrder(buckets[idx], idx, buckets.length);
        }
      }

      Alert.alert(
        language === 'ar' ? 'تم' : 'Done',
        language === 'ar' ? 'تم حفظ الفواتير المقسمة' : 'Split orders saved'
      );

      setSplitBillVisible(false);
      setCartVisible(false);
      setCart([]);
      setSelectedSplitItems([]);
    } catch (error: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        error?.message || (language === 'ar' ? 'فشل تقسيم الفاتورة' : 'Failed to split order')
      );
    }
  }, [
    cart,
    splitMode,
    selectedSplitItems,
    splitCount,
    orderType,
    paymentMethod,
    tableNumber,
    customerName,
    customerPhone,
    orderNotes,
    taxEnabled,
    taxRate,
    language,
    sanitizePhone,
  ]);

  const toggleSplitItem = useCallback((cartId: string) => {
    setSelectedSplitItems((prev) =>
      prev.includes(cartId) ? prev.filter((id) => id !== cartId) : [...prev, cartId]
    );
  }, []);

  // ==================== UI Handlers ====================
  const updateOrderType = useCallback((type: OrderType) => {
    setOrderType(type);
    setCart((prev) =>
      prev.map((item) => {
        const prices = item.multiPrices || [];
        const mp = prices.find((p: any) => p.menuItemId === item.id);
        if (!mp) return item;
        
        let basePrice: number;
        switch (type) {
          case 'dine_in': basePrice = Number(mp.dineIn || item.price || 0); break;
          case 'takeaway': basePrice = Number(mp.takeaway || item.price || 0); break;
          case 'delivery': basePrice = Number(mp.delivery || item.price || 0); break;
          default: basePrice = Number(item.price || 0);
        }
        
        if (item.selectedVariant) basePrice += Number(item.selectedVariant.priceAdjustment || 0);
        item.selectedCustomizations.forEach((c) => (basePrice += Number(c.priceAdjustment || 0)));
        
        return { ...item, finalUnitPrice: basePrice };
      })
    );
  }, []);

  // ==================== Render ====================
  const numColumns = viewMode === 'list' ? 1 : viewMode === 'grid3' ? 3 : 2;

  // Render Menu Item
  const renderMenuItem = useCallback(({ item }: { item: MenuItem }) => {
    const price = getItemPrice(item);
    const imageUri = item.image && (item.image.startsWith('http') || item.image.startsWith('/'))
      ? (item.image.startsWith('/') ? `https://tryingpos.com${item.image}` : item.image)
      : '';

    const primaryName = language === 'ar' ? item.nameAr : item.nameEn;
    const secondaryName = language === 'ar' ? item.nameEn : item.nameAr;
    const itemCartCount = cart.filter((c) => c.id === item.id).reduce((sum, c) => sum + c.quantity, 0);
    const hasVariants = (item.variants?.length ?? 0) > 0;
    const hasCustomGroups = (item.customizationGroups?.length ?? 0) > 0;
    const isSimpleVariants = hasVariants && !hasCustomGroups;

    const handleVariantChip = (v: Variant) => {
      if (isSimpleVariants) {
        addToCart(item, v, []);
      } else {
        setSelectedProduct(item);
        setCurrentVariant(v);
        setCurrentCustomizations([]);
      }
    };

    // List Mode
    if (viewMode === 'list') {
      return (
        <TouchableOpacity 
          style={[styles.menuCardList, { backgroundColor: colors.surface, borderColor: colors.border }]} 
          activeOpacity={0.75} 
          onPress={() => handleProductPress(item)}
        >
          <View style={styles.menuImageWrapList}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.menuImageList} resizeMode="cover" />
            ) : (
              <View style={[styles.menuImagePlaceholderList, { backgroundColor: colors.surfaceLight }]}>
                <Ionicons name="restaurant-outline" size={24} color={colors.textMuted} />
              </View>
            )}
            {itemCartCount > 0 && (
              <View style={[styles.cartQtyBadge, { backgroundColor: colors.rose }]}>
                <Text style={styles.cartQtyText}>{itemCartCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.menuCardListBody}>
            <Text style={[styles.menuName, { color: colors.text }]} numberOfLines={1}>
              {primaryName}
            </Text>
            {!!secondaryName && (
              <Text style={[styles.menuNameEn, { color: colors.textMuted }]} numberOfLines={1}>
                {secondaryName}
              </Text>
            )}
            {hasVariants && (
              <View style={styles.variantChipsRow}>
                {item.variants!.slice(0, 4).map((v) => (
                  <TouchableOpacity 
                    key={v.id} 
                    style={[styles.variantChip, { backgroundColor: colors.primaryLight }]} 
                    onPress={() => handleVariantChip(v)}
                  >
                    <Text style={[styles.variantChipText, { color: colors.primary }]}>
                      {language === 'ar' ? v.nameAr : v.nameEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.menuCardListRight}>
            <Text style={[styles.menuPriceTextLarge, { color: colors.success }]}>
              {Number(price).toFixed(2)}
            </Text>
            <Text style={[styles.menuSarLabel, { color: colors.textMuted }]}>{t('sar')}</Text>
            <TouchableOpacity 
              style={[styles.menuAddBtnRound, { backgroundColor: colors.primary }]} 
              onPress={() => handleProductPress(item)} 
              disabled={loadingItemId === item.id}
            >
              {loadingItemId === item.id ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="add" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    // Grid Mode
    const isSmall = viewMode === 'grid3';
    return (
      <TouchableOpacity
        style={[
          styles.menuCard,
          isSmall && styles.menuCardSm,
          { backgroundColor: colors.surface, borderColor: colors.borderLight }
        ]}
        activeOpacity={0.75}
        onPress={() => handleProductPress(item)}
      >
        <View style={[styles.menuImageWrap, isSmall && { height: 82 }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.menuImage} resizeMode="cover" />
          ) : (
            <View style={[styles.menuImagePlaceholder, { backgroundColor: colors.surfaceLight }]}>
              <Ionicons name="restaurant-outline" size={isSmall ? 22 : 28} color={colors.textMuted} />
            </View>
          )}
          {itemCartCount > 0 && (
            <View style={[styles.cartQtyBadge, { backgroundColor: colors.rose }]}>
              <Text style={styles.cartQtyText}>{itemCartCount}</Text>
            </View>
          )}
          <View style={[styles.menuPriceBadge, { backgroundColor: 'rgba(8,12,20,0.85)' }]}>
            <Text style={[styles.menuPriceText, { color: colors.success }]}>
              {Number(price).toFixed(2)} {t('sar')}
            </Text>
          </View>
        </View>

        <View style={[styles.menuBody, isSmall && styles.menuBodySm]}>
          <Text style={[styles.menuName, isSmall && styles.menuNameSm, { color: colors.text }]} numberOfLines={isSmall ? 2 : 1}>
            {primaryName}
          </Text>
          {!isSmall && !!secondaryName && (
            <Text style={[styles.menuNameEn, { color: colors.textMuted }]} numberOfLines={1}>
              {secondaryName}
            </Text>
          )}
        </View>

        {hasVariants && !isSmall && (
          <View style={styles.variantChipsRow}>
            {item.variants!.slice(0, 3).map((v) => (
              <TouchableOpacity 
                key={v.id} 
                style={[styles.variantChip, { backgroundColor: colors.primaryLight }]} 
                onPress={() => handleVariantChip(v)}
              >
                <Text style={[styles.variantChipText, { color: colors.primary }]}>
                  {language === 'ar' ? v.nameAr : v.nameEn}
                </Text>
              </TouchableOpacity>
            ))}
            {item.variants!.length > 3 && (
              <View style={[styles.variantChip, { backgroundColor: 'transparent', borderStyle: 'dashed' }]}>
                <Text style={[styles.variantChipText, { color: colors.textMuted }]}>
                  +{item.variants!.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={[styles.menuCardFoot, isSmall && { padding: 6 }]}>
          <TouchableOpacity
            style={[
              styles.menuAddBtnRow,
              isSmall && { paddingVertical: 5, borderRadius: 9 },
              { backgroundColor: colors.primary }
            ]}
            onPress={() => handleProductPress(item)}
            disabled={loadingItemId === item.id}
          >
            {loadingItemId === item.id ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="add" size={isSmall ? 14 : 16} color="#FFF" />
                {!isSmall && (
                  <Text style={styles.menuAddBtnText}>
                    {hasVariants ? (language === 'ar' ? 'اختر' : 'Choose') : (language === 'ar' ? 'أضف' : 'Add')}
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [viewMode, language, cart, loadingItemId, colors, t, addToCart, handleProductPress, getItemPrice]);

  // Render Held Order Item
  const renderHeldOrder = useCallback(({ item }: { item: HeldOrder }) => {
    const isPending = (item as any).isPendingApproval;
    const isReadyToPay = (item as any).isReadyToPay;
    const isInKitchen = (item as any).isInKitchen;
    const kitchenStatus = (item as any).kitchenStatus as string | undefined;

    const borderColor = isReadyToPay
      ? (colors.success || '#16a34a')
      : isInKitchen
        ? (colors.info || '#3b82f6')
        : colors.border;

    return (
      <View style={[styles.heldCard, { backgroundColor: colors.surfaceLight, borderColor }]}>
        <View style={styles.heldCardTop}>
          <View style={{ flex: 1 }}>
            <View style={[styles.heldCardRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.heldCardNumber, { color: colors.text }]}>{item.holdNumber}</Text>
              <View style={[
                styles.heldTypeBadge,
                { backgroundColor: isInKitchen
                    ? (kitchenStatus === 'preparing' ? '#fef3c7' : '#dbeafe')
                    : (item.orderType === 'dine_in' ? colors.successLight : colors.warningLight) }
              ]}>
                <Text style={[
                  styles.heldTypeText,
                  { color: isInKitchen
                      ? (kitchenStatus === 'preparing' ? '#d97706' : '#2563eb')
                      : (item.orderType === 'dine_in' ? colors.success : colors.warning) }
                ]}>
                  {isInKitchen
                    ? (kitchenStatus === 'preparing'
                        ? (language === 'ar' ? '🍳 يُحضَّر' : '🍳 Preparing')
                        : (language === 'ar' ? '✅ مؤكد' : '✅ Confirmed'))
                    : (item.orderType === 'dine_in' ? (language === 'ar' ? 'محلي' : 'Dine-in') :
                       item.orderType === 'takeaway' ? (language === 'ar' ? 'سفري' : 'Takeaway') :
                       (language === 'ar' ? 'توصيل' : 'Delivery'))}
                </Text>
              </View>
            </View>
            
            {item.customerName && (
              <Text style={[styles.heldCardCustomer, { color: colors.textSecondary }]}>
                {item.customerName}
              </Text>
            )}
            
            <View style={[styles.heldCardRow, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 4 }]}>
              <Text style={[styles.heldCardTime, { color: colors.textMuted }]}>
                {formatTimeAgo(item.heldAt)}
              </Text>
              <Text style={[styles.heldCardAmount, { color: colors.success }]}>
                {item.subtotal.toFixed(2)} {t('sar')}
              </Text>
            </View>
            
            {item.notes && (
              <Text style={[styles.heldCardNotes, { color: colors.textMuted }]}>
                {item.notes}
              </Text>
            )}
          </View>
        </View>
        
        <View style={[styles.heldCardActions, { borderTopColor: colors.border }]}>
          {isReadyToPay ? (
            <TouchableOpacity
              style={[styles.resumeBtn, { backgroundColor: colors.primary }]}
              onPress={() => confirmPendingOrder(item as any)}
            >
              <Ionicons name="card" size={16} color="#FFF" />
              <Text style={styles.resumeBtnText}>
                {language === 'ar' ? 'تحصيل الدفع' : 'Collect Payment'}
              </Text>
            </TouchableOpacity>
          ) : isInKitchen ? (
            // Still in kitchen - show info + early collect option
            <TouchableOpacity
              style={[styles.resumeBtn, { backgroundColor: '#6b7280' }]}
              onPress={() => confirmPendingOrder(item as any)}
            >
              <Ionicons name="card-outline" size={16} color="#FFF" />
              <Text style={styles.resumeBtnText}>
                {language === 'ar' ? 'تحصيل مبكر' : 'Collect Now'}
              </Text>
            </TouchableOpacity>
          ) : isPending ? (
            <TouchableOpacity 
              style={[styles.resumeBtn, { backgroundColor: colors.success, opacity: isConfirmingOrder === item.id ? 0.6 : 1 }]} 
              onPress={() => directConfirmTableOrder(item as any)}
              disabled={!!isConfirmingOrder}
            >
              {isConfirmingOrder === item.id ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              )}
              <Text style={styles.resumeBtnText}>
                {language === 'ar' ? 'تأكيد وإرسال للمطبخ' : 'Confirm & Send to Kitchen'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.resumeBtn, { backgroundColor: colors.primary }]} 
              onPress={() => resumeHeldOrder(item as any)}
            >
              <Ionicons name="play" size={16} color="#FFF" />
              <Text style={styles.resumeBtnText}>
                {language === 'ar' ? 'استئناف' : 'Resume'}
              </Text>
            </TouchableOpacity>
          )}
          
          {!isPending && !isReadyToPay && !isInKitchen && (
            <TouchableOpacity 
              style={[styles.deleteHeldBtn, { backgroundColor: colors.dangerLight }]} 
              onPress={() => deleteHeldOrder(item.id, (item as any).__local)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [isRTL, language, colors, t, formatTimeAgo, confirmPendingOrder, resumeHeldOrder, deleteHeldOrder, directConfirmTableOrder, isConfirmingOrder]);

  // ==================== Pending QR Payment Modal ====================
  const renderPendingPayModal = () => {
    if (!pendingPayOrder) return null;
    const isReadyToPay = (pendingPayOrder as any).isReadyToPay;
    const isAlreadyPaid = isReadyToPay && !!(pendingPayOrder as any).isPaid;
    const subtotal = pendingPayOrder.subtotal;
    const calculatedTax = taxEnabled ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + calculatedTax;
    return (
      <Modal visible={showPendingPayModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowPendingPayModal(false)}>
          <Pressable style={[styles.cartModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.cartHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.cartTitle, { color: colors.text }]}>
                {isReadyToPay
                  ? (language === 'ar' ? `تحصيل دفع ${pendingPayOrder.holdNumber}` : `Collect Payment - ${pendingPayOrder.holdNumber}`)
                  : (language === 'ar' ? `تأكيد طلب ${pendingPayOrder.holdNumber}` : `Approve ${pendingPayOrder.holdNumber}`)}
              </Text>
              <TouchableOpacity onPress={() => setShowPendingPayModal(false)} style={{ marginRight: 'auto' }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              {isAlreadyPaid ? (
                <View style={{ backgroundColor: '#dcfce7', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name="checkmark-circle" size={28} color="#16a34a" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#15803d', fontWeight: '700', fontSize: 16 }}>
                      {language === 'ar' ? 'تم الدفع إلكترونيًا ✓' : 'Paid Electronically ✓'}
                    </Text>
                    <Text style={{ color: '#16a34a', fontSize: 13, marginTop: 2 }}>
                      {language === 'ar' ? 'دفع العميل عبر QR. اضغط لإغلاق الطلب.' : 'Customer paid via QR. Tap to close order.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 12 }]}>
                    {language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                  </Text>
                  <View style={[styles.paymentRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {([
                      { key: 'cash' as const, icon: 'cash-outline', labelAr: 'نقد', labelEn: 'Cash' },
                      { key: 'card' as const, icon: 'card-outline', labelAr: 'بطاقة', labelEn: 'Card' },
                      { key: 'online' as const, icon: 'phone-portrait-outline', labelAr: 'إلكتروني', labelEn: 'Online' },
                    ]).map((pm) => (
                      <TouchableOpacity
                        key={pm.key}
                        style={[styles.paymentBtn, pendingPayMethod === pm.key && styles.paymentBtnActive, { borderColor: colors.borderLight }]}
                        onPress={() => setPendingPayMethod(pm.key)}
                      >
                        <Ionicons name={pm.icon as any} size={18} color={pendingPayMethod === pm.key ? '#FFF' : colors.textMuted} />
                        <Text style={[styles.paymentBtnText, pendingPayMethod === pm.key && styles.paymentBtnTextActive, { color: pendingPayMethod === pm.key ? '#FFF' : colors.textMuted }]}>
                          {language === 'ar' ? pm.labelAr : pm.labelEn}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <View style={[styles.orderSummary, { backgroundColor: colors.surfaceLight, borderColor: colors.border, marginTop: 16 }]}>
                <View style={styles.cartTotalRow}>
                  <Text style={[styles.cartTotalLabel, { color: colors.textMuted }]}>{t('subtotal')}</Text>
                  <Text style={[styles.cartTotalValue, { color: colors.text }]}>{subtotal.toFixed(2)} {t('sar')}</Text>
                </View>
                {taxEnabled && (
                  <View style={styles.cartTotalRow}>
                    <Text style={[styles.cartTotalLabel, { color: colors.textMuted }]}>{t('tax')} ({taxRate}%)</Text>
                    <Text style={[styles.cartTotalValue, { color: colors.text }]}>{calculatedTax.toFixed(2)} {t('sar')}</Text>
                  </View>
                )}
                <View style={[styles.cartTotalRow, styles.cartGrandRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.cartGrandLabel, { color: colors.text }]}>{t('total')}</Text>
                  <Text style={[styles.cartGrandValue, { color: colors.success }]}>{total.toFixed(2)} {t('sar')}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.checkoutBtn, { backgroundColor: isAlreadyPaid ? '#16a34a' : colors.primary, marginTop: 16 }]}
                onPress={completePendingPayment}
                disabled={isPendingPaying}
              >
                {isPendingPaying ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                    <Text style={styles.checkoutText}>
                      {isAlreadyPaid
                        ? (language === 'ar' ? 'إغلاق الطلب' : 'Close Order')
                        : (language === 'ar' ? `تأكيد الدفع - ${total.toFixed(2)} ${t('sar')}` : `Confirm Payment - ${total.toFixed(2)} ${t('sar')}`)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // Render Cart Item
  const renderCartItem = useCallback(({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}>
      <View style={styles.cartItemInfo}>
        <Text style={[styles.cartItemName, { color: colors.text }]} numberOfLines={2}>
          {language === 'ar' ? item.nameAr : item.nameEn}
        </Text>
        
        {item.selectedVariant && (
          <View style={styles.cartItemTag}>
            <Ionicons name="options-outline" size={11} color={colors.primary} />
            <Text style={[styles.cartItemTagText, { color: colors.primary }]}>
              {language === 'ar' ? item.selectedVariant.nameAr : item.selectedVariant.nameEn}
            </Text>
          </View>
        )}
        
        {item.selectedCustomizations.map((c, idx) => (
          <View key={idx} style={styles.cartItemTag}>
            <Text style={[styles.cartItemTagText, { color: colors.textSecondary }]}>
              • {language === 'ar' ? c.nameAr : c.nameEn}
              {c.priceAdjustment > 0 ? ` (+${c.priceAdjustment})` : ''}
            </Text>
          </View>
        ))}
        
        <Text style={[styles.cartItemPrice, { color: colors.success }]}>
          {(item.finalUnitPrice * item.quantity).toFixed(2)} {t('sar')}
        </Text>
      </View>
      
      <View style={styles.qtyControls}>
        <TouchableOpacity 
          style={[styles.qtyBtn, { backgroundColor: colors.primary }]} 
          onPress={() => updateQuantity(item.cartId, 1)}
        >
          <Ionicons name="add" size={16} color="#FFF" />
        </TouchableOpacity>
        
        <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
        
        <TouchableOpacity 
          style={[styles.qtyBtn, { backgroundColor: item.quantity === 1 ? colors.danger : colors.primary }]} 
          onPress={() => updateQuantity(item.cartId, -1)}
        >
          <Ionicons name={item.quantity === 1 ? 'trash' : 'remove'} size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  ), [language, colors, t, updateQuantity]);

  // Render Split Item
  const renderSplitItem = useCallback(({ item }: { item: CartItem }) => {
    const isSelected = selectedSplitItems.includes(item.cartId);
    
    return (
      <TouchableOpacity
        style={[
          styles.splitItemRow,
          isSelected && { backgroundColor: 'rgba(16,185,129,0.08)' },
          { borderBottomColor: colors.border }
        ]}
        onPress={() => toggleSplitItem(item.cartId)}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
        </View>
        
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.splitItemName, { color: colors.text }]}>
            {language === 'ar' ? item.nameAr : item.nameEn}
          </Text>
          <Text style={[styles.splitItemQty, { color: colors.textMuted }]}>
            x{item.quantity}
          </Text>
        </View>
        
        <Text style={[styles.splitItemPrice, { color: colors.success }]}>
          {(item.finalUnitPrice * item.quantity).toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  }, [language, colors, selectedSplitItems, toggleSplitItem]);

  // Order Type Options
  const orderTypeOptions = [
    { key: 'dine_in' as OrderType, labelAr: 'محلي', labelEn: 'Dine-in', icon: 'restaurant' },
    { key: 'takeaway' as OrderType, labelAr: 'سفري', labelEn: 'Takeaway', icon: 'bag-handle' },
    { key: 'delivery' as OrderType, labelAr: 'توصيل', labelEn: 'Delivery', icon: 'bicycle' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.topBarLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <DrawerMenuButton />
          <Text style={[styles.title, { color: colors.text }]}>{t('pos')}</Text>
        </View>
        
        <View style={[styles.topBarRight, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {orderTypeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.typePill,
                orderType === opt.key && styles.typePillActive,
                { borderColor: colors.borderLight }
              ]}
              onPress={() => updateOrderType(opt.key)}
            >
              <Ionicons 
                name={opt.icon as any} 
                size={13} 
                color={orderType === opt.key ? '#FFF' : colors.textMuted} 
              />
              <Text style={[
                styles.typePillText,
                orderType === opt.key && styles.typePillTextActive,
                { color: orderType === opt.key ? '#FFF' : colors.textMuted }
              ]}>
                {language === 'ar' ? opt.labelAr : opt.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity 
            style={[styles.iconBtn, { backgroundColor: colors.warningLight }]} 
            onPress={() => setHeldOrdersVisible(true)}
          >
            <Ionicons name="pause-circle" size={22} color={colors.warning} />
            {heldOrders.length > 0 && (
              <View style={[styles.iconBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.iconBadgeText}>{heldOrders.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]} 
            onPress={() => setCartVisible(true)}
          >
            <Ionicons name="cart" size={22} color={colors.primary} />
            {cartCount > 0 && (
              <View style={[styles.iconBadge, { backgroundColor: colors.rose }]}>
                <Text style={styles.iconBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Row */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('searchItems')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={[styles.viewToggleGroup, { backgroundColor: colors.surfaceLight }]}>
          {([
            { mode: 'grid2' as const, icon: 'grid-outline' },
            { mode: 'grid3' as const, icon: 'apps-outline' },
            { mode: 'list' as const, icon: 'list-outline' },
          ]).map(({ mode, icon }) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewToggleBtn,
                viewMode === mode && { backgroundColor: colors.primaryLight }
              ]}
              onPress={() => setViewMode(mode)}
            >
              <Ionicons 
                name={icon as any} 
                size={17} 
                color={viewMode === mode ? colors.primary : colors.textMuted} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Categories */}
      <View style={[styles.categoriesWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          <TouchableOpacity
            style={[
              styles.catBtn,
              activeCategory === 'all' && styles.catBtnActive,
              { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }
            ]}
            onPress={() => setActiveCategory('all')}
          >
            <Text style={[
              styles.catText,
              activeCategory === 'all' && styles.catTextActive,
              { color: activeCategory === 'all' ? '#FFF' : colors.textSecondary }
            ]}>
              {language === 'ar' ? 'الكل' : 'All'}
            </Text>
          </TouchableOpacity>
          
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catBtn,
                activeCategory === cat.id && styles.catBtnActive,
                { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }
              ]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={[
                styles.catText,
                activeCategory === cat.id && styles.catTextActive,
                { color: activeCategory === cat.id ? '#FFF' : colors.textSecondary }
              ]}>
                {language === 'ar' ? cat.nameAr : cat.nameEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Menu Items */}
      <FlatList
        ref={flatListRef}
        key={viewMode}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderMenuItem}
        numColumns={numColumns}
        contentContainerStyle={[
          styles.menuGrid,
          viewMode === 'list' && { paddingHorizontal: 0 }
        ]}
        columnWrapperStyle={numColumns > 1 ? styles.menuGridRow : undefined}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {language === 'ar' ? 'لا توجد أصناف' : 'No items found'}
            </Text>
          </View>
        }
      />

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <TouchableOpacity 
          style={[styles.floatingCart, { backgroundColor: colors.primary }]} 
          onPress={() => setCartVisible(true)} 
          activeOpacity={0.9}
        >
          <View style={styles.floatingCartContent}>
            <View style={styles.floatingCartLeft}>
              <Ionicons name="cart" size={20} color="#FFF" />
              <Text style={styles.floatingCartCount}>
                {cartCount} {t('item')}
              </Text>
            </View>
            <Text style={styles.floatingCartTotal}>
              {grandTotal.toFixed(2)} {t('sar')}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ==================== Modals ==================== */}

      {/* Customization Modal */}
      <Modal visible={!!selectedProduct} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedProduct(null)}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <Pressable style={[styles.customizeModal, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <View style={[styles.customizeHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.customizeTitle, { color: colors.text }]}>
                    {selectedProduct ? (language === 'ar' ? selectedProduct.nameAr : selectedProduct.nameEn) : ''}
                  </Text>
                  <Text style={[styles.customizeSubtitle, { color: colors.textMuted }]}>
                    {selectedProduct ? (language === 'ar' ? selectedProduct.nameEn : selectedProduct.nameAr) : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.customizeBody} showsVerticalScrollIndicator={false}>
                {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                  <View style={styles.customizeSection}>
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                      {language === 'ar' ? 'الاختيارات' : 'Variants'}
                    </Text>
                    <View style={styles.variantsGrid}>
                      {selectedProduct.variants.map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={[
                            styles.variantBtn,
                            currentVariant?.id === v.id && styles.variantBtnActive,
                            { borderColor: colors.borderLight }
                          ]}
                          onPress={() => setCurrentVariant(v)}
                        >
                          <Text style={[
                            styles.variantText,
                            currentVariant?.id === v.id && styles.variantTextActive,
                            { color: currentVariant?.id === v.id ? colors.primary : colors.textSecondary }
                          ]}>
                            {language === 'ar' ? v.nameAr : v.nameEn}
                          </Text>
                          {Number(v.priceAdjustment) > 0 && (
                            <Text style={[styles.variantPrice, { color: colors.success }]}>
                              +{v.priceAdjustment} {t('sar')}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {selectedProduct?.customizationGroups?.map((group) => (
                  <View key={group.id} style={styles.customizeSection}>
                    <View style={styles.sectionTitleRow}>
                      <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                        {language === 'ar' ? group.nameAr : group.nameEn}
                      </Text>
                      {group.isRequired && (
                        <View style={[styles.requiredBadge, { backgroundColor: colors.dangerLight }]}>
                          <Text style={[styles.requiredText, { color: colors.danger }]}>
                            {t('required')}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    {group.options.map((option) => {
                      const isSelected = currentCustomizations.some((c) => c.id === option.id);
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.optionBtn,
                            isSelected && styles.optionBtnActive,
                            { borderColor: colors.borderLight }
                          ]}
                          onPress={() => toggleCustomization(option, group.selectionType)}
                        >
                          <View style={styles.optionLeft}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                              {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                            </View>
                            <Text style={[styles.optionText, { color: colors.textSecondary }]}>
                              {language === 'ar' ? option.nameAr : option.nameEn}
                            </Text>
                          </View>
                          {option.priceAdjustment > 0 && (
                            <Text style={[styles.optionPrice, { color: colors.success }]}>
                              +{option.priceAdjustment}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.addToCartBtn, { backgroundColor: colors.primary }]}
                onPress={() => selectedProduct && addToCart(selectedProduct, currentVariant, currentCustomizations)}
              >
                <Text style={styles.addToCartText}>{t('addToCart')}</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Cart Modal */}
      <Modal visible={cartVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setCartVisible(false)}>
          <Pressable style={[styles.cartModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.cartHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.cartTitle, { color: colors.text }]}>{t('cart')}</Text>
              <View style={[styles.cartCountBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.cartCountText, { color: colors.primary }]}>{cart.length}</Text>
              </View>
              <TouchableOpacity onPress={() => setCartVisible(false)} style={{ marginRight: 'auto' }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyCartTitle, { color: colors.text }]}>{t('emptyCart')}</Text>
                <Text style={[styles.emptyCartSub, { color: colors.textMuted }]}>{t('addItemsToCart')}</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={cart}
                  keyExtractor={(item) => item.cartId}
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 8 }}
                  renderItem={renderCartItem}
                />

                <View style={[styles.cartFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.cartTotalRow}>
                    <Text style={[styles.cartTotalLabel, { color: colors.textMuted }]}>{t('subtotal')}</Text>
                    <Text style={[styles.cartTotalValue, { color: colors.text }]}>{cartTotal.toFixed(2)} {t('sar')}</Text>
                  </View>
                  
                  <View style={styles.cartTotalRow}>
                    <Text style={[styles.cartTotalLabel, { color: colors.textMuted }]}>
                      {t('tax')} ({taxRate}%)
                    </Text>
                    <Text style={[styles.cartTotalValue, { color: colors.text }]}>{tax.toFixed(2)} {t('sar')}</Text>
                  </View>
                  
                  <View style={[styles.cartTotalRow, styles.cartGrandRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.cartGrandLabel, { color: colors.text }]}>{t('total')}</Text>
                    <Text style={[styles.cartGrandValue, { color: colors.success }]}>{grandTotal.toFixed(2)} {t('sar')}</Text>
                  </View>

                  <View style={styles.cartActionsRow}>
                    <TouchableOpacity 
                      style={[styles.holdBtn, { backgroundColor: colors.warningLight, borderColor: colors.warningBorder }]} 
                      onPress={holdCurrentOrder}
                    >
                      <Ionicons name="pause-circle-outline" size={18} color={colors.warning} />
                      <Text style={[styles.holdBtnText, { color: colors.warning }]}>
                        {language === 'ar' ? 'تعليق' : 'Hold'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.splitBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder }]}
                      onPress={() => {
                        setSelectedSplitItems([]);
                        setSplitMode('equal');
                        setSplitCount(2);
                        setSplitBillVisible(true);
                      }}
                    >
                      <Ionicons name="git-branch-outline" size={18} color={colors.primary} />
                      <Text style={[styles.splitBtnText, { color: colors.primary }]}>
                        {language === 'ar' ? 'تقسيم' : 'Split'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={[styles.checkoutBtn, { backgroundColor: colors.primary }]} 
                    onPress={checkout}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.checkoutText}>
                      {t('checkout')} — {grandTotal.toFixed(2)} {t('sar')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Held Orders Modal */}
      <Modal visible={heldOrdersVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setHeldOrdersVisible(false)}>
          <Pressable style={[styles.heldModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.heldHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.heldTitle, { color: colors.text }]}>
                {language === 'ar' ? 'الطلبات المعلقة' : 'Held Orders'}
              </Text>
              <View style={[styles.heldCountBadge, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.heldCountText, { color: colors.warning }]}>{heldOrders.length}</Text>
              </View>
              <TouchableOpacity onPress={() => setHeldOrdersVisible(false)} style={{ marginRight: 'auto' }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {heldOrders.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="pause-circle-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyCartTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'لا توجد طلبات معلقة' : 'No Held Orders'}
                </Text>
                <Text style={[styles.emptyCartSub, { color: colors.textMuted }]}>
                  {language === 'ar' ? 'الطلبات المعلقة ستظهر هنا' : 'Held orders will appear here'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={heldOrders}
                keyExtractor={(item) => item.id}
                renderItem={renderHeldOrder}
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16 }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Split Bill Modal */}
      <Modal visible={splitBillVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSplitBillVisible(false)}>
          <Pressable style={[styles.splitModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.splitHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.splitTitle, { color: colors.text }]}>
                {language === 'ar' ? 'تقسيم الفاتورة' : 'Split Bill'}
              </Text>
              <TouchableOpacity onPress={() => setSplitBillVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.splitModeRow}>
              <TouchableOpacity
                style={[
                  styles.splitModeBtn,
                  splitMode === 'equal' && styles.splitModeBtnActive,
                  { borderColor: colors.borderLight }
                ]}
                onPress={() => setSplitMode('equal')}
              >
                <Ionicons 
                  name="people" 
                  size={18} 
                  color={splitMode === 'equal' ? '#FFF' : colors.textMuted} 
                />
                <Text style={[
                  styles.splitModeText,
                  splitMode === 'equal' && styles.splitModeTextActive,
                  { color: splitMode === 'equal' ? '#FFF' : colors.textMuted }
                ]}>
                  {language === 'ar' ? 'تقسيم متساوي' : 'Equal Split'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.splitModeBtn,
                  splitMode === 'items' && styles.splitModeBtnActive,
                  { borderColor: colors.borderLight }
                ]}
                onPress={() => setSplitMode('items')}
              >
                <Ionicons 
                  name="list" 
                  size={18} 
                  color={splitMode === 'items' ? '#FFF' : colors.textMuted} 
                />
                <Text style={[
                  styles.splitModeText,
                  splitMode === 'items' && styles.splitModeTextActive,
                  { color: splitMode === 'items' ? '#FFF' : colors.textMuted }
                ]}>
                  {language === 'ar' ? 'تقسيم بالأصناف' : 'By Items'}
                </Text>
              </TouchableOpacity>
            </View>

            {splitMode === 'equal' ? (
              <View style={styles.equalSplitContent}>
                <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'عدد الأشخاص' : 'Number of People'}
                </Text>
                
                <View style={styles.splitCountRow}>
                  <TouchableOpacity
                    style={[styles.splitCountBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setSplitCount(Math.max(2, splitCount - 1))}
                  >
                    <Ionicons name="remove" size={20} color="#FFF" />
                  </TouchableOpacity>
                  
                  <Text style={[styles.splitCountValue, { color: colors.text }]}>{splitCount}</Text>
                  
                  <TouchableOpacity
                    style={[styles.splitCountBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setSplitCount(splitCount + 1)}
                  >
                    <Ionicons name="add" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.splitPreview, { backgroundColor: colors.surfaceLight }]}>
                  <Text style={[styles.splitPreviewLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'لكل شخص' : 'Per Person'}
                  </Text>
                  <Text style={[styles.splitPreviewValue, { color: colors.success }]}>
                    {(grandTotal / splitCount).toFixed(2)} {t('sar')}
                  </Text>
                </View>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.splitItemsLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'اختر الأصناف للفاتورة الأولى:' : 'Select items for Bill 1:'}
                </Text>
                
                <FlatList
                  data={cart}
                  keyExtractor={(item) => item.cartId}
                  renderItem={renderSplitItem}
                  scrollEnabled={false}
                />

                {selectedSplitItems.length > 0 && (
                  <View style={[styles.splitPreview, { backgroundColor: colors.surfaceLight, marginTop: 10 }]}>
                    <View>
                      <Text style={[styles.splitPreviewLabel, { color: colors.textSecondary }]}>
                        {language === 'ar' ? 'فاتورة 1' : 'Bill 1'}
                      </Text>
                      <Text style={[styles.splitPreviewSub, { color: colors.success }]}>
                        {(() => {
                          const sel = cart.filter((i) => selectedSplitItems.includes(i.cartId))
                            .reduce((s, i) => s + i.finalUnitPrice * i.quantity, 0);
                          return (sel * 1.15).toFixed(2);
                        })()} {t('sar')}
                      </Text>
                    </View>
                    
                    <View>
                      <Text style={[styles.splitPreviewLabel, { color: colors.textSecondary }]}>
                        {language === 'ar' ? 'فاتورة 2' : 'Bill 2'}
                      </Text>
                      <Text style={[styles.splitPreviewSub, { color: colors.success }]}>
                        {(() => {
                          const sel = cart.filter((i) => selectedSplitItems.includes(i.cartId))
                            .reduce((s, i) => s + i.finalUnitPrice * i.quantity, 0);
                          return ((cartTotal - sel) * 1.15).toFixed(2);
                        })()} {t('sar')}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.checkoutBtn, { backgroundColor: colors.primary, margin: 16 }]}
              onPress={handleSplitBill}
            >
              <Text style={styles.checkoutText}>
                {language === 'ar' ? 'تأكيد التقسيم' : 'Confirm Split'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowPaymentModal(false)}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <Pressable style={[styles.cartModal, { backgroundColor: colors.surface }]}>
              <View style={[styles.cartHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.cartTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'إتمام الطلب' : 'Complete Order'}
                </Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)} style={{ marginRight: 'auto' }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ padding: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 12 }]}>
                  {language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                </Text>
                
                <View style={[styles.paymentRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {([
                    { key: 'cash' as const, icon: 'cash-outline', labelAr: 'نقد', labelEn: 'Cash' },
                    { key: 'card' as const, icon: 'card-outline', labelAr: 'بطاقة', labelEn: 'Card' },
                    { key: 'online' as const, icon: 'phone-portrait-outline', labelAr: 'إلكتروني', labelEn: 'Online' },
                  ]).map((pm) => (
                    <TouchableOpacity
                      key={pm.key}
                      style={[
                        styles.paymentBtn,
                        paymentMethod === pm.key && styles.paymentBtnActive,
                        { borderColor: colors.borderLight }
                      ]}
                      onPress={() => setPaymentMethod(pm.key)}
                    >
                      <Ionicons 
                        name={pm.icon as any} 
                        size={18} 
                        color={paymentMethod === pm.key ? '#FFF' : colors.textMuted} 
                      />
                      <Text style={[
                        styles.paymentBtnText,
                        paymentMethod === pm.key && styles.paymentBtnTextActive,
                        { color: paymentMethod === pm.key ? '#FFF' : colors.textMuted }
                      ]}>
                        {language === 'ar' ? pm.labelAr : pm.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {orderType !== 'dine_in' && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 8 }]}>
                      {language === 'ar' ? 'معلومات العميل' : 'Customer Info'}
                    </Text>
                    
                    <View style={[styles.inputField, { borderColor: colors.borderLight }]}>
                      <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={language === 'ar' ? 'اسم العميل' : 'Customer Name'}
                        placeholderTextColor={colors.textMuted}
                        value={customerName}
                        onChangeText={setCustomerName}
                        textAlign={isRTL ? 'right' : 'left'}
                      />
                    </View>
                    
                    <View style={[styles.inputField, { borderColor: colors.borderLight }]}>
                      <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={language === 'ar' ? 'رقم الجوال' : 'Phone Number'}
                        placeholderTextColor={colors.textMuted}
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                        keyboardType="phone-pad"
                        textAlign={isRTL ? 'right' : 'left'}
                      />
                    </View>
                  </>
                )}

                {orderType === 'dine_in' && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 8 }]}>
                      {language === 'ar' ? 'رقم الطاولة' : 'Table Number'}
                    </Text>
                    
                    <View style={[styles.inputField, { borderColor: colors.borderLight }]}>
                      <Ionicons name="grid-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={language === 'ar' ? 'رقم الطاولة' : 'Table Number'}
                        placeholderTextColor={colors.textMuted}
                        value={tableNumber}
                        onChangeText={setTableNumber}
                        keyboardType="numeric"
                        textAlign={isRTL ? 'right' : 'left'}
                      />
                    </View>
                  </>
                )}

                <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 8 }]}>
                  {language === 'ar' ? 'ملاحظات' : 'Notes'}
                </Text>
                
                <View style={[styles.inputField, { height: 60, borderColor: colors.borderLight }]}>
                  <TextInput
                    style={[styles.input, { height: 56, textAlignVertical: 'top' }]}
                    placeholder={language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                    placeholderTextColor={colors.textMuted}
                    value={orderNotes}
                    onChangeText={setOrderNotes}
                    multiline
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>

                <View style={[styles.orderSummary, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <View style={styles.cartTotalRow}>
                    <Text style={[styles.cartTotalLabel, { color: colors.textMuted }]}>{t('subtotal')}</Text>
                    <Text style={[styles.cartTotalValue, { color: colors.text }]}>{cartTotal.toFixed(2)} {t('sar')}</Text>
                  </View>
                  
                  <View style={styles.cartTotalRow}>
                    <Text style={[styles.cartTotalLabel, { color: colors.textMuted }]}>
                      {t('tax')} ({taxRate}%)
                    </Text>
                    <Text style={[styles.cartTotalValue, { color: colors.text }]}>{tax.toFixed(2)} {t('sar')}</Text>
                  </View>
                  
                  <View style={[styles.cartTotalRow, styles.cartGrandRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.cartGrandLabel, { color: colors.text }]}>{t('total')}</Text>
                    <Text style={[styles.cartGrandValue, { color: colors.success }]}>{grandTotal.toFixed(2)} {t('sar')}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.checkoutBtn, { backgroundColor: colors.primary }]} 
                  onPress={() => confirmOrder()} 
                  disabled={isPlacingOrder}
                >
                  {isPlacingOrder ? (
                    <>
                      <ActivityIndicator color="#FFF" />
                      <Text style={styles.checkoutText}>
                        {language === 'ar' ? 'جاري إنشاء الطلب...' : 'Creating order...'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                      <Text style={styles.checkoutText}>
                        {language === 'ar' ? `تأكيد الطلب - ${grandTotal.toFixed(2)} ${t('sar')}` : `Confirm - ${grandTotal.toFixed(2)} ${t('sar')}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 20 }} />
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {renderPendingPayModal()}

    </SafeAreaView>
  );
}

// ==================== Styles ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
  },

  // Top Bar
  topBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  typePillActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  typePillTextActive: {
    color: '#FFF',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  iconBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },

  // Search Row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Categories
  categoriesWrap: {
    borderBottomWidth: 1,
  },
  categoriesRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  catBtnActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
  },
  catTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },

  // Menu Grid
  menuGrid: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 110,
  },
  menuGridRow: {
    gap: 10,
    marginBottom: 10,
  },
  menuCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuCardSm: {
    borderRadius: 14,
  },
  menuImageWrap: {
    height: 110,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  menuImage: {
    width: '100%',
    height: '100%',
  },
  menuImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPriceBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  menuPriceText: {
    fontSize: 12,
    fontWeight: '900',
  },
  menuBody: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  menuBodySm: {
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 6,
  },
  menuName: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  menuNameSm: {
    fontSize: 12,
  },
  menuNameEn: {
    fontSize: 11,
  },
  menuCardFoot: {
    padding: 8,
    paddingTop: 4,
  },
  menuAddBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 9,
  },
  menuAddBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cartQtyBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  cartQtyText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  variantChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  variantChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.3)',
  },
  variantChipText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // List Mode
  menuCardList: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    gap: 10,
  },
  menuImageWrapList: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  menuImageList: {
    width: '100%',
    height: '100%',
  },
  menuImagePlaceholderList: {
    width: 68,
    height: 68,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCardListBody: {
    flex: 1,
  },
  menuCardListRight: {
    alignItems: 'center',
    gap: 2,
    minWidth: 60,
  },
  menuPriceTextLarge: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  menuSarLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  menuAddBtnRound: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Floating Cart
  floatingCart: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  floatingCartContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingCartCount: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingCartTotal: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    justifyContent: 'flex-end',
  },

  // Customize Modal
  customizeModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  customizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  customizeTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  customizeSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  customizeBody: {
    padding: 18,
  },
  customizeSection: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '700',
  },
  variantsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  variantBtn: {
    flex: 1,
    minWidth: '40%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  variantBtnActive: {
    borderColor: '#6C63FF',
    backgroundColor: 'rgba(108,99,255,0.15)',
  },
  variantText: {
    fontSize: 14,
    fontWeight: '700',
  },
  variantTextActive: {
    color: '#6C63FF',
  },
  variantPrice: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 7,
  },
  optionBtnActive: {
    borderColor: 'rgba(16,185,129,0.5)',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  addToCartBtn: {
    margin: 14,
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },

  // Cart Modal
  cartModal: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: '88%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  cartTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  cartCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cartCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCartTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyCartSub: {
    fontSize: 13,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 14,
    marginVertical: 4,
    borderWidth: 1,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '800',
  },
  cartItemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  cartItemTagText: {
    fontSize: 11,
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 4,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '900',
    minWidth: 18,
    textAlign: 'center',
  },
  cartFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cartTotalLabel: {
    fontSize: 13,
  },
  cartTotalValue: {
    fontSize: 13,
  },
  cartGrandRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    marginBottom: 10,
  },
  cartGrandLabel: {
    fontSize: 17,
    fontWeight: '900',
  },
  cartGrandValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  cartActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  holdBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  holdBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  splitBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkoutBtn: {
    flexDirection: 'row',
    gap: 8,
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  // Held Orders Modal
  heldModal: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 18,
    borderBottomWidth: 1,
  },
  heldTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  heldCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heldCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heldCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  heldCardTop: {
    flexDirection: 'row',
  },
  heldCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heldCardNumber: {
    fontSize: 15,
    fontWeight: '800',
  },
  heldTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heldTypeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heldCardCustomer: {
    fontSize: 13,
    marginTop: 3,
  },
  heldCardTime: {
    fontSize: 12,
  },
  heldCardAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  heldCardNotes: {
    fontSize: 11,
    marginTop: 3,
    fontStyle: 'italic',
  },
  heldCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resumeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  deleteHeldBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Split Modal
  splitModal: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
  },
  splitTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  splitModeRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  splitModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 13,
    borderWidth: 1,
  },
  splitModeBtnActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  splitModeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitModeTextActive: {
    color: '#FFF',
  },
  equalSplitContent: {
    padding: 14,
    alignItems: 'center',
  },
  splitLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  splitCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  splitCountBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitCountValue: {
    fontSize: 34,
    fontWeight: '900',
  },
  splitPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 13,
    padding: 14,
    marginTop: 18,
    width: '100%',
  },
  splitPreviewLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitPreviewValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10B981',
  },
  splitPreviewSub: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 3,
  },
  splitItemsLabel: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  splitItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  splitItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitItemQty: {
    fontSize: 11,
    marginTop: 2,
  },
  splitItemPrice: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Payment Modal
  paymentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  paymentBtnActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  paymentBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paymentBtnTextActive: {
    color: '#FFF',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  orderSummary: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
});