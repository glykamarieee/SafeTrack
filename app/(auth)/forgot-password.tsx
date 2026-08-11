import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Logo } from "../../components/common/Logo";
import { Button } from "../../components/common/Button";
import { AuthInput } from "../../components/auth/AuthInput";
import { sendPasswordReset } from "../../services/supabaseAuthService";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordScreen() {
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

      setSuccessMessage(
        "If an account exists for that email, a reset link has been sent."
      );
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Could not send reset email."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandArea}>
            <Logo size={90} />
          </View>

          <View style={styles.headerArea}>
          

            <Text style={styles.title}>Reset your password</Text>

            <Text style={styles.subtitle}>
              Enter your email and we&apos;ll send you a link to reset{"\n"}
              your password.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <View>
                <Text style={styles.formTitle}>Email verification</Text>
                <Text style={styles.formSubtitle}>
                  Use the email linked to your SafeTrack account.
                </Text>
              </View>

              <View style={styles.securePill}>
                <Ionicons name="lock-closed-outline" size={13} color="#168A52" />
                <Text style={styles.secureText}>Secure</Text>
              </View>
            </View>

            <AuthInput
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              errorText={errorText}
              placeholder="you@example.com"
            />

            {successMessage ? (
              <View style={styles.successBanner}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#168A52"
                />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <Button
              label="Send Reset Link"
              onPress={handleSubmit}
              loading={isLoading}
              style={styles.submitButton}
            />
          </View>

          <Link href="/(auth)/login" style={styles.backLink}>
            Back to Login
          </Link>

          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed-outline" size={13} color="#7A8A82" />
            <Text style={styles.privacyText}>
              Your reset request is handled securely.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FBF7",
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 38,
  },

  brandArea: {
    alignItems: "center",
  },

  headerArea: {
    marginTop: 25,
    alignItems: "center",
  },

  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: "#E5F8EC",
    alignItems: "center",
    justifyContent: "center",
  },

  kicker: {
    marginTop: 18,
    color: "#168A52",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  title: {
    marginTop: 9,
    color: "#0C2518",
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 8,
    color: "#738179",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  formCard: {
    marginTop: 25,
    padding: 18,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCECE2",
    shadowColor: "#0C5A35",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },

  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },

  formTitle: {
    color: "#10291C",
    fontSize: 16,
    fontWeight: "900",
  },

  formSubtitle: {
    marginTop: 3,
    color: "#7A8A82",
    fontSize: 11,
    lineHeight: 16,
    maxWidth: 190,
  },

  securePill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EAF8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  secureText: {
    color: "#168A52",
    fontSize: 10,
    fontWeight: "800",
  },

  successBanner: {
    marginTop: 4,
    marginBottom: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#E9F8EF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  successText: {
    flex: 1,
    color: "#168A52",
    fontSize: 12,
    lineHeight: 17,
  },

  submitButton: {
    marginTop: 2,
  },

  backLink: {
    marginTop: 24,
    color: "#168A52",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  privacyNote: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  privacyText: {
    color: "#7A8A82",
    fontSize: 11,
  },
});