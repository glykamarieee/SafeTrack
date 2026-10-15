import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../constants/theme";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorText?: string;
  placeholder?: string;
}

export function PasswordField({ label, value, onChangeText, errorText, placeholder = "••••••••" }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, isFocused && styles.inputRowFocused, errorText && styles.inputRowError]}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.gray} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!isVisible}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Pressable onPress={() => setIsVisible((v) => !v)} hitSlop={8}>
          <Ionicons name={isVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.gray} />
        </Pressable>
      </View>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputRowFocused: {
    borderColor: colors.emerald,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
