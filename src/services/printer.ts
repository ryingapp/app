import { Platform } from 'react-native';
import * as Print from 'expo-print';
import { Invoice, KitchenPrinterStation, OrderItem, PrinterProfile, PrinterSettings, PrinterTarget } from '../constants/types';
import { OfflineStorage } from './storage';

type ThermalPrinterModuleLike = {
  defaultConfig?: Record<string, any>;
  printBluetooth?: (config: Record<string, any>) => Promise<void>;
  printTcp?: (config: Record<string, any>) => Promise<void>;
};

interface PrintableItem {
  name: string;
  nameAr?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  notes?: string;
  details?: string[];
}

interface PrintableReceipt {
  title: string;
  badge?: string;
  restaurantName: string;
  restaurantVat?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  commercialRegistration?: string;
  restaurantEnName?: string;
  logo?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  cashierName?: string;
  notes?: string;
  items: PrintableItem[];
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  taxAmount?: number;
  taxRate?: number;
  total: number;
  qrCodeData?: string;
  footer?: string;
  orderType?: string;
  uuid?: string;
  invoiceCounter?: number;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  autoPrintCashier: true,
  autoPrintKitchen: true,
  cashier: {
    enabled: true,
    mode: 'system',
    label: 'Cashier',
    printerWidthMM: 80,
    printerNbrCharactersPerLine: 42,
    port: 9100,
    autoCut: true,
    openCashbox: false,
  },
  kitchen: {
    enabled: true,
    mode: Platform.OS === 'android' ? 'bluetooth' : 'system',
    label: 'Kitchen',
    printerWidthMM: 80,
    printerNbrCharactersPerLine: 42,
    port: 9100,
    autoCut: true,
    openCashbox: false,
  },
  kitchenStations: [
    {
      id: 'kitchen-default',
      name: 'Kitchen Default',
      assignedCategoryIds: [],
      assignedCategoryNames: [],
      isFallback: true,
      profile: {
        enabled: true,
        mode: Platform.OS === 'android' ? 'bluetooth' : 'system',
        label: 'Kitchen Default',
        printerWidthMM: 80,
        printerNbrCharactersPerLine: 42,
        port: 9100,
        autoCut: true,
        openCashbox: false,
      },
    },
  ],
};

export interface KitchenPrintableOrderItem extends Pick<OrderItem, 'itemName' | 'quantity' | 'notes'> {
  nameAr?: string;
  nameEn?: string;
  selectedCustomizations?: Array<{ nameAr?: string; nameEn?: string }>;
  variantName?: string;
  categoryId?: string;
  categoryName?: string;
}

function getThermalPrinterModule(): ThermalPrinterModuleLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-thermal-printer');
    const resolved = mod?.default ?? mod;
    if (!resolved) return null;
    return resolved as ThermalPrinterModuleLike;
  } catch {
    return null;
  }
}

function num(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value: string): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value?: string): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return value;
  }
}

function formatMoney(value?: number): string {
  return `${num(value).toFixed(2)} SAR`;
}

