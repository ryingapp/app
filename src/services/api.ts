const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? 'http://192.168.1.235:5000/api' : 'https://tryingpos.com/api');

interface ApiConfig {
  token?: string;
}

let config: ApiConfig = {};

// Optional callback invoked when the server returns 401 (token expired / invalid)
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  _onUnauthorized = cb;
}

export class ApiError extends Error {
  status: number;
  details: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function setApiToken(token: string) {
  config.token = token;
}

export function getApiToken(): string | undefined {
  return config.token;
}

// Returns true for errors that should NOT be retried (client errors, auth errors)
function isNonRetryableStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(endpoint: string, options: RequestInit = {}, retriesLeft = 3): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error: any) {
    // Network failure — retry with exponential backoff
    if (retriesLeft > 0) {
      const attempt = 4 - retriesLeft; // 0, 1, 2
      await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
      return request<T>(endpoint, options, retriesLeft - 1);
    }
    throw new ApiError(
      `Network request failed. API=${API_BASE_URL}. ${error?.message || ''}`.trim(),
      0,
      { endpoint, apiBaseUrl: API_BASE_URL },
    );
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ message: 'Network error' }));
    if (response.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }
    // Retry on server errors (5xx) or rate limiting (429)
    if (!isNonRetryableStatus(response.status) && retriesLeft > 0) {
      const attempt = 4 - retriesLeft;
      await sleep(Math.pow(2, attempt) * 1000);
      return request<T>(endpoint, options, retriesLeft - 1);
    }
    throw new ApiError(
      errorPayload.error || errorPayload.message || `HTTP ${response.status}`,
      response.status,
      errorPayload,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },

  restaurant: {
    get: () => request<any>('/restaurant'),
    update: (data: any) =>
      request<any>('/restaurant', { method: 'PUT', body: JSON.stringify(data) }),
  },

  categories: {
    list: () => request<any[]>('/categories'),
    getById: (id: string) => request<any>(`/categories/${id}`),
    create: (data: any) =>
      request<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/categories/${id}`, { method: 'DELETE' }),
  },

  menuItems: {
    list: () => request<any[]>('/menu-items'),
    getById: (id: string) => request<any>(`/menu-items/${id}`),
    getVariants: (id: string) => request<any[]>(`/menu-items/${id}/variants`),
    getCustomizationLinks: (id: string) => request<any[]>(`/menu-items/${id}/customizations`),
    create: (data: any) =>
      request<any>('/menu-items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/menu-items/${id}`, { method: 'DELETE' }),
  },

  customizationGroups: {
    get: (id: string) => request<any>(`/customization-groups/${id}`),
  },

  tables: {
    list: () => request<any[]>('/tables'),
    getById: (id: string) => request<any>(`/tables/${id}`),
    create: (data: any) =>
      request<any>('/tables', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request(`/tables/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    delete: (id: string) =>
      request(`/tables/${id}`, { method: 'DELETE' }),
    getActiveOrder: (id: string) =>
      request<any>(`/tables/${id}/active-order`),
    settle: (id: string, data: any) =>
      request<any>(`/tables/${id}/settle`, { method: 'POST', body: JSON.stringify(data) }),
  },

    orders: {
    list: (params?: { status?: string; type?: string; period?: string }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.type) query.append('type', params.type);
      if (params?.period) query.append('period', params.period);
      const qs = query.toString();
      return request<any[]>(`/orders${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => request<any>(`/orders/${id}`),
    create: (data: any, opts?: { idempotencyKey?: string }) =>
      request<any>('/orders', {
        method: 'POST',
        headers: opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : undefined,
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any, opts?: { idempotencyKey?: string; ifMatch?: string }) =>
      request<any>(`/orders/${id}`, {
        method: 'PUT',
        headers: {
          ...(opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : {}),
          ...(opts?.ifMatch ? { 'If-Match': opts.ifMatch } : {}),
        },
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string) =>
      request(`/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    delete: (id: string) =>
      request(`/orders/${id}`, { method: 'DELETE' }),
    getItems: (orderId: string) =>
      request<any[]>(`/orders/${orderId}/items`),
    addItems: (orderId: string, data: any) =>
      request<any>(`/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  },

  invoices: {
    list: () => request<any[]>('/invoices'),
    getById: (id: string) => request<any>(`/invoices/${id}`),
    create: (data: any) =>
      request<any>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
    refund: (invoiceId: string, reason: string, items?: any[]) =>
      request<any>(`/invoices/${invoiceId}/refund`, { method: 'POST', body: JSON.stringify({ reason, items }) }),
    getByOrder: (orderId: string) => request<any>(`/orders/${orderId}/invoice`),
  },

  kitchen: {
    orders: () => request<any[]>('/kitchen/orders'),
  },

  customers: {
    list: () => request<any[]>('/customers'),
    getById: (id: string) => request<any>(`/customers/${id}`),
    create: (data: any, opts?: { idempotencyKey?: string }) =>
      request<any>('/customers', {
        method: 'POST',
        headers: opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : undefined,
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any, opts?: { idempotencyKey?: string; ifMatch?: string }) =>
      request<any>(`/customers/${id}`, {
        method: 'PUT',
        headers: {
          ...(opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : {}),
          ...(opts?.ifMatch ? { 'If-Match': opts.ifMatch } : {}),
        },
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/customers/${id}`, { method: 'DELETE' }),
    lookup: (phone: string) => request<any>(`/customers/lookup/${phone}`),
  },

  inventory: {
    list: () => request<any[]>('/inventory'),
    getById: (id: string) => request<any>(`/inventory/${id}`),
    create: (data: any, opts?: { idempotencyKey?: string }) =>
      request<any>('/inventory', {
        method: 'POST',
        headers: opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : undefined,
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any, opts?: { idempotencyKey?: string; ifMatch?: string }) =>
      request<any>(`/inventory/${id}`, {
        method: 'PUT',
        headers: {
          ...(opts?.idempotencyKey ? { 'X-Idempotency-Key': opts.idempotencyKey } : {}),
          ...(opts?.ifMatch ? { 'If-Match': opts.ifMatch } : {}),
        },
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/inventory/${id}`, { method: 'DELETE' }),
    getTransactions: (itemId: string) =>
      request<any[]>(`/inventory/${itemId}/transactions`),
    addTransaction: (itemId: string, data: any) =>
      request<any>(`/inventory/${itemId}/transactions`, { method: 'POST', body: JSON.stringify(data) }),
  },

  users: {
    list: () => request<any[]>('/users'),
    create: (data: any) =>
      request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/users/${id}`, { method: 'DELETE' }),
  },

  branches: {
    list: () => request<any[]>('/branches'),
    create: (data: any) =>
      request<any>('/branches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/branches/${id}`, { method: 'DELETE' }),
  },

  promotions: {
    list: () => request<any[]>('/promotions'),
    getById: (id: string) => request<any>(`/promotions/${id}`),
    create: (data: any) =>
      request<any>('/promotions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/promotions/${id}`, { method: 'DELETE' }),
  },

  coupons: {
    list: () => request<any[]>('/coupons'),
    getById: (id: string) => request<any>(`/coupons/${id}`),
    create: (data: any) =>
      request<any>('/coupons', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/coupons/${id}`, { method: 'DELETE' }),
    validate: (data: any) =>
      request<any>('/coupons/validate', { method: 'POST', body: JSON.stringify(data) }),
    use: (data: any) =>
      request<any>('/coupons/use', { method: 'POST', body: JSON.stringify(data) }),
    usage: (id: string) => request<any[]>(`/coupons/${id}/usage`),
  },

  reviews: {
    list: () => request<any[]>('/reviews'),
    setVisibility: (id: string, isPublic: boolean) =>
      request<any>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ isPublic }) }),
  },

  audit: {
    invoiceLogs: (limit?: number) =>
      request<any[]>(`/invoice-audit-log${limit ? `?limit=${limit}` : ''}`),
    invoiceLogsByInvoice: (invoiceId: string) =>
      request<any[]>(`/invoice-audit-log/${invoiceId}`),
    orderLogs: (orderId: string) => request<any[]>(`/orders/${orderId}/audit-log`),
  },

  reports: {
    dailySummary: () => request<any>('/reports/daily-summary'),
    tax: (params?: { from?: string; to?: string }) => {
      const query = new URLSearchParams();
      if (params?.from) query.append('from', params.from);
      if (params?.to) query.append('to', params.to);
      const qs = query.toString();
      return request<any>(`/reports/tax${qs ? `?${qs}` : ''}`);
    },
    allBranchesSummary: () => request<any>('/reports/all-branches-summary'),
    advanced: (params?: { startDate?: string; endDate?: string; branch?: string }) => {
      const query = new URLSearchParams();
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.branch) query.append('branch', params.branch);
      const qs = query.toString();
      return request<any>(`/reports/advanced${qs ? `?${qs}` : ''}`);
    },
  },

  daySessions: {
    list: (branchId?: string) => {
      const query = branchId ? `?branch=${branchId}` : '';
      return request<any[]>(`/day-sessions${query}`);
    },
    getCurrent: (branchId?: string) => {
      const query = branchId ? `?branch=${branchId}` : '';
      return request<any>(`/day-sessions/current${query}`);
    },
    getById: (id: string) => request<any>(`/day-sessions/${id}`),
    open: (data: any, branchId?: string) => {
      const query = branchId ? `?branch=${branchId}` : '';
      return request<any>(`/day-sessions/open${query}`, { method: 'POST', body: JSON.stringify(data) });
    },
    close: (id: string, data?: any) =>
      request<any>(`/day-sessions/${id}/close`, { method: 'POST', body: JSON.stringify(data || {}) }),
    getTransactions: (id: string) =>
      request<any[]>(`/day-sessions/${id}/transactions`),
    addTransaction: (id: string, data: any) =>
      request<any>(`/day-sessions/${id}/transactions`, { method: 'POST', body: JSON.stringify(data) }),
  },

  reservations: {
    list: (date?: string) => {
      const query = date ? `?date=${date}` : '';
      return request<any[]>(`/reservations${query}`);
    },
    getById: (id: string) => request<any>(`/reservations/${id}`),
    create: (data: any) =>
      request('/reservations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request<any>(`/reservations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id: string) =>
      request(`/reservations/${id}`, { method: 'DELETE' }),
    availableSlots: (date: string, branchId?: string) => {
      const query = new URLSearchParams();
      query.append('date', date);
      if (branchId) query.append('branchId', branchId);
      return request<any[]>(`/reservations/available-slots?${query.toString()}`);
    },
  },

  queue: {
    list: () => request<any[]>('/queue'),
    getById: (id: string) => request<any>(`/queue/${id}`),
    stats: () => request<any>('/queue/stats'),
    add: (data: any) =>
      request('/queue', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`/queue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request(`/queue/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id: string) =>
      request(`/queue/${id}`, { method: 'DELETE' }),
  },
  
  loyalty: {
    getTransactions: (customerId: string) => request<any[]>(`/loyalty/transactions?customerId=${customerId}`),
    addTransaction: (data: any) => request<any>('/loyalty/transactions', { method: 'POST', body: JSON.stringify(data) }),
    getPoints: (customerId: string) => request<any>(`/loyalty/points/${customerId}`),
  },
};
