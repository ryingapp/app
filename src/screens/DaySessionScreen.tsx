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
import { DaySession, CashTransaction } from '../constants/types';
import { api } from '../services/api';
import { connectRealtime } from '../services/realtime';
import { DrawerMenuButton } from '../components/DrawerMenuButton';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

type TabType = 'current' | 'history';

export default function DaySessionScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [currentSession, setCurrentSession] = useState<DaySession | null>(null);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [sessionHistory, setSessionHistory] = useState<DaySession[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionReason, setTransactionReason] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [loading, setLoading] = useState(true);

  const dateLocale = language === 'ar' ? ar : undefined;

  // Load current session and history from API
  useEffect(() => {
    loadSessionData();

    const disconnect = connectRealtime((msg) => {
      if (
        msg.type === 'new_order' ||
        msg.type === 'order_updated' ||
        msg.type === 'order_status_changed' ||
        msg.type === 'data_changed'
      ) {
        loadSessionData();
      }
    });

    return disconnect;
  }, []);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const [current, history] = await Promise.all([
        api.daySessions.getCurrent(),
        api.daySessions.list(),
      ]);
      if (current) {
        setCurrentSession({
          id: current.id,
          status: current.status,
          openedAt: current.openedAt,
          closedAt: current.closedAt,
          openingBalance: parseFloat(current.openingBalance || '0'),
          closingBalance: current.closingBalance ? parseFloat(current.closingBalance) : undefined,
          totalSales: parseFloat(current.totalSales || '0'),
          totalOrders: current.totalOrders || 0,
          cashSales: parseFloat(current.cashSales || '0'),
          cardSales: parseFloat(current.cardSales || '0'),
          onlineSales: parseFloat(current.onlineSales || '0'),
          cashierName: current.cashierName || '',
          notes: current.notes,
          difference: current.difference,
        });
        // Load transactions for current session
        try {
          const txns = await api.daySessions.getTransactions(current.id);
          setCashTransactions(txns.map((tx: any) => ({
            id: tx.id,
            sessionId: tx.sessionId,
            type: tx.type,
            amount: parseFloat(tx.amount || '0'),
            reason: tx.reason || tx.description || '',
            createdAt: tx.createdAt,
          })));
        } catch (e) { console.error('Failed to load transactions', e); }
      } else {
        setCurrentSession(null);
      }
      // Set history (closed sessions)
      setSessionHistory(
        (history || [])
          .filter((s: any) => s.status === 'closed')
          .map((s: any) => ({
            id: s.id,
            status: s.status,
            openedAt: s.openedAt,
            closedAt: s.closedAt,
            openingBalance: parseFloat(s.openingBalance || '0'),
            closingBalance: s.closingBalance ? parseFloat(s.closingBalance) : undefined,
            totalSales: parseFloat(s.totalSales || '0'),
            totalOrders: s.totalOrders || 0,
            cashSales: parseFloat(s.cashSales || '0'),
            cardSales: parseFloat(s.cardSales || '0'),
            onlineSales: parseFloat(s.onlineSales || '0'),
            cashierName: s.cashierName || '',
            notes: s.notes,
            difference: s.difference,
          }))
      );
    } catch (e) {
      console.error('Failed to load session data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async () => {
    if (!openingBalance || !cashierName) {
      Alert.alert(t('required'), t('required'));
      return;
    }
    try {
      const result = await api.daySessions.open({
        openingBalance: parseFloat(openingBalance),
        cashierName,
      });
      setCurrentSession({
        id: result.id,
        status: 'open',
        openedAt: result.openedAt || new Date().toISOString(),
        openingBalance: parseFloat(result.openingBalance || openingBalance),
        totalSales: 0,
        totalOrders: 0,
        cashSales: 0,
        cardSales: 0,
        onlineSales: 0,
        cashierName: result.cashierName || cashierName,
      });
      setCashTransactions([]);
      setShowOpenModal(false);
      setOpeningBalance('');
      setCashierName('');
    } catch (e: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        e?.message || (language === 'ar' ? 'فشل في فتح اليوم' : 'Failed to open session')
      );
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession) return;
    try {
      const result = await api.daySessions.close(currentSession.id, {
        notes: closeNotes || undefined,
        closingBalance: actualCash || undefined,
      });
      setCurrentSession({
        ...currentSession,
        status: 'closed',
        closedAt: result.closedAt || new Date().toISOString(),
        closingBalance: result.closingBalance ? parseFloat(result.closingBalance) : undefined,
        notes: closeNotes || undefined,
        difference: result.difference,
      });
      setShowCloseModal(false);
      setCloseNotes('');
      setActualCash('');
      // Refresh history
      loadSessionData();
    } catch (e: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        e?.message || (language === 'ar' ? 'فشل في إغلاق اليوم' : 'Failed to close session')
      );
    }
  };

  const handleAddTransaction = async () => {
    if (!transactionAmount || !transactionReason) {
      Alert.alert(t('required'), t('required'));
      return;
    }
    if (!currentSession) return;
    try {
      const result = await api.daySessions.addTransaction(currentSession.id, {
        type: transactionType,
        amount: parseFloat(transactionAmount),
        description: transactionReason,
        reason: transactionReason,
      });
      const newTx: CashTransaction = {
        id: result.id || `ct_${Date.now()}`,
        sessionId: currentSession.id,
        type: transactionType,
        amount: parseFloat(transactionAmount),
        reason: transactionReason,
        createdAt: result.createdAt || new Date().toISOString(),
      };
      setCashTransactions([newTx, ...cashTransactions]);
      setShowTransactionModal(false);
      setTransactionAmount('');
      setTransactionReason('');
    } catch (e: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        e?.message || (language === 'ar' ? 'فشل في إضافة التحويل' : 'Failed to add transaction')
      );
    }
  };

  const depositsTotal = cashTransactions
    .filter((tx) => tx.type === 'deposit')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const withdrawalsTotal = cashTransactions
    .filter((tx) => tx.type === 'withdrawal')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const s = dynStyles(colors, isRTL);

  const renderStatCard = (label: string, value: string, icon: string, color: string, bgColor: string) => (
    <View style={[s.statCard, { borderColor: bgColor }]}>
      <View style={[s.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  const renderTransaction = ({ item }: { item: CashTransaction }) => (
    <View style={s.txCard}>
      <View style={[s.txIcon, {
        backgroundColor: item.type === 'deposit' ? colors.emeraldBg : colors.roseBg,
      }]}>
        <Ionicons
          name={item.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={22}
          color={item.type === 'deposit' ? colors.emerald : colors.rose}
        />
      </View>
      <View style={s.txInfo}>
        <Text style={s.txReason}>{item.reason}</Text>
        <Text style={s.txTime}>
          {format(new Date(item.createdAt), 'hh:mm a', { locale: dateLocale })}
        </Text>
      </View>
      <View style={s.txAmountBox}>
        <Text style={[s.txAmount, {
          color: item.type === 'deposit' ? colors.emerald : colors.rose,
        }]}>
          {item.type === 'deposit' ? '+' : '-'}{item.amount.toFixed(2)}
        </Text>
        <Text style={s.txCurrency}>{t('sar')}</Text>
      </View>
    </View>
  );

  const renderHistorySession = ({ item }: { item: DaySession }) => (
    <View style={s.historyCard}>
      <View style={s.historyHeader}>
        <View style={[s.historyStatus, { backgroundColor: colors.roseBg }]}>
          <Ionicons name="lock-closed" size={14} color={colors.rose} />
          <Text style={[s.historyStatusText, { color: colors.rose }]}>{t('sessionClosed')}</Text>
        </View>
        <Text style={s.historyDate}>
          {format(new Date(item.openedAt), 'dd MMM yyyy', { locale: dateLocale })}
        </Text>
      </View>

      <View style={s.historyStats}>
        <View style={s.historyStat}>
          <Text style={s.historyStatLabel}>{t('totalSales')}</Text>
          <Text style={s.historyStatValue}>{item.totalSales.toFixed(0)} {t('sar')}</Text>
        </View>
        <View style={s.historyStat}>
          <Text style={s.historyStatLabel}>{t('totalOrders')}</Text>
          <Text style={s.historyStatValue}>{item.totalOrders}</Text>
        </View>
        <View style={s.historyStat}>
          <Text style={s.historyStatLabel}>{t('closingBalance')}</Text>
          <Text style={[s.historyStatValue, { color: colors.emerald }]}>
            {item.closingBalance?.toFixed(0)} {t('sar')}
          </Text>
        </View>
      </View>

      <View style={s.historyFooter}>
        <Text style={s.historyFooterText}>{t('cashier')}: {item.cashierName}</Text>
        <Text style={s.historyFooterText}>
          {format(new Date(item.openedAt), 'hh:mm a', { locale: dateLocale })} - {item.closedAt ? format(new Date(item.closedAt), 'hh:mm a', { locale: dateLocale }) : ''}
        </Text>
      </View>
      {item.notes && (
        <View style={s.historyNotes}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
          <Text style={s.historyNotesText}>{item.notes}</Text>
        </View>
      )}
    </View>
  );

  const renderCurrentSession = () => {
    if (!currentSession || currentSession.status === 'closed') {
      return (
        <View style={s.noSession}>
          <View style={s.noSessionIcon}>
            <Ionicons name="lock-closed-outline" size={56} color={colors.textDark} />
          </View>
          <Text style={s.noSessionTitle}>{t('noActiveSession')}</Text>
          <Text style={s.noSessionSubtitle}>{t('openSession')}</Text>
          <TouchableOpacity style={s.openBtn} onPress={() => setShowOpenModal(true)}>
            <Ionicons name="lock-open" size={20} color="#FFF" />
            <Text style={s.openBtnText}>{t('openSession')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={s.sessionContent} showsVerticalScrollIndicator={false}>
        <View style={s.sessionHeader}>
          <View style={[s.sessionStatus, { backgroundColor: colors.emeraldBg }]}>
            <View style={s.statusDot} />
            <Text style={[s.sessionStatusText, { color: colors.emerald }]}>{t('currentSession')}</Text>
          </View>
          <Text style={s.sessionTime}>
            {format(new Date(currentSession.openedAt), 'hh:mm a', { locale: dateLocale })}
          </Text>
        </View>
        <Text style={s.sessionCashier}>{t('cashier')}: {currentSession.cashierName}</Text>

        <View style={s.statsGrid}>
          {renderStatCard(t('totalSales'), `${currentSession.totalSales.toFixed(0)} ${t('sar')}`, 'trending-up', colors.emerald, colors.emeraldBg)}
          {renderStatCard(t('totalOrders'), `${currentSession.totalOrders}`, 'receipt-outline', colors.blue, colors.blueBg)}
          {renderStatCard(t('cashSales'), `${currentSession.cashSales.toFixed(0)} ${t('sar')}`, 'cash-outline', colors.amber, colors.amberBg)}
          {renderStatCard(t('cardSales'), `${currentSession.cardSales.toFixed(0)} ${t('sar')}`, 'card-outline', colors.indigo, colors.indigoBg)}
        </View>

        <View style={s.balanceCard}>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>{t('openingBalance')}</Text>
            <Text style={s.balanceValue}>{currentSession.openingBalance.toFixed(2)} {t('sar')}</Text>
          </View>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>{t('depositCash')}</Text>
            <Text style={[s.balanceValue, { color: colors.emerald }]}>+{depositsTotal.toFixed(2)} {t('sar')}</Text>
          </View>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>{t('withdrawCash')}</Text>
            <Text style={[s.balanceValue, { color: colors.rose }]}>-{withdrawalsTotal.toFixed(2)} {t('sar')}</Text>
          </View>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>{t('cashSales')}</Text>
            <Text style={[s.balanceValue, { color: colors.emerald }]}>+{currentSession.cashSales.toFixed(2)} {t('sar')}</Text>
          </View>
          <View style={[s.balanceRow, s.balanceTotalRow]}>
            <Text style={s.balanceTotalLabel}>{t('closingBalance')}</Text>
            <Text style={s.balanceTotalValue}>
              {(currentSession.openingBalance + currentSession.cashSales + depositsTotal - withdrawalsTotal).toFixed(2)} {t('sar')}
            </Text>
          </View>
        </View>

        <View style={s.txActions}>
          <TouchableOpacity
            style={[s.txActionBtn, { backgroundColor: colors.emeraldBg, borderColor: colors.emeraldBorder }]}
            onPress={() => { setTransactionType('deposit'); setShowTransactionModal(true); }}
          >
            <Ionicons name="arrow-down-circle" size={20} color={colors.emerald} />
            <Text style={[s.txActionText, { color: colors.emerald }]}>{t('depositCash')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.txActionBtn, { backgroundColor: colors.roseBg, borderColor: colors.roseBorder }]}
            onPress={() => { setTransactionType('withdrawal'); setShowTransactionModal(true); }}
          >
            <Ionicons name="arrow-up-circle" size={20} color={colors.rose} />
            <Text style={[s.txActionText, { color: colors.rose }]}>{t('withdrawCash')}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.txSection}>
          <Text style={s.txSectionTitle}>{t('stockTransaction')}</Text>
          {cashTransactions.length === 0 ? (
            <View style={s.txEmpty}>
              <Ionicons name="swap-horizontal-outline" size={32} color={colors.textDark} />
              <Text style={s.txEmptyText}>{t('noActiveSession')}</Text>
            </View>
          ) : (
            cashTransactions.map((tx) => (
              <View key={tx.id}>
                {renderTransaction({ item: tx })}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={s.closeBtn} onPress={() => setShowCloseModal(true)}>
          <Ionicons name="lock-closed" size={20} color="#FFF" />
          <Text style={s.closeBtnText}>{t('closeSession')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <DrawerMenuButton />
          <Text style={s.title}>{t('daySession')}</Text>
          <View style={s.headerIcon}>
            <Ionicons name="time" size={20} color={colors.primary} />
          </View>
        </View>

        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'current' && s.tabActive]}
            onPress={() => setActiveTab('current')}
          >
            <Ionicons name="today" size={16} color={activeTab === 'current' ? colors.primary : colors.textMuted} />
            <Text style={[s.tabText, activeTab === 'current' && s.tabTextActive]}>{t('currentSession')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'history' && s.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons name="time-outline" size={16} color={activeTab === 'history' ? colors.primary : colors.textMuted} />
            <Text style={[s.tabText, activeTab === 'history' && s.tabTextActive]}>{t('sessionHistory')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'current' ? (
        renderCurrentSession()
      ) : (
        <FlatList
          data={sessionHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderHistorySession}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.txEmpty}>
              <Ionicons name="time-outline" size={48} color={colors.textDark} />
              <Text style={s.txEmptyText}>{t('noActiveSession')}</Text>
            </View>
          }
        />
      )}

      <Modal visible={showOpenModal} transparent animationType="slide" onRequestClose={() => setShowOpenModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowOpenModal(false)}>
          <Pressable style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('openSession')}</Text>
              <TouchableOpacity onPress={() => setShowOpenModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={s.modalBody}>
              <Text style={s.inputLabel}>{t('cashierName')} *</Text>
              <TextInput
                style={s.modalInput}
                placeholder={t('cashierName')}
                placeholderTextColor={colors.textDark}
                value={cashierName}
                onChangeText={setCashierName}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={s.inputLabel}>{t('openingBalance')} ({t('sar')}) *</Text>
              <TextInput
                style={s.modalInput}
                placeholder="0.00"
                placeholderTextColor={colors.textDark}
                value={openingBalance}
                onChangeText={setOpeningBalance}
                keyboardType="numeric"
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity style={s.modalPrimaryBtn} onPress={handleOpenSession}>
                <Ionicons name="lock-open" size={18} color="#FFF" />
                <Text style={s.modalPrimaryBtnText}>{t('openSession')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCloseModal} transparent animationType="slide" onRequestClose={() => setShowCloseModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowCloseModal(false)}>
          <Pressable style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('closeSession')}</Text>
              <TouchableOpacity onPress={() => setShowCloseModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={s.modalBody}>
              {currentSession && (
                <View style={s.closeSummary}>
                  <View style={s.closeSummaryRow}>
                    <Text style={s.closeSummaryLabel}>{t('totalSales')}</Text>
                    <Text style={s.closeSummaryValue}>{currentSession.totalSales.toFixed(2)} {t('sar')}</Text>
                  </View>
                  <View style={s.closeSummaryRow}>
                    <Text style={s.closeSummaryLabel}>{t('totalOrders')}</Text>
                    <Text style={s.closeSummaryValue}>{currentSession.totalOrders}</Text>
                  </View>
                  <View style={s.closeSummaryRow}>
                    <Text style={s.closeSummaryLabel}>{language === 'ar' ? 'النقد المتوقع' : 'Expected Cash'}</Text>
                    <Text style={s.closeSummaryValue}>
                      {(currentSession.openingBalance + currentSession.cashSales + depositsTotal - withdrawalsTotal).toFixed(2)} {t('sar')}
                    </Text>
                  </View>

                  <View style={{ marginVertical: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 }}>
                     <Text style={s.inputLabel}>{language === 'ar' ? 'النقد الفعلي (في الدرج)' : 'Actual Cash (In Drawer)'} *</Text>
                     <TextInput
                        style={[s.modalInput, { fontSize: 18, fontWeight: 'bold', color: colors.text }]}
                        placeholder="0.00"
                        placeholderTextColor={colors.textDark}
                        value={actualCash}
                        onChangeText={setActualCash}
                        keyboardType="numeric"
                        textAlign={isRTL ? 'right' : 'left'}
                      />
                  </View>

                  <View style={[s.closeSummaryRow, { 
                    backgroundColor: Math.abs((parseFloat(actualCash || '0') - (currentSession.openingBalance + currentSession.cashSales + depositsTotal - withdrawalsTotal))) < 0.1 ? colors.emeraldBg : colors.roseBg, 
                    padding: 8, 
                    borderRadius: 8 
                  }]}>
                    <Text style={[s.closeSummaryLabel, { fontWeight: 'bold' }]}>{language === 'ar' ? 'الفرق' : 'Difference'}</Text>
                    <Text style={[s.closeSummaryValue, { 
                        color: Math.abs((parseFloat(actualCash || '0') - (currentSession.openingBalance + currentSession.cashSales + depositsTotal - withdrawalsTotal))) < 0.1 ? colors.emerald : colors.rose, 
                        fontWeight: 'bold' 
                    }]}>
                      {(parseFloat(actualCash || '0') - (currentSession.openingBalance + currentSession.cashSales + depositsTotal - withdrawalsTotal)).toFixed(2)} {t('sar')}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.inputLabel}>{t('notes')} ({t('optional')})</Text>
              <TextInput
                style={[s.modalInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder={t('addNotes')}
                placeholderTextColor={colors.textDark}
                value={closeNotes}
                onChangeText={setCloseNotes}
                textAlign={isRTL ? 'right' : 'left'}
                multiline
              />
              <TouchableOpacity style={[s.modalPrimaryBtn, { backgroundColor: colors.rose }]} onPress={handleCloseSession}>
                <Ionicons name="lock-closed" size={18} color="#FFF" />
                <Text style={s.modalPrimaryBtnText}>{t('closeSession')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTransactionModal} transparent animationType="slide" onRequestClose={() => setShowTransactionModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowTransactionModal(false)}>
          <Pressable style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {transactionType === 'deposit' ? t('depositCash') : t('withdrawCash')}
              </Text>
              <TouchableOpacity onPress={() => setShowTransactionModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={s.modalBody}>
              <Text style={s.inputLabel}>{t('amount')} ({t('sar')}) *</Text>
              <TextInput
                style={s.modalInput}
                placeholder="0.00"
                placeholderTextColor={colors.textDark}
                value={transactionAmount}
                onChangeText={setTransactionAmount}
                keyboardType="numeric"
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={s.inputLabel}>{t('reason')} *</Text>
              <TextInput
                style={s.modalInput}
                placeholder={t('reason')}
                placeholderTextColor={colors.textDark}
                value={transactionReason}
                onChangeText={setTransactionReason}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity
                style={[s.modalPrimaryBtn, {
                  backgroundColor: transactionType === 'deposit' ? colors.emerald : colors.rose,
                }]}
                onPress={handleAddTransaction}
              >
                <Ionicons
                  name={transactionType === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={18}
                  color="#FFF"
                />
                <Text style={s.modalPrimaryBtnText}>
                  {transactionType === 'deposit' ? t('depositCash') : t('withdrawCash')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const dynStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0 },
  headerRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1, textAlign: isRTL ? 'right' : 'left', marginHorizontal: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.1)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 4 },
  tab: { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  list: { padding: 16 },
  sessionContent: { flex: 1, padding: 16 },
  sessionHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sessionStatus: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
  sessionStatusText: { fontSize: 13, fontWeight: '700' },
  sessionTime: { fontSize: 12, color: colors.textMuted },
  sessionCashier: { fontSize: 13, color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', marginBottom: 16 },
  statsGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: isRTL ? 'flex-end' : 'flex-start' },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textMuted },
  balanceCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  balanceRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 8 },
  balanceLabel: { fontSize: 14, color: colors.textSecondary },
  balanceValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  balanceTotalRow: { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 4, paddingTop: 12 },
  balanceTotalLabel: { fontSize: 16, fontWeight: '900', color: colors.text },
  balanceTotalValue: { fontSize: 16, fontWeight: '900', color: colors.emerald },
  txActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 20 },
  txActionBtn: { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  txActionText: { fontSize: 14, fontWeight: '700' },
  txSection: { marginBottom: 20 },
  txSectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textAlign: isRTL ? 'right' : 'left', marginBottom: 12 },
  txCard: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txReason: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: isRTL ? 'right' : 'left' },
  txTime: { fontSize: 11, color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginTop: 2 },
  txAmountBox: { alignItems: isRTL ? 'flex-start' : 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '800' },
  txCurrency: { fontSize: 10, color: colors.textMuted, marginTop: -2 },
  txEmpty: { alignItems: 'center', paddingVertical: 32 },
  txEmptyText: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  noSession: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  noSessionIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  noSessionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  noSessionSubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  openBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  openBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  closeBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.rose, borderRadius: 14, paddingVertical: 14, shadowColor: colors.rose, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  historyCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  historyHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  historyStatus: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  historyStatusText: { fontSize: 12, fontWeight: '700' },
  historyDate: { fontSize: 14, fontWeight: '700', color: colors.text },
  historyStats: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 14 },
  historyStat: { alignItems: 'center' },
  historyStatLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  historyStatValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  historyFooter: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  historyFooterText: { fontSize: 12, color: colors.textMuted },
  historyNotes: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  historyNotesText: { fontSize: 12, color: colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.borderLight },
  modalHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', marginBottom: 8, marginTop: 4 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.borderLight, borderRadius: 14, height: 48, paddingHorizontal: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  modalPrimaryBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  modalPrimaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  closeSummary: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  closeSummaryRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 6 },
  closeSummaryLabel: { fontSize: 14, color: colors.textSecondary },
  closeSummaryValue: { fontSize: 14, fontWeight: '700', color: colors.text },
});
