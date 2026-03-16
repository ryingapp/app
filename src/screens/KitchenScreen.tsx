import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Order } from '../constants/types';
import { api } from '../services/api';
import { connectRealtime } from '../services/realtime';
import { DrawerMenuButton, BackButton } from '../components/DrawerMenuButton';
import { useNavigation } from '@react-navigation/native';

// ==================== Types ====================
interface OrderItem {
  id: string;
  menuItemId: string;
  menuItem?: { nameAr?: string; nameEn?: string; name?: string };
  itemName?: string;
  nameEn?: string;
  nameAr?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  totalPrice?: number;
  selectedVariant?: {
    nameEn?: string;
    nameAr?: string;
  };
  selectedCustomizations?: Array<{
    nameEn?: string;
    nameAr?: string;
    name?: string;
  }>;
  customizations?: Array<{
    nameEn?: string;
    nameAr?: string;
    name?: string;
  }>;
}

interface KitchenOrder extends Omit<Order, 'items'> {
  items: OrderItem[];
  kitchenNotes?: string;
  notes?: string;
  table?: { tableNumber: string; location?: string | null } | null;
}

// ==================== Main Component ====================
export default function KitchenScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const { effectiveBranchId } = useAuth();
  const navigation = useNavigation();

  // State
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // ==================== Helper Functions ====================
  const getItemKey = (orderId: string, itemIndex: number): string => 
    `${orderId}:${itemIndex}`;

  const getItemName = (item: OrderItem): string => {
    if (item.menuItem && typeof item.menuItem === 'object') {
      return language === 'ar'
        ? item.menuItem.nameAr || item.menuItem.nameEn || ''
        : item.menuItem.nameEn || item.menuItem.nameAr || '';
    }
    
    return language === 'ar'
      ? item.nameAr || item.itemName || t('unknownItem')
      : item.nameEn || item.itemName || t('unknownItem');
  };

  const getItemExtras = (item: OrderItem): string => {
    const parts: string[] = [];

    // Variant
    if (item.selectedVariant) {
      parts.push(
        language === 'ar'
          ? item.selectedVariant.nameAr || item.selectedVariant.nameEn || ''
          : item.selectedVariant.nameEn || item.selectedVariant.nameAr || ''
      );
    }

    // Customizations
    const customizations = [
      ...(item.selectedCustomizations || []),
      ...(item.customizations || [])
    ];

    if (customizations.length > 0) {
      const extras = customizations
        .map(c => language === 'ar' ? c.nameAr || c.nameEn || c.name : c.nameEn || c.nameAr || c.name)
        .filter(Boolean)
        .join(' + ');
      if (extras) parts.push(extras);
    }

    return parts.join(' • ');
  };

  const getTimeElapsed = (createdAt?: string): string => {
    if (!createdAt) return '';
    
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return `${minutes} ${t('min')}`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return language === 'ar'
      ? `${hours} س ${remainingMinutes} د`
      : `${hours}h ${remainingMinutes}m`;
  };

  const getUrgencyColor = (createdAt?: string): string => {
    if (!createdAt) return colors.text;
    
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 8) return colors.success;
    if (minutes < 20) return colors.warning;
    return colors.danger;
  };

  // ==================== Data Loading ====================
  const loadKitchenOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    try {
      const data = await api.kitchen.orders(effectiveBranchId ?? undefined);
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load kitchen orders:', error);
      if (showLoading) Alert.alert(t('error'), t('failedToLoadData'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveBranchId, t]);

  useEffect(() => {
    loadKitchenOrders(false);

    // Real-time updates via WebSocket
    const disconnect = connectRealtime((message) => {
      if (['new_order', 'order_updated', 'order_status_changed'].includes(message.type)) {
        loadKitchenOrders(false);
      }
    });

    // Polling fallback every 20s in case WebSocket misses events
    const poll = setInterval(() => loadKitchenOrders(false), 20000);

    return () => {
      disconnect();
      clearInterval(poll);
    };
  }, [loadKitchenOrders]);

  // ==================== Item Selection ====================
  useEffect(() => {
    // Clean up invalid keys when orders change
    const validKeys = new Set<string>();
    orders.forEach(order => {
      order.items.forEach((_, index) => {
        validKeys.add(getItemKey(order.id, index));
      });
    });

    setSelectedItems(prev => new Set([...prev].filter(key => validKeys.has(key))));
    setCompletedItems(prev => new Set([...prev].filter(key => validKeys.has(key))));
  }, [orders]);

  const toggleSelectItem = (orderId: string, itemIndex: number) => {
    const key = getItemKey(orderId, itemIndex);
    if (completedItems.has(key)) return;

    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCompleteItem = (orderId: string, itemIndex: number) => {
    const key = getItemKey(orderId, itemIndex);
    
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // Also remove from selected if completed
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const completeSelectedItems = (order: KitchenOrder) => {
    const keysToComplete: string[] = [];
    
    order.items.forEach((_, index) => {
      const key = getItemKey(order.id, index);
      if (selectedItems.has(key) && !completedItems.has(key)) {
        keysToComplete.push(key);
      }
    });

    if (keysToComplete.length === 0) return;

    setCompletedItems(prev => {
      const next = new Set(prev);
      keysToComplete.forEach(key => next.add(key));
      return next;
    });

    setSelectedItems(prev => {
      const next = new Set(prev);
      keysToComplete.forEach(key => next.delete(key));
      return next;
    });
  };

  // ==================== Order Progress ====================
  const getOrderProgress = (order: KitchenOrder) => {
    const total = order.items.length;
    let completed = 0;
    let selected = 0;

    order.items.forEach((_, index) => {
      const key = getItemKey(order.id, index);
      if (completedItems.has(key)) completed++;
      if (selectedItems.has(key)) selected++;
    });

    return {
      total,
      completed,
      selected,
      allCompleted: total > 0 && completed === total,
      progress: total > 0 ? completed / total : 0,
    };
  };

  // ==================== Update Order Status ====================
  const updateOrderStatus = async (orderId: string, status: 'preparing' | 'ready') => {
    setProcessingOrderId(orderId);
    
    // Optimistic update
    setOrders(prev => 
      prev.map(order => 
        order.id === orderId ? { ...order, status } : order
      )
    );

    try {
      await api.orders.updateStatus(orderId, status);
    } catch (error) {
      console.error('Failed to update order status:', error);
      // Revert on error
      loadKitchenOrders(false);
      Alert.alert(t('error'), t('failedToUpdateStatus'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  // ==================== Filter Orders ====================
  const pendingOrders = useMemo(() => 
    orders.filter(o => ['created', 'pending', 'confirmed'].includes(o.status)),
    [orders]
  );

  const preparingOrders = useMemo(() => 
    orders.filter(o => o.status === 'preparing'),
    [orders]
  );

  // ==================== Render ====================
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==================== Ticket Render Function ====================
  // NOTE: defined as a plain function (not a React component) to avoid
  // React unmounting/remounting on every state change when called as <Ticket>.
  const renderTicket = (order: KitchenOrder, isPreparing = false) => {
    const progress = getOrderProgress(order);
    const urgencyColor = getUrgencyColor(order.createdAt);
    const borderColor = isPreparing ? colors.info : (progress.allCompleted ? colors.success : colors.warning);

    return (
      <View style={[styles.ticket, { 
        backgroundColor: colors.surface,
        borderLeftColor: borderColor,
        borderColor: colors.border,
      }]}>

        {/* Header */}
        <View style={[styles.ticketHeader, { 
          backgroundColor: isPreparing ? colors.infoLight : colors.warningLight,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }]}>
          <View>
            <Text style={[styles.orderNumber, { color: isPreparing ? colors.info : colors.warning }]}>
              #{order.orderNumber}
            </Text>
            <Text style={[styles.orderType, { color: colors.textSecondary }]}>
              {order.orderType === 'dine_in' 
                ? `${t('table')} ${order.table?.tableNumber || order.tableId || ''}`
                : t(order.orderType)}
            </Text>
          </View>
          
          <View style={styles.ticketHeaderRight}>
            <View style={[styles.timeBadge, { 
              backgroundColor: urgencyColor + '20',
              borderColor: urgencyColor,
            }]}>
              <Ionicons name="time-outline" size={12} color={urgencyColor} />
              <Text style={[styles.timeText, { color: urgencyColor }]}>
                {getTimeElapsed(order.createdAt)}
              </Text>
            </View>
            
            <View style={[styles.statusBadge, { 
              backgroundColor: isPreparing ? colors.info : colors.warning 
            }]}>
              <Text style={styles.statusText}>
                {isPreparing ? t('preparing') : t('pending')}
              </Text>
            </View>
          </View>
        </View>

        {/* Progress */}
        <View style={[styles.progressSection, { borderTopColor: colors.border }]}>
          <View style={[styles.progressRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {language === 'ar' 
                ? `${progress.completed} / ${progress.total} منجز`
                : `${progress.completed} / ${progress.total} done`}
            </Text>
            {isPreparing && progress.selected > 0 && (
              <Text style={[styles.progressText, { color: colors.primary }]}>
                {language === 'ar' ? `${progress.selected} محدد` : `${progress.selected} selected`}
              </Text>
            )}
          </View>
          
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceLight }]}>
            <View style={[
              styles.progressFill,
              { 
                width: `${Math.max(5, progress.progress * 100)}%`,
                backgroundColor: progress.allCompleted ? colors.success : (isPreparing ? colors.info : colors.warning),
              }
            ]} />
          </View>
        </View>

        {/* Items */}
        <View style={[styles.itemsContainer, { borderTopColor: colors.border }]}>
          {order.items.map((item, index) => {
            const itemKey = getItemKey(order.id, index);
            const isCompleted = completedItems.has(itemKey);
            const isSelected = selectedItems.has(itemKey);
            const extras = getItemExtras(item);

            return (
              <View key={index} style={[
                styles.itemRow,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
                index < order.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                isCompleted && styles.completedItem,
              ]}>
                
                {/* Selection Circle */}
                {isPreparing && !isCompleted && (
                  <TouchableOpacity
                    style={[
                      styles.itemCheck,
                      isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => toggleSelectItem(order.id, index)}
                  >
                    <Ionicons 
                      name={isSelected ? 'radio-button-on' : 'ellipse-outline'}
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                )}

                {/* Quantity */}
                <View style={[styles.quantityBadge, { 
                  backgroundColor: colors.surfaceLight,
                  borderColor: colors.border,
                }]}>
                  <Text style={[styles.quantityText, { color: colors.text }]}>
                    {item.quantity}
                  </Text>
                </View>

                {/* Item Info */}
                <View style={styles.itemInfo}>
                  <Text style={[
                    styles.itemName,
                    { color: isCompleted ? colors.textMuted : colors.text },
                    isCompleted && styles.completedText,
                  ]}>
                    {getItemName(item)}
                  </Text>
                  
                  {extras ? (
                    <Text style={[styles.itemExtras, { color: colors.textSecondary }]}>
                      {extras}
                    </Text>
                  ) : null}
                  
                  {item.notes ? (
                    <View style={[styles.itemNote, { backgroundColor: colors.warningLight }]}>
                      <Ionicons name="chatbubble-outline" size={12} color={colors.warning} />
                      <Text style={[styles.itemNoteText, { color: colors.warning }]}>
                        {item.notes}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Complete/Undo Button */}
                {isPreparing && (
                  <TouchableOpacity
                    style={[
                      styles.completeButton,
                      { backgroundColor: isCompleted ? colors.textDark : colors.success },
                    ]}
                    onPress={() => toggleCompleteItem(order.id, index)}
                  >
                    <Ionicons 
                      name={isCompleted ? 'refresh' : 'checkmark'} 
                      size={14} 
                      color="#FFF" 
                    />
                    <Text style={styles.completeButtonText}>
                      {isCompleted ? t('undo') : t('done')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Kitchen Notes */}
        {(order.kitchenNotes || order.notes) && (
          <View style={[styles.notesContainer, { borderTopColor: colors.border }]}>
            {order.kitchenNotes ? (
              <View style={[styles.noteCard, { 
                backgroundColor: colors.warningLight,
                borderColor: colors.warningBorder,
              }]}>
                <Text style={[styles.noteLabel, { color: colors.warning }]}>
                  {language === 'ar' ? '🍳 ملاحظات المطبخ' : '🍳 Kitchen Notes'}
                </Text>
                <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                  {order.kitchenNotes}
                </Text>
              </View>
            ) : null}
            
            {order.notes ? (
              <View style={[styles.noteCard, { 
                backgroundColor: colors.infoLight,
                borderColor: colors.infoBorder,
              }]}>
                <Text style={[styles.noteLabel, { color: colors.info }]}>
                  {language === 'ar' ? '📋 ملاحظات الطلب' : '📋 Order Notes'}
                </Text>
                <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                  {order.notes}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Footer Actions */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {isPreparing ? (
            <View style={[styles.footerActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                style={[
                  styles.markDoneButton,
                  { backgroundColor: colors.danger },
                  progress.selected === 0 && styles.disabledButton,
                ]}
                onPress={() => completeSelectedItems(order)}
                disabled={progress.selected === 0}
              >
                <Ionicons name="checkmark-done" size={16} color="#FFF" />
                <Text style={styles.buttonText}>
                  {language === 'ar' ? 'شطب المحدد' : 'Mark Selected'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.readyButton,
                  { 
                    backgroundColor: colors.success,
                    shadowColor: colors.success,
                  },
                  processingOrderId === order.id && styles.disabledButton,
                ]}
                onPress={() => updateOrderStatus(order.id, 'ready')}
                disabled={processingOrderId === order.id}
              >
                {processingOrderId === order.id ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.buttonText}>
                      {language === 'ar' ? 'الطلب جاهز' : 'Order Ready'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.startButton,
                { backgroundColor: colors.info, shadowColor: colors.info },
                processingOrderId === order.id && styles.disabledButton,
              ]}
              onPress={() => updateOrderStatus(order.id, 'preparing')}
              disabled={processingOrderId === order.id}
            >
              {processingOrderId === order.id ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="flame" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>
                    {t('startPreparing')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      }]}>
        <View style={[styles.headerContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.headerLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <DrawerMenuButton />
            <BackButton onPress={() => navigation.goBack()} />
            <View style={[styles.headerIcon, { backgroundColor: colors.danger }]}>
              <Ionicons name="restaurant" size={22} color="#FFF" />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('kitchenDisplay')}
            </Text>
          </View>

          <View style={[styles.headerRight, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.statBadge, { 
              backgroundColor: colors.warningLight,
              borderColor: colors.warningBorder,
            }]}>
              <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.statCount, { color: colors.warning }]}>
                {pendingOrders.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.warning }]}>
                {t('new')}
              </Text>
            </View>

            <View style={[styles.statBadge, { 
              backgroundColor: colors.infoLight,
              borderColor: colors.infoBorder,
            }]}>
              <Ionicons name="flame" size={12} color={colors.info} />
              <Text style={[styles.statCount, { color: colors.info }]}>
                {preparingOrders.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.info }]}>
                {t('preparing')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: colors.surfaceLight }]}
              onPress={() => loadKitchenOrders(false)}
              disabled={refreshing}
            >
              <Ionicons 
                name={refreshing ? 'sync' : 'refresh'} 
                size={18} 
                color={colors.textSecondary}
                style={refreshing ? styles.spinning : null}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Kanban Columns */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.columns}>
        
        {/* Pending Column */}
        <View style={[styles.column, { 
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
        }]}>
          <View style={[styles.columnHeader, { 
            borderBottomColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }]}>
            <View style={[styles.columnTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.columnDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.columnTitle, { color: colors.warning }]}>
                {t('newOrders')}
              </Text>
            </View>
            <View style={[styles.columnCount, { backgroundColor: colors.warningLight }]}>
              <Text style={[styles.columnCountText, { color: colors.warning }]}>
                {pendingOrders.length}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnContent}>
            {pendingOrders.map(order => (
              <React.Fragment key={order.id}>
                {renderTicket(order, false)}
              </React.Fragment>
            ))}
            
            {pendingOrders.length === 0 && (
              <View style={styles.emptyColumn}>
                <Ionicons name="checkmark-circle" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('noNewOrders')}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Preparing Column */}
        <View style={[styles.column, { 
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
        }]}>
          <View style={[styles.columnHeader, { 
            borderBottomColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }]}>
            <View style={[styles.columnTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="flame" size={16} color={colors.info} />
              <Text style={[styles.columnTitle, { color: colors.info }]}>
                {t('inProgress')}
              </Text>
            </View>
            <View style={[styles.columnCount, { backgroundColor: colors.infoLight }]}>
              <Text style={[styles.columnCountText, { color: colors.info }]}>
                {preparingOrders.length}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnContent}>
            {preparingOrders.map(order => (
              <React.Fragment key={order.id}>
                {renderTicket(order, true)}
              </React.Fragment>
            ))}
            
            {preparingOrders.length === 0 && (
              <View style={styles.emptyColumn}>
                <Ionicons name="restaurant" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('noPreparingOrders')}
                </Text>
              </View>
            )}
          </ScrollView>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statCount: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinning: {
    transform: [{ rotate: '45deg' }],
  },
  columns: {
    flex: 1,
    padding: 16,
  },
  column: {
    width: 400,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 16,
    height: '100%',
  },
  columnHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  columnTitleRow: {
    alignItems: 'center',
    gap: 8,
  },
  columnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  columnCount: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  columnCountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  columnContent: {
    padding: 14,
    gap: 14,
  },
  emptyColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ticket: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ticketHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
  },
  orderType: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  progressSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  progressRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  itemsContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
  },
  itemRow: {
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
  },
  completedItem: {
    opacity: 0.7,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  itemCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  quantityBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '900',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemExtras: {
    fontSize: 11,
    marginTop: 2,
  },
  itemNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  itemNoteText: {
    fontSize: 10,
    fontWeight: '700',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  completeButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  notesContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  footerActions: {
    gap: 10,
  },
  markDoneButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  readyButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});