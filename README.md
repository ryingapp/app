# TryingPOS - React Native Mobile App

تطبيق نظام نقاط البيع (POS) كامل مبني بـ React Native (Expo) مع تصميم داكن احترافي ودعم كامل للعربية (RTL).

## المتطلبات

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app على الجوال (للتجربة)

## التشغيل

```bash
cd react-native-app
npm install
npx expo start
```

ثم امسح QR code من تطبيق Expo Go على جوالك.

## هيكل المشروع

```
react-native-app/
├── App.tsx                          # نقطة الدخول
├── src/
│   ├── constants/
│   │   ├── theme.ts                 # الألوان والتصميم
│   │   └── types.ts                 # TypeScript interfaces
│   ├── services/
│   │   ├── api.ts                   # API service (جاهز للربط)
│   │   └── mockData.ts              # بيانات تجريبية
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Bottom tabs + Stack navigation
│   └── screens/
│       ├── AuthScreen.tsx           # تسجيل الدخول
│       ├── TablesScreen.tsx         # إدارة الطاولات
│       ├── POSScreen.tsx            # نقطة البيع + السلة + التخصيصات
│       ├── OrdersScreen.tsx         # الطلبات النشطة
│       ├── KitchenScreen.tsx        # شاشة المطبخ KDS
│       ├── InvoicesScreen.tsx       # الفواتير (ZATCA)
│       ├── ReservationsScreen.tsx   # الحجوزات
│       ├── QueueScreen.tsx          # طابور الانتظار
│       └── ReportsScreen.tsx        # التقارير ولوحة التحكم
```

## الشاشات

| الشاشة | الوصف |
|--------|-------|
| Auth | تسجيل دخول مع تصميم premium |
| Tables | خريطة حية للطاولات مع إحصائيات وتصفية وتغيير الحالة |
| POS | نقطة بيع مع بحث + فئات + تخصيصات + variants + سلة |
| Orders | قائمة الطلبات مع فلاتر وتحديث الحالة |
| Kitchen | شاشة KDS بأعمدة (جديد / تحضير) |
| Invoices | فواتير إلكترونية متوافقة مع ZATCA |
| Reservations | إدارة الحجوزات |
| Queue | نظام طابور الانتظار مع إشعارات |
| Reports | تقارير المبيعات وتنبيهات المخزون |

## ربط API حقيقي

الملف `src/services/api.ts` جاهز للربط مع الـ API الفعلي على `https://tryingpos.com/api`.
فقط استبدل استدعاءات `mockData` في الشاشات بـ `api.*` calls.

## التصميم

- خلفية داكنة: `#0B0F19`
- سطح: `#111827`
- اللون الأساسي: `#4F46E5` (Indigo)
- RTL كامل مع `I18nManager.forceRTL(true)`
