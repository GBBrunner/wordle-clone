import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/theme/context';
import { isThemeKey, readableTextOn } from '@/lib/theme/theme';

export function ThemeDropdown({ compact }: { compact?: boolean }) {
  const { theme, setTheme, hasHydrated, options, colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  const height = compact ? 32 : 40;

  if (!hasHydrated) {
    return <View style={{ width: 140, height, opacity: 0 }} />;
  }

  if (Platform.OS === 'web') {
    const style: React.CSSProperties = {
      height,
      borderRadius: 8,
      padding: '0 10px',
      border: `1px solid ${colors.icon}`,
      background: colors.background,
      color: colors.text,
      fontWeight: 600,
    };

    return (
      <View style={{ justifyContent: 'center' }}>
        <select
          aria-label="Theme"
          value={theme}
          onChange={(e) => {
            const next = e.target.value;
            if (isThemeKey(next)) setTheme(next);
          }}
          style={style}
        >
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[
          styles.button,
          {
            height,
            borderColor: colors.icon,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>Theme</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <SafeAreaView style={styles.modalWrap}>
          <View style={[styles.modal, { backgroundColor: colors.background, borderColor: colors.icon }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Theme</Text>
            {options.map((opt) => {
              const selected = opt.key === theme;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setTheme(opt.key);
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? colors.tint : 'transparent',
                      borderColor: colors.icon,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? readableTextOn(colors.tint) : colors.text,
                      fontWeight: '600',
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 90,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '700' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  option: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
