import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ORDERS: '@tryingpos_orders',
  OFFLINE_SALES: '@tryingpos_offline_sales',
  RECOVERY_STATE: '@tryingpos_recovery_state',
  CUSTOMERS: '@tryingpos_customers',
  INVENTORY: '@tryingpos_inventory',
  DAY_SESSION: '@tryingpos_day_session',
  CASH_TRANSACTIONS: '@tryingpos_cash_transactions',
  CART: '@tryingpos_cart',
  SETTINGS: '@tryingpos_settings',
  PRINTER_SETTINGS: '@tryingpos_printer_settings',
  PROMOTIONS: '@tryingpos_promotions',
  COUPONS: '@tryingpos_coupons',
  LANGUAGE: 'app_language',
  THEME: 'app_theme',
  LAST_SYNC: '@tryingpos_last_sync',
  PENDING_SYNC: '@tryingpos_pending_sync',
  SYNC_CONFLICTS: '@tryingpos_sync_conflicts',
  DEVICE_BINDING_KEY: '@tryingpos_device_binding_key',
} as const;

const SYNC_QUEUE_WARNING_THRESHOLD = 150;
const SYNC_QUEUE_HARD_LIMIT = 300;

interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: string;
  idempotencyKey: string;
  attemptCount: number;
  nextRetryAt?: string;
  lastError?: string;
}

interface SyncConflictItem {
  id: string;
  entity: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  idempotencyKey: string;
  localTimestamp: string;
  serverMessage?: string;
}

interface StorageEnvelope<T = any> {
  v: 1;
  checksum: string;
  savedAt: string;
  payload: T;
}

interface RecoveryState {
  lastRecoveryAt?: string;
  lastProcessedSyncItems?: number;
  queueBacklogAtRecovery?: number;
  lastError?: string;
}

let deviceBindingKeyCache: string | null = null;

function fastHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

async function getDeviceBindingKey(): Promise<string> {
  if (deviceBindingKeyCache) return deviceBindingKeyCache;

  const existing = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_BINDING_KEY);
  if (existing) {
    deviceBindingKeyCache = existing;
    return existing;
  }

  const randomPart = Math.random().toString(36).slice(2);
  const generated = `dev_${Date.now()}_${randomPart}`;
  await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_BINDING_KEY, generated);
  deviceBindingKeyCache = generated;
  return generated;
}

async function buildEnvelope<T>(storageKey: string, payload: T): Promise<StorageEnvelope<T>> {
  const bindingKey = await getDeviceBindingKey();
  const payloadJson = JSON.stringify(payload);
  const checksum = fastHash(`${storageKey}|${bindingKey}|${payloadJson}`);

  return {
    v: 1,
    checksum,
    savedAt: new Date().toISOString(),
    payload,
  };
}

async function verifyEnvelope<T>(storageKey: string, envelope: StorageEnvelope<T>): Promise<boolean> {
  const bindingKey = await getDeviceBindingKey();
  const payloadJson = JSON.stringify(envelope.payload);
  const expected = fastHash(`${storageKey}|${bindingKey}|${payloadJson}`);
  return envelope.checksum === expected;
}

