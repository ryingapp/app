type SoftPosEnvironment = 'SANDBOX' | 'PRODUCTION' | 'DEMO' | 'STAGING' | 'DEVELOPMENT';

type SoftPosPurchaseResult = {
  approved: boolean;
  rrn?: string;
  authCode?: string;
  transactionNumber?: string;
  raw: any;
};

type InitOptions = {
  authCode?: string;
  merchantId?: string;
  email?: string;
  password?: string;
  environment?: SoftPosEnvironment;
  partnerConfig?: string;
};

type SoftPosDiagnostics = {
  environment: string;
  sdkInstalled: boolean;
  initialized: boolean;
  hasPartnerConfig: boolean;
  hasAuthCode: boolean;
  hasMerchantId: boolean;
  hasEmail: boolean;
  hasPassword: boolean;
  credentialPath: 'auth_code' | 'merchant_credentials' | 'missing';
};

let sdkModuleCache: any = null;
let initialized = false;

function getSdkModule(): any {
  if (sdkModuleCache) return sdkModuleCache;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdkModuleCache = require('edfapay-react-native');
    return sdkModuleCache;
  } catch {
    throw new Error('EdfaPay SDK is not installed. Install package edfapay-react-native first.');
  }
}

function resolveEnvironment(sdk: any, env?: string) {
  const value = String(
    env ||
      process.env.EXPO_PUBLIC_EDFAPAY_ENV ||
      process.env.EXPO_PUBLIC_EDFAPAY_EN ||
      (__DEV__ ? 'SANDBOX' : 'PRODUCTION'),
  ).toUpperCase();
  const supported = sdk?.Env || {};

  return (
    supported[value] ||
    supported.SANDBOX ||
    value
  );
}

function resolveEnvironmentRaw(env?: string): string {
  return String(
    env ||
      process.env.EXPO_PUBLIC_EDFAPAY_ENV ||
      process.env.EXPO_PUBLIC_EDFAPAY_EN ||
      (__DEV__ ? 'SANDBOX' : 'PRODUCTION'),
  ).toUpperCase();
}

function errorDetails(error: any): string {
  const message = String(error?.message || 'Unknown error');
  const code = String(error?.code || '').toUpperCase();
  return code ? `${message} (code: ${code})` : message;
}

function buildDiagnostics(options?: InitOptions): SoftPosDiagnostics {
  const hasAuthCode = Boolean(options?.authCode || process.env.EXPO_PUBLIC_EDFAPAY_AUTH_CODE);
  const hasMerchantId = Boolean(options?.merchantId || process.env.EXPO_PUBLIC_EDFAPAY_MERCHANT_ID);
  const hasEmail = Boolean(options?.email || process.env.EXPO_PUBLIC_EDFAPAY_EMAIL);
  const hasPassword = Boolean(options?.password || process.env.EXPO_PUBLIC_EDFAPAY_PASSWORD);
  const hasPartnerConfig = Boolean(options?.partnerConfig || process.env.EXPO_PUBLIC_EDFAPAY_PARTNER_CONFIG);

  let sdkInstalled = false;
  try {
    getSdkModule();
    sdkInstalled = true;
  } catch {
    sdkInstalled = false;
  }

  const credentialPath = hasAuthCode ? 'auth_code' : (hasPassword && (hasMerchantId || hasEmail) ? 'merchant_credentials' : 'missing');

  return {
    environment: resolveEnvironmentRaw(options?.environment),
    sdkInstalled,
    initialized,
    hasPartnerConfig,
    hasAuthCode,
    hasMerchantId,
    hasEmail,
    hasPassword,
    credentialPath,
  };
}

function diagnosticsLabel(d: SoftPosDiagnostics): string {
  return `env=${d.environment} sdkInstalled=${d.sdkInstalled} initialized=${d.initialized} partnerConfig=${d.hasPartnerConfig} authCode=${d.hasAuthCode} merchantId=${d.hasMerchantId} email=${d.hasEmail} password=${d.hasPassword} credentialPath=${d.credentialPath}`;
}

export function logSoftPosDiagnostics(context: string, options?: InitOptions): void {
  if (!__DEV__) return;
  const d = buildDiagnostics(options);
  console.warn(`[SoftPOS:${context}] ${diagnosticsLabel(d)}`);
}

function resolveCredentials(sdk: any, options?: InitOptions) {
  const authCode =
    options?.authCode ||
    process.env.EXPO_PUBLIC_EDFAPAY_AUTH_CODE ||
    '';

  const merchantIdOrEmail =
    options?.merchantId ||
    options?.email ||
    process.env.EXPO_PUBLIC_EDFAPAY_MERCHANT_ID ||
    process.env.EXPO_PUBLIC_EDFAPAY_EMAIL ||
    '';
  const password = options?.password || process.env.EXPO_PUBLIC_EDFAPAY_PASSWORD || '';

  const environment = resolveEnvironment(sdk, options?.environment);

  if (authCode) {
    return {
      environment,
      authCode,
    };
  }

  if (merchantIdOrEmail && password) {
    return {
      environment,
      email: merchantIdOrEmail,
      password,
    };
  }

  const d = buildDiagnostics(options);
  throw new Error(`Missing EdfaPay credentials. Set EXPO_PUBLIC_EDFAPAY_AUTH_CODE or EXPO_PUBLIC_EDFAPAY_MERCHANT_ID/EXPO_PUBLIC_EDFAPAY_PASSWORD. [${diagnosticsLabel(d)}]`);
}

