import * as SQLite from 'expo-sqlite';

export type LocalFinanceSyncStatus = 'queued' | 'synced' | 'failed' | 'conflict';
export type LocalFinanceDocumentType = 'sale' | 'invoice';
export type LocalReconciliationPolicy = 'auto_retry' | 'verify_totals' | 'manual_review' | 'writeoff_review';

export interface LocalFinanceDocument {
  id: string;
  documentType: LocalFinanceDocumentType;
  idempotencyKey: string;
  localOrderNumber: string;
  localInvoiceNumber: string;
  orderPayload: any;
  invoicePayload: any;
  syncStatus: LocalFinanceSyncStatus;
  reconciliationPolicy: LocalReconciliationPolicy;
  lastError?: string;
  retryCount: number;
  disconnectStartedAt: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  serverOrderId?: string;
  serverInvoiceId?: string;
  ledgerHeadHash?: string;
}

export interface LocalFinanceLedgerEntry {
  id: string;
  documentId: string;
  eventType: string;
  payload: any;
  previousHash: string;
  currentHash: string;
  createdAt: string;
}

export interface RecoverySnapshot {
  id: string;
  queueCount: number;
  queuedDocuments: number;
  failedDocuments: number;
  conflictDocuments: number;
  oldestUnsyncedAt?: string;
  policySummary: string;
  createdAt: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toDocument(row: any): LocalFinanceDocument {
  return {
    id: row.id,
    documentType: row.document_type,
    idempotencyKey: row.idempotency_key,
    localOrderNumber: row.local_order_number,
    localInvoiceNumber: row.local_invoice_number,
    orderPayload: parseJson(row.order_payload, {}),
    invoicePayload: parseJson(row.invoice_payload, {}),
    syncStatus: row.sync_status,
    reconciliationPolicy: row.reconciliation_policy,
    lastError: row.last_error || undefined,
    retryCount: Number(row.retry_count || 0),
    disconnectStartedAt: row.disconnect_started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at || undefined,
    serverOrderId: row.server_order_id || undefined,
    serverInvoiceId: row.server_invoice_id || undefined,
    ledgerHeadHash: row.ledger_head_hash || undefined,
  };
}

function policyForDisconnect(disconnectStartedAt: string): LocalReconciliationPolicy {
  const ageHours = Math.max(0, (Date.now() - new Date(disconnectStartedAt).getTime()) / 3_600_000);
  if (ageHours < 24) return 'auto_retry';
  if (ageHours < 72) return 'verify_totals';
  if (ageHours < 168) return 'manual_review';
  return 'writeoff_review';
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('tryingpos-local-finance.db');
  }
  return dbPromise;
}

