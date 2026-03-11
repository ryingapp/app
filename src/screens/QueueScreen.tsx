import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { QueueEntry } from '../constants/types';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

interface QueueStats {
  waitingCount: number;
  estimatedWaitMinutes: number;
}

export default function QueueScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [notes, setNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const queueData = await api.queue.list();
      setQueue(queueData || []);
    } catch (e: any) {
      console.error('Failed to load queue', e);
      if (!silent) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          e?.message || (language === 'ar' ? 'فشل تحميل الطابور' : 'Failed to load queue')
        );
      }
    } finally {
      setIsRefreshing(false);
    }
    // Load stats separately so a failure here doesn't block the queue list
    api.queue.stats().then((s) => setStats(s || null)).catch(() => {});
  }, [language]);

  useEffect(() => { loadData(true); }, []);

  const validatePhone = (phone: string): string => {
    const clean = phone.replace(/\D/g, '');
    if (!clean) return language === 'ar' ? 'رقم الجوال مطلوب' : 'Phone required';
    if (clean.length !== 10) return language === 'ar' ? 'يجب أن يكون 10 أرقام' : 'Must be 10 digits';
    if (!clean.startsWith('05')) return language === 'ar' ? 'يجب أن يبدأ بـ 05' : 'Must start with 05';
    return '';
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setCustomerPhone(digits);
    if (digits.length > 0) setPhoneError(validatePhone(digits));
    else setPhoneError('');
  };

  const notifyCustomerWhatsApp = (entry: QueueEntry) => {
    const phone = entry.customerPhone.replace(/\D/g, '');
    const intlPhone = phone.startsWith('0') ? '966' + phone.slice(1) : '966' + phone;
    const msg = language === 'ar'
      ? `مرحباً ${entry.customerName}، دورك جاء! رقمك في الطابور: #${entry.queueNumber}. يرجى التوجه للمطعم الآن.`
      : `Hello ${entry.customerName}, it's your turn! Queue #${entry.queueNumber}. Please come to the restaurant now.`;
    Linking.openURL(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`).catch(() => {});
    // Update status in background
    api.queue.updateStatus(entry.id, 'notified').then(() => loadData(true)).catch(() => {});
  };

  const handleSeat = (entry: QueueEntry) => {
    Alert.alert(
      language === 'ar' ? 'تأكيد الجلوس' : 'Confirm Seated',
      language === 'ar' ? `هل تم إجلاس ${entry.customerName}؟` : `Has ${entry.customerName} been seated?`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'نعم، تم الجلوس' : 'Yes, Seated',
          onPress: async () => {
            try {
              await api.queue.updateStatus(entry.id, 'seated');
              await loadData(true);
            } catch (e: any) {
              Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  const handleCancel = (entry: QueueEntry) => {
    Alert.alert(
      language === 'ar' ? 'إلغاء الدور' : 'Cancel Entry',
      language === 'ar' ? `إلغاء دور ${entry.customerName}؟` : `Cancel ${entry.customerName}'s entry?`,
      [
        { text: language === 'ar' ? 'تراجع' : 'Back', style: 'cancel' },
        {
          text: language === 'ar' ? 'إلغاء الدور' : 'Cancel Entry',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.queue.updateStatus(entry.id, 'cancelled');
              await loadData(true);
            } catch (e: any) {
              Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  const handleAddToQueue = async () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const party = Math.max(1, Number(partySize || 1));
    const err = validatePhone(phone);

    if (!name) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'اسم العميل مطلوب' : 'Customer name required');
      return;
    }
    if (err) {
      setPhoneError(err);
      return;
    }

    setIsSaving(true);
    try {
      await api.queue.add({ customerName: name, customerPhone: phone, partySize: party, notes: notes.trim() || undefined });
      setAddModalVisible(false);
      setCustomerName('');
      setCustomerPhone('');
      setPartySize('2');
      setNotes('');
      setPhoneError('');
      await loadData(true);
    } catch (e: any) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || (language === 'ar' ? 'فشل إضافة العميل للطابور' : 'Failed to add to queue'));
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'notified': return colors.emerald || '#16a34a';
      case 'seated': return colors.primary;
      case 'cancelled': return colors.rose || '#e11d48';
      case 'no_show': return colors.textMuted;
      default: return colors.amber || '#f59e0b';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      waiting: language === 'ar' ? 'في الانتظار' : 'Waiting',
      notified: language === 'ar' ? 'تم الإشعار' : 'Notified',
      seated: language === 'ar' ? 'تم الجلوس' : 'Seated',
      cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
      no_show: language === 'ar' ? 'لم يحضر' : 'No Show',
    };
    return labels[status] || status;
  };

  const waitingEntries = queue.filter((e) => e.status === 'waiting' || e.status === 'notified');
  const completedEntries = queue.filter((e) => e.status === 'seated' || e.status === 'cancelled' || e.status === 'no_show');

  // Calculate real average wait time from createdAt (always accurate)
  const avgWaitMinutes = (() => {
    if (waitingEntries.length === 0) return 0;
    const now = Date.now();
    const total = waitingEntries.reduce((sum, e) => {
      return sum + Math.max(0, Math.floor((now - new Date(e.createdAt).getTime()) / 60000));
    }, 0);
    return Math.round(total / waitingEntries.length);
  })();

  const filteredWaiting = waitingEntries.filter(
    (e) => !searchPhone || e.customerPhone.includes(searchPhone) || e.customerName.toLowerCase().includes(searchPhone.toLowerCase())
  );

  const s = dynStyles(colors, isRTL);

  const renderWaitingEntry = ({ item: entry }: { item: QueueEntry }) => {
    const isNotified = entry.status === 'notified';
    return (
      <View style={[s.entryCard, isNotified && s.entryCardNotified]}>
        {/* Queue number circle */}
        <View style={[s.queueNumberCircle, isNotified && s.queueNumberCircleNotified]}>
          <Text style={s.queueSign}>#</Text>
          <Text style={[s.queueNumberText, isNotified && { color: colors.amber || '#f59e0b' }]}>{entry.queueNumber}</Text>
        </View>

        {/* Info */}
        <View style={s.entryInfo}>
          <Text style={s.entryName}>{entry.customerName}</Text>
          <View style={s.entryMeta}>
            <Ionicons name="call-outline" size={11} color={colors.textMuted} />
            <Text style={s.metaText} numberOfLines={1}>{entry.customerPhone}</Text>
          </View>
          <View style={[s.entryMeta, { marginTop: 3 }]}>
            <View style={s.metaItem}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text style={s.metaText}>{entry.partySize} {language === 'ar' ? 'أشخاص' : 'pax'}</Text>
            </View>
{(() => {
              const elapsed = Math.max(0, Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 60000));
              return elapsed > 0 ? (
                <View style={[s.metaItem, { marginStart: 10 }]}>
                  <Ionicons name="time-outline" size={11} color={elapsed > 20 ? (colors.rose || '#e11d48') : (colors.amber || '#f59e0b')} />
                  <Text style={[s.metaText, { color: elapsed > 20 ? (colors.rose || '#e11d48') : (colors.amber || '#f59e0b') }]}>{elapsed} {language === 'ar' ? 'د' : 'min'}</Text>
                </View>
              ) : null;
            })()}
          </View>
          {/* Status badge */}
          <View style={[s.statusBadge, { backgroundColor: getStatusColor(entry.status) + '22', marginTop: 4 }]}>
            <Text style={[s.statusBadgeText, { color: getStatusColor(entry.status) }]}>{getStatusLabel(entry.status)}</Text>
          </View>
          {/* Notes */}
          {entry.notes ? (
            <Text style={s.notesText}>📝 {entry.notes}</Text>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={s.actionCol}>
          {/* WhatsApp notify */}
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.success }]} onPress={() => notifyCustomerWhatsApp(entry)}>
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
          </TouchableOpacity>
          {/* Seat */}
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleSeat(entry)}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          </TouchableOpacity>
          {/* Cancel */}
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.rose || '#e11d48' }]} onPress={() => handleCancel(entry)}>
            <Ionicons name="close-circle-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCompletedEntry = ({ item: entry }: { item: QueueEntry }) => (
    <View style={[s.completedCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={s.completedNum}>#{entry.queueNumber}</Text>
      <Text style={s.completedName} numberOfLines={1}>{entry.customerName}</Text>
      <View style={[s.statusBadge, { backgroundColor: getStatusColor(entry.status) + '22' }]}>
        <Text style={[s.statusBadgeText, { color: getStatusColor(entry.status) }]}>{getStatusLabel(entry.status)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <DrawerMenuButton />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{language === 'ar' ? 'نظام الطابور' : 'Queue Management'}</Text>
            <Text style={s.subtitle}>{language === 'ar' ? 'إدارة قائمة الانتظار' : 'Manage waiting list'}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={s.statValue}>{waitingEntries.length}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'في الانتظار' : 'Waiting'}</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="time-outline" size={18} color={colors.amber || '#f59e0b'} />
            <Text style={s.statValue}>{avgWaitMinutes}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'متوسط الانتظار (د)' : 'Avg Wait (min)'}</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="list-outline" size={18} color={colors.emerald || '#16a34a'} />
            <Text style={s.statValue}>{waitingEntries.length + completedEntries.length}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'إجمالي اليوم' : 'Total Today'}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginHorizontal: 8 }} />
          <TextInput
            style={s.searchInput}
            value={searchPhone}
            onChangeText={setSearchPhone}
            placeholder={language === 'ar' ? 'بحث بالاسم أو الجوال...' : 'Search by name or phone...'}
            placeholderTextColor={colors.textMuted}
          />
          {searchPhone.length > 0 && (
            <TouchableOpacity onPress={() => setSearchPhone('')} style={{ padding: 4, marginEnd: 4 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredWaiting}
        keyExtractor={(item) => item.id}
        renderItem={renderWaitingEntry}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(false)} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="people-outline" size={50} color={colors.textMuted} />
            <Text style={s.emptyText}>
              {isRefreshing
                ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...')
                : (language === 'ar' ? 'لا يوجد عملاء في الانتظار' : 'No customers waiting')}
            </Text>
          </View>
        }
        ListFooterComponent={
          completedEntries.length > 0 ? (
            <View style={s.completedSection}>
              <Text style={s.sectionTitle}>{language === 'ar' ? 'المكتملة اليوم' : 'Completed Today'}</Text>
              {completedEntries.slice(0, 10).map((entry) => (
                <View key={entry.id} style={[s.completedCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={s.completedNum}>#{entry.queueNumber}</Text>
                  <Text style={s.completedName} numberOfLines={1}>{entry.customerName}</Text>
                  <View style={[s.statusBadge, { backgroundColor: getStatusColor(entry.status) + '22' }]}>
                    <Text style={[s.statusBadgeText, { color: getStatusColor(entry.status) }]}>{getStatusLabel(entry.status)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      {/* Add to Queue Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={[s.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={s.modalTitle}>{language === 'ar' ? 'إضافة عميل للطابور' : 'Add to Queue'}</Text>
              <TouchableOpacity onPress={() => { setAddModalVisible(false); setPhoneError(''); }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>{language === 'ar' ? 'اسم العميل *' : 'Customer Name *'}</Text>
            <TextInput
              style={s.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={language === 'ar' ? 'أدخل اسم العميل' : 'Enter customer name'}
              placeholderTextColor={colors.textMuted}
              textAlign={isRTL ? 'right' : 'left'}
            />

            <Text style={s.inputLabel}>{language === 'ar' ? 'رقم الجوال *' : 'Phone *'}</Text>
            <TextInput
              style={[s.input, phoneError ? s.inputError : customerPhone.length === 10 ? s.inputValid : {}]}
              value={customerPhone}
              onChangeText={handlePhoneChange}
              placeholder="05XXXXXXXX"
              keyboardType="number-pad"
              placeholderTextColor={colors.textMuted}
              textAlign={isRTL ? 'right' : 'left'}
              maxLength={10}
            />
            {phoneError ? (
              <Text style={s.errorText}>⚠ {phoneError}</Text>
            ) : customerPhone.length === 10 ? (
              <Text style={s.validText}>✓ {language === 'ar' ? 'رقم صحيح' : 'Valid number'}</Text>
            ) : customerPhone.length > 0 ? (
              <Text style={s.hintText}>{customerPhone.length}/10 {language === 'ar' ? 'أرقام' : 'digits'}</Text>
            ) : null}

            <Text style={s.inputLabel}>{language === 'ar' ? 'عدد الأشخاص' : 'Party Size'}</Text>
            <TextInput
              style={s.input}
              value={partySize}
              onChangeText={setPartySize}
              placeholder={language === 'ar' ? 'عدد الأشخاص' : 'Party size'}
              keyboardType="number-pad"
              placeholderTextColor={colors.textMuted}
              textAlign={isRTL ? 'right' : 'left'}
            />

            <Text style={s.inputLabel}>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Text>
            <TextInput
              style={s.input}
              value={notes}
              onChangeText={setNotes}
              placeholder={language === 'ar' ? 'أي ملاحظات إضافية...' : 'Any additional notes...'}
              placeholderTextColor={colors.textMuted}
              textAlign={isRTL ? 'right' : 'left'}
            />

            <View style={[s.modalActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={() => { setAddModalVisible(false); setPhoneError(''); }}>
                <Text style={s.modalBtnSecondaryText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, (isSaving || !!phoneError || customerPhone.length !== 10) && { opacity: 0.5 }]}
                onPress={handleAddToQueue}
                disabled={isSaving || !!phoneError || customerPhone.length !== 10}
              >
                <Text style={s.modalBtnPrimaryText}>
                  {isSaving ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : (language === 'ar' ? 'إضافة للطابور' : 'Add to Queue')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  headerRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 12, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  subtitle: { fontSize: 12, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginTop: 1 },
  addBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  statsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: colors.surfaceLight, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  searchRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: colors.surfaceLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, paddingVertical: 9, color: colors.text, fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
  list: { padding: 14, paddingBottom: 30 },
  // Waiting entry card
  entryCard: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12, gap: 12 },
  entryCardNotified: { borderColor: colors.successLight },
  queueNumberCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceLight, borderWidth: 2, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  queueNumberCircleNotified: { backgroundColor: colors.successLight, borderColor: colors.success },
  queueSign: { fontSize: 10, fontWeight: '700', color: colors.textMuted, lineHeight: 12 },
  queueNumberText: { fontSize: 20, fontWeight: '900', color: colors.text, lineHeight: 22 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: isRTL ? 'right' : 'left', marginBottom: 3 },
  entryMeta: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  metaItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: colors.textMuted },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  notesText: { fontSize: 11, color: colors.amber || '#f59e0b', marginTop: 3 },
  actionCol: { flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // Completed
  completedSection: { marginTop: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 10, paddingHorizontal: 2 },
  completedCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 6, gap: 8, opacity: 0.7 },
  completedNum: { fontWeight: '700', color: colors.textMuted, fontSize: 13, width: 36 },
  completedName: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 14, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 6 },
  modalHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: colors.surfaceLight, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  inputError: { borderColor: colors.danger },
  inputValid: { borderColor: colors.success },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 2 },
  validText: { color: colors.success, fontSize: 11, marginTop: 2 },
  hintText: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  modalActions: { justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11 },
  modalBtnSecondary: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnSecondaryText: { color: colors.textSecondary, fontWeight: '700' },
  modalBtnPrimaryText: { color: '#FFF', fontWeight: '700' },
});
