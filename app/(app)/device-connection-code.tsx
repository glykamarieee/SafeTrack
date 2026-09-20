import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { generateWatchConnectionCode, type WatchConnectionCode } from "../../services/watchPairingService";

const C = {
  background: "#F4F7F5",
  card: "#FFFFFF",
  ink: "#122019",
  muted: "#6E7D75",
  green: "#2F8F62",
  greenDark: "#176343",
  mint: "#E8F5EE",
  border: "#DDE7E1",
  danger: "#B84A4A",
};

export default function DeviceConnectionCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ watchId?: string }>();
  const watchId = String(params.watchId ?? "").trim().toUpperCase();
  const [result, setResult] = useState<WatchConnectionCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!watchId) {
      setError("No Watch ID was provided.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await generateWatchConnectionCode({ watchId }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate code.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void generate();
  }, [watchId]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <Ionicons name="watch-outline" size={31} color={C.green} />
        </View>

        <Text style={styles.eyebrow}>CHILD DEVICE CONNECTION</Text>
        <Text style={styles.title}>Connect the smartwatch</Text>
        <Text style={styles.subtitle}>
          Enter this one-time code in the SafeTrack app on the child’s Galaxy Watch8.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>WATCH ID</Text>
          <Text style={styles.watchId}>{result?.watchId ?? watchId}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>CONNECTION CODE</Text>
          <Text style={styles.code}>{result?.connectionCode ?? (loading ? "••••••" : "------")}</Text>
          {result?.expiresAt ? (
            <Text style={styles.expiry}>
              Valid until {new Date(result.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={19} color={C.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable disabled={loading} onPress={() => void generate()} style={styles.primary}>
          <Ionicons name="refresh-outline" size={19} color="#FFFFFF" />
          <Text style={styles.primaryText}>{loading ? "Generating..." : "Generate New Code"}</Text>
        </Pressable>

        <Text style={styles.note}>
          The code is used only for device verification. After successful pairing, the watch stores its secure device session and opens the Child Dashboard normally.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, padding: 22, justifyContent: "center" },
  back: { position: "absolute", top: 20, left: 20, flexDirection: "row", alignItems: "center" },
  backText: { color: C.ink, fontWeight: "800", marginLeft: 4 },
  iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  eyebrow: { marginTop: 18, textAlign: "center", color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { marginTop: 6, textAlign: "center", color: C.ink, fontSize: 27, fontWeight: "900" },
  subtitle: { marginTop: 8, textAlign: "center", color: C.muted, lineHeight: 20, fontSize: 13 },
  card: { marginTop: 24, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center" },
  label: { color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  watchId: { color: C.ink, fontSize: 14, fontWeight: "900", marginTop: 6 },
  divider: { width: "100%", height: 1, backgroundColor: C.border, marginVertical: 18 },
  code: { color: C.greenDark, fontSize: 40, fontWeight: "900", letterSpacing: 7, marginTop: 8 },
  expiry: { color: C.muted, fontSize: 11, fontWeight: "700", marginTop: 8 },
  errorBox: { marginTop: 14, backgroundColor: "#FCEEEE", padding: 12, borderRadius: 14, flexDirection: "row", alignItems: "flex-start" },
  errorText: { color: C.danger, flex: 1, marginLeft: 8, lineHeight: 18 },
  primary: { marginTop: 16, minHeight: 52, borderRadius: 26, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "900", marginLeft: 7 },
  note: { color: C.muted, fontSize: 10.5, lineHeight: 16, textAlign: "center", marginTop: 14 },
});
