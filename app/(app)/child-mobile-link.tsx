import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { SafeTrackBackButton } from "../../components/common/SafeTrackBackButton";
import { useAuthStore } from "../../store/authStore";
import {
  createGuardianChildMobileLinkCode,
} from "../../services/childMobileService";
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

  /*
   * IMPORTANT:
   * GuardianHome passes:
   *
   * /child-mobile-link?childId=<selected-child-id>
   *
   * We read that exact child ID here.
   */
  const params = useLocalSearchParams<{
    childId?: string | string[];
  }>();

  const selectedChildId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;

  const children = useAuthStore(
    (state) => state.linkedChildren
  );

  /*
   * Find the exact child selected from GuardianHome.
   *
   * DO NOT use children[0].
   */
  const child = children.find(
    (item) => item.id === selectedChildId
  );

  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  /*
   * If the selected child changes, clear the previous
   * connection code.
   *
   * This prevents Wilcom's old code from remaining visible
   * when Nyep is selected.
   */
  useEffect(() => {
    setLinkCode(null);
    setExpiresAt(null);
  }, [selectedChildId]);

  const trackingSource = String(
    child?.trackingSource ?? ""
  )
    .trim()
    .toLowerCase();

  const canUseMobile =
    trackingSource === "mobile" ||
    trackingSource === "both";

  const generateCode = async () => {
    /*
     * We require a specific child ID.
     *
     * If this screen was opened without childId,
     * we intentionally do NOT fall back to children[0].
     */
    if (!selectedChildId) {
      Alert.alert(
        "Child not selected",
        "Please return to the Guardian dashboard and select the child you want to connect."
      );
      return;
    }

    if (!child) {
      Alert.alert(
        "Child profile not found",
        "The selected child profile could not be found. Please return to the Guardian dashboard and select the child again."
      );
      return;
    }

    if (!canUseMobile) {
      Alert.alert(
        "Child phone access unavailable",
        "Update this child's tracking source to Mobile or Both before connecting a child phone."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * CRITICAL:
       *
       * Use child.id from the selected child.
       *
       * For Wilcom:
       * create_child_mobile_link_code(Wilcom UUID)
       *
       * For Nyep:
       * create_child_mobile_link_code(Nyep UUID)
       */
      const result =
        await createGuardianChildMobileLinkCode(
          child.id
        );

      /*
       * Verify that the backend returned the same child
       * that the user selected.
       *
       * This protects against accidentally displaying
       * a code belonging to another child.
       */
      if (result.childId !== child.id) {
        throw new Error(
          "SafeTrack returned a connection code for a different child profile. No code was displayed."
        );
      }

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

  /*
   * No child ID was supplied.
   */
  if (!selectedChildId) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right"]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <SafeTrackBackButton fallbackHref="/(app)/home" />

          <Text style={styles.eyebrow}>
            CHILD MOBILE ACCESS
          </Text>

          <Text style={styles.title}>
            Child not selected
          </Text>

          <Text style={styles.subtitle}>
            Please return to the Guardian dashboard and
            select a specific child before creating a
            connection code.
          </Text>

          <Pressable
            onPress={() => router.replace("/(app)/home")}
            style={({ pressed }) => [
              styles.generateButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="arrow-back-outline"
              size={22}
              color={colors.white}
            />

            <Text style={styles.generateButtonText}>
              Return to Guardian dashboard
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
   * Selected child ID exists, but the child is not in
   * the current Guardian store.
   */
  if (!child) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right"]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <SafeTrackBackButton fallbackHref="/(app)/home" />

          <Text style={styles.eyebrow}>
            CHILD MOBILE ACCESS
          </Text>

          <Text style={styles.title}>
            Child profile unavailable
          </Text>

          <Text style={styles.subtitle}>
            The selected child could not be loaded from
            the current Guardian account. Please return
            and select the child again.
          </Text>

          <Pressable
            onPress={() => router.replace("/(app)/home")}
            style={({ pressed }) => [
              styles.generateButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="arrow-back-outline"
              size={22}
              color={colors.white}
            />

            <Text style={styles.generateButtonText}>
              Return to Guardian dashboard
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SafeTrackBackButton fallbackHref="/(app)/home" />

        <Text style={styles.eyebrow}>
          CHILD MOBILE ACCESS
        </Text>

        <Text style={styles.title}>
          Connect child phone
        </Text>

        <Text style={styles.subtitle}>
          Create a temporary device connection code for
          the selected child phone.
        </Text>

        {/* SELECTED CHILD */}

        <View style={styles.childCard}>
          <View style={styles.childAvatar}>
            <Text style={styles.childInitial}>
              {child.fullName
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.childCopy}>
            <Text style={styles.childLabel}>
              SELECTED CHILD
            </Text>

            <Text style={styles.childName}>
              {child.fullName}
            </Text>

            <Text style={styles.childSource}>
              Tracking source:{" "}
              {child.trackingSource ??
                "Not available"}
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
              Child Mobile Access requires this child's
              tracking source to be Mobile or Both.
              Update the child profile first.
            </Text>
          </View>
        ) : (
          <View style={styles.codeCard}>
            <View style={styles.codeHeader}>
              <View style={styles.codeHeaderCopy}>
                <Text style={styles.codeTitle}>
                  Temporary connection code
                </Text>

                <Text style={styles.codeDescription}>
                  Give this code to{" "}
                  <Text style={styles.boldChildName}>
                    {child.fullName}
                  </Text>{" "}
                  and enter it only on the child's phone.
                </Text>
              </View>

              <View style={styles.keyIcon}>
                <Ionicons
                  name="key-outline"
                  size={23}
                  color={colors.primary}
                />
              </View>
            </View>

            {linkCode ? (
              <>
                <View style={styles.codeBox}>
                  <Text style={styles.codeValue}>
                    {linkCode}
                  </Text>
                </View>

                <Text style={styles.expiryText}>
                  Expires at{" "}
                  {formatExpiry(expiresAt)}.
                  Generate a new code when it expires.
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
                (pressed || loading) &&
                  styles.pressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.white}
                />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={22}
                  color={colors.white}
                />
              )}

              <Text
                style={styles.generateButtonText}
              >
                {linkCode
                  ? "Generate new connection code"
                  : "Generate connection code"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* CONNECTION STEPS */}

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>
            How to connect {child.fullName}
            &apos;s phone
          </Text>

          <Step
            value="1"
            label={`Generate the temporary connection code for ${child.fullName} on this Guardian account.`}
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

        {/* SECURITY INFORMATION */}

        <View style={styles.securityInfo}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.primary}
          />

          <Text style={styles.securityInfoText}>
            This connection code belongs only to{" "}
            <Text style={styles.boldChildName}>
              {child.fullName}
            </Text>
            . Codes expire after 15 minutes and should
            not be shared with another child device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>
          {value}
        </Text>
      </View>

      <Text style={styles.stepText}>
        {label}
      </Text>
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

  boldChildName: {
    color: colors.primaryDark,
    fontWeight: "900",
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
    paddingHorizontal: 16,
  },

  generateButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
    textAlign: "center",
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

  securityInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 3,
    marginTop: 14,
  },

  securityInfoText: {
    flex: 1,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 16,
    marginLeft: 7,
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.6,
  },
});