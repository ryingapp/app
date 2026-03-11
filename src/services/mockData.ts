import { Category, MenuItem, Order, Table, Invoice, Reservation, QueueEntry, InventoryItem, InventoryTransaction, Customer, Promotion, Coupon, DaySession, CashTransaction, DeliveryOrder, RestaurantSettings, LoyaltyProfile, LoyaltyReward, AuditLogEntry, Rating, MultiPrice, HeldOrder } from '../constants/types';

export const mockCategories: Category[] = [
  { id: 'c1', nameEn: 'Burgers', nameAr: 'برجر' },
  { id: 'c2', nameEn: 'Appetizers', nameAr: 'المقبلات' },
  { id: 'c3', nameEn: 'Drinks', nameAr: 'المشروبات' },
  { id: 'c4', nameEn: 'Desserts', nameAr: 'الحلويات' },
  { id: 'c5', nameEn: 'Salads', nameAr: 'السلطات' },
];

export const mockMenuItems: MenuItem[] = [
  {
    id: 'm1',
    categoryId: 'c1',
    nameEn: 'Classic Beef',
    nameAr: 'برجر لحم كلاسيك',
    price: 35,
    image: '🍔',
    isAvailable: true,
    calories: 650,
    variants: [
      { id: 'v1', nameEn: 'Regular', nameAr: 'عادي', priceAdjustment: 0, isDefault: true },
      { id: 'v2', nameEn: 'Large', nameAr: 'كبير', priceAdjustment: 10, isDefault: false },
    ],
    customizationGroups: [
      {
        id: 'cg1',
        nameEn: 'Extra Toppings',
        nameAr: 'إضافات',
        selectionType: 'multiple',
        minSelections: 0,
        maxSelections: 5,
        isRequired: false,
        options: [
          { id: 'opt1', nameEn: 'Extra Cheese', nameAr: 'جبنة إضافية', priceAdjustment: 5, isDefault: false },
          { id: 'opt2', nameEn: 'Bacon', nameAr: 'بيكون', priceAdjustment: 8, isDefault: false },
          { id: 'opt3', nameEn: 'Jalapeno', nameAr: 'هالبينو', priceAdjustment: 3, isDefault: false },
        ],
      },
      {
        id: 'cg2',
        nameEn: 'Remove Ingredients',
        nameAr: 'إزالة مكونات',
        selectionType: 'multiple',
        minSelections: 0,
        maxSelections: 3,
        isRequired: false,
        options: [
          { id: 'opt4', nameEn: 'No Onion', nameAr: 'بدون بصل', priceAdjustment: 0, isDefault: false },
          { id: 'opt5', nameEn: 'No Tomato', nameAr: 'بدون طماطم', priceAdjustment: 0, isDefault: false },
        ],
      },
    ],
  },
  {
    id: 'm2',
    categoryId: 'c1',
    nameEn: 'Chicken Crispy',
    nameAr: 'كرسبي دجاج',
    price: 32,
    image: '🍗',
    isAvailable: true,
    calories: 580,
    customizationGroups: [
      {
        id: 'cg3',
        nameEn: 'Spice Level',
        nameAr: 'مستوى الحرارة',
        selectionType: 'single',
        minSelections: 1,
        maxSelections: 1,
        isRequired: true,
        options: [
          { id: 'opt6', nameEn: 'Regular', nameAr: 'عادي', priceAdjustment: 0, isDefault: true },
          { id: 'opt7', nameEn: 'Spicy', nameAr: 'حار', priceAdjustment: 0, isDefault: false },
          { id: 'opt8', nameEn: 'Extra Spicy', nameAr: 'حار جداً', priceAdjustment: 2, isDefault: false },
        ],
      },
    ],
  },
  { id: 'm3', categoryId: 'c1', nameEn: 'Double Smash', nameAr: 'دبل سماش', price: 42, image: '🍔', isAvailable: true, calories: 850 },
  { id: 'm4', categoryId: 'c2', nameEn: 'French Fries', nameAr: 'بطاطس مقلية', price: 12, image: '🍟', isAvailable: true, calories: 320 },
  { id: 'm5', categoryId: 'c2', nameEn: 'Onion Rings', nameAr: 'حلقات بصل', price: 15, image: '🧅', isAvailable: true, calories: 280 },
  { id: 'm6', categoryId: 'c3', nameEn: 'Cola', nameAr: 'كولا', price: 8, image: '🥤', isAvailable: true, calories: 140 },
  { id: 'm7', categoryId: 'c3', nameEn: 'Fresh Orange', nameAr: 'عصير برتقال', price: 14, image: '🍊', isAvailable: false, calories: 110 },
  { id: 'm8', categoryId: 'c4', nameEn: 'Chocolate Cake', nameAr: 'كيكة شوكولاتة', price: 22, image: '🍰', isAvailable: true, calories: 450 },
  { id: 'm9', categoryId: 'c5', nameEn: 'Caesar Salad', nameAr: 'سلطة سيزر', price: 18, image: '🥗', isAvailable: true, calories: 220 },
];

