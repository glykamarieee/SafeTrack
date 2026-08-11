import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export default function LoginScreen() {
  const router = useRouter();

  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState("");
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
        router.replace(
          linkedChildren.length
            ? "/(app)/home"
            : "/(auth)/child-registration"
        );

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require("../../assets/images/logo-black.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.accessPill}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={colors.primaryDark}
            />
            <Text style={styles.accessText}>SAFETRACK ACCESS</Text>
          </View>

          <Text style={styles.heading}>Welcome back</Text>

          <Text style={styles.subtitle}>
            Log in using your Guardian or Administrator account.
          </Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardTitle}>Sign in securely</Text>

                <Text style={styles.cardSubtitle}>
                  Enter your SafeTrack account details.
                </Text>
              </View>

              <View style={styles.protectedPill}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={colors.primaryDark}
                />
                <Text style={styles.protectedText}>Protected</Text>
              </View>
            </View>

            <Text style={styles.label}>Email</Text>

            <View style={styles.inputShell}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.primary}
              />

              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setLocalError(null);
                }}
                placeholder="Email address"
                placeholderTextColor="#97A49E"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Password</Text>

            <View style={styles.inputShell}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.primary}
              />

              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setLocalError(null);
                }}
                placeholder="Password"
                placeholderTextColor="#97A49E"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={21}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            <Link
              href="/(auth)/forgot-password"
              style={styles.forgotLink}
            >
              Forgot password?
            </Link>

            {displayError ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={21}
                  color={colors.danger}
                />

                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isLoading}
              onPress={() => void signIn()}
              style={({ pressed }) => [
                styles.loginButton,
                (pressed || isLoading) && styles.pressed,
                isLoading && styles.disabled,
              ]}
            >
              {isLoading ? (
                <Text style={styles.loginButtonText}>Signing in...</Text>
              ) : (
                <>
                  <Ionicons
                    name="log-in-outline"
                    size={19}
                    color={colors.white}
                  />

                  <Text style={styles.loginButtonText}>Log in</Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color={colors.white}
                    style={styles.loginArrow}
                  />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to SafeTrack? </Text>

            <Link
              href="/(auth)/register"
              style={styles.footerLink}
            >
              Create an account
            </Link>
          </View>

          <Pressable
            onPress={() => router.push("/(auth)/child-device-link")}
            style={({ pressed }) => [
              styles.childAccessLink,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={15}
              color={colors.primaryDark}
            />

            <Text style={styles.childAccessText}>
              Using a child&apos;s phone? Link child device
            </Text>
          </Pressable>

          <View style={styles.securityLine}>
            <Ionicons
              name="lock-closed-outline"
              size={13}
              color={colors.muted}
            />

            <Text style={styles.securityText}>
              Your account and safety records are protected.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flex: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 25,
    paddingBottom: 34,
  },

  logo: {
    width: 114,
    height: 102,
    marginTop: 2,
  },

  accessPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 7,
  },

  accessText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginLeft: 6,
  },

  heading: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 25,
  },

  subtitle: {
    maxWidth: 315,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },

  card: {
    width: "100%",
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginTop: 28,
    ...shadow.card,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 17,
  },

  cardHeaderCopy: {
    flex: 1,
    marginRight: 10,
  },

  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: colors.muted,
    fontSize: 11.5,
    marginTop: 3,
  },

  protectedPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },

  protectedText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
  },

  label: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
    marginTop: 5,
    marginBottom: 7,
  },

  inputShell: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "600",
    paddingVertical: 11,
    marginLeft: 11,
  },

  forgotLink: {
    alignSelf: "flex-end",
    color: colors.primaryDark,
    fontSize: 12.5,
    fontWeight: "900",
    marginTop: 13,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    marginTop: 15,
  },

  errorText: {
    flex: 1,
    color: "#A94747",
    fontSize: 12.5,
    lineHeight: 18,
    marginLeft: 8,
  },

  loginButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 18,
    ...shadow.soft,
  },

  loginButtonText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: "900",
    marginLeft: 7,
  },

  loginArrow: {
    position: "absolute",
    right: 19,
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  footerText: {
    color: colors.muted,
    fontSize: 12,
  },

  footerLink: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  childAccessLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },

  childAccessText: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "900",
    marginLeft: 6,
  },

  securityLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
  },

  securityText: {
    color: colors.muted,
    fontSize: 10.5,
    marginLeft: 6,
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.6,
  },
});