export const OfflineStorage = {
  async save(key: string, data: any): Promise<void> {
    try {
      const envelope = await buildEnvelope(key, data);
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (error) {
      console.error('Storage save error:', error);
    }
  },

  async load<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (parsed && parsed.v === 1 && typeof parsed.checksum === 'string' && parsed.payload !== undefined) {
        const valid = await verifyEnvelope(key, parsed as StorageEnvelope<T>);
        if (!valid) {
          console.warn(`Storage tamper detected for key: ${key}`);
          await AsyncStorage.removeItem(key);
          return null;
        }
        return (parsed as StorageEnvelope<T>).payload;
      }

      return parsed as T;
    } catch (error) {
      console.error('Storage load error:', error);
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },

  async saveOrders(orders: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.ORDERS, orders);
  },

  async loadOrders<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.ORDERS);
  },

  async saveOfflineSales(sales: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.OFFLINE_SALES, sales);
  },

  async loadOfflineSales<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.OFFLINE_SALES);
  },

  async saveCustomers(customers: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.CUSTOMERS, customers);
  },

  async loadCustomers<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.CUSTOMERS);
  },

  async saveInventory(inventory: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.INVENTORY, inventory);
  },

  async loadInventory<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.INVENTORY);
  },

  async saveDaySession(session: any): Promise<void> {
    await this.save(STORAGE_KEYS.DAY_SESSION, session);
  },

  async loadDaySession<T>(): Promise<T | null> {
    return this.load<T>(STORAGE_KEYS.DAY_SESSION);
  },

  async saveCashTransactions(transactions: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.CASH_TRANSACTIONS, transactions);
  },

  async loadCashTransactions<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.CASH_TRANSACTIONS);
  },

  async saveCart(cart: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.CART, cart);
  },

  async loadCart<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.CART);
  },

  async saveSettings(settings: any): Promise<void> {
    await this.save(STORAGE_KEYS.SETTINGS, settings);
  },

  async loadSettings<T>(): Promise<T | null> {
    return this.load<T>(STORAGE_KEYS.SETTINGS);
  },

  async savePrinterSettings(settings: any): Promise<void> {
    await this.save(STORAGE_KEYS.PRINTER_SETTINGS, settings);
  },

  async loadPrinterSettings<T>(): Promise<T | null> {
    return this.load<T>(STORAGE_KEYS.PRINTER_SETTINGS);
  },

  async savePromotions(promotions: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.PROMOTIONS, promotions);
  },

  async loadPromotions<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.PROMOTIONS);
  },

  async saveCoupons(coupons: any[]): Promise<void> {
    await this.save(STORAGE_KEYS.COUPONS, coupons);
  },

  async loadCoupons<T>(): Promise<T[] | null> {
    return this.load<T[]>(STORAGE_KEYS.COUPONS);
  },

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'idempotencyKey' | 'attemptCount'> & { idempotencyKey?: string }): Promise<void> {
    const queue = await this.load<SyncQueueItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];

    if (queue.length >= SYNC_QUEUE_HARD_LIMIT) {
      throw new Error(`SYNC_QUEUE_LIMIT_REACHED:${SYNC_QUEUE_HARD_LIMIT}`);
    }

    const generatedId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const idempotencyKey = item.idempotencyKey || `${item.entity}:${item.action}:${generatedId}`;

    const exists = queue.some((q) => q.idempotencyKey === idempotencyKey);
    if (exists) return;

    queue.push({
      ...item,
      id: generatedId,
      timestamp: new Date().toISOString(),
      idempotencyKey,
      attemptCount: 0,
    });
    await this.save(STORAGE_KEYS.PENDING_SYNC, queue);
  },

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return await this.load<SyncQueueItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];
  },

  async getSyncQueueHealth(): Promise<{
    count: number;
    status: 'healthy' | 'warning' | 'critical';
    warningThreshold: number;
    hardLimit: number;
  }> {
    const queue = await this.getSyncQueue();
    const count = queue.length;
    const status = count >= SYNC_QUEUE_HARD_LIMIT
      ? 'critical'
      : count >= SYNC_QUEUE_WARNING_THRESHOLD
        ? 'warning'
        : 'healthy';

    return {
      count,
      status,
      warningThreshold: SYNC_QUEUE_WARNING_THRESHOLD,
      hardLimit: SYNC_QUEUE_HARD_LIMIT,
    };
  },

  async clearSyncQueue(): Promise<void> {
    await this.save(STORAGE_KEYS.PENDING_SYNC, []);
  },

  async removeSyncItem(id: string): Promise<void> {
    const queue = await this.getSyncQueue();
    await this.save(STORAGE_KEYS.PENDING_SYNC, queue.filter(item => item.id !== id));
  },

  async getReadySyncQueue(limit = 25): Promise<SyncQueueItem[]> {
    const queue = await this.getSyncQueue();
    const now = Date.now();
    return queue
      .filter((item) => !item.nextRetryAt || new Date(item.nextRetryAt).getTime() <= now)
      .slice(0, limit);
  },

  async markSyncItemRetry(id: string, errorMessage: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const updated = queue.map((item) => {
      if (item.id !== id) return item;

      const attemptCount = (item.attemptCount || 0) + 1;
      const delayMs = Math.min(60_000, 1000 * Math.pow(2, Math.min(attemptCount, 6)));

      return {
        ...item,
        attemptCount,
        lastError: errorMessage,
        nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
      };
    });

    await this.save(STORAGE_KEYS.PENDING_SYNC, updated);
  },

  async dropFailedSyncItems(maxAttempts = 8): Promise<void> {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter((item) => (item.attemptCount || 0) < maxAttempts);
    await this.save(STORAGE_KEYS.PENDING_SYNC, filtered);
  },

  async updateLastSync(): Promise<void> {
    await this.save(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },

  async getLastSync(): Promise<string | null> {
    return this.load<string>(STORAGE_KEYS.LAST_SYNC);
  },

  async saveRecoveryState(state: RecoveryState): Promise<void> {
    await this.save(STORAGE_KEYS.RECOVERY_STATE, state);
  },

  async getRecoveryState(): Promise<RecoveryState | null> {
    return this.load<RecoveryState>(STORAGE_KEYS.RECOVERY_STATE);
  },

  async clearAll(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS);
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Storage clearAll error:', error);
    }
  },

  async addSyncConflict(item: Omit<SyncConflictItem, 'id' | 'localTimestamp'>): Promise<void> {
    const conflicts = await this.getSyncConflicts();
    conflicts.push({
      ...item,
      id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      localTimestamp: new Date().toISOString(),
    });
    await this.save(STORAGE_KEYS.SYNC_CONFLICTS, conflicts);
  },

  async getSyncConflicts(): Promise<SyncConflictItem[]> {
    return (await this.load<SyncConflictItem[]>(STORAGE_KEYS.SYNC_CONFLICTS)) || [];
  },

  async resolveSyncConflict(id: string): Promise<void> {
    const conflicts = await this.getSyncConflicts();
    await this.save(
      STORAGE_KEYS.SYNC_CONFLICTS,
      conflicts.filter((conflict) => conflict.id !== id),
    );
  },
};

export { STORAGE_KEYS };
export type { SyncQueueItem, SyncConflictItem, RecoveryState };