export const mockTables: Table[] = [
  { id: 't1', name: 'طاولة 1', capacity: 4, section: 'الصالة الرئيسية', status: 'available' },
  { id: 't2', name: 'طاولة 2', capacity: 6, section: 'الصالة الرئيسية', status: 'occupied', guests: 4, currentOrderValue: 180, timeSeated: 35 },
  { id: 't3', name: 'طاولة 3', capacity: 2, section: 'الشرفة', status: 'reserved', reservationTime: '19:00' },
  { id: 't4', name: 'طاولة 4', capacity: 8, section: 'الصالة VIP', status: 'occupied', guests: 6, currentOrderValue: 450, timeSeated: 60, isVIP: true },
  { id: 't5', name: 'طاولة 5', capacity: 4, section: 'الشرفة', status: 'needs_cleaning' },
  { id: 't6', name: 'طاولة 6', capacity: 4, section: 'الصالة الرئيسية', status: 'available' },
  { id: 't7', name: 'طاولة 7', capacity: 2, section: 'الصالة الرئيسية', status: 'available' },
  { id: 't8', name: 'طاولة 8', capacity: 6, section: 'الصالة VIP', status: 'reserved', reservationTime: '20:30', isVIP: true },
];

export const mockOrders: Order[] = [
  {
    id: 'o1',
    orderNumber: 'ORD-0001',
    orderType: 'dine_in',
    status: 'pending',
    tableId: 'طاولة 5',
    total: 97,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    items: [
      { id: 'oi1', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 2, unitPrice: 35, totalPrice: 70 },
      { id: 'oi2', menuItemId: 'm4', itemName: 'بطاطس مقلية', quantity: 1, unitPrice: 12, totalPrice: 12 },
    ],
  },
  {
    id: 'o2',
    orderNumber: 'ORD-0002',
    orderType: 'takeaway',
    status: 'preparing',
    customerName: 'محمد',
    total: 64,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    items: [
      { id: 'oi3', menuItemId: 'm2', itemName: 'كرسبي دجاج', quantity: 2, unitPrice: 32, totalPrice: 64 },
    ],
  },
  {
    id: 'o3',
    orderNumber: 'ORD-0003',
    orderType: 'dine_in',
    status: 'ready',
    tableId: 'طاولة 2',
    total: 43,
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    items: [
      { id: 'oi4', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 1, unitPrice: 35, totalPrice: 35 },
      { id: 'oi5', menuItemId: 'm6', itemName: 'كولا', quantity: 1, unitPrice: 8, totalPrice: 8 },
    ],
  },
  {
    id: 'o4',
    orderNumber: 'ORD-0004',
    orderType: 'takeaway',
    status: 'completed',
    customerName: 'فاطمة',
    total: 120,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    items: [
      { id: 'oi6', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 2, unitPrice: 35, totalPrice: 70 },
      { id: 'oi7', menuItemId: 'm4', itemName: 'بطاطس مقلية', quantity: 2, unitPrice: 12, totalPrice: 24 },
      { id: 'oi8', menuItemId: 'm6', itemName: 'كولا', quantity: 2, unitPrice: 8, totalPrice: 16 },
    ],
  },
  {
    id: 'o5',
    orderNumber: 'ORD-0005',
    orderType: 'dine_in',
    status: 'completed',
    tableId: 'طاولة 1',
    total: 85,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    items: [
      { id: 'oi9', menuItemId: 'm3', itemName: 'دبل سماش', quantity: 1, unitPrice: 42, totalPrice: 42 },
      { id: 'oi10', menuItemId: 'm9', itemName: 'سلطة سيزر', quantity: 1, unitPrice: 18, totalPrice: 18 },
      { id: 'oi11', menuItemId: 'm8', itemName: 'كيكة شوكولاتة', quantity: 1, unitPrice: 22, totalPrice: 22 },
    ],
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    invoiceNumber: 'INV-202603070001',
    orderId: 'o1',
    invoiceType: 'simplified',
    status: 'issued',
    subtotal: 85.0,
    taxAmount: 12.75,
    taxRate: 15.0,
    total: 97.75,
    customerName: 'أحمد',
    paymentMethod: 'cash',
    isPaid: true,
    qrCodeData: 'base64...',
    cashierName: 'محمد',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'inv2',
    invoiceNumber: 'INV-202603070002',
    orderId: 'o2',
    invoiceType: 'simplified',
    status: 'issued',
    subtotal: 120.0,
    taxAmount: 18.0,
    taxRate: 15.0,
    total: 138.0,
    customerName: 'عميل سفري',
    paymentMethod: 'card',
    isPaid: true,
    qrCodeData: 'base64...',
    cashierName: 'محمد',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

export const mockReservations: Reservation[] = [
  {
    id: 'r1',
    reservationNumber: 'RES-001',
    customerName: 'محمد أحمد',
    customerPhone: '0512345678',
    guestCount: 4,
    reservationDate: new Date().toISOString(),
    reservationTime: '19:00',
    duration: 90,
    status: 'confirmed',
    tableId: 'طاولة 3',
    specialRequests: 'طاولة بجانب النافذة',
    depositAmount: 50.0,
    depositPaid: true,
  },
  {
    id: 'r2',
    reservationNumber: 'RES-002',
    customerName: 'سارة خالد',
    customerPhone: '0555555555',
    guestCount: 2,
    reservationDate: new Date().toISOString(),
    reservationTime: '20:30',
    duration: 60,
    status: 'pending',
    depositAmount: 0,
    depositPaid: false,
  },
  {
    id: 'r3',
    reservationNumber: 'RES-003',
    customerName: 'خالد عبدالله',
    customerPhone: '0566666666',
    guestCount: 6,
    reservationDate: new Date().toISOString(),
    reservationTime: '21:00',
    duration: 120,
    status: 'seated',
    tableId: 'طاولة 4',
    depositAmount: 100,
    depositPaid: true,
  },
];

export const mockQueue: QueueEntry[] = [
  {
    id: 'q1',
    queueNumber: 15,
    customerName: 'سارة',
    customerPhone: '0512345678',
    partySize: 3,
    status: 'waiting',
    estimatedWaitMinutes: 20,
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'q2',
    queueNumber: 16,
    customerName: 'عبدالله',
    customerPhone: '0533333333',
    partySize: 5,
    status: 'notified',
    estimatedWaitMinutes: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'q3',
    queueNumber: 17,
    customerName: 'فهد',
    customerPhone: '0544444444',
    partySize: 2,
    status: 'waiting',
    estimatedWaitMinutes: 35,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

export const mockInventory: InventoryItem[] = [
  { id: 'inv_1', name: 'لحم بقري', nameAr: 'لحم بقري', unit: 'kg', currentStock: 15.5, minStock: 20.0, costPerUnit: 45.0, category: 'meat', isActive: true },
  { id: 'inv_2', name: 'خبز برجر', nameAr: 'خبز برجر', unit: 'piece', currentStock: 150, minStock: 50, costPerUnit: 1.5, category: 'grains', isActive: true },
  { id: 'inv_3', name: 'جبنة شيدر', nameAr: 'جبنة شيدر', unit: 'kg', currentStock: 8, minStock: 5, costPerUnit: 35.0, category: 'dairy', isActive: true },
  { id: 'inv_4', name: 'طماطم', nameAr: 'طماطم', unit: 'kg', currentStock: 3, minStock: 10, costPerUnit: 5.0, category: 'vegetables', isActive: true },
  { id: 'inv_5', name: 'بصل', nameAr: 'بصل', unit: 'kg', currentStock: 12, minStock: 8, costPerUnit: 3.0, category: 'vegetables', isActive: true },
  { id: 'inv_6', name: 'زيت قلي', nameAr: 'زيت قلي', unit: 'liter', currentStock: 5, minStock: 10, costPerUnit: 8.0, category: 'other', isActive: true },
  { id: 'inv_7', name: 'كولا', nameAr: 'كولا', unit: 'piece', currentStock: 200, minStock: 100, costPerUnit: 2.0, category: 'beverages', isActive: true },
  { id: 'inv_8', name: 'بطاطس مجمدة', nameAr: 'بطاطس مجمدة', unit: 'kg', currentStock: 25, minStock: 15, costPerUnit: 12.0, category: 'vegetables', isActive: true },
];

export const mockInventoryTransactions: InventoryTransaction[] = [
  { id: 'it1', inventoryItemId: 'inv_1', type: 'purchase', quantity: 30, unitCost: 45, notes: 'مورد اللحوم - شحنة أسبوعية', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: 'it2', inventoryItemId: 'inv_1', type: 'usage', quantity: -14.5, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
  { id: 'it3', inventoryItemId: 'inv_4', type: 'waste', quantity: -2, notes: 'تالفة', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
  { id: 'it4', inventoryItemId: 'inv_6', type: 'purchase', quantity: 20, unitCost: 8, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
];

export const mockCustomers: Customer[] = [
  { id: 'cust1', name: 'محمد أحمد', phone: '0512345678', email: 'mohammed@email.com', totalOrders: 15, totalSpent: 1250, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  { id: 'cust2', name: 'سارة خالد', phone: '0555555555', totalOrders: 8, totalSpent: 680, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString() },
  { id: 'cust3', name: 'خالد عبدالله', phone: '0566666666', address: 'شارع الملك فهد، الرياض', totalOrders: 22, totalSpent: 2100, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString() },
  { id: 'cust4', name: 'فاطمة علي', phone: '0577777777', email: 'fatima@email.com', notes: 'حساسية من المكسرات', totalOrders: 5, totalSpent: 420, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString() },
  { id: 'cust5', name: 'عبدالرحمن', phone: '0588888888', totalOrders: 3, totalSpent: 195, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() },
];

export const mockPromotions: Promotion[] = [
  { id: 'promo1', nameEn: 'Weekend Special', nameAr: 'عرض نهاية الأسبوع', descriptionAr: 'خصم 20% على جميع البرجر', discountType: 'percentage', discountValue: 20, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), isActive: true },
  { id: 'promo2', nameEn: 'Happy Hour', nameAr: 'الساعة السعيدة', descriptionAr: 'خصم 10 ريال على الطلبات فوق 50 ريال', discountType: 'fixed', discountValue: 10, minOrderAmount: 50, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), isActive: true },
  { id: 'promo3', nameEn: 'Lunch Deal', nameAr: 'عرض الغداء', descriptionAr: 'خصم 15% على وجبات الغداء', discountType: 'percentage', discountValue: 15, maxDiscountAmount: 25, startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), endDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), isActive: false },
];

export const mockCoupons: Coupon[] = [
  { id: 'coup1', code: 'WELCOME10', discountType: 'percentage', discountValue: 10, usageLimit: 100, usageCount: 45, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), isActive: true },
  { id: 'coup2', code: 'SAVE20', discountType: 'fixed', discountValue: 20, minOrderAmount: 80, usageLimit: 50, usageCount: 12, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), isActive: true },
  { id: 'coup3', code: 'VIP50', discountType: 'percentage', discountValue: 50, maxDiscountAmount: 100, usageLimit: 10, usageCount: 10, validFrom: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), validUntil: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), isActive: false },
];

