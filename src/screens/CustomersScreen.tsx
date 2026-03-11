import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, fontSize } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Customer } from '../constants/types';
import { api } from '../services/api';
import { DrawerMenuButton } from '../components/DrawerMenuButton';

const EMPTY_CUSTOMER: Omit<Customer, 'id' | 'totalOrders' | 'totalSpent' | 'createdAt'> = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export default function CustomersScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.customers.list();
      setCustomers(data || []);
    } catch (e: any) {
      console.error('Failed to load customers', e);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        e?.message || (language === 'ar' ? 'فشل في تحميل العملاء' : 'Failed to load customers')
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_CUSTOMER);

  const filtered = customers.filter(
    (c) =>
      c.name.includes(search) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => {
    setEditingCustomer(null);
    setForm(EMPTY_CUSTOMER);
    setShowForm(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setShowDetails(false);
    setShowForm(true);
  };

  const saveCustomer = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert(t('required'), t('customerName') + ' & ' + t('phone'));
      return;
    }

    setIsSaving(true);
    try {
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, form);
      } else {
        await api.customers.create(form);
      }
      setShowForm(false);
      await loadData(); // reload from server
    } catch (e: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        e?.message || (language === 'ar' ? 'فشل في حفظ العميل' : 'Failed to save customer')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCustomer = (id: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف العميل' : 'Delete Customer',
      language === 'ar' ? 'هل أنت متأكد من حذف هذا العميل؟' : 'Are you sure you want to delete this customer?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.customers.delete(id);
              setShowDetails(false);
              await loadData();
            } catch (e: any) {
              Alert.alert(
                language === 'ar' ? 'خطأ' : 'Error',
                e?.message || (language === 'ar' ? 'فشل في حذف العميل' : 'Failed to delete customer')
              );
            }
          },
        },
      ]
    );
  };

  const openDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  const s = dynStyles(colors, isRTL);

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={s.customerCard}
      onPress={() => openDetails(item)}
      data-testid={`card-customer-${item.id}`}
    >
      <View style={s.cardRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={s.cardInfo}>
          <Text style={s.customerName} data-testid={`text-name-${item.id}`}>{item.name}</Text>
          <View style={s.phoneRow}>
            <Ionicons name="call-outline" size={12} color={colors.textMuted} />
            <Text style={s.phoneText}>{item.phone}</Text>
          </View>
        </View>
        <View style={s.cardStats}>
          <Text style={s.statValue}>{item.pointsBalance || 0}</Text>
          <Text style={[s.statLabel, { color: colors.amber }]}>{t('points')}</Text>
          {item.loyaltyTier && (
            <View style={{ backgroundColor: colors.amber + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: colors.amber, fontWeight: 'bold' }}>{item.loyaltyTier}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <DrawerMenuButton />
          <Text style={s.title}>{t('customers')}</Text>
          <TouchableOpacity style={s.addBtn} onPress={openAdd} data-testid="button-add-customer">
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder={t('searchCustomers')}
            placeholderTextColor={colors.textDark}
            value={search}
            onChangeText={setSearch}
            data-testid="input-search-customer"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} data-testid="button-clear-search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.countText}>{filtered.length} {t('customers')}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomer}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textDark} />
            <Text style={s.emptyText}>{isLoading ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...') : t('noCustomers')}</Text>
          </View>
        }
      />

      <Modal visible={showDetails} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetails(false)} data-testid="button-close-details">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{t('customers')}</Text>
              <View style={s.modalActions}>
                <TouchableOpacity
                  onPress={() => selectedCustomer && openEdit(selectedCustomer)}
                  style={s.modalActionBtn}
                  data-testid="button-edit-customer"
                >
                  <Ionicons name="create-outline" size={20} color={colors.blue} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => selectedCustomer && deleteCustomer(selectedCustomer.id)}
                  style={s.modalActionBtn}
                  data-testid="button-delete-customer"
                >
                  <Ionicons name="trash-outline" size={20} color={colors.rose} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedCustomer && (
              <ScrollView style={s.detailsScroll} showsVerticalScrollIndicator={false}>
                <View style={s.detailAvatarRow}>
                  <View style={s.detailAvatar}>
                    <Text style={s.detailAvatarText}>{selectedCustomer.name.charAt(0)}</Text>
                  </View>
                  <Text style={s.detailName}>{selectedCustomer.name}</Text>
                </View>

                <View style={s.detailStatsRow}>
                  <View style={s.detailStatCard}>
                    <Ionicons name="receipt-outline" size={20} color={colors.blue} />
                    <Text style={s.detailStatValue}>{selectedCustomer.totalOrders}</Text>
                    <Text style={s.detailStatLabel}>{t('totalOrders')}</Text>
                  </View>
                  <View style={s.detailStatCard}>
                    <Ionicons name="wallet-outline" size={20} color={colors.emerald} />
                    <Text style={s.detailStatValue}>{selectedCustomer.totalSpent}</Text>
                    <Text style={s.detailStatLabel}>{t('totalSpent')} ({t('sar')})</Text>
                  </View>
                  <View style={s.detailStatCard}>
                    <Ionicons name="cart-outline" size={20} color={colors.amber} />
                    <Text style={s.detailStatValue}>
                      {selectedCustomer.totalOrders > 0
                        ? Math.round(selectedCustomer.totalSpent / selectedCustomer.totalOrders)
                        : 0}
                    </Text>
                    <Text style={s.detailStatLabel}>{t('averageOrder')} ({t('sar')})</Text>
                  </View>
                </View>

                <View style={[s.detailStatsRow, { marginTop: 12 }]}>
                  <View style={s.detailStatCard}>
                    <Ionicons name="star" size={20} color={colors.amber} />
                    <Text style={s.detailStatValue}>{selectedCustomer.pointsBalance || 0}</Text>
                    <Text style={s.detailStatLabel}>{t('points')}</Text>
                  </View>
                  {selectedCustomer.loyaltyTier && (
                    <View style={s.detailStatCard}>
                      <Ionicons name="trophy" size={20} color={colors.primary} />
                      <Text style={[s.detailStatValue, { fontSize: 14 }]}>{selectedCustomer.loyaltyTier}</Text>
                      <Text style={s.detailStatLabel}>{t('tier')}</Text>
                    </View>
                  )}
                </View>

                <View style={s.detailSection}>
                  <Text style={s.detailSectionTitle}>{t('phone')}</Text>
                  <View style={s.detailInfoRow}>
                    <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                    <Text style={s.detailInfoText}>{selectedCustomer.phone}</Text>
                  </View>
                  {selectedCustomer.email && (
                    <View style={s.detailInfoRow}>
                      <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                      <Text style={s.detailInfoText}>{selectedCustomer.email}</Text>
                    </View>
                  )}
                  {selectedCustomer.address && (
                    <View style={s.detailInfoRow}>
                      <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                      <Text style={s.detailInfoText}>{selectedCustomer.address}</Text>
                    </View>
                  )}
                </View>

                {selectedCustomer.notes && (
                  <View style={s.detailSection}>
                    <Text style={s.detailSectionTitle}>{t('notes')}</Text>
                    <View style={s.notesBox}>
                      <Text style={s.notesText}>{selectedCustomer.notes}</Text>
                    </View>
                  </View>
                )}

                <View style={s.detailSection}>
                  <Text style={s.detailSectionTitle}>{t('memberSince')}</Text>
                  <Text style={s.detailInfoText}>
                    {new Date(selectedCustomer.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowForm(false)} data-testid="button-close-form">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>
                {editingCustomer ? t('editCustomer') : t('addCustomer')}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={s.formScroll} showsVerticalScrollIndicator={false}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>{t('customerName')} *</Text>
                <TextInput
                  style={s.fieldInput}
                  value={form.name}
                  onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                  placeholder={t('customerName')}
                  placeholderTextColor={colors.textDark}
                  data-testid="input-customer-name"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>{t('phone')} *</Text>
                <TextInput
                  style={s.fieldInput}
                  value={form.phone}
                  onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
                  placeholder="05XXXXXXXX"
                  placeholderTextColor={colors.textDark}
                  keyboardType="phone-pad"
                  data-testid="input-customer-phone"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>{t('email')}</Text>
                <TextInput
                  style={s.fieldInput}
                  value={form.email}
                  onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.textDark}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  data-testid="input-customer-email"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>{t('address')}</Text>
                <TextInput
                  style={s.fieldInput}
                  value={form.address}
                  onChangeText={(v) => setForm((p) => ({ ...p, address: v }))}
                  placeholder={t('address')}
                  placeholderTextColor={colors.textDark}
                  data-testid="input-customer-address"
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>{t('notes')}</Text>
                <TextInput
                  style={[s.fieldInput, s.textArea]}
                  value={form.notes}
                  onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
                  placeholder={t('notes')}
                  placeholderTextColor={colors.textDark}
                  multiline
                  numberOfLines={3}
                  data-testid="input-customer-notes"
                />
              </View>

              <TouchableOpacity style={[s.saveBtn, isSaving && { opacity: 0.6 }]} onPress={saveCustomer} disabled={isSaving} data-testid="button-save-customer">
                <Text style={s.saveBtnText}>
                  {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (editingCustomer ? t('save') : t('addCustomer'))}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: colors.text,
    fontSize: 14,
    textAlign: isRTL ? 'right' : 'left',
  },
  countText: { fontSize: 12, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' },
  list: { padding: 16 },
  customerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.primaryLight },
  cardInfo: { flex: 1 },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  phoneRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  phoneText: { fontSize: 12, color: colors.textMuted },
  cardStats: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.blue },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  spentValue: { fontSize: 11, color: colors.emerald, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalActionBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsScroll: { paddingHorizontal: 20, paddingTop: 16 },
  detailAvatarRow: { alignItems: 'center', marginBottom: 20 },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detailAvatarText: { fontSize: 32, fontWeight: '800', color: colors.primaryLight },
  detailName: { fontSize: 22, fontWeight: '800', color: colors.white },
  detailStatsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
    marginBottom: 20,
  },
  detailStatCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  detailStatValue: { fontSize: 20, fontWeight: '900', color: colors.white, marginTop: 6 },
  detailStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  detailSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 10,
  },
  detailInfoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailInfoText: { fontSize: 14, color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  notesBox: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  notesText: { fontSize: 13, color: colors.amber, textAlign: isRTL ? 'right' : 'left' },
  formScroll: { paddingHorizontal: 20, paddingTop: 16 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    textAlign: isRTL ? 'right' : 'left',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
});
