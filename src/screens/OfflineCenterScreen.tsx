import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { DrawerMenuButton } from '../components/DrawerMenuButton';
import {
  buildRecoveryInsights,
  getOfflineFinanceQueueCounts,
  initLocalFinanceDb,
  listOfflineFinanceDocuments,
  listRecoverySnapshots,
  type LocalFinanceDocument,
  type LocalReconciliationPolicy,
  type RecoverySnapshot,
  updateDocumentReconciliationPolicy,
} from '../services/localDb';
import { processSyncQueue } from '../services/syncEngine';

const POLICY_ORDER: LocalReconciliationPolicy[] = [
  'auto_retry',
  'verify_totals',
  'manual_review',
  'writeoff_review',
];

function shortHash(value?: string) {
  if (!value) return '—';
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default function OfflineCenterScreen() {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [documents, setDocuments] = useState<LocalFinanceDocument[]>([]);
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
  const [summary, setSummary] = useState<{
    queued: number;
    failed: number;
    conflict: number;
    synced: number;
    oldestUnsyncedAt?: string;
    recommendedPolicy: LocalReconciliationPolicy;
  }>({
    queued: 0,
    failed: 0,
    conflict: 0,
    synced: 0,
    recommendedPolicy: 'auto_retry',
  });
  const [queueCounts, setQueueCounts] = useState<Record<'queued' | 'synced' | 'failed' | 'conflict', number>>({
    queued: 0,
    synced: 0,
    failed: 0,
    conflict: 0,
  });

  const loadOfflineData = useCallback(async () => {
    setLoading(true);
    try {
      await initLocalFinanceDb();
      const [nextDocs, nextSnapshots, nextSummary, nextCounts] = await Promise.all([
        listOfflineFinanceDocuments(),
        listRecoverySnapshots(8),
        buildRecoveryInsights(),
        getOfflineFinanceQueueCounts(),
      ]);
      setDocuments(nextDocs);
      setSnapshots(nextSnapshots);
      setSummary(nextSummary);
      setQueueCounts(nextCounts as any);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOfflineData();
    }, [loadOfflineData]),
  );

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await processSyncQueue(50);
      await loadOfflineData();
      Alert.alert(
        language === 'ar' ? 'تمت المزامنة' : 'Sync Complete',
        language === 'ar' ? 'تمت محاولة مزامنة عمليات الأوفلاين.' : 'Offline operations were processed.',
      );
    } catch (error: any) {
      Alert.alert(
        language === 'ar' ? 'فشل المزامنة' : 'Sync Failed',
        error?.message || (language === 'ar' ? 'تعذر تنفيذ المزامنة الآن' : 'Unable to sync right now'),
      );
    } finally {
      setSyncing(false);
    }
  };

  const changePolicy = async (doc: LocalFinanceDocument) => {
    const options = POLICY_ORDER.filter((item) => item !== doc.reconciliationPolicy);
    Alert.alert(
      t('offlinePolicy'),
      language === 'ar' ? 'اختر سياسة التسوية' : 'Choose a reconciliation policy',
      [
        ...options.map((policy) => ({
          text: policyLabel(policy, t),
          onPress: async () => {
            await updateDocumentReconciliationPolicy(doc.idempotencyKey, policy);
            await loadOfflineData();
          },
        })),
        { text: t('cancel'), style: 'cancel' },
      ],
    );
  };

  const s = styles(colors, isRTL);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <DrawerMenuButton />
        <Text style={s.headerTitle}>{t('offlineCenter')}</Text>
        <TouchableOpacity style={s.refreshButton} onPress={() => void loadOfflineData()}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 36 }}>
          <View style={s.heroCard}>
            <View style={s.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>{t('offlineCenter')}</Text>
                <Text style={s.heroDesc}>{t('offlineCenterDescription')}</Text>
              </View>
              <TouchableOpacity style={s.syncButton} onPress={handleSyncNow} disabled={syncing}>
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="sync-outline" size={16} color="#FFF" />
                    <Text style={s.syncButtonText}>{t('syncNow')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={s.recommendationText}>
              {t('recommendedPolicy')}: {policyLabel(summary.recommendedPolicy, t)}
            </Text>
            {summary.oldestUnsyncedAt ? (
              <Text style={s.subtleText}>
                {t('oldestUnsynced')}: {formatDate(summary.oldestUnsyncedAt, language)}
              </Text>
            ) : null}
          </View>

          <View style={s.summaryGrid}>
            <SummaryCard title={t('queuedOps')} value={queueCounts.queued} color={colors.amber} bg={colors.amberBg} />
            <SummaryCard title={t('failedOps')} value={queueCounts.failed} color={colors.rose} bg={colors.roseBg} />
            <SummaryCard title={t('conflictOps')} value={queueCounts.conflict} color={colors.indigo} bg={colors.indigoBg} />
            <SummaryCard title={t('syncedOps')} value={queueCounts.synced} color={colors.emerald} bg={colors.emeraldBg} />
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('offlineSalesQueue')}</Text>
            {documents.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>{t('noOfflineDocuments')}</Text>
              </View>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={s.docCard}>
                  <View style={s.docHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docTitle}>{doc.localOrderNumber}</Text>
                      <Text style={s.docSubtitle}>{doc.localInvoiceNumber}</Text>
                    </View>
                    <View style={[s.badge, badgeStyle(doc.syncStatus, colors)]}>
                      <Text style={s.badgeText}>{statusLabel(doc.syncStatus, t)}</Text>
                    </View>
                  </View>

                  <InfoRow label={t('total')} value={money(doc.invoicePayload?.total)} styles={s} />
                  <InfoRow label={t('offlinePolicy')} value={policyLabel(doc.reconciliationPolicy, t)} styles={s} />
                  <InfoRow label={t('retryCount')} value={String(doc.retryCount)} styles={s} />
                  <InfoRow label={t('localLedgerHash')} value={shortHash(doc.ledgerHeadHash)} styles={s} />
                  <InfoRow label={t('createdAt')} value={formatDate(doc.createdAt, language)} styles={s} />
                  {doc.serverOrderId ? <InfoRow label={t('serverOrderId')} value={doc.serverOrderId} styles={s} /> : null}
                  {doc.serverInvoiceId ? <InfoRow label={t('serverInvoiceId')} value={doc.serverInvoiceId} styles={s} /> : null}
                  {doc.lastError ? <InfoRow label={t('lastError')} value={doc.lastError} styles={s} /> : null}

                  <View style={s.docActions}>
                    <TouchableOpacity style={s.policyButton} onPress={() => void changePolicy(doc)}>
                      <Ionicons name="options-outline" size={16} color={colors.primary} />
                      <Text style={s.policyButtonText}>{t('changePolicy')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('recoverySnapshots')}</Text>
            {snapshots.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>{t('noRecoverySnapshots')}</Text>
              </View>
            ) : (
              snapshots.map((snapshot) => (
                <View key={snapshot.id} style={s.snapshotCard}>
                  <Text style={s.snapshotTitle}>{formatDate(snapshot.createdAt, language)}</Text>
                  <Text style={s.snapshotText}>{t('queueCount')}: {snapshot.queueCount}</Text>
                  <Text style={s.snapshotText}>{t('queuedOps')}: {snapshot.queuedDocuments}</Text>
                  <Text style={s.snapshotText}>{t('failedOps')}: {snapshot.failedDocuments}</Text>
                  <Text style={s.snapshotText}>{t('conflictOps')}: {snapshot.conflictDocuments}</Text>
                  <Text style={s.snapshotText}>{t('recommendedPolicy')}: {policyLabel(snapshot.policySummary as LocalReconciliationPolicy, t)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type OfflineScreenStyles = ReturnType<typeof styles>;

function SummaryCard({ title, value, color, bg }: { title: string; value: number; color: string; bg: string }) {
  return (
    <View style={[base.summaryCard, { backgroundColor: bg }]}> 
      <Text style={[base.summaryValue, { color }]}>{value}</Text>
      <Text style={base.summaryLabel}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: OfflineScreenStyles }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function money(value: any) {
  const parsed = Number(value || 0);
  return `${parsed.toFixed(2)} SAR`;
}

function formatDate(value: string, language: string) {
  try {
    return new Date(value).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US');
  } catch {
    return value;
  }
}

function policyLabel(policy: LocalReconciliationPolicy, t: (key: string) => string) {
  switch (policy) {
    case 'auto_retry':
      return t('policyAutoRetry');
    case 'verify_totals':
      return t('policyVerifyTotals');
    case 'manual_review':
      return t('policyManualReview');
    case 'writeoff_review':
      return t('policyWriteoffReview');
    default:
      return policy;
  }
}

function statusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case 'queued':
      return t('queued');
    case 'failed':
      return t('failed');
    case 'conflict':
      return t('conflict');
    case 'synced':
      return t('synced');
    default:
      return status;
  }
}

function badgeStyle(status: string, colors: any) {
  switch (status) {
    case 'queued':
      return { backgroundColor: colors.amberBg };
    case 'failed':
      return { backgroundColor: colors.roseBg };
    case 'conflict':
      return { backgroundColor: colors.indigoBg };
    case 'synced':
      return { backgroundColor: colors.emeraldBg };
    default:
      return { backgroundColor: colors.surfaceLight };
  }
}

const base = StyleSheet.create({
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: '#334155',
    fontWeight: '700',
  },
});

const styles = (colors: any, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  refreshButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  heroDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 4,
  },
  syncButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    minWidth: 110,
  },
  syncButtonText: {
    color: '#FFF',
    fontWeight: '800',
  },
  recommendationText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  subtleText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: fontSize.md,
  },
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 10,
  },
  docHeaderRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  docTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  docSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left',
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    flex: 1,
    textAlign: isRTL ? 'left' : 'right',
  },
  docActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'flex-start',
    marginTop: 6,
  },
  policyButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryGlow,
  },
  policyButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  snapshotCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  snapshotTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  snapshotText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
});
