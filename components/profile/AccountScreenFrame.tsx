import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
} from "react-native";
import { Text, TextInput } from "../ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";

import { guardianColors as colors, guardianRadius as radius, guardianSpacing as spacing } from "../../constants/guardianDesign";

/** Shared layout for the account settings screens (back, title, card). */
export function AccountScreenFrame({
  title,
  subtitle,
  backTo,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Hidden screens live in the Tabs navigator, so "back" navigates explicitly. */
  backTo: Href;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.navigate(backTo)}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={20} color={colors.primaryDeep} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AccountField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" {...props} />
    </View>
  );
}

export function AccountButton({
  label,
  onPress,
  busy = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress(): void;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        danger && styles.buttonDanger,
        (busy || disabled) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{busy ? "Please wait…" : label}</Text>
    </Pressable>
  );
}

export function AccountMessage({ text, tone }: { text: string | null; tone: "error" | "success" }) {
  if (!text) return null;

  return (
    <View style={[styles.message, tone === "error" ? styles.messageError : styles.messageSuccess]}>
      <Ionicons
        name={tone === "error" ? "alert-circle-outline" : "checkmark-circle-outline"}
        size={18}
        color={tone === "error" ? colors.danger : colors.primaryDark}
      />
      <Text style={[styles.messageText, tone === "error" ? styles.messageTextError : styles.messageTextSuccess]}>
        {text}
      </Text>
    </View>
  );
}

export const accountStyles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", padding: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 12.5, lineHeight: 17 },
  card: { padding: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  field: { marginBottom: 12 },
  label: { color: colors.ink, fontSize: 12.5, fontWeight: "800", marginBottom: 6 },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.ink,
    fontSize: 14,
  },
  button: { minHeight: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryDark, marginTop: 4 },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  message: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 11, borderRadius: 13, marginBottom: 12 },
  messageError: { backgroundColor: colors.dangerSoft },
  messageSuccess: { backgroundColor: colors.softMint },
  messageText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  messageTextError: { color: colors.dangerDark },
  messageTextSuccess: { color: colors.primaryDeep },
  pressed: { opacity: 0.82 },
});
