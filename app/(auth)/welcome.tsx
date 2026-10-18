import { Animated, Image, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { MapPattern } from "../../components/ui/MapPattern";
import { WatchIllustration } from "../../components/admin/WatchIllustration";
import { useEntrance } from "../../theme/motion";
import { space } from "../../theme/tokens";
import { useTheme } from "../../theme/ThemeProvider";

/** Wide screens (the web dashboard on a laptop) get their own layout. */
const WIDE_MIN = 960;

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  return width >= WIDE_MIN ? <WelcomeWide /> : <WelcomePhone />;
}

function WelcomePhone() {
  const player = useVideoPlayer(require("../../assets/videos/safetrack-intro.mp4"), (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  const logo = useEntrance(0, 0, 600);
  const copy = useEntrance(3, 24, 500);
  const actions = useEntrance(5, 24, 500);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="cover" />

      {/* A forest tint that deepens smoothly toward the bottom, where the text sits. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(13,42,30,0.35)", "rgba(13,42,30,0.25)", "rgba(13,42,30,0.75)", "rgba(13,42,30,0.95)"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <Animated.View style={[styles.logoArea, logo]}>
          <Image source={require("../../assets/images/logo.png")} resizeMode="contain" style={styles.logo} accessibilityLabel="SafeTrack logo" />
        </Animated.View>

        <View style={styles.bottomContent}>
          <Animated.View style={[styles.copy, copy]}>
            <Text variant="legend" style={styles.eyebrow}>
              Child safety, made calm
            </Text>
            <Text variant="display" style={styles.headline} accessibilityRole="header">
              Know where they are.{"\n"}Be there when it matters.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.actions, actions]}>
            <Button label="Get started" size="lg" iconRight="arrow-forward" onPress={() => router.push("/(auth)/register")} />
            <Button label="I already have an account" variant="glass" onPress={() => router.push("/(auth)/login")} style={styles.signIn} />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D2A1E" },
  safeArea: { flex: 1, justifyContent: "space-between", paddingHorizontal: space.xl, paddingBottom: space.xl },
  logoArea: { alignItems: "center", marginTop: space.lg },
  logo: { width: 220, height: 132 },
  bottomContent: { gap: space.xl, width: "100%", maxWidth: 520, alignSelf: "center" },
  copy: { gap: space.sm },
  eyebrow: { color: "#3DDC84" },
  headline: { color: "#FFFFFF" },
  actions: { gap: space.sm },
  signIn: { alignSelf: "stretch" },
});

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: "watch-outline", title: "Watch SOS", text: "Hold to send, with a countdown to cancel." },
  { icon: "shield-checkmark-outline", title: "Safe zones", text: "Know when they arrive and leave." },
  { icon: "map-outline", title: "Routes on real roads", text: "Replay the day, street by street." },
  { icon: "analytics-outline", title: "AI notices", text: "Unusual movement, flagged calmly." },
];

/**
 * Laptop and desktop: a forest brand panel (logo, headline, a product
 * preview, highlights) beside a clean sign-in card. Stretching the phone's
 * full-screen video across a wide window left it washed out with an empty
 * strip beside it.
 */
function WelcomeWide() {
  const { colors } = useTheme();
  // Shorter windows (e.g. 1280x800): the preview says enough; skip the cards.
  const { height } = useWindowDimensions();
  const roomy = height >= 860;
  const brand = useEntrance(0, 16, 600);
  const card = useEntrance(2, 24, 500);

  return (
    <View style={[wide.page, { backgroundColor: colors.paper }]}>
      <StatusBar style="light" />

      <LinearGradient colors={["#0D2A1E", "#123A28", "#15803D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={wide.brand}>
        <MapPattern opacity={0.07} />
        <View style={[wide.glow, wide.glowTop]} />
        <View style={[wide.glow, wide.glowBottom]} />

        <Animated.View style={[wide.brandInner, brand]}>
          <Image source={require("../../assets/images/logo.png")} resizeMode="contain" style={wide.logo} accessibilityLabel="SafeTrack logo" />

          <View style={wide.copy}>
            <Text variant="legend" style={wide.eyebrow}>
              Child safety, made calm
            </Text>
            <Text variant="display" style={wide.headline} accessibilityRole="header">
              Know where they are.{"\n"}Be there when it matters.
            </Text>
            <Text style={wide.lead}>
              A smartwatch and phone app that keep guardians informed with the latest location, safe zones, SOS alerts and gentle AI
              notices.
            </Text>
          </View>

          {/* Product preview: the watch and what the guardian sees. */}
          <View style={wide.preview}>
            <WatchIllustration size={150} />
            <View style={wide.previewCards}>
              <View style={wide.previewCard}>
                <View style={[wide.previewDot, { backgroundColor: "#3DDC84" }]} />
                <View style={wide.featureCopy}>
                  <Text weight="800" style={wide.previewTitle}>Inside School</Text>
                  <Text style={wide.previewText}>Safe zone · arrived 7:42 AM</Text>
                </View>
              </View>
              <View style={wide.previewCard}>
                <Ionicons name="location" size={16} color="#3DDC84" />
                <View style={wide.featureCopy}>
                  <Text weight="800" style={wide.previewTitle}>Latest location</Text>
                  <Text style={wide.previewText}>Updated 2 min ago</Text>
                </View>
              </View>
              <View style={wide.previewCard}>
                <Ionicons name="notifications" size={16} color="#FFD27A" />
                <View style={wide.featureCopy}>
                  <Text weight="800" style={wide.previewTitle}>No active SOS</Text>
                  <Text style={wide.previewText}>The watch sends one with a hold</Text>
                </View>
              </View>
            </View>
          </View>

          {roomy ? <View style={wide.features}>
            {FEATURES.map((feature) => (
              <View key={feature.title} style={wide.feature}>
                <View style={wide.featureIcon}>
                  <Ionicons name={feature.icon} size={18} color="#3DDC84" />
                </View>
                <View style={wide.featureCopy}>
                  <Text weight="800" style={wide.featureTitle}>
                    {feature.title}
                  </Text>
                  <Text style={wide.featureText}>{feature.text}</Text>
                </View>
              </View>
            ))}
          </View> : null}
        </Animated.View>
      </LinearGradient>

      <View style={wide.side}>
        <Animated.View style={[wide.sideInner, card]}>
          <Text variant="legend" style={{ color: colors.primary }}>
            Get started
          </Text>
          <Text variant="display" style={wide.sideTitle} accessibilityRole="header">
            Welcome to SafeTrack
          </Text>
          <Text tone="muted" style={wide.sideLead}>
            Set up in minutes: create your guardian account, then link your child&apos;s smartwatch or phone with a 6-digit code.
          </Text>

          <View style={wide.choices}>
            <Choice
              primary
              icon="person-add-outline"
              title="Create a guardian account"
              text="New to SafeTrack? Start here."
              onPress={() => router.push("/(auth)/register")}
            />
            <Choice
              icon="log-in-outline"
              title="I already have an account"
              text="Sign in as a guardian or administrator."
              onPress={() => router.push("/(auth)/login")}
            />
          </View>

          <View style={[wide.facts, { borderTopColor: colors.rule }]}>
            {[
              { icon: "watch-outline" as const, text: "Smartwatch or phone" },
              { icon: "shield-checkmark-outline" as const, text: "Safe zones and SOS" },
              { icon: "time-outline" as const, text: "Philippine time records" },
            ].map((fact) => (
              <View key={fact.text} style={wide.fact}>
                <Ionicons name={fact.icon} size={16} color={colors.primary} />
                <Text variant="label" tone="ink2">
                  {fact.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={wide.adminRow}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
            <Text variant="label" tone="muted" style={wide.flex}>
              Administrators use the same sign-in to open the dashboard.
            </Text>
          </View>
        </Animated.View>

        <Text variant="label" tone="muted" style={wide.footer}>
          Latest location, not real-time · SafeTrack never contacts emergency services.
        </Text>
      </View>
    </View>
  );
}

/** A large choice tile: icon, title, short line and an arrow; lifts on hover (web). */
function Choice({
  icon,
  title,
  text,
  primary = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fg = primary ? "#FFFFFF" : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
          wide.choice,
          primary
            ? { backgroundColor: colors.primary, borderColor: colors.primary }
            : { backgroundColor: colors.surface, borderColor: hovered ? colors.primary : colors.rule },
          hovered && wide.choiceHover,
          state.pressed && { opacity: 0.85 },
        ];
      }}
    >
      <View style={[wide.choiceIcon, { backgroundColor: primary ? "rgba(255,255,255,0.16)" : colors.primaryTint }]}>
        <Ionicons name={icon} size={22} color={primary ? "#FFFFFF" : colors.primary} />
      </View>
      <View style={wide.flex}>
        <Text weight="800" style={[wide.choiceTitle, { color: fg }]}>
          {title}
        </Text>
        <Text variant="label" style={{ color: primary ? "rgba(255,255,255,0.82)" : colors.muted }}>
          {text}
        </Text>
      </View>
      <View style={[wide.choiceArrow, { backgroundColor: primary ? "rgba(255,255,255,0.16)" : colors.sunken }]}>
        <Ionicons name="arrow-forward" size={18} color={primary ? "#FFFFFF" : colors.primary} />
      </View>
    </Pressable>
  );
}

const wide = StyleSheet.create({
  page: { flex: 1, flexDirection: "row" },
  brand: { flex: 1.25, overflow: "hidden", justifyContent: "center" },
  glow: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(61,220,132,0.12)" },
  glowTop: { width: 520, height: 520, top: -200, right: -160 },
  glowBottom: { width: 420, height: 420, bottom: -220, left: -120, backgroundColor: "rgba(255,255,255,0.06)" },
  brandInner: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 56, paddingVertical: 40, gap: 26 },
  logo: { width: 170, height: 100, marginLeft: -10 },
  copy: { gap: 10 },
  eyebrow: { color: "#3DDC84" },
  headline: { color: "#FFFFFF", fontSize: 42, lineHeight: 48 },
  lead: { color: "rgba(255,255,255,0.78)", fontSize: 15, lineHeight: 23, maxWidth: 520 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  previewCards: { flex: 1, gap: 10 },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  previewDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 3 },
  previewTitle: { color: "#FFFFFF", fontSize: 13 },
  previewText: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, marginTop: 1 },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  feature: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(61,220,132,0.14)",
  },
  featureCopy: { flex: 1 },
  featureTitle: { color: "#FFFFFF", fontSize: 13.5 },
  featureText: { color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 17, marginTop: 1 },
  side: { flex: 1, justifyContent: "center", paddingHorizontal: 56, paddingVertical: 40 },
  sideInner: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 12 },
  sideTitle: { fontSize: 38, lineHeight: 44 },
  sideLead: { fontSize: 15, lineHeight: 23, marginBottom: 14 },
  choices: { gap: 12 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  choiceHover: { transform: [{ translateY: -2 }], shadowColor: "#0D2A1E", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  choiceIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  choiceTitle: { fontSize: 16.5 },
  choiceArrow: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 18, paddingTop: 18, borderTopWidth: 1 },
  fact: { flexDirection: "row", alignItems: "center", gap: 7 },
  adminRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  flex: { flex: 1 },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, textAlign: "center" },
});
