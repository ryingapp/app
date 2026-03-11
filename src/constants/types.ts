export interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
}

export interface Variant {
  id: string;
  nameEn: string;
  nameAr: string;
  priceAdjustment: number;
  isDefault: boolean;
}

export interface CustomizationOption {
  id: string;
  nameEn: string;
  nameAr: string;
  priceAdjustment: number;
  isDefault: boolean;
}

export interface CustomizationGroup {
  id: string;
  nameEn: string;
  nameAr: string;
  selectionType: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  nameEn: string;
  nameAr: string;
  price: number;
  image: string;
  isAvailable: boolean;
  calories?: number;
  multiPrices?: MultiPrice[];
  variants?: Variant[];
  customizationGroups?: CustomizationGroup[];
}

export interface CartItem extends MenuItem {
  cartId: string;
  menuItemId?: string;
  itemName?: string;
  unitPrice?: number;
  totalPrice?: number;
  quantity: number;
  selectedVariant?: Variant;
  selectedCustomizations: CustomizationOption[];
  finalUnitPrice: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  selectedVariant?: Variant;
  selectedCustomizations?: CustomizationOption[];
}

export type OrderStatus = 'created' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'delivered' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  customerName?: string;
  tableId?: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'needs_cleaning';

export interface Table {
  id: string;
  name: string;
  capacity: number;
  section: string;
  status: TableStatus;
  guests?: number;
  currentOrderValue?: number;
  timeSeated?: number;
  isVIP?: boolean;
  reservationTime?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  invoiceType: 'simplified' | 'standard' | 'credit_note' | 'debit_note';
  status: 'issued' | 'refunded';
  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  zatcaStatus?: 'approved' | 'pending' | 'rejected' | string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: 'cash' | 'card' | 'online' | string;
  isPaid: boolean;
  qrCodeData: string;
  cashierName: string;
  createdAt: string;
  uuid?: string;
  invoiceCounter?: number;
}

export type PrinterConnectionMode = 'disabled' | 'system' | 'bluetooth' | 'tcp';
export type PrinterTarget = 'cashier' | 'kitchen';

export interface PrinterProfile {
  enabled: boolean;
  mode: PrinterConnectionMode;
  label: string;
  printerWidthMM: 80;
  printerNbrCharactersPerLine: number;
  ip?: string;
  port?: number;
  autoCut: boolean;
  openCashbox?: boolean;
}

export interface KitchenPrinterStation {
  id: string;
  name: string;
  profile: PrinterProfile;
  assignedCategoryIds: string[];
  assignedCategoryNames?: string[];
  isFallback?: boolean;
}

export interface PrinterSettings {
  autoPrintCashier: boolean;
  autoPrintKitchen: boolean;
  cashier: PrinterProfile;
  kitchen: PrinterProfile;
  kitchenStations?: KitchenPrinterStation[];
}

export interface Reservation {
  id: string;
  reservationNumber: string;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  tableId?: string;
  specialRequests?: string;
  depositAmount: number;
  depositPaid: boolean;
}

export interface QueueEntry {
  id: string;
  queueNumber: number;
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: 'waiting' | 'notified' | 'seated' | 'cancelled' | 'no_show';
  estimatedWaitMinutes: number;
  createdAt: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  nameAr: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  category: string;
  isActive: boolean;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  type: 'purchase' | 'usage' | 'adjustment' | 'transfer' | 'waste';
  quantity: number;
  unitCost?: number;
  notes?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  pointsBalance?: number;
  loyaltyTier?: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface DaySession {
  id: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  totalSales: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  difference?: number;
  notes?: string;
  cashierName: string;
}

export interface CashTransaction {
  id: string;
  sessionId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  reason: string;
  createdAt: string;
}

export type DeliveryPlatform = 'hungerstation' | 'jahez' | 'keeta' | 'ninja';
export type DeliveryStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled' | 'rejected';

export interface DeliveryOrder {
  id: string;
  platform: DeliveryPlatform;
  platformOrderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: DeliveryStatus;
  total: number;
  platformFee: number;
  items: OrderItem[];
  createdAt: string;
  notes?: string;
}

export interface RestaurantSettings {
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  address?: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  commercialRegistration?: string;
  taxEnabled: boolean;
  taxRate: number;
  serviceDineIn: boolean;
  servicePickup: boolean;
  serviceDelivery: boolean;
  serviceTableBooking: boolean;
  serviceQueue: boolean;
  serviceKitchenScreen: boolean; // false = printer only
  serviceQuickOrder: boolean; // true = fast food flow
  logo?: string;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'vip';

export interface LoyaltyProfile {
  customerId: string;
  customerName: string;
  phone: string;
  tier: LoyaltyTier;
  totalPoints: number;
  availablePoints: number;
  totalSpent: number;
  totalVisits: number;
  joinedAt: string;
  pointsHistory: PointsTransaction[];
}

export interface PointsTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  orderId?: string;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  pointsCost: number;
  discountType: 'percentage' | 'fixed' | 'free_item';
  discountValue: number;
  isActive: boolean;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'discount' | 'refund' | 'payment' | 'void' | 'login' | 'logout';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  userId: string;
  userName: string;
  details: string;
  detailsAr: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export interface Rating {
  id: string;
  invoiceId: string;
  orderId: string;
  customerName: string;
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface MultiPrice {
  menuItemId: string;
  dineIn: number;
  takeaway: number;
  delivery: number;
  platform: number;
}

export interface HeldOrder {
  id: string;
  holdNumber: string;
  items: CartItem[];
  customerName?: string;
  tableId?: string;
  orderType: OrderType;
  subtotal: number;
  heldAt: string;
  heldBy: string;
  notes?: string;
  isPaid?: boolean;
  isPendingApproval?: boolean;
}
