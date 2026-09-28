import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { useChildMobileStore } from "../../store/childMobileStore";
import {
  childColors as colors,
  childRadius as radius,
  childShadow as shadow,
  childSpacing as spacing,
} from "../../constants/childDesign";

export default function ChildDeviceLinkScreen() {
  const router = useRouter();
  const linkDevice = useChildMobileStore((state) => state.linkDevice);
  const isLoading = useChildMobileStore((state) => state.isLoading);
  const storeError = useChildMobileStore((state) => state.error);
  const clearError = useChildMobileStore((state) => state.clearError);

  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const linkChildDevice = async () => {
    clearError();
    setLocalError(null);
    const normalizedCode = code.replace(/\D/g, "");

    if (!/^\d{6}$/.test(normalizedCode)) {
      setLocalError("Enter the six-digit child-device connection code provided by the Guardian.");
      return;
    }

    try {
      await linkDevice(normalizedCode);
      router.replace("/(child)/child-home" as Href);
    } catch (error) {
      Alert.alert(
        "Unable to link child phone",
        error instanceof Error ? error.message : "SafeTrack could not link this child phone."
      );
    }
  };

  const displayError = localError ?? storeError;

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
          <SafeTrackBackButton fallbackHref="/(auth)/login" />

          <View style={styles.heroMark}>
            <Ionicons name="phone-portrait-outline" size={30} color={colors.brandDeep} />
          </View>
          <Text style={styles.eyebrow}>CHILD DEVICE</Text>
          <Text style={styles.title}>Connect this phone</Text>
          <Text style={styles.subtitle}>
            Use the temporary code created by your Guardian to connect this phone to your SafeTrack child profile.
          </Text>

          <View style={styles.steps}>
            <Step number="1" text="Ask your Guardian to generate a Child Phone Connection Code." />
            <View style={styles.stepLine} />
            <Step number="2" text="Enter the six-digit code below before it expires." />
            <View style={styles.stepLine} />
            <Step number="3" text="After linking, this phone can share location, show safe-zone status, and use SOS." />
          </View>

          <View style={styles.codeSurface}>
            <Text style={styles.codeLabel}>CONNECTION CODE</Text>
            <TextInput
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, ""));
                setLocalError(null);
                clearError();
              }}
              placeholder="000000"
              placeholderTextColor="#A9B5AF"
              keyboardType="number-pad"
              autoCorrect={false}
              maxLength={6}
              style={styles.input}
              accessibilityLabel="Six-digit child device connection code"
            />
            <Text style={styles.codeHelper}>{code.length}/6 digits entered</Text>

            {displayError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={19} color={colors.dangerDeep} />
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => void linkChildDevice()}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
                isLoading && styles.disabled,
              ]}
            >
              <Ionicons name="link-outline" size={20} color={colors.white} />
              <Text style={styles.linkButtonText}>
                {isLoading ? "Connecting..." : "Connect child phone"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.brandDeep} />
            <Text style={styles.privacyText}>
              This screen links only the child phone. Guardian and Administrator accounts continue to use their own authenticated access.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 42,
  },
  heroMark: {
    width: 64,
    height: 64,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
    marginTop: 28,
  },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 22 },
  title: { color: colors.ink, fontSize: 33, fontWeight: "900", letterSpacing: -1, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  steps: { marginTop: 27 },
  step: { flexDirection: "row", alignItems: "center" },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandWash,
  },
  stepNumberText: { color: colors.brandDeep, fontSize: 12, fontWeight: "900" },
  stepText: { flex: 1, color: colors.text, fontSize: 11.5, lineHeight: 17, marginLeft: 11 },
  stepLine: { width: 1, height: 18, backgroundColor: colors.line, marginLeft: 17, marginVertical: 4 },
  codeSurface: {
    marginTop: 28,
    padding: 19,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.lift,
  },
  codeLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2 },
  input: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 9,
    textAlign: "center",
    paddingVertical: 18,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  codeHelper: { color: colors.muted, fontSize: 10.5, textAlign: "center", marginTop: 9 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, marginTop: 14 },
  errorText: { flex: 1, color: colors.dangerDeep, fontSize: 11, lineHeight: 16, marginLeft: 8 },
  linkButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.brandDeep,
    marginTop: 18,
  },
  linkButtonText: { color: colors.white, fontSize: 13.5, fontWeight: "900", marginLeft: 8 },
  privacyNote: { flexDirection: "row", alignItems: "flex-start", marginTop: 23, paddingTop: 17, borderTopWidth: 1, borderTopColor: colors.line },
  privacyText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16, marginLeft: 9 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.56 },
});
