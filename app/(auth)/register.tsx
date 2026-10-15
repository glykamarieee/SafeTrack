import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { Text } from "../../components/ui/Text";
import { useAuthStore } from "../../store/authStore";
import { MIN_PASSWORD_LENGTH } from "../../services/supabaseAuthService";
import { useTheme } from "../../theme/ThemeProvider";

function validEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const createAccount = async () => {
    clearError(); setLocalError(null);
    if (fullName.trim().length < 2) return setLocalError("Enter your full name.");
    if (!validEmail(email.trim())) return setLocalError("Enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) return setLocalError(`Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirmPassword) return setLocalError("Passwords do not match.");
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
      await logout();
      router.replace({ pathname: "/(auth)/login", params: { notice: "registered", email: email.trim().toLowerCase() } });
    } catch {
      // Store exposes the relevant registration message.
    }
  };
  const displayError = localError ?? authError;

  return (
    <AuthShell
      back
      compact
      step={{ current: 1, total: 2 }}
      eyebrow="Guardian account setup"
      title="Create an account"
      subtitle="Create your guardian account first. You can register your child and link a smartwatch in the next step."
      footer={
        <>
          <View style={styles.footerRow}>
            <Text variant="label" weight="500" tone="ink2">Already have an account? </Text>
            <Link href="/(auth)/login" accessibilityRole="link">
              <Text variant="label" tone="primary" weight="800">Log in</Text>
            </Link>
          </View>
          <View style={styles.note}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
            <Text variant="caption">Your information is protected by SafeTrack.</Text>
          </View>
        </>
      }
    >
      <Field label="Full name" icon="person-outline" value={fullName} onChangeText={setFullName} placeholder="Full name" autoCapitalize="words" autoComplete="name" />
      <Field label="Email address" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Password" secure autoCapitalize="none" autoComplete="new-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
      <Field label="Confirm password" icon="shield-checkmark-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secure autoCapitalize="none" autoComplete="new-password" />
      {displayError ? <Notice tone="error">{displayError}</Notice> : null}
      <Button label={isLoading ? "Creating account…" : "Create account"} icon="person-add-outline" size="lg" loading={isLoading} onPress={() => void createAccount()} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  note: { flexDirection: "row", alignItems: "center", gap: 6 },
});