export async function initLocalFinanceDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS offline_finance_documents (
      id TEXT PRIMARY KEY NOT NULL,
      document_type TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      local_order_number TEXT NOT NULL,
      local_invoice_number TEXT NOT NULL,
      order_payload TEXT NOT NULL,
      invoice_payload TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      reconciliation_policy TEXT NOT NULL,
      last_error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      disconnect_started_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      server_order_id TEXT,
      server_invoice_id TEXT,
      ledger_head_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_offline_finance_sync_status ON offline_finance_documents(sync_status, created_at);
    CREATE TABLE IF NOT EXISTS local_finance_ledger (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      previous_hash TEXT NOT NULL,
      current_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_finance_ledger_document ON local_finance_ledger(document_id, created_at);
    CREATE TABLE IF NOT EXISTS recovery_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      queue_count INTEGER NOT NULL,
      queued_documents INTEGER NOT NULL,
      failed_documents INTEGER NOT NULL,
      conflict_documents INTEGER NOT NULL,
      oldest_unsynced_at TEXT,
      policy_summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function appendFinanceLedgerEvent(documentId: string, eventType: string, payload: any): Promise<string> {
  const db = await getDb();
  const lastEntry = await db.getFirstAsync<{ current_hash?: string }>(
    'SELECT current_hash FROM local_finance_ledger ORDER BY created_at DESC LIMIT 1',
  );
  const previousHash = lastEntry?.current_hash || 'GENESIS';
  const createdAt = nowIso();
  const payloadJson = JSON.stringify(payload ?? {});
  const currentHash = simpleHash(`${documentId}|${eventType}|${previousHash}|${createdAt}|${payloadJson}`);

  await db.runAsync(
    `INSERT INTO local_finance_ledger (id, document_id, event_type, payload_json, previous_hash, current_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [makeId('ledger'), documentId, eventType, payloadJson, previousHash, currentHash, createdAt],
  );

  await db.runAsync(
    'UPDATE offline_finance_documents SET ledger_head_hash = ?, updated_at = ? WHERE id = ?',
    [currentHash, createdAt, documentId],
  );

  return currentHash;
}

export async function saveOfflineFinanceDocument(input: Omit<LocalFinanceDocument, 'retryCount' | 'updatedAt' | 'reconciliationPolicy' | 'ledgerHeadHash'> & {
  retryCount?: number;
  reconciliationPolicy?: LocalReconciliationPolicy;
  ledgerHeadHash?: string;
}): Promise<LocalFinanceDocument> {
  const db = await getDb();
  const updatedAt = nowIso();
  const reconciliationPolicy = input.reconciliationPolicy || policyForDisconnect(input.disconnectStartedAt);

  await db.runAsync(
    `INSERT OR REPLACE INTO offline_finance_documents (
      id, document_type, idempotency_key, local_order_number, local_invoice_number,
      order_payload, invoice_payload, sync_status, reconciliation_policy, last_error,
      retry_count, disconnect_started_at, created_at, updated_at, synced_at,
      server_order_id, server_invoice_id, ledger_head_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.documentType,
      input.idempotencyKey,
      input.localOrderNumber,
      input.localInvoiceNumber,
      JSON.stringify(input.orderPayload ?? {}),
      JSON.stringify(input.invoicePayload ?? {}),
      input.syncStatus,
      reconciliationPolicy,
      input.lastError || null,
      input.retryCount ?? 0,
      input.disconnectStartedAt,
      input.createdAt,
      updatedAt,
      input.syncedAt || null,
      input.serverOrderId || null,
      input.serverInvoiceId || null,
      input.ledgerHeadHash || null,
    ],
  );

  const saved = await getOfflineFinanceDocumentById(input.id);
  if (!saved) {
    throw new Error('FAILED_TO_PERSIST_LOCAL_FINANCE_DOCUMENT');
  }
  return saved;
}

export async function getOfflineFinanceDocumentById(id: string): Promise<LocalFinanceDocument | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM offline_finance_documents WHERE id = ? LIMIT 1', [id]);
  return row ? toDocument(row) : null;
}

export async function getOfflineFinanceDocumentByIdempotencyKey(idempotencyKey: string): Promise<LocalFinanceDocument | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM offline_finance_documents WHERE idempotency_key = ? LIMIT 1',
    [idempotencyKey],
  );
  return row ? toDocument(row) : null;
}

export async function listOfflineFinanceDocuments(): Promise<LocalFinanceDocument[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM offline_finance_documents ORDER BY created_at DESC');
  return rows.map(toDocument);
}

export async function updateOfflineFinanceDocumentStatus(
  idempotencyKey: string,
  patch: Partial<Pick<LocalFinanceDocument, 'syncStatus' | 'lastError' | 'serverOrderId' | 'serverInvoiceId' | 'syncedAt' | 'retryCount' | 'reconciliationPolicy'>>,
): Promise<LocalFinanceDocument | null> {
  const existing = await getOfflineFinanceDocumentByIdempotencyKey(idempotencyKey);
  if (!existing) return null;

  const next: LocalFinanceDocument = {
    ...existing,
    ...patch,
    reconciliationPolicy: patch.reconciliationPolicy || policyForDisconnect(existing.disconnectStartedAt),
    retryCount: patch.retryCount ?? existing.retryCount,
    lastError: patch.lastError ?? existing.lastError,
    serverOrderId: patch.serverOrderId ?? existing.serverOrderId,
    serverInvoiceId: patch.serverInvoiceId ?? existing.serverInvoiceId,
    syncedAt: patch.syncedAt ?? existing.syncedAt,
    syncStatus: patch.syncStatus ?? existing.syncStatus,
    updatedAt: nowIso(),
  };

  return saveOfflineFinanceDocument(next);
}

export async function listLedgerEntries(documentId?: string): Promise<LocalFinanceLedgerEntry[]> {
  const db = await getDb();
  const rows = documentId
    ? await db.getAllAsync<any>('SELECT * FROM local_finance_ledger WHERE document_id = ? ORDER BY created_at ASC', [documentId])
    : await db.getAllAsync<any>('SELECT * FROM local_finance_ledger ORDER BY created_at ASC');

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    eventType: row.event_type,
    payload: parseJson(row.payload_json, {}),
    previousHash: row.previous_hash,
    currentHash: row.current_hash,
    createdAt: row.created_at,
  }));
}

