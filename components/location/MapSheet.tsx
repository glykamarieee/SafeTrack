import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose(): void;
  children: ReactNode;
};

/** A bottom sheet built on Modal (no gesture or animation libraries needed). */
export function MapSheet({ visible, title, subtitle, onClose, children }: Props) {
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
              <Ionicons name="close" size={18} color="#5F6B66" />
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
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color="#137A50" />
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={primary ? "#FFFFFF" : "#155F42"} />
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export const sheetStyles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  note: { marginTop: 10, color: "#6B7670", fontSize: 11.5, lineHeight: 16 },
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(10,20,16,0.32)" },
  panel: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "82%",
    alignSelf: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    shadowColor: "#0F231C",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, marginTop: 9, backgroundColor: "#D5DDD9" },
  header: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: "#14211B", fontSize: 17, fontWeight: "800" },
  subtitle: { marginTop: 3, color: "#66736D", fontSize: 12.5 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F4F2" },
  body: { flexGrow: 0 },
  bodyContent: { paddingTop: 10, paddingBottom: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E3E9E6",
  },
  rowLabel: { color: "#66736D", fontSize: 12.5, width: 92 },
  rowValue: { flex: 1, color: "#1E2B25", fontSize: 12.5, fontWeight: "700", textAlign: "right" },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EEF4F1",
  },
  buttonPrimary: { backgroundColor: "#137A50" },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: "#155F42", fontSize: 13, fontWeight: "800" },
  buttonTextPrimary: { color: "#FFFFFF" },
});