// Exact copy of web receipt CSS
const receiptCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Segoe UI', Tahoma, monospace;
    padding: 0;
    background: #fff;
    color: #000;
    font-size: 12px;
    line-height: 1.4;
  }
  .receipt {
    max-width: 80mm;
    margin: 0 auto;
    padding: 8px 4px;
    direction: rtl;
  }
  .receipt-center { text-align: center; }
  .receipt-logo { max-width: 80px; max-height: 80px; margin: 0 auto 6px; display: block; object-fit: contain; }
  .receipt-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
  .receipt-info { font-size: 11px; color: #333; margin-bottom: 1px; }
  .receipt-divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .receipt-thick-divider { border: none; border-top: 2px solid #000; margin: 8px 0; }
  .receipt-title { font-size: 14px; font-weight: bold; text-align: center; margin: 4px 0; }
  .receipt-order-box {
    border: 2px solid #000;
    text-align: center;
    padding: 6px;
    margin: 8px 0;
    font-size: 22px;
    font-weight: bold;
  }
  .receipt-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; }
  .receipt-label { flex-shrink: 0; }
  .receipt-value { flex-shrink: 0; text-align: end; }
  .receipt-item { margin-bottom: 6px; }
  .receipt-item-row { display: flex; justify-content: space-between; font-size: 12px; }
  .receipt-item-name { font-weight: bold; flex: 1; text-align: right; }
  .receipt-item-price { flex-shrink: 0; font-weight: bold; }
  .receipt-item-detail { font-size: 10px; color: #555; margin-top: 1px; text-align: right; }
  .receipt-grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding: 4px 0; }
  .receipt-payment-box { border: 1px solid #000; padding: 4px 8px; margin: 6px 0; text-align: center; }
  .receipt-qr { text-align: center; margin-top: 8px; }
  .receipt-footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
  .receipt-badge { display: inline-block; padding: 2px 8px; border: 1px solid #000; font-size: 11px; font-weight: bold; margin: 4px 0; }
`;

function getOrderTypeLabel(orderType?: string): { ar: string; en: string } {
  if (orderType === 'delivery') return { ar: 'توصيل', en: 'Delivery' };
  if (orderType === 'dine_in') return { ar: 'داخل المطعم', en: 'Dine In' };
  if (orderType === 'pickup') return { ar: 'استلام', en: 'Pickup' };
  return { ar: '', en: '' };
}

function buildReceiptHtml(doc: PrintableReceipt, target: PrinterTarget): string {
  const isKitchen = target === 'kitchen';
  const itemCount = doc.items.reduce((s, i) => s + i.quantity, 0);
  const taxRate = doc.taxRate ?? 15;

  // Items rows (3-column style matching web)
  const itemsHtml = doc.items.map((item) => {
    const detailLines = [
      ...(item.details || []),
      ...(item.notes ? [item.notes] : []),
    ].filter(Boolean)
     .map((d) => `<div style="font-size:9px;color:#555;padding-inline-start:34px;margin-top:1px">${escapeHtml(String(d))}</div>`)
     .join('');

    return `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="width:28px;flex-shrink:0">${item.quantity}</span>
          <span style="flex:1;font-weight:bold;padding-inline:4px">${escapeHtml(item.name)}</span>
          <span style="width:65px;text-align:end;font-weight:bold;flex-shrink:0" dir="ltr">${num(item.totalPrice).toFixed(2)} ر.س</span>
        </div>
        ${item.nameAr && item.nameAr !== item.name ? `<div style="font-size:10px;color:#333;padding-inline-start:34px;margin-top:1px">${escapeHtml(item.nameAr)}</div>` : ''}
        ${detailLines}
      </div>`;
  }).join('');

  const orderTypeLabel = getOrderTypeLabel(doc.orderType);

  // QR code via Google Charts (works in WebView when online)
  const qrHtml = doc.qrCodeData && !isKitchen ? `
    <div style="text-align:center;margin:8px 0">
      <img
        src="https://chart.googleapis.com/chart?chs=130x130&cht=qr&chl=${encodeURIComponent(doc.qrCodeData)}&choe=UTF-8"
        width="130" height="130"
        style="margin:0 auto;display:block"
        alt="QR Code"
        onerror="this.style.display='none'"
      />
    </div>` : '';

  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>${receiptCSS}</style>
  </head>
  <body>
  <div class="receipt" dir="rtl">

    <!-- HEADER -->
    <div style="text-align:center;margin-bottom:8px">
      ${doc.logo ? `<img src="${escapeHtml(doc.logo)}" class="receipt-logo" />` : ''}
      ${doc.restaurantName ? `<div style="font-size:16px;font-weight:bold;margin-bottom:1px">${escapeHtml(doc.restaurantName)}</div>` : ''}
      ${doc.restaurantEnName ? `<div style="font-size:13px;font-weight:bold;margin-bottom:4px;color:#333">${escapeHtml(doc.restaurantEnName)}</div>` : ''}
      ${doc.restaurantAddress ? `<div style="font-size:10px;color:#333">${escapeHtml(doc.restaurantAddress)}</div>` : ''}
      ${doc.restaurantVat ? `<div style="font-size:10px;color:#333;margin-top:2px">الرقم الضريبي / VAT: ${escapeHtml(doc.restaurantVat)}</div>` : ''}
      ${doc.commercialRegistration ? `<div style="font-size:10px;color:#333;margin-top:1px">س.ت / CR: ${escapeHtml(doc.commercialRegistration)}</div>` : ''}
      ${doc.restaurantPhone ? `<div style="font-size:10px;color:#333;margin-top:1px">خدمة العملاء / Customer Service: ${escapeHtml(doc.restaurantPhone)}</div>` : ''}
    </div>

    <hr class="receipt-divider" />

    <!-- TITLE -->
    <div style="text-align:center;margin:4px 0">
      <div style="font-size:14px;font-weight:bold">${isKitchen ? 'أمر مطبخ' : 'فاتورة ضريبية مبسطة'}</div>
      <div style="font-size:11px;font-weight:bold;color:#333">${isKitchen ? 'Kitchen Ticket' : 'Simplified Tax Invoice'}</div>
    </div>

    <hr class="receipt-divider" />

    <!-- ORDER BOX -->
    ${doc.orderNumber ? `
    <div style="border:2px solid #000;text-align:center;padding:6px;margin:8px 0">
      <div style="font-size:13px;font-weight:bold">الطلب #${escapeHtml(doc.orderNumber)}</div>
    </div>` : ''}

    <!-- INVOICE DETAILS -->
    ${!isKitchen ? `
    <div style="margin-bottom:6px">
      ${doc.invoiceNumber ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:11px">
          <span>رقم الفاتورة</span>
          <span style="font-weight:bold">${escapeHtml(doc.invoiceNumber)}</span>
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">Invoice #</div>` : ''}
      ${doc.invoiceCounter !== undefined ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:11px">
          <span>تسلسل الفاتورة</span>
          <span style="font-weight:bold">${doc.invoiceCounter}</span>
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">Invoice Counter</div>` : ''}
      ${doc.uuid ? `
        <div style="font-size:9px;color:#777;margin-bottom:4px;word-break:break-all;text-align:right">UUID: ${escapeHtml(doc.uuid)}</div>` : ''}
      ${doc.createdAt ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:11px">
          <span>التاريخ</span>
          <span dir="ltr">${escapeHtml(formatDate(doc.createdAt))}</span>
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">Date</div>` : ''}
    </div>` : ''}

    <hr class="receipt-divider" />

    <!-- ORDER TYPE + CUSTOMER -->
    <div style="margin-bottom:6px">
      ${orderTypeLabel.ar ? `
        <div style="font-size:12px;font-weight:bold;margin-bottom:1px">${orderTypeLabel.ar}</div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">${orderTypeLabel.en}</div>` : ''}
      ${doc.customerName ? `<div style="font-size:11px;margin-bottom:2px">العميل : ${escapeHtml(doc.customerName)}</div>` : ''}
      ${doc.customerPhone ? `<div style="font-size:11px;margin-bottom:2px">الجوال : ${escapeHtml(doc.customerPhone)}</div>` : ''}
      ${doc.cashierName ? `<div style="font-size:11px;margin-bottom:2px">الكاشير : ${escapeHtml(doc.cashierName)}</div>` : ''}
      ${doc.notes ? `<div style="font-size:11px;margin-bottom:2px">ملاحظات : ${escapeHtml(doc.notes)}</div>` : ''}
    </div>

    <hr class="receipt-thick-divider" />

    <!-- ITEMS TABLE -->
    <div style="margin-bottom:4px">
      <!-- Header -->
      <div style="font-size:10px;font-weight:bold;margin-bottom:2px;display:flex;justify-content:space-between">
        <span style="width:28px">الكمية</span>
        <span style="flex:1;text-align:center">المنتج</span>
        <span style="width:65px;text-align:end">السعر</span>
      </div>
      <div style="font-size:9px;font-weight:bold;margin-bottom:6px;border-bottom:1px solid #000;padding-bottom:4px;display:flex;justify-content:space-between;color:#555">
        <span style="width:28px">Qty</span>
        <span style="flex:1;text-align:center">Item</span>
        <span style="width:65px;text-align:end">Price</span>
      </div>
      ${itemsHtml}
    </div>

    <hr class="receipt-thick-divider" />

    ${!isKitchen ? `
    <!-- TOTALS -->
    <div style="margin-bottom:4px">
      ${doc.subtotal !== undefined ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:12px">
          <span>المجموع الفرعي</span>
          <span dir="ltr">${num(doc.subtotal).toFixed(2)} ر.س</span>
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">Subtotal</div>` : ''}

      ${num(doc.discount) > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:12px;color:#16a34a">
          <span>الخصم</span>
          <span dir="ltr">-${num(doc.discount).toFixed(2)} ر.س</span>
        </div>
        <div style="font-size:10px;color:#16a34a;margin-bottom:4px">Discount</div>` : ''}

      ${num(doc.deliveryFee) > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:12px">
          <span>رسوم التوصيل</span>
          <span dir="ltr">${num(doc.deliveryFee).toFixed(2)} ر.س</span>
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">Delivery Fee</div>` : ''}

      ${doc.taxAmount !== undefined ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:12px">
          <span>VAT ${taxRate}%(${taxRate}.0%)</span>
          <span dir="ltr">${num(doc.taxAmount).toFixed(2)} ر.س</span>
        </div>
        <div style="font-size:10px;color:#555;margin-bottom:4px">(${taxRate}.0%) ضريبة القيمة المضافة ${taxRate}%</div>` : ''}

      <hr style="border:none;border-top:1px dashed #000;margin:6px 0" />

      <!-- Grand Total -->
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin-bottom:1px">
        <span>الإجمالي</span>
        <span dir="ltr">${num(doc.total).toFixed(2)} ر.س</span>
      </div>
      <div style="font-size:11px;font-weight:bold;color:#555;margin-bottom:2px">Total</div>
    </div>

    <hr class="receipt-divider" />

    <!-- PAYMENT METHOD -->
    ${doc.paymentMethod ? `
    <div style="margin:6px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:1px;font-size:12px;font-weight:bold">
        <span>الدفع - ${escapeHtml(doc.paymentMethod)}</span>
        <span dir="ltr">${num(doc.total).toFixed(2)} ر.س</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#555;margin-bottom:4px">
        <span>Payment - ${escapeHtml(doc.paymentMethod)}</span>
        <span dir="ltr">${num(doc.total).toFixed(2)} ر.س</span>
      </div>
    </div>` : ''}

    <!-- ITEM COUNT -->
    <div style="font-size:11px;margin:6px 0">عدد المنتجات ${itemCount}</div>

    <hr class="receipt-divider" />
    ` : ''}

    <!-- QR CODE -->
    ${qrHtml}

    <!-- FOOTER -->
    <div style="text-align:center;font-size:10px;color:#555;margin-top:8px">
      <p>شكراً لزيارتكم</p>
      <p style="margin-top:1px">Thank you for your visit</p>
    </div>

    <div style="text-align:center;font-size:9px;color:#999;margin-top:10px;border-top:1px dotted #ccc;padding-top:6px">
      <span>Powered by </span><span style="font-weight:bold;color:#666">Trying</span>
    </div>

  </div>
  </body>
  </html>`;
}

function line(left: string, right = '', width = 42): string {
  const cleanLeft = String(left || '').replace(/\n/g, ' ');
  const cleanRight = String(right || '').replace(/\n/g, ' ');
  const space = Math.max(1, width - cleanLeft.length - cleanRight.length);
  return `${cleanLeft}${' '.repeat(space)}${cleanRight}`;
}

function buildThermalPayload(doc: PrintableReceipt, profile: PrinterProfile, target: PrinterTarget): string {
  const width = profile.printerNbrCharactersPerLine || 42;
  const payload: string[] = [];

  payload.push('[C]<b>' + doc.restaurantName + '</b>');
  if (doc.restaurantAddress) payload.push('[C]' + doc.restaurantAddress);
  if (doc.restaurantPhone) payload.push('[C]' + doc.restaurantPhone);
  if (doc.restaurantVat) payload.push('[C]VAT: ' + doc.restaurantVat);
  payload.push('[C]--------------------------------');
  payload.push('[C]<b>' + doc.title + '</b>');
  if (doc.orderNumber) payload.push('[C]<font size="big">' + doc.orderNumber + '</font>');
  if (doc.invoiceNumber) payload.push('[L]' + line('Invoice', doc.invoiceNumber, width));
  if (doc.createdAt) payload.push('[L]' + line('Date', formatDate(doc.createdAt), width));
  if (doc.customerName) payload.push('[L]' + line('Customer', doc.customerName, width));
  if (doc.customerPhone) payload.push('[L]' + line('Phone', doc.customerPhone, width));
  if (doc.paymentMethod) payload.push('[L]' + line('Payment', doc.paymentMethod, width));
  if (doc.cashierName) payload.push('[L]' + line('Cashier', doc.cashierName, width));
  if (doc.notes) payload.push('[L]Notes: ' + doc.notes);
  payload.push('[C]--------------------------------');

  for (const item of doc.items) {
    payload.push('[L]<b>' + item.name + ' × ' + item.quantity + '</b>[R]' + num(item.totalPrice).toFixed(2));
    for (const detail of item.details || []) {
      payload.push('[L]  ' + detail);
    }
    if (item.notes) {
      payload.push('[L]  ' + item.notes);
    }
  }

  payload.push('[C]--------------------------------');
  if (doc.subtotal !== undefined) payload.push('[L]' + line('Subtotal', num(doc.subtotal).toFixed(2), width));
  if (num(doc.discount) > 0) payload.push('[L]' + line('Discount', '-' + num(doc.discount).toFixed(2), width));
  if (num(doc.deliveryFee) > 0) payload.push('[L]' + line('Delivery', num(doc.deliveryFee).toFixed(2), width));
  if (doc.taxAmount !== undefined) payload.push('[L]' + line('VAT', num(doc.taxAmount).toFixed(2), width));
  payload.push('[L]<b>' + line('TOTAL', num(doc.total).toFixed(2), width) + '</b>');
  payload.push('[C]================================');
  payload.push('[C]' + (target === 'kitchen' ? 'Kitchen Ticket' : 'Cashier Receipt'));
  if (doc.qrCodeData && target === 'cashier') {
    // Thermal printer library usually supports <qrcode> tag
    payload.push('[C]<qrcode size="8">' + doc.qrCodeData + '</qrcode>');
  }
  payload.push('[L]\n[L]\n');

  return payload.join('\n');
}

async function systemPrint(doc: PrintableReceipt, target: PrinterTarget) {
  const html = buildReceiptHtml(doc, target);

  // On web (browser) expo-print doesn't support HTML — open a new window instead
  if (Platform.OS === 'web') {
    const printWindow = (window as any).open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    }
    return;
  }

  await Print.printAsync({ 
    html,
    width: 283, // ~80mm width in points
  });
}

async function thermalPrint(doc: PrintableReceipt, profile: PrinterProfile, target: PrinterTarget) {
  const thermal = getThermalPrinterModule();
  if (!thermal) {
    throw new Error('Thermal printer module is unavailable in this build');
  }

  const payload = buildThermalPayload(doc, profile, target);
  const config = {
    payload,
    autoCut: profile.autoCut,
    openCashbox: profile.openCashbox,
    printerWidthMM: profile.printerWidthMM,
    printerNbrCharactersPerLine: profile.printerNbrCharactersPerLine,
    ip: profile.ip,
    port: profile.port || 9100,
    timeout: 30000,
  };

  if (profile.mode === 'tcp') {
    if (!profile.ip) throw new Error('TCP printer IP is missing');
    if (!thermal.printTcp) throw new Error('TCP thermal printing is unavailable');
    await thermal.printTcp(config);
    return;
  }

  if (!thermal.printBluetooth) throw new Error('Bluetooth thermal printing is unavailable');
  await thermal.printBluetooth(config);
}

async function printWithProfile(doc: PrintableReceipt, target: PrinterTarget, profile: PrinterProfile) {
  if (!profile.enabled || profile.mode === 'disabled') return;

  if (profile.mode === 'system') {
    await systemPrint(doc, target);
    return;
  }

  if (Platform.OS === 'android') {
    try {
      await thermalPrint(doc, profile, target);
      return;
    } catch (error) {
      console.warn('Thermal printing fallback to system print:', error);
    }
  }

  await systemPrint(doc, target);
}

function normalizeKitchenStations(settings: PrinterSettings): KitchenPrinterStation[] {
  const savedStations = (settings.kitchenStations || []).map((station) => ({
    ...station,
    assignedCategoryIds: station.assignedCategoryIds || [],
    assignedCategoryNames: station.assignedCategoryNames || [],
    profile: {
      ...DEFAULT_SETTINGS.kitchen,
      ...station.profile,
      label: station.profile?.label || station.name,
    },
  }));

  if (savedStations.length > 0) {
    return savedStations;
  }

  return [
    {
      id: 'kitchen-default',
      name: settings.kitchen.label || 'Kitchen Default',
      assignedCategoryIds: [],
      assignedCategoryNames: [],
      isFallback: true,
      profile: {
        ...DEFAULT_SETTINGS.kitchen,
        ...settings.kitchen,
      },
    },
  ];
}

function routeKitchenItemsToStations(
  items: KitchenPrintableOrderItem[],
  stations: KitchenPrinterStation[],
): Array<{ station: KitchenPrinterStation; items: KitchenPrintableOrderItem[] }> {
  const activeStations = stations.filter((station) => station.profile.enabled && station.profile.mode !== 'disabled');
  const fallbackStation = activeStations.find((station) => station.isFallback) || activeStations[0];
  const buckets = new Map<string, KitchenPrintableOrderItem[]>();

  for (const item of items) {
    const matchedStation = activeStations.find((station) =>
      (station.assignedCategoryIds || []).includes(String(item.categoryId || '')) ||
      (station.assignedCategoryNames || []).some((name) => name && name === item.categoryName),
    );

    const station = matchedStation || fallbackStation;
    if (!station) continue;

    const current = buckets.get(station.id) || [];
    current.push(item);
    buckets.set(station.id, current);
  }

  return activeStations
    .map((station) => ({ station, items: buckets.get(station.id) || [] }))
    .filter((entry) => entry.items.length > 0);
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const saved = await OfflineStorage.loadPrinterSettings<PrinterSettings>();
  if (!saved) return DEFAULT_SETTINGS;
  const normalized: PrinterSettings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    cashier: {
      ...DEFAULT_SETTINGS.cashier,
      ...saved.cashier,
    },
    kitchen: {
      ...DEFAULT_SETTINGS.kitchen,
      ...saved.kitchen,
    },
  };
  normalized.kitchenStations = normalizeKitchenStations(normalized);
  return normalized;
}

export async function savePrinterSettings(settings: PrinterSettings): Promise<void> {
  await OfflineStorage.savePrinterSettings(settings);
}

export function getDefaultPrinterSettings(): PrinterSettings {
  return DEFAULT_SETTINGS;
}

export async function testPrint(target: PrinterTarget, settings?: PrinterSettings, profileOverride?: PrinterProfile, titleOverride?: string) {
  const printerSettings = settings || (await getPrinterSettings());
  const profile = profileOverride || (target === 'cashier' ? printerSettings.cashier : printerSettings.kitchen);
  const doc: PrintableReceipt = {
    title: titleOverride || (target === 'cashier' ? 'اختبار طباعة الكاشير' : 'اختبار طباعة المطبخ'),
    badge: target === 'cashier' ? '80mm' : 'Kitchen',
    restaurantName: 'TryingPOS',
    createdAt: new Date().toISOString(),
    orderNumber: `TEST-${Date.now().toString().slice(-4)}`,
    paymentMethod: 'Cash',
    items: [
      { name: target === 'cashier' ? 'فاتورة تجريبية' : 'طلب مطبخ تجريبي', quantity: 1, totalPrice: 12.5, details: ['No onions', 'Extra sauce'] },
    ],
    subtotal: 10.87,
    taxAmount: 1.63,
    taxRate: 15,
    total: 12.5,
    footer: Platform.OS === 'android' ? 'Bluetooth thermal ready on native build' : 'iOS uses system print / AirPrint',
  };

  await printWithProfile(doc, target, profile);
}

export async function printInvoiceDocument(
  invoicePayload: any,
  options?: { language?: 'ar' | 'en'; restaurant?: any; settings?: PrinterSettings },
) {
  const invoice: Invoice = invoicePayload?.id ? invoicePayload : invoicePayload?.invoice;
  const order = invoicePayload?.order;
  const restaurant = options?.restaurant || invoicePayload?.restaurant || {};
  const settings = options?.settings || (await getPrinterSettings());

  // Build address from composite fields (matching web invoice)
  const buildAddress = (r: any): string => {
    const parts: string[] = [];
    if (r.buildingNumber) parts.push(r.buildingNumber);
    if (r.streetName) parts.push(r.streetName);
    if (r.district) parts.push(r.district);
    if (r.city) parts.push(r.city);
    if (parts.length > 0) return parts.join(' - ');
    return r.address || '';
  };

  const items: PrintableItem[] = (order?.items || []).map((item: any) => ({
    name: item.menuItem?.nameEn || item.itemName || 'Item',
    nameAr: item.menuItem?.nameAr || undefined,
    quantity: num(item.quantity, 1),
    unitPrice: num(item.unitPrice),
    totalPrice: num(item.totalPrice),
    notes: item.notes || undefined,
    details: [
      ...(item.variantName ? [item.variantName] : []),
      ...((item.customizations || []).map((c: any) => c.name).filter(Boolean)),
    ],
  }));

  const doc: PrintableReceipt = {
    title: 'فاتورة ضريبية مبسطة\nSimplified Tax Invoice',
    badge: '80mm',
    restaurantName: restaurant?.nameAr || restaurant?.nameEn || 'TryingPOS',
    restaurantEnName: restaurant?.nameEn,
    restaurantVat: restaurant?.vatNumber || undefined,
    commercialRegistration: restaurant?.commercialRegistration || undefined,
    restaurantAddress: buildAddress(restaurant) || undefined,
    restaurantPhone: restaurant?.phone || undefined,
    logo: restaurant?.logo || undefined,
    orderNumber: order?.orderNumber || undefined,
    invoiceNumber: invoice?.invoiceNumber,
    createdAt: invoice?.createdAt || order?.createdAt,
    customerName: invoice?.customerName || order?.customerName || undefined,
    customerPhone: invoice?.customerPhone || order?.customerPhone || undefined,
    paymentMethod: invoice?.paymentMethod || order?.paymentMethod || undefined,
    cashierName: invoice?.cashierName || undefined,
    items,
    subtotal: num(invoice?.subtotal),
    discount: num(invoice?.discount),
    deliveryFee: num(invoice?.deliveryFee),
    taxAmount: num(invoice?.taxAmount),
    taxRate: num(invoice?.taxRate, 15),
    total: num(invoice?.total),
    qrCodeData: invoice?.qrCodeData || undefined,
    footer: 'Generated from mobile app',
    orderType: order?.orderType || undefined,
    uuid: (invoice as any)?.uuid || undefined,
    invoiceCounter: (invoice as any)?.invoiceCounter || undefined,
  };

  await printWithProfile(doc, 'cashier', settings.cashier);
}

export async function printKitchenTicketDocument(
  payload: {
    orderNumber?: string;
    orderType?: string;
    createdAt?: string;
    customerName?: string;
    notes?: string;
    items: KitchenPrintableOrderItem[];
  },
  options?: { language?: 'ar' | 'en'; restaurant?: any; settings?: PrinterSettings; profileOverride?: PrinterProfile; titleOverride?: string; footerOverride?: string },
) {
  const settings = options?.settings || (await getPrinterSettings());
  const doc: PrintableReceipt = {
    title: options?.titleOverride || (options?.language === 'ar' ? 'أمر مطبخ' : 'Kitchen Ticket'),
    badge: payload.orderType || 'Kitchen',
    restaurantName: options?.restaurant?.nameAr || options?.restaurant?.nameEn || 'TryingPOS',
    orderNumber: payload.orderNumber,
    createdAt: payload.createdAt,
    customerName: payload.customerName,
    notes: payload.notes,
    items: payload.items.map((item: any) => ({
      name: item.itemName || item.nameAr || item.nameEn || 'Item',
      quantity: num(item.quantity, 1),
      totalPrice: 0,
      notes: item.notes || undefined,
      details: [
        ...(item.variantName ? [item.variantName] : []),
        ...((item.selectedCustomizations || []).map((c: any) => c.nameAr || c.nameEn).filter(Boolean)),
      ],
    })),
    total: 0,
    footer: options?.footerOverride || 'Kitchen copy',
  };

  await printWithProfile(doc, 'kitchen', options?.profileOverride || settings.kitchen);
}

export async function printKitchenStationTickets(
  payload: {
    order: any;
    orderItems: KitchenPrintableOrderItem[];
    restaurant?: any;
    language?: 'ar' | 'en';
  },
  settings?: PrinterSettings,
) {
  const printerSettings = settings || (await getPrinterSettings());
  const stations = normalizeKitchenStations(printerSettings);
  const routed = routeKitchenItemsToStations(payload.orderItems, stations);

  if (routed.length === 0 && printerSettings.kitchen.enabled) {
    await printKitchenTicketDocument(
      {
        orderNumber: payload.order?.orderNumber,
        orderType: payload.order?.orderType,
        createdAt: payload.order?.createdAt || new Date().toISOString(),
        customerName: payload.order?.customerName,
        notes: payload.order?.notes,
        items: payload.orderItems,
      },
      { language: payload.language, restaurant: payload.restaurant, settings: printerSettings },
    );
    return;
  }

  for (const entry of routed) {
    await printKitchenTicketDocument(
      {
        orderNumber: payload.order?.orderNumber,
        orderType: payload.order?.orderType,
        createdAt: payload.order?.createdAt || new Date().toISOString(),
        customerName: payload.order?.customerName,
        notes: payload.order?.notes,
        items: entry.items,
      },
      {
        language: payload.language,
        restaurant: payload.restaurant,
        settings: printerSettings,
        profileOverride: entry.station.profile,
        titleOverride: payload.language === 'ar' ? `أمر مطبخ - ${entry.station.name}` : `Kitchen Ticket - ${entry.station.name}`,
        footerOverride: entry.station.name,
      },
    );
  }
}

export async function autoPrintOrderDocuments(
  payload: {
    order: any;
    invoice?: any;
    orderItems: any[];
    restaurant?: any;
    language?: 'ar' | 'en';
  },
) {
  const settings = await getPrinterSettings();

  // ── KITCHEN TICKET ────────────────────────────────────────────
  // Print only if:
  //   1. autoPrintKitchen = true
  //   2. kitchen printer is enabled
  //   3. Kitchen Screen service (KDS) is NOT active on the restaurant
  const isKdsEnabled = payload.restaurant?.serviceKitchenScreen === true;
  const shouldPrintKitchen =
    settings.autoPrintKitchen &&
    settings.kitchen.enabled &&
    settings.kitchen.mode !== 'disabled' &&
    !isKdsEnabled;

  if (shouldPrintKitchen) {
    await printKitchenStationTickets(
      {
        order: payload.order,
        orderItems: payload.orderItems,
        restaurant: payload.restaurant,
        language: payload.language,
      },
      settings,
    );
  }

  // ── CASHIER RECEIPT ───────────────────────────────────────────
  // Print only if:
  //   1. autoPrintCashier = true
  //   2. cashier printer is enabled
  //   3. invoice data is available
  const shouldPrintCashier =
    settings.autoPrintCashier &&
    settings.cashier.enabled &&
    settings.cashier.mode !== 'disabled' &&
    !!payload.invoice;

  if (shouldPrintCashier) {
    await printInvoiceDocument(payload.invoice, {
      language: payload.language,
      restaurant: payload.restaurant,
      settings,
    });
  }
}