export async function createRecoverySnapshot(snapshot: Omit<RecoverySnapshot, 'id' | 'createdAt'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO recovery_snapshots (id, queue_count, queued_documents, failed_documents, conflict_documents, oldest_unsynced_at, policy_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      makeId('recovery'),
      snapshot.queueCount,
      snapshot.queuedDocuments,
      snapshot.failedDocuments,
      snapshot.conflictDocuments,
      snapshot.oldestUnsyncedAt || null,
      snapshot.policySummary,
      nowIso(),
    ],
  );
}

export async function listRecoverySnapshots(limit = 10): Promise<RecoverySnapshot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM recovery_snapshots ORDER BY created_at DESC LIMIT ?',
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    queueCount: Number(row.queue_count || 0),
    queuedDocuments: Number(row.queued_documents || 0),
    failedDocuments: Number(row.failed_documents || 0),
    conflictDocuments: Number(row.conflict_documents || 0),
    oldestUnsyncedAt: row.oldest_unsynced_at || undefined,
    policySummary: row.policy_summary,
    createdAt: row.created_at,
  }));
}

export async function updateDocumentReconciliationPolicy(
  idempotencyKey: string,
  reconciliationPolicy: LocalReconciliationPolicy,
): Promise<LocalFinanceDocument | null> {
  return updateOfflineFinanceDocumentStatus(idempotencyKey, {
    reconciliationPolicy,
  });
}

export async function getOfflineFinanceQueueCounts(): Promise<Record<LocalFinanceSyncStatus, number>> {
  const docs = await listOfflineFinanceDocuments();
  return docs.reduce(
    (acc, doc) => {
      acc[doc.syncStatus] += 1;
      return acc;
    },
    { queued: 0, synced: 0, failed: 0, conflict: 0 } as Record<LocalFinanceSyncStatus, number>,
  );
}

export async function buildRecoveryInsights(): Promise<{
  queued: number;
  failed: number;
  conflict: number;
  synced: number;
  oldestUnsyncedAt?: string;
  recommendedPolicy: LocalReconciliationPolicy;
}> {
  const docs = await listOfflineFinanceDocuments();
  const queuedDocs = docs.filter((doc) => doc.syncStatus === 'queued');
  const failedDocs = docs.filter((doc) => doc.syncStatus === 'failed');
  const conflictDocs = docs.filter((doc) => doc.syncStatus === 'conflict');
  const syncedDocs = docs.filter((doc) => doc.syncStatus === 'synced');
  const oldestUnsyncedAt = [...queuedDocs, ...failedDocs, ...conflictDocs]
    .map((doc) => doc.disconnectStartedAt)
    .sort()[0];

  return {
    queued: queuedDocs.length,
    failed: failedDocs.length,
    conflict: conflictDocs.length,
    synced: syncedDocs.length,
    oldestUnsyncedAt,
    recommendedPolicy: oldestUnsyncedAt ? policyForDisconnect(oldestUnsyncedAt) : 'auto_retry',
  };
}

export async function createLocalSaleFinancialDocument(args: {
  id: string;
  idempotencyKey: string;
  localOrderNumber: string;
  localInvoiceNumber: string;
  createdAt: string;
  orderPayload: any;
  invoicePayload: any;
}): Promise<LocalFinanceDocument> {
  const saved = await saveOfflineFinanceDocument({
    id: args.id,
    documentType: 'sale',
    idempotencyKey: args.idempotencyKey,
    localOrderNumber: args.localOrderNumber,
    localInvoiceNumber: args.localInvoiceNumber,
    orderPayload: args.orderPayload,
    invoicePayload: args.invoicePayload,
    syncStatus: 'queued',
    disconnectStartedAt: args.createdAt,
    createdAt: args.createdAt,
  });

  await appendFinanceLedgerEvent(saved.id, 'offline_sale_queued', {
    localOrderNumber: saved.localOrderNumber,
    localInvoiceNumber: saved.localInvoiceNumber,
    total: saved.invoicePayload?.total,
  });
  await appendFinanceLedgerEvent(saved.id, 'local_invoice_issued', {
    invoiceNumber: saved.localInvoiceNumber,
    total: saved.invoicePayload?.total,
    taxAmount: saved.invoicePayload?.taxAmount,
  });

  return (await getOfflineFinanceDocumentById(saved.id)) || saved;
}
