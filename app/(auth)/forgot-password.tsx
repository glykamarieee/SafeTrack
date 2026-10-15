import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { Text } from "../../components/ui/Text";
import { sendPasswordReset } from "../../services/supabaseAuthService";
import { useTheme } from "../../theme/ThemeProvider";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [errorText, setErrorText] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSuccessMessage(null);

    if (!isValidEmail(email)) {
      setErrorText("Enter a valid email address.");
      return;
    }

    setErrorText(undefined);
    setIsLoading(true);

    try {
      await sendPasswordReset(email.trim());

      setSuccessMessage("If an account exists for that email, a reset link has been sent.");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      back
      compact
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="Enter the email linked to your SafeTrack account and we'll send you a link to set a new password."
      footer={
        <>
          <Link href="/(auth)/login" accessibilityRole="link">
            <Text variant="label" tone="primary" weight="800">
              Back to login
            </Text>
          </Link>
          <View style={styles.note}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
            <Text variant="caption">Your reset request is handled securely.</Text>
          </View>
        </>
      }
    >
      <Field
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={errorText}
        placeholder="you@example.com"
        onSubmitEditing={() => void handleSubmit()}
        returnKeyType="send"
      />

      {successMessage ? <Notice tone="success">{successMessage}</Notice> : null}

      <Button label="Send reset link" icon="paper-plane-outline" size="lg" onPress={() => void handleSubmit()} loading={isLoading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "center", gap: 6 },
});
