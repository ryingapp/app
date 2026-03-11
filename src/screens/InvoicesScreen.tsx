import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Invoice } from '../constants/types';
import { api } from '../services/api';
import { connectRealtime } from '../services/realtime';
import { DrawerMenuButton } from '../components/DrawerMenuButton';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { printInvoiceDocument } from '../services/printer';

export default function InvoicesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Refund States
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [refundItems, setRefundItems] = useState<any[]>([]);
  const [refundReason, setRefundReason] = useState('');
  const [isLoadingRefundDetails, setIsLoadingRefundDetails] = useState(false);

  const loadInvoices = async () => {
    try {
      const [data, restData] = await Promise.all([
        api.invoices.list(),
        api.restaurant.get(),
      ]);
      setInvoices(data);
      setRestaurant(restData);
    } catch (e) { console.error('Failed to load invoices', e); }
  };

  useEffect(() => {
    loadInvoices();

    const disconnect = connectRealtime((msg) => {
      if (
        msg.type === 'new_order' ||
        msg.type === 'order_updated' ||
        msg.type === 'order_status_changed' ||
        msg.type === 'data_changed'
      ) {
        loadInvoices();
      }
    });

    return disconnect;
  }, []);

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName?.includes(searchQuery)
  );

  const s = dynStyles(colors, isRTL);
  const num = (value: any, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const handlePrintInvoice = async () => {
    if (!selectedInvoice || isPrinting) return;
    setIsPrinting(true);
    try {
      const invoicePayload = await api.invoices.getByOrder(selectedInvoice.orderId);
      await printInvoiceDocument(invoicePayload, { language, restaurant });
    } catch (error: any) {
      Alert.alert(
        language === 'ar' ? 'فشل الطباعة' : 'Print failed',
        error?.message || (language === 'ar' ? 'تعذر طباعة الفاتورة' : 'Unable to print invoice'),
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const openRefundModal = async () => {
    if (!selectedInvoice) return;
    if (selectedInvoice.status !== 'issued') {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Notice',
        language === 'ar' ? 'لا يمكن استرجاع هذه الفاتورة' : 'This invoice cannot be refunded',
      );
      return;
    }
    setRefundReason('');
    setRefundModalVisible(true);
    // Load items in background after modal opens
    if (refundItems.length === 0) {
      setIsLoadingRefundDetails(true);
      try {
        const data = await api.invoices.getByOrder(selectedInvoice.orderId);
        const items = (data.order?.items || []).map((i: any) => ({
          ...i,
          checked: false,
          refundQty: i.quantity,
        }));
        setRefundItems(items);
      } catch (e) {
        // Items unavailable — allow full refund without item selection
        setRefundItems([]);
      } finally {
        setIsLoadingRefundDetails(false);
      }
    }
  };

  const handleRefundSubmit = async () => {
    if (!refundReason) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'يرجى إدخال سبب الاسترجاع' : 'Please enter a refund reason');
      return;
    }

    const itemsToRefund = refundItems
      .filter((i) => i.checked && i.refundQty > 0)
      .map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        quantity: i.refundQty,
      }));

    // Only block if items were loaded but none selected — if items never loaded, do full refund
    if (refundItems.length > 0 && itemsToRefund.length === 0) {
      Alert.alert(language === 'ar' ? 'تنبيه' : 'Notice', language === 'ar' ? 'يرجى اختيار عناصر للاسترجاع' : 'Please select items to refund');
      return;
    }

    const confirmMessage = itemsToRefund.length > 0
      ? (language === 'ar' ? `هل أنت متأكد من استرجاع ${itemsToRefund.length} عنصر؟` : `Are you sure you want to refund ${itemsToRefund.length} items?`)
      : (language === 'ar' ? 'هل أنت متأكد من استرجاع هذه الفاتورة كاملاً؟' : 'Are you sure you want to fully refund this invoice?');

    // Confirm action
    Alert.alert(
      language === 'ar' ? 'تأكيد الاسترجاع' : 'Confirm Refund',
      confirmMessage,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'استرجاع' : 'Refund',
          style: 'destructive',
          onPress: async () => {
             try {
              const itemsPayload = itemsToRefund.length > 0 ? itemsToRefund : undefined;
              await api.invoices.refund(selectedInvoice!.id, refundReason, itemsPayload);
              Alert.alert(language === 'ar' ? 'تم' : 'Success', language === 'ar' ? 'تم إنشاء إشعار دائن بنجاح' : 'Credit note created successfully');
              setRefundModalVisible(false);
              setRefundItems([]);
              setSelectedInvoice(null);
              loadInvoices();
            } catch (e: any) {
              Alert.alert(language === 'ar' ? 'خطأ' : 'Error', e?.message || 'Refund failed');
            }
          }
        }
      ]
    );
  };

  const renderInvoice = ({ item: invoice }: { item: Invoice }) => (
    <TouchableOpacity style={s.invoiceCard} activeOpacity={0.7} onPress={() => setSelectedInvoice(invoice)}>
      <View style={[s.invoiceIcon, {
        backgroundColor: invoice.status === 'issued' ? colors.emeraldBg : colors.roseBg,
      }]}>
        <Ionicons
          name={invoice.status === 'issued' ? 'checkmark-circle' : 'alert-circle'}
          size={24}
          color={invoice.status === 'issued' ? colors.emerald : colors.rose}
        />
      </View>

      <View style={s.invoiceInfo}>
        <Text style={s.invoiceNumber}>{invoice.invoiceNumber}</Text>
        <Text style={s.invoiceMeta}>
          {format(new Date(invoice.createdAt), 'dd MMM yyyy - hh:mm a', { locale: language === 'ar' ? ar : enUS })} • {invoice.customerName || t('cashCustomer')}
        </Text>
      </View>

      <View style={s.invoiceRight}>
        <Text style={[s.invoiceTotal, { color: colors.emerald }]}>{num(invoice.total).toFixed(2)}</Text>
        <Text style={s.invoiceCurrency}>{t('sar')}</Text>
        <View style={s.paymentRow}>
          <Ionicons
            name={invoice.paymentMethod === 'cash' ? 'cash-outline' : 'card-outline'}
            size={14}
            color={colors.textMuted}
          />
          <Text style={s.paymentText}>{invoice.paymentMethod === 'cash' ? t('cash') : t('card')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={s.headerRow}>
          <DrawerMenuButton />
          <Text style={s.title}>{t('electronicInvoices')}</Text>
          <View style={s.headerIcon}>
            <Ionicons name="receipt" size={20} color={colors.primary} />
          </View>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.white }]}
            placeholder={t('searchInvoice')}
            placeholderTextColor={colors.textDark}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>
      </View>

      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoice}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.textDark} />
            <Text style={s.emptyText}>{t('noMatchingInvoices')}</Text>
          </View>
        }
      />

      <Modal visible={!!selectedInvoice} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
        <Pressable style={s.overlay} onPress={() => setSelectedInvoice(null)}>
          <Pressable style={[s.detailModal, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={[s.detailHeader, { borderBottomColor: colors.border }]}>
              <Text style={s.detailTitle}>{t('invoiceDetails')}</Text>
              <Text style={[s.detailNumber, { color: colors.primary }]}>{selectedInvoice?.invoiceNumber}</Text>
            </View>

            {selectedInvoice && (
              <ScrollView style={s.detailBody} showsVerticalScrollIndicator={false}>
                <View style={s.companyRow}>
                  <View>
                    <Text style={s.companyName}>
                      {restaurant ? (language === 'ar' ? restaurant.nameAr : restaurant.nameEn) : 'TryingPOS'}
                    </Text>
                    <Text style={s.companyTax}>{t('taxNumberLabel')}: {restaurant?.vatNumber || '—'}</Text>
                  </View>
                  <View style={s.qrPlaceholder}>
                    {selectedInvoice.qrCodeData ? (
                      <Text style={s.qrText}>QR</Text>
                    ) : (
                      <Text style={s.qrText}>ZATCA{'\n'}QR CODE</Text>
                    )}
                  </View>
                </View>

                <View style={s.detailRows}>
                  <View style={[s.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={s.detailLabel}>{t('issueDate')}</Text>
                    <Text style={s.detailValue}>{format(new Date(selectedInvoice.createdAt), 'yyyy/MM/dd HH:mm:ss')}</Text>
                  </View>
                  <View style={[s.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={s.detailLabel}>{language === 'ar' ? 'نوع الفاتورة' : 'Invoice Type'}</Text>
                    <Text style={s.detailValue}>
                      {selectedInvoice.invoiceType === 'credit_note'
                        ? (language === 'ar' ? 'إشعار دائن' : 'Credit Note')
                        : (language === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice')}
                    </Text>
                  </View>
                  <View style={[s.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={s.detailLabel}>{t('customerName')}</Text>
                    <Text style={s.detailValue}>{selectedInvoice.customerName || t('cashCustomer')}</Text>
                  </View>
                  <View style={[s.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={s.detailLabel}>{t('paymentMethod')}</Text>
                    <Text style={s.detailValue}>
                      {selectedInvoice.paymentMethod === 'cash' ? t('cash') : 
                       selectedInvoice.paymentMethod === 'card' ? t('card') : 
                       selectedInvoice.paymentMethod || '—'}
                    </Text>
                  </View>
                  <View style={[s.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={s.detailLabel}>{t('cashier')}</Text>
                    <Text style={s.detailValue}>{selectedInvoice.cashierName || '—'}</Text>
                  </View>
                  {selectedInvoice.zatcaStatus && (
                    <View style={[s.detailRow, { borderBottomColor: colors.border }]}>
                      <Text style={s.detailLabel}>{language === 'ar' ? 'حالة زاتكا' : 'ZATCA Status'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons
                          name={selectedInvoice.zatcaStatus === 'approved' ? 'checkmark-circle' : selectedInvoice.zatcaStatus === 'pending' ? 'time' : 'alert-circle'}
                          size={16}
                          color={selectedInvoice.zatcaStatus === 'approved' ? colors.emerald : selectedInvoice.zatcaStatus === 'pending' ? colors.amber : colors.rose}
                        />
                        <Text style={[s.detailValue, {
                          color: selectedInvoice.zatcaStatus === 'approved' ? colors.emerald : selectedInvoice.zatcaStatus === 'pending' ? colors.amber : colors.rose
                        }]}>
                          {selectedInvoice.zatcaStatus === 'approved' ? (language === 'ar' ? 'معتمدة' : 'Approved') :
                           selectedInvoice.zatcaStatus === 'pending' ? (language === 'ar' ? 'قيد المراجعة' : 'Pending') :
                           selectedInvoice.zatcaStatus}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={[s.totalsBox, { borderColor: colors.border }]}>
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>{t('taxableAmount')}</Text>
                    <Text style={s.totalValue}>{num(selectedInvoice.subtotal).toFixed(2)} {t('sar')}</Text>
                  </View>
                  {num(selectedInvoice.discount) > 0 && (
                    <View style={s.totalRow}>
                      <Text style={s.totalLabel}>{language === 'ar' ? 'خصم' : 'Discount'}</Text>
                      <Text style={[s.totalValue, { color: colors.rose }]}>-{num(selectedInvoice.discount).toFixed(2)} {t('sar')}</Text>
                    </View>
                  )}
                  {num(selectedInvoice.deliveryFee) > 0 && (
                    <View style={s.totalRow}>
                      <Text style={s.totalLabel}>{language === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</Text>
                      <Text style={s.totalValue}>{num(selectedInvoice.deliveryFee).toFixed(2)} {t('sar')}</Text>
                    </View>
                  )}
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>{t('vatAmount')} ({num(selectedInvoice.taxRate, 15)}%)</Text>
                    <Text style={s.totalValue}>{num(selectedInvoice.taxAmount).toFixed(2)} {t('sar')}</Text>
                  </View>
                  <View style={[s.totalRow, s.grandTotalRow]}>
                    <Text style={s.grandTotalLabel}>{t('total')}</Text>
                    <Text style={[s.grandTotalValue, { color: colors.emerald }]}>{num(selectedInvoice.total).toFixed(2)} {t('sar')}</Text>
                  </View>
                </View>

                <View style={s.actionButtons}>
                  <TouchableOpacity style={[s.secondaryBtn, { borderColor: colors.borderLight }]}>
                    <Ionicons name="download-outline" size={18} color={colors.white} />
                    <Text style={s.secondaryBtnText}>{t('downloadPDF')}</Text>
                  </TouchableOpacity>
                  
                  {selectedInvoice?.status === 'issued' && selectedInvoice.invoiceType !== 'credit_note' && (
                    <TouchableOpacity 
                      style={[s.secondaryBtn, { borderColor: colors.rose, backgroundColor: 'rgba(244, 63, 94, 0.1)' }]} 
                      onPress={openRefundModal}
                    >
                      <Ionicons name="return-up-back-outline" size={18} color={colors.rose} />
                      <Text style={[s.secondaryBtnText, { color: colors.rose }]}>{language === 'ar' ? 'استرجاع' : 'Refund'}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: isPrinting ? 0.7 : 1 }]} onPress={handlePrintInvoice} disabled={isPrinting}>
                    <Ionicons name="print-outline" size={18} color="#FFF" />
                    <Text style={s.primaryBtnText}>{isPrinting ? (language === 'ar' ? 'جاري الطباعة...' : 'Printing...') : t('print')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={refundModalVisible} transparent animationType="slide" onRequestClose={() => { setRefundModalVisible(false); setRefundItems([]); }}>
        <View style={s.overlay}>
           <View style={[s.detailModal, { backgroundColor: colors.surface, borderColor: colors.borderLight, height: '70%' }]}>
              <View style={[s.detailHeader, { borderBottomColor: colors.border }]}>
                 <Text style={s.detailTitle}>{language === 'ar' ? 'استرجاع عناصر' : 'Refund Items'}</Text>
                 <TouchableOpacity onPress={() => { setRefundModalVisible(false); setRefundItems([]); }}>
                    <Ionicons name="close" size={24} color={colors.text} />
                 </TouchableOpacity>
              </View>
              
              <View style={{ padding: 16, flex: 1 }}>
                {isLoadingRefundDetails ? (
                   <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: colors.textMuted }}>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</Text>
                   </View>
                ) : (
                   <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                     <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                       <Text style={{ color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', flex: 1 }}>
                          {language === 'ar' ? 'حدد العناصر والكميات' : 'Select items & qty'}
                       </Text>
                       <TouchableOpacity 
                          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(79,70,229,0.1)', borderRadius: 8 }}
                          onPress={() => {
                            const allChecked = refundItems.every(i => i.checked);
                            const newItems = refundItems.map(i => ({ ...i, checked: !allChecked, refundQty: !allChecked ? i.quantity : i.refundQty }));
                            setRefundItems(newItems);
                         }}>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                            {refundItems.every(i => i.checked) 
                              ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All') 
                              : (language === 'ar' ? 'استرجاع الكل' : 'Refund All')}
                          </Text>
                       </TouchableOpacity>
                     </View>
                     
                     {refundItems.map((item, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: colors.background, padding: 10, borderRadius: 8 }}>
                           <TouchableOpacity onPress={() => {
                              const newItems = [...refundItems];
                              newItems[idx].checked = !newItems[idx].checked;
                              setRefundItems(newItems);
                           }}>
                              <Ionicons 
                                name={item.checked ? 'checkbox' : 'square-outline'} 
                                size={24} 
                                color={item.checked ? colors.primary : colors.textMuted} 
                              />
                           </TouchableOpacity>
                           <View style={{ flex: 1, marginHorizontal: 10 }}>
                              <Text style={{ color: colors.text, textAlign: isRTL ? 'right' : 'left' }}>
                                 {language === 'ar' ? item.itemName || '' : item.itemName || ''}
                              </Text>
                              <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
                                 {num(item.unitPrice).toFixed(2)} {t('sar')} - Qty: {item.quantity}
                              </Text>
                           </View>
                           {item.checked && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                                  <TouchableOpacity 
                                    onPress={() => {
                                       const newItems = [...refundItems];
                                       if (newItems[idx].refundQty > 1) newItems[idx].refundQty--;
                                       setRefundItems(newItems);
                                    }}
                                    style={{ padding: 4 }}
                                  >
                                     <Ionicons name="remove" size={16} color={colors.text} />
                                  </TouchableOpacity>
                                  <Text style={{ color: colors.text, paddingHorizontal: 8 }}>{item.refundQty}</Text>
                                  <TouchableOpacity 
                                    onPress={() => {
                                       const newItems = [...refundItems];
                                       if (newItems[idx].refundQty < item.quantity) newItems[idx].refundQty++;
                                       setRefundItems(newItems);
                                    }}
                                    style={{ padding: 4 }}
                                  >
                                     <Ionicons name="add" size={16} color={colors.text} />
                                  </TouchableOpacity>
                              </View>
                           )}
                        </View>
                     ))}

                     <Text style={{ color: colors.textSecondary, marginTop: 16, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
                        {language === 'ar' ? 'سبب الاسترجاع' : 'Refund Reason'}
                     </Text>
                     <TextInput
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, backgroundColor: colors.background, textAlign: isRTL ? 'right' : 'left' }}
                        value={refundReason}
                        onChangeText={setRefundReason}
                        placeholder={language === 'ar' ? 'مثال: العميل لم يعجبه الطلب' : 'e.g., Customer Complaint'}
                        placeholderTextColor={colors.textMuted}
                     />
                   </ScrollView>
                )}
              </View>

              <View style={[s.actionButtons, { padding: 16, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <TouchableOpacity 
                     style={[s.secondaryBtn, { borderColor: colors.borderLight }]}
                     onPress={() => { setRefundModalVisible(false); setRefundItems([]); }}
                  >
                     <Text style={s.secondaryBtnText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                     style={[s.primaryBtn, { backgroundColor: colors.rose }]} 
                     onPress={handleRefundSubmit}
                  >
                     <Text style={s.primaryBtnText}>{language === 'ar' ? 'تأكيد الاسترجاع' : 'Confirm Refund'}</Text>
                  </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.white, flex: 1, textAlign: isRTL ? 'right' : 'left', marginHorizontal: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.1)', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, height: 48, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: 16 },
  invoiceCard: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12, gap: 14 },
  invoiceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  invoiceInfo: { flex: 1 },
  invoiceNumber: { fontSize: 14, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  invoiceMeta: { fontSize: 11, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginTop: 4 },
  invoiceRight: { alignItems: isRTL ? 'flex-start' : 'flex-end' },
  invoiceTotal: { fontSize: 18, fontWeight: '900' },
  invoiceCurrency: { fontSize: 11, color: 'rgba(52,211,153,0.5)', marginTop: -2 },
  paymentRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  paymentText: { fontSize: 11, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  detailModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', borderWidth: 1 },
  detailHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  detailTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  detailNumber: { fontSize: 13, fontWeight: '700' },
  detailBody: { padding: 20 },
  companyRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  companyName: { fontSize: 18, fontWeight: '800', color: colors.white, textAlign: isRTL ? 'right' : 'left' },
  companyTax: { fontSize: 13, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginTop: 4 },
  qrPlaceholder: { width: 72, height: 72, backgroundColor: '#FFF', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(79,70,229,0.2)' },
  qrText: { fontSize: 8, color: 'rgba(0,0,0,0.4)', textAlign: 'center' },
  detailRows: { gap: 16, marginBottom: 28 },
  detailRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1 },
  detailLabel: { fontSize: 14, color: colors.textMuted },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  totalsBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 24 },
  totalRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { fontSize: 14, color: colors.textSecondary },
  totalValue: { fontSize: 14, color: colors.textSecondary },
  grandTotalRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, marginBottom: 0 },
  grandTotalLabel: { fontSize: 20, fontWeight: '900', color: colors.white },
  grandTotalValue: { fontSize: 20, fontWeight: '900' },
  actionButtons: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 20 },
  secondaryBtn: { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  primaryBtn: { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
