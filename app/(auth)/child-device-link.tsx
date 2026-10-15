import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { CodeInput } from "../../components/ui/CodeInput";
import { Notice } from "../../components/ui/Notice";
import { Steps } from "../../components/ui/Steps";
import { Text } from "../../components/ui/Text";
import { useChildMobileStore } from "../../store/childMobileStore";
import { hasSeenOnboarding } from "../../services/onboardingService";
import { useTheme } from "../../theme/ThemeProvider";

export default function ChildDeviceLinkScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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

      // A newly linked phone opens the child tour first.
      if (!(await hasSeenOnboarding("child"))) {
        router.replace({ pathname: "/onboarding", params: { audience: "child", next: "/(child)/child-home" } });
        return;
      }

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
    <AuthShell
      back
      compact
      eyebrow="Child phone"
      title="Link this phone"
      subtitle="Use the temporary code from your guardian to connect this phone to your SafeTrack profile."
      footer={
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
          <Text variant="caption" style={styles.privacyText}>
            This links only the child phone. Guardian and administrator accounts keep using their own sign-in.
          </Text>
        </View>
      }
    >
      <Steps
        steps={[
          { title: "Ask your guardian for a code", detail: "They create a Child Phone Connection Code in SafeTrack." },
          { title: "Enter the six digits below", detail: "Before the code expires." },
          { title: "You're connected", detail: "This phone can share location, show safe-zone status and send SOS." },
        ]}
      />

      <View style={styles.codeBlock}>
        <Text variant="legend">Connection code</Text>
        <CodeInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setLocalError(null);
            clearError();
          }}
          accessibilityLabel="Six-digit child device connection code"
          error={Boolean(displayError)}
        />
        <Text variant="caption" tabular>
          {code.length}/6 digits entered
        </Text>
      </View>

      {displayError ? <Notice tone="error">{displayError}</Notice> : null}

      <Button
        label={isLoading ? "Connecting…" : "Connect child phone"}
        icon="link-outline"
        size="lg"
        loading={isLoading}
        disabled={code.length !== 6}
        onPress={() => void linkChildDevice()}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  codeBlock: { gap: 10, alignItems: "center" },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8, maxWidth: 420 },
  privacyText: { flex: 1 },
});
