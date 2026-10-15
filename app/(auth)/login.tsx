import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { Text } from "../../components/ui/Text";
import { useAuthStore } from "../../store/authStore";
import { resendVerificationEmail } from "../../services/supabaseAuthService";
import { hasSeenOnboarding } from "../../services/onboardingService";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { space } from "../../theme/tokens";

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

const NOTICES: Record<string, string> = {
  registered:
    "Account created. If SafeTrack sent you a confirmation email, open its link first, then log in.",
  "password-updated": "Password updated. Log in with your new password.",
  "account-deleted": "Your account was deleted.",
};

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ notice?: string; email?: string }>();
  const notice = params.notice ? NOTICES[params.notice] : undefined;
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const signIn = async () => {
    clearError();
    setLocalError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!validEmail(normalizedEmail)) {
      setLocalError(
        "Enter the email address registered to your SafeTrack account."
      );
      return;
    }

    if (!password) {
      setLocalError("Enter your password.");
      return;
    }

    try {
      await login(normalizedEmail, password);

      const { role, linkedChildren } = useAuthStore.getState();

      if (role === "admin") {
        router.replace("/(app)/home");
        return;
      }

      if (role === "guardian") {
        const target = linkedChildren.length ? "/(app)/home" : "/(auth)/child-registration";

        // The first sign-in on this device opens the tour first.
        if (!(await hasSeenOnboarding("guardian"))) {
          router.replace({ pathname: "/onboarding", params: { audience: "guardian", next: target } });
          return;
        }

        router.replace(target);
        return;
      }

      setLocalError(
        "SafeTrack could not determine the access role for this account."
      );
    } catch {
      /*
        authStore stores a safe user-facing message in state.error.
      */
    }
  };

  const displayError = localError ?? authError;
  const needsVerification = Boolean(displayError && /confirm your email/i.test(displayError));

  const resend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) {
      setLocalError("Enter your email address to resend the confirmation link.");
      return;
    }
    setResendState("sending");
    try {
      await resendVerificationEmail(normalizedEmail);
      setResendState("sent");
    } catch (reason) {
      setResendState("idle");
      setLocalError(reason instanceof Error ? reason.message : "The confirmation email could not be sent.");
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see where your child is."
      footer={
        <>
          <View style={styles.footerRow}>
            <Text variant="label" weight="500" tone="ink2">
              New to SafeTrack?{" "}
            </Text>
            <Link href="/(auth)/register" accessibilityRole="link">
              <Text variant="label" tone="primary" weight="800">
                Create account
              </Text>
            </Link>
          </View>
          <View style={styles.securityLine}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
            <Text variant="caption">Your account and safety records are protected.</Text>
          </View>
        </>
      }
    >
      <Field
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setLocalError(null);
        }}
        placeholder="Email address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <View style={styles.passwordBlock}>
        <Field
          label="Password"
          icon="lock-closed-outline"
          secure
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setLocalError(null);
          }}
          placeholder="Password"
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={() => void signIn()}
          returnKeyType="go"
        />
        <Link href="/(auth)/forgot-password" accessibilityRole="link" style={styles.forgotLink}>
          <Text variant="label" tone="primary" weight="800">
            Forgot password?
          </Text>
        </Link>
      </View>

      {notice && !displayError ? <Notice tone="success">{notice}</Notice> : null}

      {displayError ? <Notice tone="error">{displayError}</Notice> : null}

      {needsVerification ? (
        <Button
          variant="secondary"
          icon="mail-outline"
          disabled={resendState !== "idle"}
          onPress={() => void resend()}
          label={
            resendState === "sent"
              ? "Confirmation email sent. Check your inbox."
              : resendState === "sending"
                ? "Sending…"
                : "Resend confirmation email"
          }
        />
      ) : null}

      <Button
        label={isLoading ? "Signing in…" : "Sign in"}
        size="lg"
        iconRight="arrow-forward"
        loading={isLoading}
        onPress={() => void signIn()}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text variant="legend">or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Button
        variant="forest"
        icon="phone-portrait-outline"
        label="I'm a child: link this phone"
        onPress={() => router.push("/(auth)/child-device-link")}
      />
    </AuthShell>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    passwordBlock: { gap: space.sm },
    forgotLink: { alignSelf: "flex-end", paddingVertical: space.xs },
    divider: { flexDirection: "row", alignItems: "center", gap: space.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.rule },
    footerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
    securityLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  }),
);
