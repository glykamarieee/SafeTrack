import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { currentScheme } from "../../theme/currentScheme";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { palettes, shadow } from "../../theme/tokens";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose(): void;
  children: ReactNode;
};

/** A bottom sheet built on Modal (no gesture or animation libraries needed). */
export function MapSheet({ visible, title, subtitle, onClose, children }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <SafeAreaView edges={["bottom"]} style={styles.panel}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text numberOfLines={2} style={styles.title}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={18} color={colors.ink2} />
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function SheetRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SheetButton({
  icon,
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress(): void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.buttonPrimary, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.onPrimary : colors.primary} />
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const lightNote = { marginTop: 10, color: palettes.light.muted, fontSize: 11.5, lineHeight: 16 };
const darkNote = { ...lightNote, color: palettes.dark.muted };

/** Layout shared with sheet content; `note` follows the current theme when read. */
export const sheetStyles = {
  actions: { flexDirection: "row" as const, gap: 8, marginTop: 14 },
  get note() {
    return currentScheme() === "dark" ? darkNote : lightNote;
  },
};

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.scrim },
    panel: {
      width: "100%",
      maxWidth: 560,
      maxHeight: "82%",
      alignSelf: "center",
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: c.surface,
      paddingHorizontal: 20,
      borderWidth: 1, borderColor: scheme === "dark" ? c.rule : "transparent",
      ...shadow(scheme, "float"),
    },
    handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginTop: 10, backgroundColor: c.ruleStrong },
    header: { flexDirection: "row", alignItems: "flex-start", marginTop: 14 },
    headerCopy: { flex: 1, minWidth: 0 },
    title: { color: c.ink, fontSize: 18, fontWeight: "800" },
    subtitle: { marginTop: 3, color: c.muted, fontSize: 12.5 },
    close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: c.sunken },
    body: { flexGrow: 0 },
    bodyContent: { paddingTop: 10, paddingBottom: 20 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.rule,
    },
    rowLabel: { color: c.muted, fontSize: 12.5, width: 92 },
    rowValue: { flex: 1, color: c.ink, fontSize: 12.5, fontWeight: "700", textAlign: "right" },
    button: {
      flex: 1,
      minHeight: 46,
      borderRadius: 999,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: c.primaryTint,
    },
    buttonPrimary: { backgroundColor: c.primary },
    buttonDisabled: { opacity: 0.45 },
    buttonPressed: { opacity: 0.82 },
    buttonText: { color: c.primary, fontSize: 13, fontWeight: "800" },
    buttonTextPrimary: { color: c.onPrimary },
  }),
);