function configureTheme(sdk: any) {
  try {
    sdk?.EdfaPayPlugin?.enableLogs?.(__DEV__);
    sdk?.EdfaPayPlugin?.setAnimationSpeed?.(1.0);

    // Quick-start parity: EdfaPayPlugin.theme().setPrimaryColor("#00cc66")
    sdk?.EdfaPayPlugin?.theme?.()?.setPrimaryColor?.('#00cc66');

    sdk?.EdfaPayPlugin?.setTheme?.({
      primaryColor: '#2196F3',
      secondaryColor: '#FFFFFF',
      fontScale: 1.0,
      presentation: sdk?.Presentation?.DIALOG_BOTTOM_FILL || 'DIALOG_BOTTOM_FILL',
      presentationOptions: {
        dismissOnTouchOutside: false,
        dismissOnBackPress: false,
        shufflePinPad: true,
        purchaseSecondaryAction: sdk?.PurchaseSecondaryAction?.NONE || 'NONE',
      },
    });
  } catch {
    // Theme API shape may vary by SDK version; ignore theme failures.
  }
}

export function isSoftPosReady(): boolean {
  return initialized;
}

export async function initializeSoftPos(options?: InitOptions): Promise<void> {
  if (initialized) return;

  const sdk = getSdkModule();
  const { EdfaPayPlugin } = sdk;

  const partnerConfig =
    options?.partnerConfig ||
    process.env.EXPO_PUBLIC_EDFAPAY_PARTNER_CONFIG ||
    '';

  if (partnerConfig) {
    EdfaPayPlugin?.setPartnerConfig?.(partnerConfig);
  }

  configureTheme(sdk);

  const credentials = resolveCredentials(sdk, options);
  logSoftPosDiagnostics('initialize:start', options);

  let firstInitiateError: any = null;
  try {
    await EdfaPayPlugin.initiate(credentials, {
      onTerminalBindingTask: (bindingTask: any) => {
        try {
          bindingTask?.bind?.();
        } catch {}
      },
    });
  } catch (error: any) {
    firstInitiateError = error;
    // Some SDK versions accept only credentials
    try {
      await EdfaPayPlugin.initiate(credentials);
      if (__DEV__) {
        console.warn(`[SoftPOS:initialize:fallback] initiate(credentials, callback) failed, fallback succeeded: ${errorDetails(firstInitiateError)}`);
      }
    } catch (fallbackError: any) {
      throw new Error(`SoftPOS initiation failed. First attempt: ${errorDetails(firstInitiateError)}. Fallback attempt: ${errorDetails(fallbackError)}.`);
    }
  }

  initialized = true;
}

export async function purchaseWithSoftPos(params: {
  amount: string;
  orderId?: string;
}): Promise<SoftPosPurchaseResult> {
  const sdk = getSdkModule();
  const { EdfaPayPlugin } = sdk;

  logSoftPosDiagnostics('purchase:before-init');
  await initializeSoftPos();

  try {
    const transaction = await EdfaPayPlugin.purchase({
      txnParams: {
        amount: params.amount,
        transactionType: sdk?.TransactionType?.PURCHASE || 'PURCHASE',
        orderId: params.orderId,
      },
      flowType: sdk?.FlowType?.DETAIL || 'DETAIL',
    });

    const tx = transaction?.transaction || transaction;

    return {
      approved: true,
      rrn: tx?.rrn,
      authCode: tx?.authCode,
      transactionNumber: tx?.transactionNumber,
      raw: transaction,
    };
  } catch (error: any) {
    const code = String(error?.code || '').toUpperCase();
    if (code === 'CANCELLED_BY_USER') {
      throw new Error('Payment was cancelled by user');
    }
    const details = errorDetails(error);
    const d = buildDiagnostics();
    throw new Error(`SoftPOS payment failed: ${details}. [${diagnosticsLabel(d)}]`);
  }
}

// Quick Start API wrappers (v1.0.5 style)
export async function processPayment(amount = '10.00'): Promise<SoftPosPurchaseResult> {
  return purchaseWithSoftPos({ amount });
}

export async function initAndPay(options?: InitOptions & { amount?: string }): Promise<SoftPosPurchaseResult> {
  await initializeSoftPos(options);
  return processPayment(options?.amount || '10.00');
}

export type { SoftPosPurchaseResult, InitOptions, SoftPosDiagnostics };
