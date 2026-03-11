import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  Keyboard,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';

// ==================== Types ====================
interface FormErrors {
  email?: string;
  password?: string;
}

interface InputFieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChange: (text: string) => void;
  secure?: boolean;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  placeholder?: string;
  isRTL: boolean;
  accentColor: string;
  mutedColor: string;
  borderColor: string;
  onToggleSecure?: () => void;
  showPassword?: boolean;
  error?: string;
}

// ==================== Constants ====================
const ACCENT = '#1B2E4B'; // Deep navy
const BG = '#F4F5F7';
const CARD = '#FFFFFF';
const BORDER = '#DDE2EC';
const TEXT = '#1A2235';
const MUTED = '#677899';
const ERROR = '#DC2626';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH > 768;

// ==================== Sub-components ====================
const Logo: React.FC<{ ar: boolean }> = ({ ar }) => {
  const logoImage = (() => {
    try {
      return require('../../assets/logo.png');
    } catch {
      return null;
    }
  })();

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.logoArea,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      {logoImage ? (
        <Image source={logoImage} style={styles.logoImg} resizeMode="contain" />
      ) : (
        <View style={styles.logoBox}>
          <Text style={styles.logoBoxTxt}>POS</Text>
        </View>
      )}
      <Text style={styles.logoSub}>
        {ar ? 'نظام نقاط البيع' : 'Point of Sale System'}
      </Text>
    </Animated.View>
  );
};

const InputField: React.FC<InputFieldProps> = ({
  label,
  icon,
  value,
  onChange,
  secure,
  isFocused,
  onFocus,
  onBlur,
  keyboardType = 'default',
  autoCapitalize = 'none',
  placeholder,
  isRTL,
  accentColor,
  mutedColor,
  borderColor,
  onToggleSecure,
  showPassword,
  error,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: error ? -2 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [error]);

  return (
    <Animated.View style={[styles.fieldWrap, { transform: [{ translateY }] }]}>
      <Text style={[styles.fieldLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      
      <View
        style={[
          styles.inputRow,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
          isFocused && styles.inputActive,
          error && styles.inputError,
        ]}
      >
        <Ionicons name={icon} size={17} color={isFocused ? accentColor : mutedColor} />
        
        <TextInput
          style={[
            styles.input,
            { textAlign: isRTL ? 'right' : 'left' },
            isRTL && { writingDirection: 'rtl' }
          ]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholder={placeholder}
          placeholderTextColor={mutedColor}
          onFocus={onFocus}
          onBlur={onBlur}
          importantForAutofill="yes"
        />
        
        {secure && (
          <TouchableOpacity onPress={onToggleSecure} hitSlop={8}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color={mutedColor}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && (
        <Animated.Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left' }]}>
          {error}
        </Animated.Text>
      )}
    </Animated.View>
  );
};

// ==================== Main Component ====================
export default function AuthScreen({ navigation }: any) {
  const { language, isRTL } = useLanguage();
  const { login } = useAuth();
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const ar = language === 'ar';
  const isTablet = width > 768;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = ar ? 'البريد الإلكتروني مطلوب' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = ar ? 'بريد إلكتروني غير صحيح' : 'Invalid email address';
    }

    // Password validation
    if (!password) {
      newErrors.password = ar ? 'كلمة المرور مطلوبة' : 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = ar ? 'كلمة المرور قصيرة (6 أحرف على الأقل)' : 'Password too short (min 6 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      
      if (rememberMe) {
        // Implement remember me logic
        // await SecureStore.setItemAsync('userEmail', email);
      }
      
      navigation.replace('Dashboard');
    } catch (err: any) {
      let message = err.message || 'Login failed';
      
      // Handle specific error codes
      if (err.code === 'auth/user-not-found') {
        message = ar ? 'المستخدم غير موجود' : 'User not found';
      } else if (err.code === 'auth/wrong-password') {
        message = ar ? 'كلمة مرور خاطئة' : 'Wrong password';
      } else if (err.code === 'auth/too-many-requests') {
        message = ar ? 'محاولات كثيرة جداً. حاول لاحقاً' : 'Too many attempts. Try later';
      }
      
      Alert.alert(
        ar ? 'خطأ في تسجيل الدخول' : 'Login Error',
        message,
        [{ text: ar ? 'حسناً' : 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      ar ? 'استعادة كلمة المرور' : 'Reset Password',
      ar ? 'سيتم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني' : 'A password reset link will be sent to your email',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { 
          text: ar ? 'إرسال' : 'Send', 
          onPress: () => {
            if (!email) {
              Alert.alert(
                ar ? 'تنبيه' : 'Notice',
                ar ? 'أدخل بريدك الإلكتروني أولاً' : 'Enter your email first'
              );
              return;
            }
            // Implement password reset
            Alert.alert(ar ? 'تم الإرسال' : 'Sent', ar ? 'تحقق من بريدك' : 'Check your email');
          }
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={[BG, '#E8ECF2']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          style={styles.keyboardView}
        >
          <Animated.View 
            style={[
              styles.wrap,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {/* Logo */}
            <Logo ar={ar} />

            {/* Card */}
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={[styles.cardTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                {ar ? 'تسجيل الدخول' : 'Sign In'}
              </Text>

              {/* Email Field */}
              <InputField
                label={ar ? 'البريد الإلكتروني' : 'Email'}
                icon="mail-outline"
                value={email}
                onChange={setEmail}
                isFocused={focused === 'email'}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="example@email.com"
                isRTL={isRTL}
                accentColor={ACCENT}
                mutedColor={MUTED}
                borderColor={BORDER}
                error={errors.email}
              />

              {/* Password Field */}
              <InputField
                label={ar ? 'كلمة المرور' : 'Password'}
                icon="lock-closed-outline"
                value={password}
                onChange={setPassword}
                secure
                showPassword={showPassword}
                onToggleSecure={() => setShowPassword(!showPassword)}
                isFocused={focused === 'password'}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                isRTL={isRTL}
                accentColor={ACCENT}
                mutedColor={MUTED}
                borderColor={BORDER}
                error={errors.password}
              />

              {/* Remember Me & Forgot Password */}
              <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity
                  style={[styles.rememberRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={rememberMe ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={rememberMe ? ACCENT : MUTED}
                  />
                  <Text style={styles.rememberText}>
                    {ar ? 'تذكرني' : 'Remember me'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>
                    {ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.btnTxt}>
                    {ar ? 'تسجيل الدخول' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Removed Google and Apple login buttons as requested */}
            </View>

            <Text style={styles.footer}>© 2026 Trying POS. All rights reserved.</Text>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ==================== Styles ====================
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoImg: {
    width: 190,
    height: 75,
    marginBottom: 10,
  },
  logoBox: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoBoxTxt: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '700',
  },
  logoSub: {
    fontSize: 12,
    color: MUTED,
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  cardTablet: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputRow: {
    height: 50,
    borderWidth: 1.2,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAFBFD',
  },
  inputActive: {
    borderColor: ACCENT,
    backgroundColor: '#F0F4FA',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: ERROR,
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    padding: 0,
    fontWeight: '400',
  },
  errorText: {
    fontSize: 11,
    color: ERROR,
    marginTop: 4,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rememberText: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600',
  },
  btn: {
    height: 52,
    backgroundColor: ACCENT,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnTxt: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    marginTop: 28,
    fontSize: 11,
    color: '#AAB4C8',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});