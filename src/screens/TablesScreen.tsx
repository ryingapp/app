import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Table, TableStatus } from '../constants/types';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

type ActionMode = 'none' | 'merge' | 'transfer_select_target';

export default function TablesScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();

  const STATUS_CONFIG: Record<TableStatus, { color: string; bg: string; label: string; icon: string }> = {
    available: { color: colors.emerald, bg: colors.emeraldBg, label: t('available'), icon: 'checkmark-circle' },
    occupied: { color: colors.rose, bg: colors.roseBg, label: t('occupied'), icon: 'people' },
    reserved: { color: colors.amber, bg: colors.amberBg, label: t('reserved'), icon: 'calendar' },
    needs_cleaning: { color: colors.blue, bg: colors.blueBg, label: t('needsCleaning'), icon: 'water' },
  };

  const [tables, setTables] = useState<Table[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.tables.list();
        setTables(data);
      } catch (e) { console.error('Failed to load tables', e); }
    };
    loadData();
    // Poll every 10 seconds so table status (occupied/available) reflects real orders
    const poll = setInterval(loadData, 10000);
    return () => clearInterval(poll);
  }, []);

  const [filter, setFilter] = useState<'all' | TableStatus>('all');
  const [actionMenuTable, setActionMenuTable] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('');

  const [actionMode, setActionMode] = useState<ActionMode>('none');
  const [mergeSelected, setMergeSelected] = useState<string[]>([]);
  const [transferSourceId, setTransferSourceId] = useState<string | null>(null);

  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [splitTableId, setSplitTableId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<'equal' | 'items'>('equal');
  const [splitCount, setSplitCount] = useState('2');

  const stats = useMemo(() => ({
    all: tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
    needs_cleaning: tables.filter((t) => t.status === 'needs_cleaning').length,
    guests: tables.reduce((a, t) => a + (t.guests || 0), 0),
    revenue: tables.reduce((a, t) => a + (Number(t.currentOrderValue) || 0), 0),
  }), [tables]);

  const filteredTables = useMemo(
    () => tables.filter((t) => filter === 'all' || t.status === filter),
    [tables, filter]
  );

  const updateStatus = async (id: string, status: TableStatus) => {
    try {
      await api.tables.updateStatus(id, status);
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          if (status === 'available') return { ...t, status, guests: undefined, currentOrderValue: undefined, timeSeated: undefined };
          if (status === 'occupied' && t.status !== 'occupied') return { ...t, status, guests: 2, currentOrderValue: 0, timeSeated: 0 };
          return { ...t, status };
        })
      );
    } catch (e) {
      console.error('Failed to update table status', e);
      Alert.alert(t('error'), 'Failed to update table status');
    }
    setActionMenuTable(null);
  };

  const handleAddTable = async () => {
    if (!newTableName.trim()) return;
    try {
      const newTable = await api.tables.create({
        name: newTableName,
        capacity: parseInt(newTableCapacity) || 4,
        section: t('mainHall'),
        status: 'available',
      });
      setTables((prev) => [newTable, ...prev]);
      setAddModalVisible(false);
      setNewTableName('');
      setNewTableCapacity('');
    } catch (e: any) {
      Alert.alert(t('error'), e?.message || 'Failed to create table');
    }
  };

  const startMerge = () => {
    const currentTable = actionMenuTable;
    setActionMenuTable(null);
    if (currentTable) {
      setActionMode('merge');
      setMergeSelected([currentTable]);
    }
  };

  const toggleMergeSelect = (tableId: string) => {
    setMergeSelected((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId]
    );
  };

  const confirmMerge = () => {
    if (mergeSelected.length < 2) {
      Alert.alert(t('mergeTables'), t('mergeSelectAtLeast2'));
      return;
    }

    const selectedTables = tables.filter((t) => mergeSelected.includes(t.id));
    const totalGuests = selectedTables.reduce((a, t) => a + (t.guests || 0), 0);
    const totalOrder = selectedTables.reduce((a, t) => a + (t.currentOrderValue || 0), 0);
    const totalCapacity = selectedTables.reduce((a, t) => a + t.capacity, 0);
    const primaryTable = selectedTables[0];
    const mergedNames = selectedTables.map((t) => t.name).join(' + ');

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === primaryTable.id) {
          return {
            ...t,
            name: mergedNames,
            capacity: totalCapacity,
            status: 'occupied' as TableStatus,
            guests: totalGuests || 2,
            currentOrderValue: totalOrder,
            timeSeated: t.timeSeated || 0,
          };
        }
        if (mergeSelected.includes(t.id) && t.id !== primaryTable.id) {
          return {
            ...t,
            status: 'needs_cleaning' as TableStatus,
            guests: undefined,
            currentOrderValue: undefined,
            timeSeated: undefined,
          };
        }
        return t;
      })
    );

    Alert.alert(
      t('mergeTables'),
      `${t('mergeSuccess')}: ${mergedNames}`
    );
    cancelAction();
  };

  const startTransfer = () => {
    const currentTable = actionMenuTable;
    setActionMenuTable(null);
    if (currentTable) {
      setTransferSourceId(currentTable);
      setTransferModalVisible(true);
    }
  };

  const handleTransferTarget = (targetId: string) => {
    if (!transferSourceId || targetId === transferSourceId) return;

    const sourceTable = tables.find((t) => t.id === transferSourceId);
    const targetTable = tables.find((t) => t.id === targetId);
    if (!sourceTable || !targetTable) return;

    if (targetTable.status === 'occupied' || targetTable.status === 'reserved') {
      Alert.alert(
        language === 'ar' ? 'دمج الطاولات؟' : 'Merge Tables?',
        language === 'ar'
          ? `الطاولة ${targetTable.name} مشغولة بالفعل. هل تريد دمج الطلبات ونقل الضيوف إليها؟`
          : `Table ${targetTable.name} is already occupied. Do you want to merge orders and transfer guests?`,
        [
          { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
          {
            text: language === 'ar' ? 'دمج ونقل' : 'Merge & Transfer',
            onPress: () => {
              // Perform Merge Logic
              setTables((prev) =>
                prev.map((t) => {
                  if (t.id === targetId) {
                    return {
                      ...t,
                      guests: (t.guests || 0) + (sourceTable.guests || 0),
                      currentOrderValue: (t.currentOrderValue || 0) + (sourceTable.currentOrderValue || 0),
                      timeSeated: Math.min(t.timeSeated || Date.now(), sourceTable.timeSeated || Date.now()),
                    };
                  }
                  if (t.id === transferSourceId) {
                    return {
                      ...t,
                      status: 'needs_cleaning',
                      guests: undefined,
                      currentOrderValue: undefined,
                      timeSeated: undefined,
                    };
                  }
                  return t;
                })
              );
              // In reality, call API to merge orders
              Alert.alert(language === 'ar' ? 'تم الدمج' : 'Tables Merged', language === 'ar' ? `تم نقل الطلب من ${sourceTable.name} إلى ${targetTable.name}` : `Order transferred from ${sourceTable.name} to ${targetTable.name}`);
              cancelAction();
            }
          }
        ]
      );
      return;
    }

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === transferSourceId) {
          return {
            ...t,
            status: 'needs_cleaning' as TableStatus,
            guests: undefined,
            currentOrderValue: undefined,
            timeSeated: undefined,
          };
        }
        if (t.id === targetId) {
          return {
            ...t,
            status: 'occupied' as TableStatus,
            guests: sourceTable.guests || 2,
            currentOrderValue: sourceTable.currentOrderValue || 0,
            timeSeated: sourceTable.timeSeated || 0,
          };
        }
        return t;
      })
    );

    Alert.alert(
      t('transferOrder'),
      `${t('transferSuccess')}: ${sourceTable.name} → ${targetTable.name}`
    );
    cancelAction();
  };

  const startSplitBill = () => {
    const currentTable = actionMenuTable;
    setActionMenuTable(null);
    if (currentTable) {
      setSplitTableId(currentTable);
      setSplitModalVisible(true);
      setSplitMode('equal');
      setSplitCount('2');
    }
  };

  const confirmSplitBill = () => {
    if (!splitTableId) return;
    const table = tables.find((t) => t.id === splitTableId);
    if (!table || !table.currentOrderValue) return;

    const count = parseInt(splitCount) || 2;
    const total = Number(table.currentOrderValue);

    if (splitMode === 'equal') {
      const perPerson = (total / count).toFixed(2);
      Alert.alert(
        t('splitBill'),
        `${t('totalAmount')}: ${total} ${t('sar')}\n${t('splitInto')}: ${count}\n${t('perPerson')}: ${perPerson} ${t('sar')}`
      );
    } else {
      Alert.alert(
        t('splitBill'),
        `${t('splitByItemsInfo')}\n${t('totalAmount')}: ${total} ${t('sar')}`
      );
    }

    setSplitModalVisible(false);
    setSplitTableId(null);
  };

  const cancelAction = () => {
    setActionMode('none');
    setMergeSelected([]);
    setTransferSourceId(null);
  };

  const handleTablePress = (tableId: string) => {
    if (actionMode === 'merge') {
      toggleMergeSelect(tableId);
    } else if (actionMode === 'transfer_select_target') {
      if (tableId !== transferSourceId) {
        handleTransferTarget(tableId);
      }
    } else {
      setActionMenuTable(tableId);
    }
  };

  const handleTableLongPress = (tableId: string) => {
    if (actionMode === 'none') {
      setActionMenuTable(tableId);
    }
  };

  const filters: { key: 'all' | TableStatus; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'available', label: t('available') },
    { key: 'occupied', label: t('occupied') },
    { key: 'reserved', label: t('reserved') },
    { key: 'needs_cleaning', label: t('cleaning') },
  ];

  const s = dynStyles(colors, isRTL);

  const currentActionTable = actionMenuTable ? tables.find((t) => t.id === actionMenuTable) : null;
  const isOccupiedAction = currentActionTable?.status === 'occupied';

  const renderTable = ({ item }: { item: Table }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['available'];
    const isOccupied = item.status === 'occupied';
    const isMergeSelected = actionMode === 'merge' && mergeSelected.includes(item.id);
    const isTransferSource = actionMode === 'transfer_select_target' && item.id === transferSourceId;
    const isTransferTarget = actionMode === 'transfer_select_target' && item.id !== transferSourceId;

    return (
      <TouchableOpacity
        style={[
          s.tableCard,
          { borderColor: cfg.color + '33' },
          isMergeSelected && { borderColor: colors.primary, borderWidth: 2 },
          isTransferSource && { borderColor: colors.amber, borderWidth: 2, opacity: 0.6 },
          isTransferTarget && { borderColor: colors.emerald + '66', borderWidth: 1.5 },
        ]}
        activeOpacity={0.7}
        onLongPress={() => handleTableLongPress(item.id)}
        onPress={() => handleTablePress(item.id)}
      >
        <View style={[s.tableIndicator, { backgroundColor: cfg.color }]} />

        {isMergeSelected && (
          <View style={[s.selectionBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={14} color="#FFF" />
          </View>
        )}

        {isTransferTarget && (
          <View style={[s.selectionBadge, { backgroundColor: colors.emerald }]}>
            <Ionicons name="arrow-forward" size={14} color="#FFF" />
          </View>
        )}

        <View style={s.tableHeader}>
          <View style={s.tableHeaderRight}>
            <View style={[s.tableIcon, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
            </View>
            <View>
              <View style={s.tableNameRow}>
                <Text style={s.tableName}>{item.name}</Text>
                {item.isVIP && (
                  <View style={s.vipBadge}>
                    <Text style={s.vipText}>{t('vip')}</Text>
                  </View>
                )}
              </View>
              <Text style={s.tableSection}>{item.section}</Text>
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={s.tableBody}>
          {isOccupied ? (
            <>
              <View style={s.tableMetric}>
                <Text style={s.metricLabel}>{t('currentTotal')}</Text>
                <Text style={s.metricValue}>{item.currentOrderValue} {t('sar')}</Text>
              </View>
              <View style={s.tableMetric}>
                <Text style={s.metricLabel}>{t('guests')}</Text>
                <Text style={s.metricValue}>{item.guests}</Text>
              </View>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${Math.min(100, ((item.timeSeated || 0) / 120) * 100)}%` }]} />
              </View>
            </>
          ) : item.status === 'reserved' ? (
            <View style={[s.reservedBox, { borderColor: colors.amberBorder }]}>
              <Ionicons name="time-outline" size={16} color={colors.amber} />
              <Text style={s.reservedLabel}>{t('reservationTime')}</Text>
              <Text style={s.reservedTime}>{item.reservationTime}</Text>
            </View>
          ) : item.status === 'needs_cleaning' ? (
            <Text style={s.cleaningText}>{t('waitingForCleaning')}</Text>
          ) : (
            <Text style={s.readyText}>{t('readyToServe')}</Text>
          )}
        </View>

        <View style={s.tableFooter}>
          <View style={s.capacityRow}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={s.capacityText}>{item.capacity} {t('persons')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={s.headerRow}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <DrawerMenuButton />
            <Text style={s.title}>{t('liveMap')}</Text>
          </View>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={s.statsRow}>
          <View style={[s.statBox, { borderColor: colors.border }]}>
            <Ionicons name="people" size={18} color={colors.blue} />
            <Text style={s.statValue}>{stats.guests}</Text>
            <Text style={s.statLabel}>{t('guests')}</Text>
          </View>
          <View style={[s.statBox, { borderColor: colors.border }]}>
            <Ionicons name="cash" size={18} color={colors.emerald} />
            <Text style={[s.statValue, { color: colors.emerald }]}>{stats.revenue}</Text>
            <Text style={s.statLabel}>{t('sar')}</Text>
          </View>
          <View style={[s.statBox, { borderColor: colors.border }]}>
            <Ionicons name="restaurant" size={18} color={colors.rose} />
            <Text style={s.statValue}>{stats.occupied}/{stats.all}</Text>
            <Text style={s.statLabel}>{t('occupied')}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, filter === f.key && s.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
                {f.label}
              </Text>
              <View style={[s.filterCount, filter === f.key && s.filterCountActive]}>
                <Text style={[s.filterCountText, filter === f.key && s.filterCountTextActive]}>
                  {f.key === 'all' ? stats.all : stats[f.key]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {actionMode !== 'none' && (
        <View style={[s.actionBanner, { backgroundColor: actionMode === 'merge' ? colors.primaryDark : colors.amberBg }]}>
          <View style={s.actionBannerContent}>
            <Ionicons
              name={actionMode === 'merge' ? 'git-merge' : 'swap-horizontal'}
              size={20}
              color={actionMode === 'merge' ? colors.white : colors.amber}
            />
            <Text style={[s.actionBannerText, { color: actionMode === 'merge' ? colors.white : colors.amber }]}>
              {actionMode === 'merge'
                ? `${t('mergeSelectTables')} (${mergeSelected.length} ${t('selected')})`
                : t('transferSelectTarget')
              }
            </Text>
          </View>
          <View style={s.actionBannerButtons}>
            {actionMode === 'merge' && (
              <TouchableOpacity
                style={[s.actionConfirmBtn, { backgroundColor: colors.emerald }]}
                onPress={confirmMerge}
              >
                <Text style={s.actionConfirmText}>{t('confirm')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.actionCancelBtn, { borderColor: colors.rose }]}
              onPress={cancelAction}
            >
              <Text style={[s.actionCancelText, { color: colors.rose }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={filteredTables}
        keyExtractor={(item) => item.id}
        renderItem={renderTable}
        numColumns={2}
        contentContainerStyle={s.grid}
        columnWrapperStyle={s.gridRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textDark} />
            <Text style={s.emptyText}>{t('noMatchingTables')}</Text>
          </View>
        }
      />

      <Modal visible={!!actionMenuTable} transparent animationType="fade" onRequestClose={() => setActionMenuTable(null)}>
        <Pressable style={s.overlay} onPress={() => setActionMenuTable(null)}>
          <View style={[s.statusMenu, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}>
            <Text style={s.statusMenuTitle}>{t('tableActions')}</Text>

            {isOccupiedAction && (
              <>
                <TouchableOpacity style={s.actionMenuItem} onPress={startMerge}>
                  <View style={[s.actionMenuIcon, { backgroundColor: colors.indigoBg }]}>
                    <Ionicons name="git-merge" size={20} color={colors.indigo} />
                  </View>
                  <View style={s.actionMenuTextWrap}>
                    <Text style={s.actionMenuItemText}>{t('mergeTables')}</Text>
                    <Text style={s.actionMenuItemSub}>{t('mergeTablesDesc')}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={s.actionMenuItem} onPress={startTransfer}>
                  <View style={[s.actionMenuIcon, { backgroundColor: colors.amberBg }]}>
                    <Ionicons name="swap-horizontal" size={20} color={colors.amber} />
                  </View>
                  <View style={s.actionMenuTextWrap}>
                    <Text style={s.actionMenuItemText}>{t('transferOrder')}</Text>
                    <Text style={s.actionMenuItemSub}>{t('transferOrderDesc')}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={s.actionMenuItem} onPress={startSplitBill}>
                  <View style={[s.actionMenuIcon, { backgroundColor: colors.emeraldBg }]}>
                    <Ionicons name="cut" size={20} color={colors.emerald} />
                  </View>
                  <View style={s.actionMenuTextWrap}>
                    <Text style={s.actionMenuItemText}>{t('splitBill')}</Text>
                    <Text style={s.actionMenuItemSub}>{t('splitBillDesc')}</Text>
                  </View>
                </TouchableOpacity>

                <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
              </>
            )}

            <Text style={[s.statusMenuSubTitle, { color: colors.textMuted }]}>{t('changeStatus')}</Text>
            {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG['available']][]).map(([key, cfg]) => (
              <TouchableOpacity
                key={key}
                style={s.statusMenuItem}
                onPress={() => actionMenuTable && updateStatus(actionMenuTable, key)}
              >
                <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                <Text style={s.statusMenuText}>{cfg.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setAddModalVisible(false)}>
          <View style={[s.addModal, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={s.addModalTitle}>{t('addNewTable')}</Text>
            <Text style={s.addModalLabel}>{t('tableName')}</Text>
            <TextInput
              style={[s.addInput, { borderColor: colors.borderLight, color: colors.white }]}
              placeholder={t('tableExample')}
              placeholderTextColor={colors.textDark}
              value={newTableName}
              onChangeText={setNewTableName}
              textAlign={isRTL ? 'right' : 'left'}
            />
            <Text style={s.addModalLabel}>{t('capacity')}</Text>
            <TextInput
              style={[s.addInput, { borderColor: colors.borderLight, color: colors.white }]}
              placeholder="4"
              placeholderTextColor={colors.textDark}
              value={newTableCapacity}
              onChangeText={setNewTableCapacity}
              keyboardType="number-pad"
              textAlign={isRTL ? 'right' : 'left'}
            />
            <TouchableOpacity style={[s.addConfirmBtn, { backgroundColor: colors.primary }]} onPress={handleAddTable}>
              <Text style={s.addConfirmText}>{t('confirmAdd')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={splitModalVisible} transparent animationType="slide" onRequestClose={() => setSplitModalVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setSplitModalVisible(false)}>
          <View style={[s.splitModal, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={s.splitModalTitle}>{t('splitBill')}</Text>

            {splitTableId && (() => {
              const table = tables.find((t) => t.id === splitTableId);
              return table ? (
                <View style={[s.splitTotalBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                  <Text style={s.splitTotalLabel}>{t('totalAmount')}</Text>
                  <Text style={[s.splitTotalValue, { color: colors.emerald }]}>
                    {table.currentOrderValue} {t('sar')}
                  </Text>
                </View>
              ) : null;
            })()}

            <Text style={s.splitSectionLabel}>{t('splitMethod')}</Text>
            <View style={s.splitModeRow}>
              <TouchableOpacity
                style={[
                  s.splitModeBtn,
                  { borderColor: splitMode === 'equal' ? colors.primary : colors.border },
                  splitMode === 'equal' && { backgroundColor: colors.primaryGlow },
                ]}
                onPress={() => setSplitMode('equal')}
              >
                <Ionicons name="grid" size={24} color={splitMode === 'equal' ? colors.primary : colors.textMuted} />
                <Text style={[s.splitModeText, splitMode === 'equal' && { color: colors.primary }]}>
                  {t('equalSplit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.splitModeBtn,
                  { borderColor: splitMode === 'items' ? colors.primary : colors.border },
                  splitMode === 'items' && { backgroundColor: colors.primaryGlow },
                ]}
                onPress={() => setSplitMode('items')}
              >
                <Ionicons name="list" size={24} color={splitMode === 'items' ? colors.primary : colors.textMuted} />
                <Text style={[s.splitModeText, splitMode === 'items' && { color: colors.primary }]}>
                  {t('splitByItems')}
                </Text>
              </TouchableOpacity>
            </View>

            {splitMode === 'equal' && (
              <>
                <Text style={s.splitSectionLabel}>{t('numberOfSplits')}</Text>
                <View style={s.splitCountRow}>
                  <TouchableOpacity
                    style={[s.splitCountBtn, { backgroundColor: colors.surfaceLight }]}
                    onPress={() => setSplitCount(String(Math.max(2, (parseInt(splitCount) || 2) - 1)))}
                  >
                    <Ionicons name="remove" size={20} color={colors.white} />
                  </TouchableOpacity>
                  <TextInput
                    style={[s.splitCountInput, { borderColor: colors.borderLight, color: colors.white }]}
                    value={splitCount}
                    onChangeText={setSplitCount}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={[s.splitCountBtn, { backgroundColor: colors.surfaceLight }]}
                    onPress={() => setSplitCount(String((parseInt(splitCount) || 2) + 1))}
                  >
                    <Ionicons name="add" size={20} color={colors.white} />
                  </TouchableOpacity>
                </View>

                {splitTableId && (() => {
                  const table = tables.find((t) => t.id === splitTableId);
                  const count = parseInt(splitCount) || 2;
                  const perPerson = table?.currentOrderValue ? (Number(table.currentOrderValue) / count).toFixed(2) : '0';
                  return (
                    <View style={[s.splitPreview, { backgroundColor: colors.emeraldBg, borderColor: colors.emeraldBorder }]}>
                      <Text style={[s.splitPreviewLabel, { color: colors.emerald }]}>{t('perPerson')}</Text>
                      <Text style={[s.splitPreviewValue, { color: colors.emerald }]}>{perPerson} {t('sar')}</Text>
                    </View>
                  );
                })()}
              </>
            )}

            {splitMode === 'items' && (
              <View style={[s.splitItemsInfo, { backgroundColor: colors.blueBg, borderColor: colors.blueBorder }]}>
                <Ionicons name="information-circle" size={20} color={colors.blue} />
                <Text style={[s.splitItemsText, { color: colors.blue }]}>{t('splitByItemsInfo')}</Text>
              </View>
            )}

            <View style={s.splitActions}>
              <TouchableOpacity
                style={[s.splitCancelBtn, { borderColor: colors.border }]}
                onPress={() => setSplitModalVisible(false)}
              >
                <Text style={[s.splitCancelText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.splitConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={confirmSplitBill}
              >
                <Text style={s.splitConfirmText}>{t('confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
      
      {/* Transfer Select Modal */}
      <Modal visible={transferModalVisible} transparent animationType="slide" onRequestClose={() => setTransferModalVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setTransferModalVisible(false)}>
          <Pressable style={[s.addModal, { backgroundColor: colors.surface, width: '90%', maxHeight: '80%' }]} onPress={(e) => e.stopPropagation()}>
            <Text style={s.addModalTitle}>{language === 'ar' ? 'اختر الطاولة المستهدفة' : 'Select Target Table'}</Text>
            <FlatList
              data={tables.filter(t => t.id !== transferSourceId)}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row', 
                    alignItems: 'center', 
                    padding: 16, 
                    borderBottomWidth: 1, 
                    borderBottomColor: colors.border 
                  }}
                  onPress={() => {
                    setTransferModalVisible(false);
                    handleTransferTarget(item.id);
                  }}
                >
                  <View style={[s.tableIcon, { backgroundColor: (STATUS_CONFIG[item.status] ?? STATUS_CONFIG['available']).bg, marginEnd: 12 }]}>
                    <Ionicons name={(STATUS_CONFIG[item.status] ?? STATUS_CONFIG['available']).icon as any} size={20} color={(STATUS_CONFIG[item.status] ?? STATUS_CONFIG['available']).color} />
                  </View>
                  <View style={{ flex: 1 }}>
                      <Text style={[s.statusMenuText, { textAlign: isRTL ? 'right' : 'left' }]}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' }}>
                        {(STATUS_CONFIG[item.status] ?? STATUS_CONFIG['available']).label}
                        {item.guests ? ` • ${item.guests} ${t('guests')}` : ''}
                      </Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={[s.splitCancelBtn, { marginTop: 10, borderColor: colors.border }]} 
              onPress={() => setTransferModalVisible(false)}
            >
               <Text style={[s.splitCancelText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingBottom: 12 },
  headerRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statBox: { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 10, borderWidth: 1 },
  statValue: { fontSize: 16, fontWeight: '900', color: colors.white },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.white },
  filterCount: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  filterCountTextActive: { color: colors.white },
  actionBanner: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  actionBannerContent: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, flex: 1 },
  actionBannerText: { fontSize: 13, fontWeight: '700' },
  actionBannerButtons: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 },
  actionConfirmBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  actionConfirmText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  actionCancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionCancelText: { fontSize: 13, fontWeight: '700' },
  grid: { padding: 12 },
  gridRow: { gap: 12, marginBottom: 12 },
  tableCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, overflow: 'hidden', position: 'relative' as const },
  tableIndicator: { height: 3, width: '100%' },
  selectionBadge: { position: 'absolute' as const, top: 8, right: isRTL ? undefined : 8, left: isRTL ? 8 : undefined, zIndex: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tableHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  tableHeaderRight: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flex: 1 },
  tableIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tableNameRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
  tableName: { fontSize: 15, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  vipBadge: { backgroundColor: colors.amber, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  vipText: { fontSize: 8, fontWeight: '900', color: '#000', letterSpacing: 1 },
  tableSection: { fontSize: 11, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  tableBody: { paddingHorizontal: 14, minHeight: 50 },
  tableMetric: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 4 },
  metricLabel: { fontSize: 11, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' },
  metricValue: { fontSize: 14, fontWeight: '800', color: colors.white },
  progressBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.rose, borderRadius: 2 },
  reservedBox: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: colors.amberBg, borderWidth: 1, borderRadius: 12, padding: 10 },
  reservedLabel: { fontSize: 12, fontWeight: '600', color: colors.amber, flex: 1, textAlign: isRTL ? 'right' : 'left' },
  reservedTime: { fontSize: 16, fontWeight: '900', color: colors.white },
  cleaningText: { fontSize: 13, color: colors.blue, textAlign: 'center', fontWeight: '600' },
  readyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  tableFooter: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10 },
  capacityRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  capacityText: { fontSize: 11, color: colors.textMuted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  statusMenu: { width: '100%', borderRadius: 20, padding: 16, borderWidth: 1, maxHeight: '80%' },
  statusMenuTitle: { fontSize: 18, fontWeight: '800', color: colors.white, textAlign: 'center', marginBottom: 16 },
  statusMenuSubTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, textAlign: isRTL ? 'right' : 'left', paddingHorizontal: 16 },
  actionMenuItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  actionMenuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionMenuTextWrap: { flex: 1 },
  actionMenuItemText: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  actionMenuItemSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  menuDivider: { height: 1, marginVertical: 8, marginHorizontal: 16 },
  statusMenuItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
  statusMenuText: { fontSize: 16, fontWeight: '600', color: colors.text },
  addModal: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1 },
  addModalTitle: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left', marginBottom: 20 },
  addModalLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', marginBottom: 8 },
  addInput: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, borderWidth: 1, height: 48, paddingHorizontal: 14, fontSize: 16, marginBottom: 16 },
  addConfirmBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  splitModal: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1 },
  splitModalTitle: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left', marginBottom: 20 },
  splitTotalBox: { borderRadius: 12, padding: 16, borderWidth: 1, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  splitTotalLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  splitTotalValue: { fontSize: 22, fontWeight: '900' },
  splitSectionLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', marginBottom: 10 },
  splitModeRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 20 },
  splitModeBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5 },
  splitModeText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  splitCountRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  splitCountBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitCountInput: { width: 60, height: 44, borderRadius: 12, borderWidth: 1, fontSize: 20, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.3)' },
  splitPreview: { borderRadius: 12, padding: 16, borderWidth: 1, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  splitPreviewLabel: { fontSize: 14, fontWeight: '600' },
  splitPreviewValue: { fontSize: 20, fontWeight: '900' },
  splitItemsInfo: { borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  splitItemsText: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: isRTL ? 'right' : 'left' },
  splitActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 },
  splitCancelBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  splitCancelText: { fontSize: 15, fontWeight: '700' },
  splitConfirmBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
