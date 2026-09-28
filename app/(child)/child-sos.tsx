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
  childColors as colors,
  childRadius as radius,
  childSpacing as spacing,
} from "../../constants/childDesign";

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
          <View style={[styles.sosStage, isCounting && styles.sosStageCounting]}>
            <Text style={styles.stageKicker}>{isCounting ? "KEEP HOLDING" : "READY WHEN NEEDED"}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hold to send SOS alert"
              onPressIn={beginCountdown}
              onPressOut={() => {
                if (countdownRef.current !== null) cancelCountdown(false);
              }}
              style={({ pressed }) => [
                styles.holdButton,
                isCounting && styles.holdButtonCounting,
                pressed && styles.holdButtonPressed,
              ]}
            >
              {sending ? (
                <ActivityIndicator color={colors.white} size="large" />
              ) : isCounting ? (
                <Text style={styles.countdownText}>{countdown}</Text>
              ) : (
                <Ionicons name="hand-left-outline" size={42} color={colors.white} />
              )}
            </Pressable>

            <Text style={styles.holdTitle}>
              {sending
                ? "Sending SOS..."
                : isCounting
                  ? `Sending in ${countdown}`
                  : "Press and hold"}
            </Text>
            <Text style={styles.holdHelper}>
              {isCounting
                ? "Keep your finger down. Lift it to cancel."
                : "Holding starts a 5-second confirmation countdown to help prevent accidental alerts."}
            </Text>

            {isCounting ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => cancelCountdown(true)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={19} color={colors.dangerDeep} />
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
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 28,
    paddingVertical: 27,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sosStageCounting: { backgroundColor: colors.dangerSoft, borderColor: "#F5CACA" },
  stageKicker: { color: colors.dangerDeep, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2 },
  holdButton: {
    width: 142,
    height: 142,
    borderRadius: 71,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    marginTop: 20,
    borderWidth: 10,
    borderColor: "#F9D8D8",
  },
  holdButtonCounting: { backgroundColor: colors.dangerDeep, borderColor: "#F2BFC0" },
  holdButtonPressed: { transform: [{ scale: 0.98 }] },
  countdownText: { color: colors.white, fontSize: 50, fontWeight: "900", letterSpacing: -1.5 },
  holdTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 20 },
  holdHelper: { color: colors.muted, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 7, maxWidth: 320 },
  cancelButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: radius.pill,
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
