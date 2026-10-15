import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
import { HoldRing } from "../../components/ui/HoldRing";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";
import {
  childColors as colors,
  childRadius as radius,
  childSpacing as spacing,
} from "../../constants/childDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { childPalette } from "../../theme/legacy";

const COUNTDOWN_SECONDS = 5;
const REALERT_INTERVAL_MS = 60_000;

function formatTime(value?: string | null) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildSosScreen() {
  const styles = useStyles();
  const { colors: theme } = useTheme();
  const colors = childPalette(theme);

  const activeSos = useChildMobileStore((state) => state.activeSos);
  const isLoading = useChildMobileStore((state) => state.isLoading);
  const triggerSos = useChildMobileStore((state) => state.triggerSos);
  const refreshActiveSos = useChildMobileStore((state) => state.refreshActiveSos);
  const recordRealert = useChildMobileStore((state) => state.recordRealert);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const cancelCountdown = useCallback(
    (showAlert = true) => {
      if (countdownRef.current === null || sending) return;
      setCountdown(null);
      if (showAlert) {
        Alert.alert("SOS Cancelled", "The SOS request was cancelled.");
      }
    },
    [sending]
  );

  const sendSos = useCallback(async () => {
    if (sending) return;
    try {
      setSending(true);
      await triggerSos();
      Alert.alert("SOS Sent", "Your Guardian has received the emergency alert.");
    } catch (error) {
      Alert.alert(
        "SOS Failed",
        error instanceof Error ? error.message : "Unable to send SOS."
      );
    } finally {
      setSending(false);
    }
  }, [sending, triggerSos]);

  useEffect(() => {
    if (countdown === null) return;
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
    const timer = setInterval(() => {
      void refreshActiveSos();
    }, 15000);
    return () => clearInterval(timer);
  }, [refreshActiveSos]);

  useEffect(() => {
    if (!activeSos || activeSos.status !== "active") return;
    const timer = setInterval(() => {
      void recordRealert(activeSos.id);
    }, REALERT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeSos, recordRealert]);

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

  const sosActive = activeSos?.status === "active";
  const isCounting = countdown !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>EMERGENCY HELP</Text>
        <Text style={styles.title}>{sosActive ? "Help request sent" : "SOS"}</Text>
        <Text style={styles.subtitle}>
          {sosActive
            ? "Your Guardian has been notified. Keep this screen open if you can."
            : "Press and keep holding the SOS control until the countdown reaches zero."}
        </Text>

        {sosActive ? (
          <View style={styles.activeStage}>
            <View style={styles.activeIcon}>
              <Ionicons name="warning" size={38} color={colors.white} />
            </View>
            <Text style={styles.activeKicker}>SOS ACTIVE</Text>
            <Text style={styles.activeTitle}>Guardian notified</Text>
            <Text style={styles.activeBody}>
              SafeTrack will continue its configured re-alert process while this SOS remains active.
            </Text>

            <View style={styles.activeFacts}>
              <Fact label="SENT" value={formatTime(activeSos?.triggeredAt)} />
              <View style={styles.activeDivider} />
              <Fact label="RE-ALERTS" value={String(activeSos?.realertCount ?? 0)} />
            </View>
          </View>
        ) : (
          <View style={styles.sosStage}>
            <Text style={styles.stageKicker}>{isCounting ? "KEEP HOLDING" : "READY WHEN NEEDED"}</Text>

            <HoldRing
              running={isCounting}
              durationMs={COUNTDOWN_SECONDS * 1000}
              color={theme.danger}
              trackColor={theme.dangerTint}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hold to send SOS alert"
                accessibilityHint="Keep holding for 5 seconds. Lift your finger to stop."
                onPressIn={beginCountdown}
                onPressOut={() => {
                  if (countdownRef.current !== null) cancelCountdown(false);
                }}
                style={({ pressed }) => [styles.holdButton, isCounting && styles.holdButtonCounting, pressed && styles.holdButtonPressed]}
              >
                {sending ? (
                  <ActivityIndicator color={theme.onDanger} size="large" />
                ) : isCounting ? (
                  <Text style={styles.countdownText}>{countdown}</Text>
                ) : (
                  <>
                    <Text style={styles.sosLabel}>SOS</Text>
                    <Text style={styles.sosHint}>HOLD</Text>
                  </>
                )}
              </Pressable>
            </HoldRing>

            <Text style={styles.holdTitle}>
              {sending ? "Sending SOS..." : isCounting ? `Sending in ${countdown}` : "Press and hold"}
            </Text>
            <Text style={styles.holdHelper}>
              {isCounting
                ? "Keep holding. Lift your finger to stop."
                : "Holding starts a 5-second countdown to help prevent accidental alerts."}
            </Text>

            {isCounting ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => cancelCountdown(true)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={19} color={theme.danger} />
                <Text style={styles.cancelText}>Cancel SOS</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.guidance}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.brandDeep} />
          <View style={styles.flex}>
            <Text style={styles.guidanceTitle}>What happens after SOS is sent?</Text>
            <Text style={styles.guidanceText}>
              SafeTrack records the SOS and notifies your linked Guardian using the existing alert process. It does not automatically contact emergency services.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const styles = useStyles();

  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = childPalette(__c);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 116,
  },
  flex: { flex: 1 },
  eyebrow: { color: colors.danger, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 7 },
  sosStage: {
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 8,
    gap: 4,
  },
  stageKicker: { color: colors.dangerDeep, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginBottom: 14 },
  holdButton: {
    width: 184,
    height: 184,
    borderRadius: 92,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    shadowColor: __c.danger,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  holdButtonCounting: { transform: [{ scale: 0.95 }] },
  holdButtonPressed: { transform: [{ scale: 0.95 }] },
  sosLabel: { color: __c.onDanger, fontSize: 46, fontWeight: "800", letterSpacing: 1 },
  sosHint: { color: __c.onDanger, opacity: 0.85, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  countdownText: { color: __c.onDanger, fontSize: 72, fontWeight: "800", letterSpacing: -2 },
  holdTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 20 },
  holdHelper: { color: colors.muted, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 7, maxWidth: 320 },
  cancelButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: __c.danger,
    backgroundColor: colors.surface,
    marginTop: 18,
  },
  cancelText: { color: colors.dangerDeep, fontSize: 12.5, fontWeight: "900", marginLeft: 6 },
  activeStage: {
    marginTop: 28,
    padding: 24,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerDeep,
  },
  activeIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  activeKicker: { color: "rgba(255,255,255,0.78)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2, marginTop: 22 },
  activeTitle: { color: colors.white, fontSize: 26, fontWeight: "900", marginTop: 4 },
  activeBody: { color: "rgba(255,255,255,0.84)", fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  activeFacts: {
    flexDirection: "row",
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  fact: { flex: 1 },
  factLabel: { color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  factValue: { color: colors.white, fontSize: 12.5, fontWeight: "900", marginTop: 4 },
  activeDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 16 },
  guidance: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  guidanceTitle: { color: colors.text, fontSize: 12.5, fontWeight: "900", marginLeft: 10 },
  guidanceText: { color: colors.muted, fontSize: 10.5, lineHeight: 16, marginLeft: 10, marginTop: 3 },
  pressed: { opacity: 0.72 },
});
});
