import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Logo } from "../../components/common/Logo";
import { Button } from "../../components/common/Button";
import { AuthInput } from "../../components/auth/AuthInput";
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandArea}>
            <Logo size={80} />
          </View>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>For your SafeTrack account.</Text>

          <View style={styles.formCard}>
            {stage === "checking" ? (
              <View style={styles.center}>
                <ActivityIndicator color="#168A52" />
                <Text style={styles.muted}>Checking your reset link…</Text>
              </View>
            ) : stage === "invalid" ? (
              <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={28} color="#B3261E" />
                <Text style={styles.errorText}>{problem}</Text>
                <Link href="/(auth)/forgot-password" style={styles.link}>
                  Request a new reset link
                </Link>
              </View>
            ) : (
              <>
                <AuthInput
                  label="New password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                />
                <AuthInput
                  label="Confirm new password"
                  icon="shield-checkmark-outline"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  errorText={problem ?? undefined}
                />
                <Button label="Save new password" onPress={save} loading={stage === "saving"} />
              </>
            )}
          </View>

          <Link href="/(auth)/login" style={styles.link}>
            Back to Login
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FBF7" },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 38, width: "100%", maxWidth: 480, alignSelf: "center" },
  brandArea: { alignItems: "center" },
  title: { marginTop: 20, color: "#0C2518", fontSize: 26, fontWeight: "900", textAlign: "center" },
  subtitle: { marginTop: 6, color: "#738179", fontSize: 14, textAlign: "center" },
  formCard: {
    marginTop: 22,
    padding: 18,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCECE2",
  },
  center: { alignItems: "center", gap: 10, paddingVertical: 10 },
  muted: { color: "#7A8A82", fontSize: 13 },
  errorText: { color: "#B3261E", fontSize: 13, lineHeight: 18, textAlign: "center" },
  link: { marginTop: 22, color: "#168A52", fontSize: 14, fontWeight: "900", textAlign: "center" },
});
