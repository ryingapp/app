import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useDrawer } from '../context/DrawerContext';

export function DrawerMenuButton() {
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();

  return (
    <TouchableOpacity
      onPress={openDrawer}
      style={[s.btn, { backgroundColor: colors.surfaceLight }]}
      data-testid="button-open-drawer"
    >
      <Ionicons name="menu" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.btn, { backgroundColor: colors.surfaceLight }]}
      data-testid="button-back"
    >
      <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color={colors.text} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
