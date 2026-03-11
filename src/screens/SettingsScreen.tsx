import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { DrawerMenuButton } from '../components/DrawerMenuButton';
import { PrinterSettings, PrinterProfile } from '../constants/types';
import { getDefaultPrinterSettings, getPrinterSettings, savePrinterSettings, testPrint } from '../services/printer';
import { api } from '../services/api';

type PrinterConnectionMode = 'LAN' | 'Bluetooth' | 'USB';

interface ServiceToggles {
  serviceDineIn: boolean;
  servicePickup: boolean;
  serviceDelivery: boolean;
  serviceTableBooking: boolean;
  serviceQueue: boolean;
  allowCashOnPublicQR: boolean;
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, language, isRTL, toggleLanguage } = useLanguage();
  const { logout } = useAuth();
  
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(getDefaultPrinterSettings());
  const [services, setServices] = useState<ServiceToggles>({
    serviceDineIn: true,
    servicePickup: true,
    serviceDelivery: true,
    serviceTableBooking: true,
    serviceQueue: true,
    allowCashOnPublicQR: true,
  });
  const [servicesLoading, setServicesLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const [p, rest] = await Promise.all([
        getPrinterSettings(),
        api.restaurant.get().catch(() => null),
      ]);
      if (p) setPrinterSettings(p);
      if (rest) {
        setServices({
          serviceDineIn: rest.serviceDineIn ?? true,
          servicePickup: rest.servicePickup ?? true,
          serviceDelivery: rest.serviceDelivery ?? true,
          serviceTableBooking: rest.serviceTableBooking ?? true,
          serviceQueue: rest.serviceQueue ?? true,
          allowCashOnPublicQR: (rest as any).allowCashOnPublicQR ?? true,
        });
      }
    };
    loadSettings();
  }, []);

  const handleSavePrinter = async () => {
    await savePrinterSettings(printerSettings);
    Alert.alert(language === 'ar' ? 'تم الحفظ' : 'Saved', language === 'ar' ? 'تم حفظ إعدادات الطابعة' : 'Printer settings saved');
  };

  const toggleService = async (key: keyof ServiceToggles) => {
    const next = { ...services, [key]: !services[key] };
    setServices(next);
    setServicesLoading(true);
    try {
      await api.restaurant.update({ [key]: next[key] });
    } catch (e) {
      // revert on failure
      setServices(services);
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'فشل حفظ الإعداد' : 'Failed to save');
    } finally {
      setServicesLoading(false);
    }
  };

  const handleResetPrinter = async () => {
    const defaults = getDefaultPrinterSettings();
    setPrinterSettings(defaults);
    await savePrinterSettings(defaults);
    Alert.alert(
      language === 'ar' ? 'تم الإعادة' : 'Reset',
      language === 'ar' ? 'تم إعادة إعدادات الطابعة للافتراضي' : 'Printer settings reset to defaults'
    );
  };

  const handleTestPrint = async () => {
    try {
      await testPrint('cashier', printerSettings);
      Alert.alert(language === 'ar' ? 'تم الإرسال' : 'Sent', language === 'ar' ? 'تم إرسال أمر الطباعة' : 'Print command sent');
    } catch (e) {
      Alert.alert('Error', 'Print failed');
    }
  };

  const updatePrinter = (key: keyof PrinterSettings, val: any) => {
    setPrinterSettings(prev => {
      const next = { ...prev, [key]: val };
      void savePrinterSettings(next);
      return next;
    });
  };

  const updatePrinterProfile = (
    target: 'cashier' | 'kitchen',
    key: keyof PrinterProfile,
    val: any
  ) => {
    setPrinterSettings((prev) => {
      const next = {
        ...prev,
        [target]: { ...prev[target], [key]: val },
      };
      void savePrinterSettings(next);
      return next;
    });
  };

  // Define dynamic styles inside the component or use inline
  const dynStyles = {
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border
    },
    text: { color: colors.text },
    subText: { color: colors.textSecondary },
    primaryText: { color: colors.primary }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <DrawerMenuButton />
        <Text style={[styles.title, dynStyles.text]}>{t('settings')}</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={colors.rose} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* App Settings Section */}
        <View style={[styles.section, dynStyles.section]}>
          <Text style={[styles.sectionTitle, dynStyles.primaryText]}>
            {language === 'ar' ? 'إعدادات التطبيق' : 'App Settings'}
          </Text>

          <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowInfo}>
              <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.label, dynStyles.text]}>{t('darkMode')}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={[styles.row, { borderBottomColor: 'transparent' }]}>
            <View style={styles.rowInfo}>
              <Ionicons name="language-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.label, dynStyles.text]}>
                {language === 'ar' ? 'English' : 'العربية'}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleLanguage} style={[styles.langBtn, { backgroundColor: colors.primary }]}>
                <Text style={{color: '#FFF', fontWeight: 'bold'}}>{language === 'ar' ? 'EN' : 'عربي'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Services Section */}
        <View style={[styles.section, dynStyles.section]}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[styles.sectionTitle, dynStyles.primaryText]}>
              {language === 'ar' ? 'الخدمات' : 'Services'}
            </Text>
            {servicesLoading && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14, textAlign: isRTL ? 'right' : 'left' }}>
            {language === 'ar' ? 'فعّل أو ألغِ الخدمات التي يقدمها مطعمك' : 'Enable or disable services offered by your restaurant'}
          </Text>

          {([
            { key: 'serviceDineIn', icon: 'restaurant', labelAr: 'الأكل داخل المطعم', labelEn: 'Dine-in' },
            { key: 'servicePickup', icon: 'walk', labelAr: 'الاستلام من المطعم', labelEn: 'Pickup / Takeaway' },
            { key: 'serviceDelivery', icon: 'bicycle', labelAr: 'التوصيل', labelEn: 'Delivery' },
            { key: 'serviceTableBooking', icon: 'calendar', labelAr: 'حجز الطاولات', labelEn: 'Table Reservations' },
            { key: 'serviceQueue', icon: 'people', labelAr: 'الطابور الإلكتروني', labelEn: 'Digital Queue' },
            { key: 'allowCashOnPublicQR', icon: 'cash', labelAr: 'الدفع نقدي من الكيو ار', labelEn: 'Cash Payment via QR' },
          ] as const).map((svc, idx, arr) => {
            const isOn = services[svc.key];
            return (
              <View
                key={svc.key}
                style={[
                  styles.row,
                  { borderBottomColor: idx < arr.length - 1 ? colors.borderLight : 'transparent' }
                ]}
              >
                <View style={styles.rowInfo}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: isOn ? colors.emeraldBg : colors.surfaceLight,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: isOn ? colors.emeraldBorder : colors.border,
                  }}>
                    <Ionicons name={svc.icon as any} size={18} color={isOn ? colors.emerald : colors.textMuted} />
                  </View>
                  <View>
                    <Text style={[styles.label, dynStyles.text]}>
                      {language === 'ar' ? svc.labelAr : svc.labelEn}
                    </Text>
                    <Text style={{ fontSize: 11, color: isOn ? colors.emerald : colors.rose, fontWeight: '700' }}>
                      {isOn
                        ? (language === 'ar' ? 'مفعّل' : 'Active')
                        : (language === 'ar' ? 'معطّل' : 'Disabled')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isOn}
                  onValueChange={() => toggleService(svc.key)}
                  trackColor={{ false: colors.border, true: colors.emerald }}
                  thumbColor="#FFF"
                />
              </View>
            );
          })}
        </View>

        {/* Printer Settings Section */}
        <View style={[styles.section, dynStyles.section]}>
          <Text style={[styles.sectionTitle, dynStyles.primaryText]}>
            {language === 'ar' ? 'إعدادات الطابعة' : 'Printer Settings'}
          </Text>

          {/* Status Summary Card */}
          <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight }}>
            <Text style={{ fontWeight: '700', color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
              {language === 'ar' ? 'الحالة الحالية' : 'Current Status'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14 }}>{printerSettings.autoPrintCashier && printerSettings.cashier.enabled ? '✅' : '❌'}</Text>
                <Text style={{ fontSize: 12, color: colors.text }}>{language === 'ar' ? 'فاتورة الكاشير' : 'Cashier Receipt'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14 }}>{printerSettings.autoPrintKitchen && printerSettings.kitchen.enabled ? '✅' : '❌'}</Text>
                <Text style={{ fontSize: 12, color: colors.text }}>{language === 'ar' ? 'تذكرة المطبخ' : 'Kitchen Ticket'}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowInfo}>
              <Ionicons name="receipt-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.label, dynStyles.text]}>
                {language === 'ar' ? 'طباعة فاتورة العميل تلقائياً' : 'Auto Print Receipt'}
              </Text>
            </View>
            <Switch
              value={printerSettings.autoPrintCashier}
              onValueChange={(val) => updatePrinter('autoPrintCashier', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowInfo}>
              <Ionicons name="restaurant-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={[styles.label, dynStyles.text]}>
                  {language === 'ar' ? 'طباعة تذكرة المطبخ تلقائياً' : 'Auto Print Kitchen Ticket'}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                  {language === 'ar' ? '(فقط في حال تعطيل شاشة المطبخ)' : '(Only if Kitchen Screen is disabled)'}
                </Text>
              </View>
            </View>
            <Switch
              value={printerSettings.autoPrintKitchen}
              onValueChange={(val) => updatePrinter('autoPrintKitchen', val)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>
          
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />
          
          {/* Cashier Printer Config */}
          <View style={{ marginBottom: spacing.md }}>
            <View style={[styles.row, { borderBottomWidth: 0, paddingVertical: 4 }]}>
               <Text style={[styles.label, dynStyles.primaryText, { fontSize: 14 }]}>
                 {language === 'ar' ? 'طابعة الكاشير' : 'Cashier Printer'}
               </Text>
               <Switch
                 value={printerSettings.cashier.enabled}
                 onValueChange={(val) => updatePrinterProfile('cashier', 'enabled', val)}
                 trackColor={{ false: colors.border, true: colors.primary }}
                 thumbColor="#FFF"
               />
            </View>
            
            {printerSettings.cashier.enabled && (
              <>
                <Text style={[styles.inputLabel, dynStyles.subText, { marginTop: 8 }]}>{language === 'ar' ? 'نوع الاتصال' : 'Connection Mode'}</Text>
                <View style={styles.segmentContainer}>
                  {(['system', 'bluetooth', 'tcp'] as any[]).map((mode) => {
                     const isSelected = printerSettings.cashier.mode === mode;
                     return (
                       <TouchableOpacity
                         key={mode}
                         style={[
                           styles.segmentBtn,
                           isSelected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }
                         ]}
                         onPress={() => updatePrinterProfile('cashier', 'mode', mode)}
                       >
                         <Text style={[styles.segmentText, { color: isSelected ? '#FFF' : colors.text }]}>{mode.toUpperCase()}</Text>
                       </TouchableOpacity>
                     );
                  })}
                </View>

                {printerSettings.cashier.mode === 'tcp' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 2, borderColor: colors.border, color: colors.text }]}
                      placeholder="IP Address"
                      placeholderTextColor={colors.textSecondary}
                      value={printerSettings.cashier.ip || ''}
                      onChangeText={(val) => updatePrinterProfile('cashier', 'ip', val)}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.text }]}
                      placeholder="Port"
                      placeholderTextColor={colors.textSecondary}
                      value={String(printerSettings.cashier.port || '9100')}
                      keyboardType="numeric"
                      onChangeText={(val) => updatePrinterProfile('cashier', 'port', Number(val))}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />

          {/* Kitchen Printer Config */}
          <View style={{ marginBottom: spacing.md }}>
            <View style={[styles.row, { borderBottomWidth: 0, paddingVertical: 4 }]}>
               <Text style={[styles.label, dynStyles.primaryText, { fontSize: 14 }]}>
                 {language === 'ar' ? 'طابعة المطبخ' : 'Kitchen Printer'}
               </Text>
               <Switch
                 value={printerSettings.kitchen.enabled}
                 onValueChange={(val) => updatePrinterProfile('kitchen', 'enabled', val)}
                 trackColor={{ false: colors.border, true: colors.primary }}
                 thumbColor="#FFF"
               />
            </View>
            
            {printerSettings.kitchen.enabled && (
              <>
                <Text style={[styles.inputLabel, dynStyles.subText, { marginTop: 8 }]}>{language === 'ar' ? 'نوع الاتصال' : 'Connection Mode'}</Text>
                <View style={styles.segmentContainer}>
                  {(['system', 'bluetooth', 'tcp'] as any[]).map((mode) => {
                     const isSelected = printerSettings.kitchen.mode === mode;
                     return (
                       <TouchableOpacity
                         key={mode}
                         style={[
                           styles.segmentBtn,
                           isSelected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }
                         ]}
                         onPress={() => updatePrinterProfile('kitchen', 'mode', mode)}
                       >
                         <Text style={[styles.segmentText, { color: isSelected ? '#FFF' : colors.text }]}>{mode.toUpperCase()}</Text>
                       </TouchableOpacity>
                     );
                  })}
                </View>

                {printerSettings.kitchen.mode === 'tcp' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 2, borderColor: colors.border, color: colors.text }]}
                      placeholder="IP Address"
                      placeholderTextColor={colors.textSecondary}
                      value={printerSettings.kitchen.ip || ''}
                      onChangeText={(val) => updatePrinterProfile('kitchen', 'ip', val)}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.text }]}
                      placeholder="Port"
                      placeholderTextColor={colors.textSecondary}
                      value={String(printerSettings.kitchen.port || '9100')}
                      keyboardType="numeric"
                      onChangeText={(val) => updatePrinterProfile('kitchen', 'port', Number(val))}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleSavePrinter}
          >
            <Text style={styles.actionBtnText}>{t('save')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryBtn, { borderColor: colors.primary, marginTop: spacing.sm }]}
            onPress={handleTestPrint}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
               {language === 'ar' ? 'طباعة تجريبية' : 'Test Print'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryBtn, { borderColor: colors.rose ?? '#ef4444', marginTop: spacing.sm }]}
            onPress={handleResetPrinter}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.rose ?? '#ef4444' }]}>
               {language === 'ar' ? 'إعادة ضبط إعدادات الطابعة' : 'Reset to Defaults'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={24} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            {language === 'ar' 
              ? 'لإدارة قائمة الطعام، الموظفين، والتقارير المفصلة، يرجى استخدام لوحة التحكم عبر الويب.' 
              : 'To manage menu, staff, and detailed reports, please use the web dashboard.'}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Ensures space between title and logout
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  logoutBtn: {
    padding: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  langBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.sm,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
    textAlign: 'left',
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  infoText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    flex: 1,
    lineHeight: 20,
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: fontSize.md,
  },
});
