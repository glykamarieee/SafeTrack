
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { useAuthStore } from "../../store/authStore";
import { createGuardianChildMobileLinkCode } from "../../services/childMobileService";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function formatExpiry(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildMobileLinkScreen() {
  const router = useRouter();
  const children = useAuthStore((state) => state.linkedChildren);
  const child = children[0];

  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const trackingSource = String(child?.trackingSource ?? "")
    .trim()
    .toLowerCase();

  const canUseMobile = trackingSource === "mobile" || trackingSource === "both";

  const generateCode = async () => {
    if (!child) {
      Alert.alert(
        "No child profile",
        "Register a child profile before connecting a child phone."
      );
      router.replace("/(auth)/child-registration" as never);
      return;
    }

    if (!canUseMobile) {
      Alert.alert(
        "Child phone access unavailable",
        "Update the child tracking source to Mobile or Both before connecting a child phone."
      );
      return;
    }

    setLoading(true);

    try {
      const result = await createGuardianChildMobileLinkCode(child.id);
      setLinkCode(result.linkCode);
      setExpiresAt(result.expiresAt);
    } catch (error) {
      Alert.alert(
        "Unable to create child device code",
        error instanceof Error
          ? error.message
          : "SafeTrack could not create the temporary child device code."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SafeTrackBackButton fallbackHref="/(app)/home" />

        <Text style={styles.eyebrow}>CHILD MOBILE ACCESS</Text>
        <Text style={styles.title}>Connect child phone</Text>
        <Text style={styles.subtitle}>
          Create a temporary device connection code for the registered child
          phone.
        </Text>

        <View style={styles.childCard}>
          <View style={styles.childAvatar}>
            <Text style={styles.childInitial}>
              {(child?.fullName ?? "C").charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.childCopy}>
            <Text style={styles.childLabel}>REGISTERED CHILD</Text>
            <Text style={styles.childName}>
              {child?.fullName ?? "No child registered"}
            </Text>
            <Text style={styles.childSource}>
              Tracking source: {child?.trackingSource ?? "Not available"}
            </Text>
          </View>

          <Ionicons
            name="phone-portrait-outline"
            size={26}
            color={colors.primary}
          />
        </View>

        {!canUseMobile ? (
          <View style={styles.warning}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#A56A18"
            />
            <Text style={styles.warningText}>
              Child Mobile Access requires the child tracking source to be
              Mobile or Both. Update the child profile first.
            </Text>
          </View>
        ) : (
          <View style={styles.codeCard}>
            <View style={styles.codeHeader}>
              <View style={styles.codeHeaderCopy}>
                <Text style={styles.codeTitle}>Temporary connection code</Text>
                <Text style={styles.codeDescription}>
                  Give this code to the child and enter it only on the child
                  phone.
                </Text>
              </View>

              <View style={styles.keyIcon}>
                <Ionicons name="key-outline" size={23} color={colors.primary} />
              </View>
            </View>

            {linkCode ? (
              <>
                <View style={styles.codeBox}>
                  <Text style={styles.codeValue}>{linkCode}</Text>
                </View>
                <Text style={styles.expiryText}>
                  Expires at {formatExpiry(expiresAt)}. Generate a new code
                  when it expires.
                </Text>
              </>
            ) : (
              <View style={styles.emptyCode}>
                <Ionicons
                  name="lock-closed-outline"
                  size={31}
                  color={colors.muted}
                />
                <Text style={styles.emptyCodeText}>
                  No active child phone code yet.
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => void generateCode()}
              disabled={loading}
              style={({ pressed }) => [
                styles.generateButton,
                (pressed || loading) && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={22}
                  color={colors.white}
                />
              )}
              <Text style={styles.generateButtonText}>
                {linkCode ? "Generate new connection code" : "Generate connection code"}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How to connect the child phone</Text>

          <Step
            value="1"
            label="Generate the temporary connection code on this Guardian account."
          />
          <Step
            value="2"
            label="Open SafeTrack on the child's phone and select Child Device Access."
          />
          <Step
            value="3"
            label="Enter the code before it expires to open the Child Dashboard."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{value}</Text>
      </View>
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 42,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginTop: 22,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 23,
    ...shadow.soft,
  },
  childAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  childInitial: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "900",
  },
  childCopy: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },
  childLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  childName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  childSource: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 15,
    borderRadius: radius.md,
    backgroundColor: "#FFF5E5",
    marginTop: 15,
  },
  warningText: {
    flex: 1,
    color: "#906019",
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 8,
  },
  codeCard: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 15,
    ...shadow.card,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  codeHeaderCopy: {
    flex: 1,
    marginRight: 12,
  },
  codeTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  codeDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  keyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  emptyCode: {
    alignItems: "center",
    paddingVertical: 34,
  },
  emptyCodeText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
  },
  codeBox: {
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.softMint,
    marginTop: 17,
  },
  codeValue: {
    color: colors.primaryDark,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 5,
  },
  expiryText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 9,
  },
  generateButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 17,
  },
  generateButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
  },
  stepsCard: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 16,
    ...shadow.soft,
  },
  stepsTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 13,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  stepNumberText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  stepText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