export const mockDaySession: DaySession = {
  id: 'ds1',
  status: 'open',
  openedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  openingBalance: 500,
  totalSales: 2450,
  totalOrders: 32,
  cashSales: 1200,
  cardSales: 950,
  onlineSales: 300,
  cashierName: 'محمد',
};

export const mockCashTransactions: CashTransaction[] = [
  { id: 'ct1', sessionId: 'ds1', type: 'deposit', amount: 200, reason: 'إيداع صباحي إضافي', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
  { id: 'ct2', sessionId: 'ds1', type: 'withdrawal', amount: 100, reason: 'شراء مستلزمات', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: 'ct3', sessionId: 'ds1', type: 'deposit', amount: 50, reason: 'فكة إضافية', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString() },
];

export const mockSessionHistory: DaySession[] = [
  { id: 'ds0', status: 'closed', openedAt: new Date(Date.now() - 1000 * 60 * 60 * 32).toISOString(), closedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), openingBalance: 500, closingBalance: 1850, totalSales: 3200, totalOrders: 45, cashSales: 1600, cardSales: 1200, onlineSales: 400, cashierName: 'أحمد', notes: 'يوم ممتاز' },
  { id: 'ds_prev', status: 'closed', openedAt: new Date(Date.now() - 1000 * 60 * 60 * 56).toISOString(), closedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), openingBalance: 500, closingBalance: 1420, totalSales: 2800, totalOrders: 38, cashSales: 1400, cardSales: 1000, onlineSales: 400, cashierName: 'محمد' },
];

