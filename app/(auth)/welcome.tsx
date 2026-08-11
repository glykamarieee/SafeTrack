import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const player = useVideoPlayer(
    require("../../assets/videos/safetrack-intro.mp4"),
    (videoPlayer) => {
      videoPlayer.loop = true;
      videoPlayer.muted = true;
      videoPlayer.play();
    }
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <VideoView
        player={player}
        style={styles.backgroundVideo}
        nativeControls={false}
        contentFit="cover"
      />

      <View pointerEvents="none" style={styles.fullScreenOverlay} />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.logoArea}>
          <Image
            source={require("../../assets/images/logo.png")}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="SafeTrack logo"
          />
        </View>

        <View style={styles.bottomContent}>
          <Text style={styles.headline}>
            Know where they are.{"\n"}
            Be there when it matters.
          </Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.getStartedButton,
              pressed && styles.getStartedButtonPressed,
            ]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </Pressable>

          <Text style={styles.signInText}>
            Already have an account?{" "}
            <Text
              style={styles.signInLink}
              onPress={() => router.push("/(auth)/login")}
            >
              Sign in
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#24573A",
  },

  backgroundVideo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  /*
   * One full-screen overlay only.
   * This removes the visible middle line caused by the old bottom overlay.
   */
  fullScreenOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(6, 49, 28, 0.46)",
  },

  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  logoArea: {
    alignItems: "center",
    marginTop: 18,
  },

  logo: {
    width: 225,
    height: 135,
  },

  bottomContent: {
    gap: 18,
  },

  headline: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.38)",
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },

  getStartedButton: {
    height: 60,
    borderRadius: 30,
    backgroundColor: "#22BE73",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#061F11",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 7,
  },

  getStartedButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },

  getStartedText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  signInText: {
    color: "rgba(255, 255, 255, 0.90)",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },

  signInLink: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});