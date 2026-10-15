import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeProvider";
import {
  MIN_PASSWORD_LENGTH,
  passwordProblem,
  signOut,
  startPasswordRecovery,
  updateMyPassword,
} from "../../services/supabaseAuthService";

type Stage = "checking" | "ready" | "invalid" | "saving";

/**
 * Opened from the password-reset email (safetrack://reset-password#…, or
 * /reset-password on web). The link becomes a short recovery session in
 * which the new password is saved; the user then logs in with it.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const linkedUrl = Linking.useURL();
  const [stage, setStage] = useState<Stage>("checking");
  const [problem, setProblem] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const url = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : linkedUrl;
    if (!url || handled.current === url) return;
    handled.current = url;

    startPasswordRecovery(url)
      .then(() => {
        setStage("ready");
        // Keep the tokens out of the browser history.
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
      })
      .catch((reason: Error) => {
        setProblem(reason.message);
        setStage("invalid");
      });
  }, [linkedUrl]);

  // No link at all (screen opened directly): stop waiting after a moment.
  useEffect(() => {
    const timer = setTimeout(() => {
      setStage((current) => {
        if (current !== "checking") return current;
        setProblem("Open the reset link from your email on this device.");
        return "invalid";
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const save = async () => {
    const invalid = passwordProblem(password, confirm);
    if (invalid) {
      setProblem(invalid);
      return;
    }

    setProblem(null);
    setStage("saving");

    try {
      await updateMyPassword(password);
      await signOut().catch(() => undefined);
      router.replace({ pathname: "/(auth)/login", params: { notice: "password-updated" } });
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : "The password could not be saved.");
      setStage("ready");
    }
  };

  return (
    <AuthShell
      compact
      eyebrow="Account recovery"
      title="Choose a new password"
      subtitle="For your SafeTrack account."
      footer={
        <Link href="/(auth)/login" accessibilityRole="link">
          <Text variant="label" tone="primary" weight="800">
            Back to login
          </Text>
        </Link>
      }
    >
      {stage === "checking" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="label" tone="muted">Checking your reset link…</Text>
        </View>
      ) : stage === "invalid" ? (
        <>
          <Notice tone="error" title="This reset link can't be used">
            {problem ?? "Request a new reset link."}
          </Notice>
          <Button label="Request a new reset link" variant="secondary" icon="refresh" onPress={() => router.replace("/(auth)/forgot-password")} />
        </>
      ) : (
        <>
          <Field
            label="New password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
          <Field
            label="Confirm new password"
            icon="shield-checkmark-outline"
            value={confirm}
            onChangeText={setConfirm}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            error={problem}
          />
          <Button label="Save new password" icon="checkmark" size="lg" onPress={() => void save()} loading={stage === "saving"} />
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 10, paddingVertical: 16 },
});