export const mockDeliveryOrders: DeliveryOrder[] = [
  {
    id: 'del1', platform: 'hungerstation', platformOrderId: 'HS-78542', customerName: 'عبدالله محمد', customerPhone: '0501234567', customerAddress: 'شارع التحلية، حي العليا، الرياض', status: 'new', total: 89, platformFee: 8.9,
    items: [
      { id: 'doi1', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 2, unitPrice: 35, totalPrice: 70 },
      { id: 'doi2', menuItemId: 'm4', itemName: 'بطاطس مقلية', quantity: 1, unitPrice: 12, totalPrice: 12 },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: 'del2', platform: 'jahez', platformOrderId: 'JH-41256', customerName: 'نورة أحمد', customerPhone: '0559876543', customerAddress: 'حي الورود، جدة', status: 'preparing', total: 64, platformFee: 6.4,
    items: [
      { id: 'doi3', menuItemId: 'm2', itemName: 'كرسبي دجاج', quantity: 2, unitPrice: 32, totalPrice: 64 },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'del3', platform: 'keeta', platformOrderId: 'KT-99013', customerName: 'سلطان', customerPhone: '0533456789', customerAddress: 'حي النزهة، الدمام', status: 'ready', total: 120, platformFee: 12,
    items: [
      { id: 'doi4', menuItemId: 'm3', itemName: 'دبل سماش', quantity: 2, unitPrice: 42, totalPrice: 84 },
      { id: 'doi5', menuItemId: 'm6', itemName: 'كولا', quantity: 2, unitPrice: 8, totalPrice: 16 },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'del4', platform: 'ninja', platformOrderId: 'NJ-55021', customerName: 'ريم', customerPhone: '0544567890', customerAddress: 'حي الملقا، الرياض', status: 'delivered', total: 55, platformFee: 5.5,
    items: [
      { id: 'doi6', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 1, unitPrice: 35, totalPrice: 35 },
      { id: 'doi7', menuItemId: 'm5', itemName: 'حلقات بصل', quantity: 1, unitPrice: 15, totalPrice: 15 },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'del5', platform: 'hungerstation', platformOrderId: 'HS-78600', customerName: 'فيصل', customerPhone: '0511112222', customerAddress: 'حي السلامة، جدة', status: 'accepted', total: 96, platformFee: 9.6,
    items: [
      { id: 'doi8', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 1, unitPrice: 35, totalPrice: 35 },
      { id: 'doi9', menuItemId: 'm2', itemName: 'كرسبي دجاج', quantity: 1, unitPrice: 32, totalPrice: 32 },
      { id: 'doi10', menuItemId: 'm4', itemName: 'بطاطس مقلية', quantity: 1, unitPrice: 12, totalPrice: 12 },
      { id: 'doi11', menuItemId: 'm6', itemName: 'كولا', quantity: 2, unitPrice: 8, totalPrice: 16 },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
];

export const mockSettings: RestaurantSettings = {
  nameEn: 'TryingPOS Restaurant',
  nameAr: 'مطعم ترايينق',
  address: 'شارع الملك فهد، الرياض',
  phone: '0112345678',
  email: 'info@tryingpos.com',
  taxEnabled: true,
  vatNumber: '300012345600003',
  taxRate: 15,
  serviceKitchenScreen: true,
  serviceQuickOrder: false,
  serviceDineIn: true,
  servicePickup: true,
  serviceDelivery: true,
  serviceTableBooking: true,
  serviceQueue: true,
};

export const mockLoyaltyProfiles: LoyaltyProfile[] = [
  {
    customerId: 'cust3', customerName: 'خالد عبدالله', phone: '0566666666', tier: 'vip',
    totalPoints: 4200, availablePoints: 1850, totalSpent: 2100, totalVisits: 22,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    pointsHistory: [
      { id: 'pt1', type: 'earned', points: 120, description: 'طلب #ORD-0005', orderId: 'o5', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
      { id: 'pt2', type: 'redeemed', points: -500, description: 'استبدال: خصم 50 ريال', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
      { id: 'pt3', type: 'earned', points: 85, description: 'طلب #ORD-0003', orderId: 'o3', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
      { id: 'pt4', type: 'bonus', points: 200, description: 'مكافأة ترقية VIP', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
    ],
  },
  {
    customerId: 'cust1', customerName: 'محمد أحمد', phone: '0512345678', tier: 'gold',
    totalPoints: 2500, availablePoints: 1200, totalSpent: 1250, totalVisits: 15,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    pointsHistory: [
      { id: 'pt5', type: 'earned', points: 97, description: 'طلب #ORD-0001', orderId: 'o1', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
      { id: 'pt6', type: 'earned', points: 64, description: 'طلب #ORD-0002', orderId: 'o2', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    ],
  },
  {
    customerId: 'cust2', customerName: 'سارة خالد', phone: '0555555555', tier: 'silver',
    totalPoints: 1360, availablePoints: 960, totalSpent: 680, totalVisits: 8,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    pointsHistory: [
      { id: 'pt7', type: 'earned', points: 43, description: 'طلب #ORD-0003', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
      { id: 'pt8', type: 'redeemed', points: -200, description: 'استبدال: مشروب مجاني', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
    ],
  },
  {
    customerId: 'cust4', customerName: 'فاطمة علي', phone: '0577777777', tier: 'bronze',
    totalPoints: 420, availablePoints: 420, totalSpent: 420, totalVisits: 5,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    pointsHistory: [
      { id: 'pt9', type: 'earned', points: 120, description: 'طلب #ORD-0004', orderId: 'o4', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    ],
  },
];

export const mockLoyaltyRewards: LoyaltyReward[] = [
  { id: 'rw1', nameAr: 'خصم 10 ريال', nameEn: '10 SAR Off', descriptionAr: 'خصم 10 ريال على طلبك القادم', descriptionEn: '10 SAR discount on your next order', pointsCost: 200, discountType: 'fixed', discountValue: 10, isActive: true },
  { id: 'rw2', nameAr: 'خصم 15%', nameEn: '15% Off', descriptionAr: 'خصم 15% على الطلب', descriptionEn: '15% discount on order', pointsCost: 500, discountType: 'percentage', discountValue: 15, isActive: true },
  { id: 'rw3', nameAr: 'مشروب مجاني', nameEn: 'Free Drink', descriptionAr: 'احصل على مشروب مجاني', descriptionEn: 'Get a free drink', pointsCost: 150, discountType: 'free_item', discountValue: 0, isActive: true },
  { id: 'rw4', nameAr: 'خصم 50 ريال', nameEn: '50 SAR Off', descriptionAr: 'خصم 50 ريال على طلبات فوق 200 ريال', descriptionEn: '50 SAR off on orders above 200 SAR', pointsCost: 1000, discountType: 'fixed', discountValue: 50, isActive: true },
  { id: 'rw5', nameAr: 'حلويات مجانية', nameEn: 'Free Dessert', descriptionAr: 'احصل على حلوى مجانية', descriptionEn: 'Get a free dessert', pointsCost: 300, discountType: 'free_item', discountValue: 0, isActive: false },
];

export const mockAuditLog: AuditLogEntry[] = [
  { id: 'al1', action: 'payment', entity: 'order', entityId: 'o1', userId: 'u2', userName: 'سارة خالد', details: 'Payment received for order ORD-0001 - 97.75 SAR (Cash)', detailsAr: 'تم استلام دفعة للطلب ORD-0001 - 97.75 ر.س (نقدي)', severity: 'info', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: 'al2', action: 'create', entity: 'order', entityId: 'o2', userId: 'u2', userName: 'سارة خالد', details: 'New order ORD-0002 created - Takeaway', detailsAr: 'تم إنشاء طلب جديد ORD-0002 - سفري', severity: 'info', createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
  { id: 'al3', action: 'discount', entity: 'order', entityId: 'o3', userId: 'u1', userName: 'محمد أحمد', details: 'Applied 10% discount on order ORD-0003', detailsAr: 'تم تطبيق خصم 10% على الطلب ORD-0003', severity: 'warning', createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
  { id: 'al4', action: 'delete', entity: 'order_item', entityId: 'oi5', userId: 'u1', userName: 'محمد أحمد', details: 'Deleted item "Cola" from order ORD-0003', detailsAr: 'تم حذف صنف "كولا" من الطلب ORD-0003', severity: 'critical', createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
  { id: 'al5', action: 'refund', entity: 'invoice', entityId: 'inv1', userId: 'u1', userName: 'محمد أحمد', details: 'Refund issued for invoice INV-202603070001 - 97.75 SAR', detailsAr: 'تم إصدار استرداد للفاتورة INV-202603070001 - 97.75 ر.س', severity: 'critical', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
  { id: 'al6', action: 'update', entity: 'menu_item', entityId: 'm1', userId: 'u1', userName: 'محمد أحمد', details: 'Updated price of "Classic Beef" from 32 to 35 SAR', detailsAr: 'تم تحديث سعر "برجر لحم كلاسيك" من 32 إلى 35 ر.س', severity: 'warning', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: 'al7', action: 'void', entity: 'order', entityId: 'o_void', userId: 'u2', userName: 'سارة خالد', details: 'Voided order ORD-0099 - Reason: Customer cancelled', detailsAr: 'تم إلغاء الطلب ORD-0099 - السبب: إلغاء العميل', severity: 'critical', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: 'al8', action: 'login', entity: 'user', entityId: 'u1', userId: 'u1', userName: 'محمد أحمد', details: 'User logged in', detailsAr: 'تسجيل دخول المستخدم', severity: 'info', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
  { id: 'al9', action: 'create', entity: 'customer', entityId: 'cust5', userId: 'u2', userName: 'سارة خالد', details: 'New customer added: عبدالرحمن', detailsAr: 'تم إضافة عميل جديد: عبدالرحمن', severity: 'info', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: 'al10', action: 'update', entity: 'inventory', entityId: 'inv_1', userId: 'u3', userName: 'أحمد علي', details: 'Stock adjustment: Beef -2kg (Waste)', detailsAr: 'تعديل مخزون: لحم بقري -2 كجم (هدر)', severity: 'warning', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
];

export const mockRatings: Rating[] = [
  { id: 'rat1', invoiceId: 'inv1', orderId: 'o1', customerName: 'أحمد', stars: 5, comment: 'ممتاز! الطعام لذيذ جداً والخدمة سريعة', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: 'rat2', invoiceId: 'inv2', orderId: 'o2', customerName: 'عميل سفري', stars: 4, comment: 'جيد بشكل عام', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: 'rat3', invoiceId: 'inv_prev1', orderId: 'o_prev1', customerName: 'محمد', stars: 5, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: 'rat4', invoiceId: 'inv_prev2', orderId: 'o_prev2', customerName: 'سارة', stars: 3, comment: 'الانتظار كان طويل', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() },
  { id: 'rat5', invoiceId: 'inv_prev3', orderId: 'o_prev3', customerName: 'خالد', stars: 5, comment: 'أفضل برجر في المنطقة', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
  { id: 'rat6', invoiceId: 'inv_prev4', orderId: 'o_prev4', customerName: 'فاطمة', stars: 4, comment: 'لذيذ لكن الأسعار مرتفعة شوي', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString() },
  { id: 'rat7', invoiceId: 'inv_prev5', orderId: 'o_prev5', customerName: 'عبدالله', stars: 2, comment: 'الطلب وصل بارد', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() },
  { id: 'rat8', invoiceId: 'inv_prev6', orderId: 'o_prev6', customerName: 'نورة', stars: 5, comment: 'رائع!', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString() },
];

export const mockMultiPrices: MultiPrice[] = [
  { menuItemId: 'm1', dineIn: 35, takeaway: 33, delivery: 38, platform: 40 },
  { menuItemId: 'm2', dineIn: 32, takeaway: 30, delivery: 35, platform: 37 },
  { menuItemId: 'm3', dineIn: 42, takeaway: 40, delivery: 45, platform: 48 },
  { menuItemId: 'm4', dineIn: 12, takeaway: 12, delivery: 14, platform: 15 },
  { menuItemId: 'm5', dineIn: 15, takeaway: 15, delivery: 17, platform: 18 },
  { menuItemId: 'm6', dineIn: 8, takeaway: 8, delivery: 10, platform: 11 },
  { menuItemId: 'm7', dineIn: 14, takeaway: 14, delivery: 16, platform: 17 },
  { menuItemId: 'm8', dineIn: 22, takeaway: 22, delivery: 25, platform: 27 },
  { menuItemId: 'm9', dineIn: 18, takeaway: 18, delivery: 20, platform: 22 },
];

export const mockHeldOrders: HeldOrder[] = [
  {
    id: 'held1', holdNumber: 'H-001',
    items: [
      { id: 'm1', categoryId: 'c1', nameEn: 'Classic Beef', nameAr: 'برجر لحم كلاسيك', price: 35, image: '🍔', isAvailable: true, cartId: 'hci1', menuItemId: 'm1', itemName: 'برجر لحم كلاسيك', quantity: 2, unitPrice: 35, finalUnitPrice: 35, totalPrice: 70, selectedCustomizations: [] },
      { id: 'm4', categoryId: 'c2', nameEn: 'Fries', nameAr: 'بطاطس مقلية', price: 12, image: '🍟', isAvailable: true, cartId: 'hci2', menuItemId: 'm4', itemName: 'بطاطس مقلية', quantity: 1, unitPrice: 12, finalUnitPrice: 12, totalPrice: 12, selectedCustomizations: [] },
    ],
    customerName: 'طاولة 3 - عميل',
    orderType: 'dine_in',
    subtotal: 82,
    heldAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    heldBy: 'محمد',
    notes: 'العميل يتصفح القائمة',
  },
  {
    id: 'held2', holdNumber: 'H-002',
    items: [
      { id: 'm2', categoryId: 'c1', nameEn: 'Chicken Crispy', nameAr: 'كرسبي دجاج', price: 32, image: '🍗', isAvailable: true, cartId: 'hci3', menuItemId: 'm2', itemName: 'كرسبي دجاج', quantity: 1, unitPrice: 32, finalUnitPrice: 32, totalPrice: 32, selectedCustomizations: [] },
      { id: 'm6', categoryId: 'c3', nameEn: 'Cola', nameAr: 'كولا', price: 8, image: '🥤', isAvailable: true, cartId: 'hci4', menuItemId: 'm6', itemName: 'كولا', quantity: 2, unitPrice: 8, finalUnitPrice: 8, totalPrice: 16, selectedCustomizations: [] },
      { id: 'm5', categoryId: 'c2', nameEn: 'Onion Rings', nameAr: 'حلقات بصل', price: 15, image: '🧅', isAvailable: true, cartId: 'hci5', menuItemId: 'm5', itemName: 'حلقات بصل', quantity: 1, unitPrice: 15, finalUnitPrice: 15, totalPrice: 15, selectedCustomizations: [] },
    ],
    orderType: 'takeaway',
    customerName: 'فهد - سفري',
    subtotal: 63,
    heldAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    heldBy: 'سارة',
  },
];
