# EdfaPay SoftPOS Setup (React Native / Expo)

This project now includes app-level SoftPOS integration in:
- `src/services/edfapaySoftpos.ts`
- `src/screens/POSScreen.tsx`

## 1) Install dependency

```bash
npm install edfapay-react-native
```

If the command returns `404`, the package is private for partner accounts.
Use the installation source provided by EdfaPay/DK partner team (private registry URL, tarball, or git package).

## 2) Environment variables

Set these in your runtime env (or EAS secrets):

- `EXPO_PUBLIC_EDFAPAY_ENV` = `SANDBOX` or `PRODUCTION`
- `EXPO_PUBLIC_EDFAPAY_AUTH_CODE` = your auth token
- `EXPO_PUBLIC_EDFAPAY_PARTNER_CONFIG` = encrypted partner config string (optional but required for partner overrides)

Alternative credential path:
- `EXPO_PUBLIC_EDFAPAY_MERCHANT_ID`
- `EXPO_PUBLIC_EDFAPAY_PASSWORD`

Backward-compatible alias (legacy):
- `EXPO_PUBLIC_EDFAPAY_EMAIL`

## 3) Android native setup

Because this app is Expo-managed, generate native folders first:

```bash
npx expo prebuild
```

Then apply the SDK repository and packaging settings in generated Android files:

### android/build.gradle

Add EdfaPay Maven repository under `allprojects.repositories`:

```gradle
maven {
  url "https://build.edfapay.com/nexus/content/repositories/edfapay-mobile/"
  credentials {
    username 'edfapay-sdk-consumer'
    password 'Edfapay@123'
  }
}
```

### android/app/build.gradle

Add packaging exclusions:

```gradle
android {
  packagingOptions {
    pickFirst 'META-INF/AL2.0'
    pickFirst 'META-INF/LGPL2.1'
    pickFirst 'META-INF/DEPENDENCIES'
  }
}
```

Also ensure:
- minSdk >= 29
- compileSdk >= 36
- AGP >= 8.9.1

## 4) Runtime flow in app

On POS checkout when payment method is `card`:
1. app initializes SDK (with partner config before initiate)
2. app executes `purchase()` with amount and orderId
3. if approved, app creates local order API with payment references in notes (`RRN`, `AUTH`, `TXN`)
4. if canceled/failed, order is not created

Additionally, app startup performs a safe eager initialization on Android when credentials exist. This reduces first-payment delay and matches SDK guidance to initialize before payment operations.

## 5) Production safety

- Logs are enabled only in `__DEV__`
- PIN pad shuffle is enabled in theme presentation options
- Do not hardcode auth token in source
