import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Reservation } from '../constants/types';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

// Format date as YYYY-MM-DD
const fmtDate = (d: Date) => d.toISOString().split('T')[0];

const TODAY = fmtDate(new Date());
const TOMORROW = fmtDate(new Date(Date.now() + 86400000));
const YESTERDAY = fmtDate(new Date(Date.now() - 86400000));

export default function ReservationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [reservationDate, setReservationDate] = useState(TODAY);
  const [reservationTime, setReservationTime] = useState('19:00');
  const [guestCount, setGuestCount] = useState('2');
  const [notes, setNotes] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [showTablePicker, setShowTablePicker] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const data = await api.reservations.list(selectedDate);
      setReservations(data || []);
    } catch (e: any) {
      if (!silent) Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || (language === 'ar' ? 'فشل تحميل الحجوزات' : 'Failed to load reservations'));
    } finally {
      setIsRefreshing(false);
    }
    api.tables.list().then((t) => setTables(t || [])).catch(() => {});
  }, [selectedDate, language]);

  useEffect(() => { loadData(true); }, [selectedDate]);

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
    setPhoneError(digits.length > 0 ? validatePhone(digits) : '');
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setPhoneError('');
    setReservationDate(TODAY);
    setReservationTime('19:00');
    setGuestCount('2');
    setNotes('');
    setSelectedTableId('');
  };

  const createReservation = async () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const gc = Math.max(1, Number(guestCount || 1));
    const err = validatePhone(phone);
    if (!name) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'اسم العميل مطلوب' : 'Customer name required');
      return;
    }
    if (err) { setPhoneError(err); return; }
    if (!reservationDate || !reservationTime) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'التاريخ والوقت مطلوبان' : 'Date and time required');
      return;
    }
    setIsSaving(true);
    try {
      await api.reservations.create({
        customerName: name,
        customerPhone: phone,
        reservationDate: `${reservationDate}T${reservationTime}`,
        reservationTime,
        guestCount: gc,
        specialRequests: notes.trim() || undefined,
        tableId: selectedTableId || undefined,
        source: 'phone',
      });
      setShowModal(false);
      resetForm();
      await loadData(true);
    } catch (e: any) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || (language === 'ar' ? 'فشل إنشاء الحجز' : 'Failed to create reservation'));
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: 'confirmed' | 'seated' | 'cancelled') => {
    try {
      await api.reservations.updateStatus(id, status);
      await loadData(true);
    } catch (e: any) {
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || 'Failed');
    }
  };

  const deleteReservation = (id: string, name: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف الحجز' : 'Delete Reservation',
      language === 'ar' ? `هل تريد حذف حجز ${name}؟` : `Delete reservation for ${name}?`,
      [
        { text: language === 'ar' ? 'تراجع' : 'Back', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.reservations.delete(id);
              await loadData(true);
            } catch (e: any) {
              Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label: language === 'ar' ? 'قيد الانتظار' : 'Pending',   color: colors.amber || '#f59e0b',   bg: (colors.amberBg   || '#f59e0b22') },
    confirmed: { label: language === 'ar' ? 'مؤكد'         : 'Confirmed', color: colors.blue  || '#3b82f6',   bg: (colors.blueBg    || '#3b82f622') },
    seated:    { label: language === 'ar' ? 'تم الجلوس'    : 'Seated',    color: colors.emerald || '#16a34a', bg: (colors.emeraldBg || '#16a34a22') },
    completed: { label: language === 'ar' ? 'مكتمل'        : 'Completed', color: colors.textMuted,             bg: colors.surfaceLight },
    cancelled: { label: language === 'ar' ? 'ملغي'         : 'Cancelled', color: colors.rose  || '#e11d48',   bg: (colors.roseBg    || '#e11d4822') },
    no_show:   { label: language === 'ar' ? 'لم يحضر'      : 'No Show',   color: colors.rose  || '#e11d48',   bg: (colors.roseBg    || '#e11d4822') },
  };

  const active = reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show');
  const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length;
  const pendingCount   = reservations.filter((r) => r.status === 'pending').length;
  const totalGuests    = active.reduce((s, r) => s + (r.guestCount || 0), 0);
  const filteredReservations = filter === 'all' ? reservations : reservations.filter((r) => r.status === filter);

  const dateLabels: Record<string, string> = {
    [YESTERDAY]: language === 'ar' ? 'أمس' : 'Yesterday',
    [TODAY]:     language === 'ar' ? 'اليوم' : 'Today',
    [TOMORROW]:  language === 'ar' ? 'غداً' : 'Tomorrow',
  };

  const s = dynStyles(colors, isRTL);

  const renderReservation = ({ item: res }: { item: Reservation }) => {
    const st = STATUS_MAP[res.status] || STATUS_MAP.pending;
    const tableName = tables.find((t) => t.id === res.tableId)?.tableNumber;
    return (
      <View style={s.card}>
        <View style={[s.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[s.cardHeaderLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={s.cardIcon}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={s.customerName}>{res.customerName}</Text>
              {res.reservationNumber ? <Text style={s.resNum}>{res.reservationNumber}</Text> : null}
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={s.detailsRow}>
          <View style={s.detailItem}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={s.detailText}>{res.reservationDate ? new Date(res.reservationDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }) : '-'} • {res.reservationTime}</Text>
          </View>
          <View style={s.detailItem}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={s.detailText}>{res.guestCount} {language === 'ar' ? 'أشخاص' : 'pax'}</Text>
          </View>
          <View style={s.detailItem}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} />
            <Text style={s.detailText}>{res.customerPhone}</Text>
          </View>
          {tableName ? (
            <View style={s.detailItem}>
              <Ionicons name="grid-outline" size={14} color={colors.emerald || '#16a34a'} />
              <Text style={[s.detailText, { color: colors.emerald || '#16a34a' }]}>{language === 'ar' ? 'طاولة' : 'Table'} {tableName}</Text>
            </View>
          ) : null}
          {res.depositAmount && Number(res.depositAmount) > 0 ? (
            <View style={[s.depositBadge, { backgroundColor: res.depositPaid ? (colors.emeraldBg || '#16a34a22') : (colors.roseBg || '#e11d4822') }]}>
              <Text style={[s.depositText, { color: res.depositPaid ? (colors.emerald || '#16a34a') : (colors.rose || '#e11d48') }]}>
                {language === 'ar' ? 'عربون' : 'Deposit'}: {res.depositAmount} {language === 'ar' ? 'ر.س' : 'SAR'} • {res.depositPaid ? (language === 'ar' ? 'مدفوع' : 'Paid') : (language === 'ar' ? 'غير مدفوع' : 'Unpaid')}
              </Text>
            </View>
          ) : null}
          {res.specialRequests ? (
            <View style={s.detailItem}>
              <Ionicons name="document-text-outline" size={14} color={colors.amber || '#f59e0b'} />
              <Text style={[s.detailText, { color: colors.amber || '#f59e0b' }]} numberOfLines={1}>{res.specialRequests}</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {res.status === 'pending' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.blueBg || '#3b82f622', borderColor: colors.blue || '#3b82f6' }]} onPress={() => updateStatus(res.id, 'confirmed')}>
              <Ionicons name="checkmark-circle-outline" size={13} color={colors.blue || '#3b82f6'} />
              <Text style={[s.actionText, { color: colors.blue || '#3b82f6' }]}>{language === 'ar' ? 'تأكيد' : 'Confirm'}</Text>
            </TouchableOpacity>
          )}
          {res.status === 'confirmed' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.emeraldBg || '#16a34a22', borderColor: colors.emerald || '#16a34a' }]} onPress={() => updateStatus(res.id, 'seated')}>
              <Ionicons name="restaurant-outline" size={13} color={colors.emerald || '#16a34a'} />
              <Text style={[s.actionText, { color: colors.emerald || '#16a34a' }]}>{language === 'ar' ? 'تم الجلوس' : 'Seat'}</Text>
            </TouchableOpacity>
          )}
          {(res.status === 'pending' || res.status === 'confirmed') && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.roseBg || '#e11d4822', borderColor: colors.rose || '#e11d48' }]} onPress={() => updateStatus(res.id, 'cancelled')}>
              <Ionicons name="close-circle-outline" size={13} color={colors.rose || '#e11d48'} />
              <Text style={[s.actionText, { color: colors.rose || '#e11d48' }]}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border, marginStart: 'auto' }]} onPress={() => deleteReservation(res.id, res.customerName)}>
            <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View style={[s.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <DrawerMenuButton />
          <Text style={s.title}>{language === 'ar' ? 'الحجوزات' : 'Reservations'}</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={s.addBtnText}>{language === 'ar' ? 'حجز جديد' : 'New'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{active.length}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'اليوم' : 'Today'}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: colors.emerald || '#16a34a' }]}>{confirmedCount}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'مؤكد' : 'Confirmed'}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: colors.amber || '#f59e0b' }]}>{pendingCount}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'انتظار' : 'Pending'}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{totalGuests}</Text>
            <Text style={s.statLabel}>{language === 'ar' ? 'ضيوف' : 'Guests'}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateRow}>
          {[YESTERDAY, TODAY, TOMORROW].map((d) => (
            <TouchableOpacity key={d} style={[s.dateBtn, selectedDate === d && s.dateBtnActive]} onPress={() => setSelectedDate(d)}>
              <Text style={[s.dateBtnText, selectedDate === d && s.dateBtnTextActive]}>{dateLabels[d] || d}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.customDateBox}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <TextInput
              style={s.customDateInput}
              value={![YESTERDAY, TODAY, TOMORROW].includes(selectedDate) ? selectedDate : ''}
              onChangeText={(v) => { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setSelectedDate(v); }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
          {['all', 'pending', 'confirmed', 'seated'].map((f) => {
            const labels: Record<string, string> = {
              all: language === 'ar' ? 'الكل' : 'All',
              pending: language === 'ar' ? 'انتظار' : 'Pending',
              confirmed: language === 'ar' ? 'مؤكد' : 'Confirmed',
              seated: language === 'ar' ? 'جالس' : 'Seated',
            };
            return (
              <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterBtnActive]} onPress={() => setFilter(f)}>
                <Text style={[s.filterText, filter === f && s.filterTextActive]}>{labels[f]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredReservations}
        keyExtractor={(item) => item.id}
        renderItem={renderReservation}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(false)} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={50} color={colors.textMuted} />
            <Text style={s.emptyText}>
              {isRefreshing ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...') : (language === 'ar' ? 'لا توجد حجوزات' : 'No reservations found')}
            </Text>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView>
            <View style={s.modalContent}>
              <View style={[s.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={s.modalTitle}>{language === 'ar' ? 'حجز جديد' : 'New Reservation'}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={s.inputLabel}>{language === 'ar' ? 'اسم العميل *' : 'Customer Name *'}</Text>
              <TextInput style={s.input} value={customerName} onChangeText={setCustomerName}
                placeholder={language === 'ar' ? 'أدخل الاسم' : 'Enter name'}
                placeholderTextColor={colors.textMuted} textAlign={isRTL ? 'right' : 'left'} />

              <Text style={s.inputLabel}>{language === 'ar' ? 'رقم الجوال *' : 'Phone *'}</Text>
              <TextInput
                style={[s.input, phoneError ? s.inputError : customerPhone.length === 10 ? s.inputValid : {}]}
                value={customerPhone} onChangeText={handlePhoneChange}
                placeholder="05XXXXXXXX" keyboardType="number-pad" maxLength={10}
                placeholderTextColor={colors.textMuted} textAlign={isRTL ? 'right' : 'left'} />
              {phoneError ? <Text style={s.errorText}>⚠ {phoneError}</Text>
                : customerPhone.length === 10 ? <Text style={s.validText}>✓ {language === 'ar' ? 'رقم صحيح' : 'Valid'}</Text>
                : customerPhone.length > 0 ? <Text style={s.hintText}>{customerPhone.length}/10</Text> : null}

              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>{language === 'ar' ? 'التاريخ *' : 'Date *'}</Text>
                  <TextInput style={s.input} value={reservationDate} onChangeText={setReservationDate}
                    placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10}
                    placeholderTextColor={colors.textMuted} textAlign={isRTL ? 'right' : 'left'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>{language === 'ar' ? 'الوقت *' : 'Time *'}</Text>
                  <TextInput style={s.input} value={reservationTime} onChangeText={setReservationTime}
                    placeholder="HH:MM" keyboardType="numbers-and-punctuation" maxLength={5}
                    placeholderTextColor={colors.textMuted} textAlign={isRTL ? 'right' : 'left'} />
                </View>
              </View>

              <Text style={s.inputLabel}>{language === 'ar' ? 'عدد الأشخاص' : 'Party Size'}</Text>
              <TextInput style={s.input} value={guestCount} onChangeText={setGuestCount}
                keyboardType="number-pad" placeholderTextColor={colors.textMuted} textAlign={isRTL ? 'right' : 'left'} />

              <Text style={s.inputLabel}>{language === 'ar' ? 'الطاولة (اختياري)' : 'Table (optional)'}</Text>
              <TouchableOpacity style={[s.input, s.tablePickerBtn]} onPress={() => setShowTablePicker(true)}>
                <Text style={[s.tablePickerText, !selectedTableId && { color: colors.textMuted }]}>
                  {selectedTableId
                    ? (tables.find((tb) => tb.id === selectedTableId)?.tableNumber
                        ? `${language === 'ar' ? 'طاولة' : 'Table'} ${tables.find((tb) => tb.id === selectedTableId)?.tableNumber}`
                        : selectedTableId)
                    : (language === 'ar' ? 'اختر طاولة...' : 'Select table...')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={s.inputLabel}>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Text>
              <TextInput style={s.input} value={notes} onChangeText={setNotes}
                placeholder={language === 'ar' ? 'طلبات خاصة...' : 'Special requests...'}
                placeholderTextColor={colors.textMuted} textAlign={isRTL ? 'right' : 'left'} />

              <View style={[s.modalActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity style={[s.modalBtn, s.modalBtnSecondary]} onPress={() => setShowModal(false)}>
                  <Text style={s.modalBtnSecondaryText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: colors.primary }, (isSaving || !!phoneError || customerPhone.length !== 10) && { opacity: 0.5 }]}
                  onPress={createReservation}
                  disabled={isSaving || !!phoneError || customerPhone.length !== 10}>
                  <Text style={s.modalBtnPrimaryText}>
                    {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ الحجز' : 'Save Reservation')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showTablePicker} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={[s.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={s.modalTitle}>{language === 'ar' ? 'اختر طاولة' : 'Select Table'}</Text>
              <TouchableOpacity onPress={() => setShowTablePicker(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.tableOption} onPress={() => { setSelectedTableId(''); setShowTablePicker(false); }}>
              <Text style={[s.tableOptionText, { color: colors.textMuted }]}>{language === 'ar' ? 'بدون طاولة' : 'No table'}</Text>
            </TouchableOpacity>
            {tables.map((tb) => (
              <TouchableOpacity key={tb.id} style={[s.tableOption, selectedTableId === tb.id && { backgroundColor: colors.primary + '22' }]}
                onPress={() => { setSelectedTableId(tb.id); setShowTablePicker(false); }}>
                <Text style={s.tableOptionText}>{language === 'ar' ? 'طاولة' : 'Table'} {tb.tableNumber}</Text>
                <Text style={s.tableOptionSub}>{tb.capacity} {language === 'ar' ? 'أشخاص' : 'seats'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
  headerRow: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 10, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, flex: 1, textAlign: isRTL ? 'right' : 'left' },
  addBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 13, backgroundColor: colors.primary },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  statsRow: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: colors.surfaceLight, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginTop: 1 },
  dateRow: { paddingHorizontal: 16, gap: 8, marginBottom: 10, alignItems: 'center' },
  dateBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  dateBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateBtnText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dateBtnTextActive: { color: '#fff' },
  customDateBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, gap: 5 },
  customDateInput: { width: 90, color: colors.text, fontSize: 12, padding: 0 },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: '#FFF' },
  list: { padding: 14, paddingBottom: 30 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14 },
  cardHeader: { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardHeaderLeft: { alignItems: 'center', gap: 10, flex: 1 },
  cardIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 15, fontWeight: '800', color: colors.text },
  resNum: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  detailsRow: { backgroundColor: colors.surfaceLight, borderRadius: 12, padding: 10, gap: 7, marginBottom: 10 },
  detailItem: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: colors.textSecondary },
  depositBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  depositText: { fontSize: 11, fontWeight: '700' },
  actionsRow: { flexWrap: 'wrap', gap: 7 },
  actionBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  actionText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
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
  tablePickerBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  tablePickerText: { color: colors.text, fontSize: 14 },
  tableOption: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableOptionText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  tableOptionSub: { color: colors.textMuted, fontSize: 12 },
  modalActions: { justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11 },
  modalBtnSecondary: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  modalBtnSecondaryText: { color: colors.textSecondary, fontWeight: '700' },
  modalBtnPrimaryText: { color: '#FFF', fontWeight: '700' },
});
