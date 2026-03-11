import { api, ApiError } from './api';
import { OfflineStorage, type SyncQueueItem } from './storage';
import { markOfflineSaleFailed, markOfflineSaleSynced } from './offlineSales';
import { buildRecoveryInsights, createRecoverySnapshot, initLocalFinanceDb } from './localDb';

type SyncResult = {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
};

async function applyQueueItem(item: SyncQueueItem): Promise<any> {
  const { entity, action, data } = item;

  if (entity === 'orders') {
    if (action === 'create') return await api.orders.create(data, { idempotencyKey: item.idempotencyKey });
    if (action === 'update') return await api.orders.update(data.id, data, {
      idempotencyKey: item.idempotencyKey,
      ifMatch: data?.updatedAt ? String(data.updatedAt) : undefined,
    });
    if (action === 'delete') return await api.orders.delete(data.id);
  }

  if (entity === 'customers') {
    if (action === 'create') return await api.customers.create(data, { idempotencyKey: item.idempotencyKey });
    if (action === 'update') return await api.customers.update(data.id, data, {
      idempotencyKey: item.idempotencyKey,
      ifMatch: data?.updatedAt ? String(data.updatedAt) : undefined,
    });
    if (action === 'delete') return await api.customers.delete(data.id);
  }

  if (entity === 'inventory') {
    if (action === 'create') return await api.inventory.create(data, { idempotencyKey: item.idempotencyKey });
    if (action === 'update') return await api.inventory.update(data.id, data, {
      idempotencyKey: item.idempotencyKey,
      ifMatch: data?.updatedAt ? String(data.updatedAt) : undefined,
    });
    if (action === 'delete') return await api.inventory.delete(data.id);
  }

  throw new Error(`Unsupported sync entity/action: ${entity}/${action}`);
}

async function updateRecoveryState(result: SyncResult, queueBacklogAtRecovery: number, lastError?: string) {
  await initLocalFinanceDb();
  const insights = await buildRecoveryInsights();
  await OfflineStorage.saveRecoveryState({
    lastRecoveryAt: new Date().toISOString(),
    lastProcessedSyncItems: result.processed,
    queueBacklogAtRecovery,
    lastError,
  });
  await createRecoverySnapshot({
    queueCount: queueBacklogAtRecovery,
    queuedDocuments: insights.queued,
    failedDocuments: insights.failed,
    conflictDocuments: insights.conflict,
    oldestUnsyncedAt: insights.oldestUnsyncedAt,
    policySummary: insights.recommendedPolicy,
  });
}

export async function processSyncQueue(batchSize = 25): Promise<SyncResult> {
  const queueBacklogAtRecovery = (await OfflineStorage.getSyncQueue()).length;
  const readyItems = await OfflineStorage.getReadySyncQueue(batchSize);

  let succeeded = 0;
  let failed = 0;
  let conflicts = 0;

  for (const item of readyItems) {
    try {
      const response = await applyQueueItem(item);
      await OfflineStorage.removeSyncItem(item.id);
      if (item.entity === 'orders' && item.action === 'create') {
        let invoice: any;
        try {
          invoice = response?.id ? await api.invoices.getByOrder(response.id) : undefined;
        } catch {
          invoice = undefined;
        }
        await markOfflineSaleSynced(item.idempotencyKey, {
          ...response,
          invoiceId: invoice?.id,
        });
      }
      succeeded += 1;
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 409) {
        conflicts += 1;
        await OfflineStorage.addSyncConflict({
          entity: item.entity,
          action: item.action,
          data: item.data,
          idempotencyKey: item.idempotencyKey,
          serverMessage: error.message,
        });
        await OfflineStorage.removeSyncItem(item.id);
        if (item.entity === 'orders' && item.action === 'create') {
          await markOfflineSaleFailed(item.idempotencyKey, error.message, 'conflict');
        }
        continue;
      }

      failed += 1;
      await OfflineStorage.markSyncItemRetry(item.id, error?.message || 'Sync failed');
      if (item.entity === 'orders' && item.action === 'create') {
        await markOfflineSaleFailed(item.idempotencyKey, error?.message || 'Sync failed');
      }
    }
  }

  await OfflineStorage.dropFailedSyncItems(8);

  const result = {
    processed: readyItems.length,
    succeeded,
    failed,
    conflicts,
  };

  if (succeeded > 0) {
    await OfflineStorage.updateLastSync();
  }

  await updateRecoveryState(
    result,
    queueBacklogAtRecovery,
    failed > 0 ? 'One or more sync items failed' : conflicts > 0 ? 'One or more sync conflicts detected' : undefined,
  );

  return result;
}

export async function queueCreate(entity: 'orders' | 'customers' | 'inventory', data: any, idempotencyKey?: string) {
  await OfflineStorage.addToSyncQueue({
    action: 'create',
    entity,
    data,
    idempotencyKey,
  });
}

export async function queueUpdate(entity: 'orders' | 'customers' | 'inventory', data: any, idempotencyKey?: string) {
  await OfflineStorage.addToSyncQueue({
    action: 'update',
    entity,
    data,
    idempotencyKey,
  });
}

export async function queueDelete(entity: 'orders' | 'customers' | 'inventory', data: any, idempotencyKey?: string) {
  await OfflineStorage.addToSyncQueue({
    action: 'delete',
    entity,
    data,
    idempotencyKey,
  });
}
