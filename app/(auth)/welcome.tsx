import { Animated, Image, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { useEntrance } from "../../theme/motion";
import { space } from "../../theme/tokens";

export default function WelcomeScreen() {
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

      {/* A forest tint, deeper at the bottom where the text sits. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
      <View pointerEvents="none" style={styles.bottomShade} />

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
  tint: { backgroundColor: "rgba(13, 42, 30, 0.42)" },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
    backgroundColor: "rgba(13, 42, 30, 0.55)",
  },
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
