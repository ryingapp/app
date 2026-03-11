import { OfflineStorage } from './storage';
import { queueCreate } from './syncEngine';
import {
  appendFinanceLedgerEvent,
  buildRecoveryInsights,
  createLocalSaleFinancialDocument,
  getOfflineFinanceDocumentByIdempotencyKey,
  initLocalFinanceDb,
  listOfflineFinanceDocuments,
  type LocalReconciliationPolicy,
  updateOfflineFinanceDocumentStatus,
} from './localDb';

export interface OfflineSaleRecord {
  id: string;
  idempotencyKey: string;
  localOrderNumber: string;
  localInvoiceNumber: string;
  createdAt: string;
  orderData: any;
  invoiceData?: any;
  syncStatus: 'queued' | 'synced' | 'failed' | 'conflict';
  reconciliationPolicy?: LocalReconciliationPolicy;
  lastError?: string;
  syncedAt?: string;
  serverOrderId?: string;
  serverInvoiceId?: string;
  ledgerHeadHash?: string;
}

function randomSuffix(length = 6): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

function deviceTag(): string {
  return randomSuffix(4);
}

export function buildOfflineOrderNumber(): string {
  const stamp = Date.now().toString().slice(-8);
  return `OFF-${deviceTag()}-${stamp}`;
}

export function buildOfflineInvoiceNumber(): string {
  const stamp = Date.now().toString().slice(-8);
  return `LINV-${deviceTag()}-${stamp}`;
}

export function buildSaleIdempotencyKey(): string {
  return `sale:${Date.now()}:${randomSuffix(8)}`;
}

function buildLocalInvoicePayload(orderData: any, localInvoiceNumber: string, createdAt: string) {
  return {
    id: `local_invoice_${Date.now()}_${randomSuffix(5)}`,
    invoiceNumber: localInvoiceNumber,
    invoiceType: 'simplified',
    status: 'issued',
    subtotal: Number(orderData?.subtotal || 0),
    taxAmount: Number(orderData?.taxAmount || 0),
    taxRate: Number(orderData?.taxRate || 0),
    total: Number(orderData?.total || 0),
    customerName: orderData?.customerName,
    customerPhone: orderData?.customerPhone,
    paymentMethod: orderData?.paymentMethod || 'cash',
    isPaid: orderData?.paymentMethod !== 'online',
    qrCodeData: '',
    cashierName: 'Offline Cashier',
    createdAt,
  };
}

async function syncAsyncStorageMirror(): Promise<OfflineSaleRecord[]> {
  await initLocalFinanceDb();
  const docs = await listOfflineFinanceDocuments();
  const records: OfflineSaleRecord[] = docs.map((doc) => ({
    id: doc.id,
    idempotencyKey: doc.idempotencyKey,
    localOrderNumber: doc.localOrderNumber,
    localInvoiceNumber: doc.localInvoiceNumber,
    createdAt: doc.createdAt,
    orderData: doc.orderPayload,
    invoiceData: doc.invoicePayload,
    syncStatus: doc.syncStatus,
    reconciliationPolicy: doc.reconciliationPolicy,
    lastError: doc.lastError,
    syncedAt: doc.syncedAt,
    serverOrderId: doc.serverOrderId,
    serverInvoiceId: doc.serverInvoiceId,
    ledgerHeadHash: doc.ledgerHeadHash,
  }));
  await OfflineStorage.saveOfflineSales(records);
  return records;
}

export async function getOfflineSales(): Promise<OfflineSaleRecord[]> {
  return syncAsyncStorageMirror();
}

export async function queueOfflineSale(orderData: any): Promise<OfflineSaleRecord> {
  const idempotencyKey = buildSaleIdempotencyKey();
  const localOrderNumber = buildOfflineOrderNumber();
  const localInvoiceNumber = buildOfflineInvoiceNumber();
  const createdAt = new Date().toISOString();
  const invoiceData = buildLocalInvoicePayload(orderData, localInvoiceNumber, createdAt);
  const record: OfflineSaleRecord = {
    id: `offline_sale_${Date.now()}_${randomSuffix(5)}`,
    idempotencyKey,
    localOrderNumber,
    localInvoiceNumber,
    createdAt,
    orderData: {
      ...orderData,
      notes: [
        `[OFFLINE_ORDER:${localOrderNumber}]`,
        orderData?.notes,
      ].filter(Boolean).join(' | '),
    },
    invoiceData,
    syncStatus: 'queued',
  };

  await initLocalFinanceDb();
  await queueCreate('orders', record.orderData, idempotencyKey);
  const saved = await createLocalSaleFinancialDocument({
    id: record.id,
    idempotencyKey,
    localOrderNumber,
    localInvoiceNumber,
    createdAt,
    orderPayload: record.orderData,
    invoicePayload: invoiceData,
  });
  await syncAsyncStorageMirror();

  return {
    ...record,
    reconciliationPolicy: saved.reconciliationPolicy,
    ledgerHeadHash: saved.ledgerHeadHash,
  };
}

export async function markOfflineSaleSynced(idempotencyKey: string, serverOrder?: any): Promise<void> {
  await initLocalFinanceDb();
  const linkedInvoice = serverOrder?.id
    ? await (async () => {
        try {
          const existing = await getOfflineFinanceDocumentByIdempotencyKey(idempotencyKey);
          return serverOrder?.invoiceId || existing?.serverInvoiceId;
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const updated = await updateOfflineFinanceDocumentStatus(idempotencyKey, {
    syncStatus: 'synced',
    syncedAt: new Date().toISOString(),
    lastError: undefined,
    serverOrderId: serverOrder?.id,
    serverInvoiceId: linkedInvoice,
  });
  if (updated) {
    await appendFinanceLedgerEvent(updated.id, 'server_sale_synced', {
      serverOrderId: serverOrder?.id,
      serverInvoiceId: linkedInvoice,
    });
  }
  await syncAsyncStorageMirror();
}

export async function markOfflineSaleFailed(idempotencyKey: string, reason: string, syncStatus: 'failed' | 'conflict' = 'failed'): Promise<void> {
  await initLocalFinanceDb();
  const updated = await updateOfflineFinanceDocumentStatus(idempotencyKey, {
    syncStatus,
    lastError: reason,
  });
  if (updated) {
    await appendFinanceLedgerEvent(updated.id, syncStatus === 'conflict' ? 'server_conflict_detected' : 'sync_retry_scheduled', {
      reason,
      reconciliationPolicy: updated.reconciliationPolicy,
      retryCount: updated.retryCount + 1,
    });
    await updateOfflineFinanceDocumentStatus(idempotencyKey, {
      retryCount: updated.retryCount + 1,
    });
  }
  await syncAsyncStorageMirror();
}

export async function getOfflineRecoverySummary(): Promise<{
  queued: number;
  failed: number;
  conflict: number;
  synced: number;
  oldestUnsyncedAt?: string;
  recommendedPolicy?: LocalReconciliationPolicy;
}> {
  await syncAsyncStorageMirror();
  return buildRecoveryInsights();
}
