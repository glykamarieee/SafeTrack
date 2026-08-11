import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

const COUNTDOWN_SECONDS = 5;
const REALERT_INTERVAL_MS = 60_000;

function formatTime(value?: string | null) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildSosScreen() {
  const activeSos = useChildMobileStore(
    (state) => state.activeSos
  );

  const isLoading = useChildMobileStore(
    (state) => state.isLoading
  );

  const triggerSos = useChildMobileStore(
    (state) => state.triggerSos
  );

  const refreshActiveSos = useChildMobileStore(
    (state) => state.refreshActiveSos
  );

  const recordRealert = useChildMobileStore(
    (state) => state.recordRealert
  );

  const [countdown, setCountdown] = useState<number | null>(
    null
  );

  const [sending, setSending] = useState(false);

  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const cancelCountdown = useCallback(
    (showConfirmation = true) => {
      if (countdownRef.current === null || sending) {
        return;
      }

      setCountdown(null);

      if (showConfirmation) {
        Alert.alert(
          "SOS cancelled",
          "The SOS request was cancelled before the alert was sent."
        );
      }
    },
    [sending]
  );

  const sendSos = useCallback(async () => {
    if (sending) {
      return;
    }

    setSending(true);

    try {
      await triggerSos();

      Alert.alert(
        "SOS alert sent",
        "Your linked Guardian has received an SOS alert with your latest available location."
      );
    } catch (error) {
      Alert.alert(
        "Unable to send SOS",
        error instanceof Error
          ? error.message
          : "SafeTrack could not send the SOS alert."
      );
    } finally {
      setSending(false);
    }
  }, [sending, triggerSos]);

  /*
    This effect handles the countdown outside React rendering.
    It prevents the “Cannot update a component while rendering”
    error shown in your terminal.
  */
  useEffect(() => {
    if (countdown === null) {
      return;
    }

    const timer = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        void sendSos();
        return;
      }

      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, sendSos]);

  useEffect(() => {
    void refreshActiveSos();

    const interval = setInterval(() => {
      void refreshActiveSos();
    }, 15_000);

    return () => clearInterval(interval);
  }, [refreshActiveSos]);

  useEffect(() => {
    if (activeSos?.status !== "active") {
      return;
    }

    const interval = setInterval(() => {
      void recordRealert();
    }, REALERT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeSos?.id, activeSos?.status, recordRealert]);

  const beginCountdown = () => {
    if (
      activeSos?.status === "active" ||
      sending ||
      isLoading ||
      countdownRef.current !== null
    ) {
      return;
    }

    setCountdown(COUNTDOWN_SECONDS);
  };

  const sosIsActive = activeSos?.status === "active";

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>EMERGENCY ALERT</Text>

        <Text style={styles.heading}>SOS help</Text>

        <Text style={styles.subtitle}>
          Press and hold the SOS button. You can cancel only while the
          countdown is active.
        </Text>

        {sosIsActive ? (
          <View style={styles.activeCard}>
            <View style={styles.activeIcon}>
              <Ionicons
                name="warning-outline"
                size={32}
                color={colors.danger}
              />
            </View>

            <Text style={styles.activeTitle}>
              SOS alert is active
            </Text>

            <Text style={styles.activeText}>
              Your linked Guardian is being notified. SafeTrack keeps the
              SOS active until the Guardian acknowledges it.
            </Text>

            <View style={styles.activeDetails}>
              <View style={styles.activeDetailRow}>
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={colors.danger}
                />

                <Text style={styles.activeDetailText}>
                  Sent {formatTime(activeSos.triggeredAt)}
                </Text>
              </View>

              <View style={styles.activeDetailRow}>
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color={colors.danger}
                />

                <Text style={styles.activeDetailText}>
                  Re-alert count: {activeSos.realertCount}
                </Text>
              </View>
            </View>

            <Text style={styles.activeNote}>
              SOS cannot be cancelled after it has been sent.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sosCard}>
              <View style={styles.sosOuterCircle}>
                <View style={styles.sosInnerCircle}>
                  <Ionicons
                    name="warning-outline"
                    size={54}
                    color={colors.danger}
                  />
                </View>
              </View>

              <Text style={styles.sosTitle}>
                {countdown !== null
                  ? `Sending SOS in ${countdown}`
                  : "Press and hold for SOS"}
              </Text>

              <Text style={styles.sosText}>
                {countdown !== null
                  ? "Keep holding. Release or tap Cancel SOS before the countdown ends."
                  : "Use SOS only when you need urgent help from your linked Guardian."}
              </Text>

              <Pressable
                disabled={sending || isLoading}
                onPressIn={beginCountdown}
                onPressOut={() => {
                  if (countdownRef.current !== null) {
                    cancelCountdown(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.holdButton,
                  countdown !== null && styles.holdButtonActive,
                  (pressed || sending || isLoading) && styles.pressed,
                  (sending || isLoading) && styles.disabled,
                ]}
              >
                {sending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />
                ) : (
                  <Ionicons
                    name="hand-left-outline"
                    size={25}
                    color={colors.white}
                  />
                )}

                <Text style={styles.holdButtonText}>
                  {sending
                    ? "Sending SOS..."
                    : countdown !== null
                      ? `Hold for ${countdown}s`
                      : "Press and hold SOS"}
                </Text>
              </Pressable>

              {countdown !== null ? (
                <Pressable
                  onPress={() => cancelCountdown(true)}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={colors.danger}
                  />

                  <Text style={styles.cancelButtonText}>
                    Cancel SOS
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>
                How SOS works
              </Text>

              <View style={styles.instructionRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepText}>1</Text>
                </View>

                <Text style={styles.instructionText}>
                  Press and hold the SOS button to begin the five-second
                  countdown.
                </Text>
              </View>

              <View style={styles.instructionRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepText}>2</Text>
                </View>

                <Text style={styles.instructionText}>
                  Release the button or select Cancel SOS before the countdown
                  ends.
                </Text>
              </View>

              <View style={styles.instructionRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepText}>3</Text>
                </View>

                <Text style={styles.instructionText}>
                  SafeTrack sends the SOS alert and latest available location
                  to the linked Guardian.
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.note}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.muted}
          />

          <Text style={styles.noteText}>
            Smartwatch shake activation is handled by the registered
            smartwatch application. This screen provides the child phone
            tap-and-hold SOS function.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingTop: 40,
    paddingBottom: 120,
  },

  eyebrow: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  heading: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 5,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 7,
  },

  sosCard: {
    alignItems: "center",
    padding: 25,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    marginTop: 24,
    ...shadow.card,
  },

  sosOuterCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
  },

  sosInnerCircle: {
    width: 95,
    height: 95,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },

  sosTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 18,
  },

  sosText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },

  holdButton: {
    width: "100%",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    marginTop: 23,
  },

  holdButtonActive: {
    backgroundColor: "#B64040",
  },

  holdButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
  },

  cancelButton: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    marginTop: 12,
  },

  cancelButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 6,
  },

  activeCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#F4D0D0",
    backgroundColor: "#FFF9F9",
    marginTop: 24,
    ...shadow.soft,
  },

  activeIcon: {
    width: 74,
    height: 74,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },

  activeTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 14,
  },

  activeText: {
    color: "#9B5E5E",
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },

  activeDetails: {
    width: "100%",
    marginTop: 17,
  },

  activeDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#F5DCDC",
  },

  activeDetailText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 7,
  },

  activeNote: {
    color: "#9B5E5E",
    fontSize: 10.5,
    textAlign: "center",
    marginTop: 12,
  },

  instructionsCard: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 15,
    ...shadow.soft,
  },

  instructionsTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 11,
  },

  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
  },

  stepCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  stepText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },

  instructionText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginLeft: 9,
  },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 4,
    marginTop: 18,
  },

  noteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
    marginLeft: 7,
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.58,
  },
});