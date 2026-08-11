import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

/**
 * SafeTrack splash screen.
 *
 * Uses the white SafeTrack logo on a sage-green background,
 * then continues automatically to the Get Started screen.
 */
export default function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);

    entrance.start();

    const nextScreenTimer = setTimeout(() => {
      router.replace("/(auth)/welcome");
    }, 1800);

    return () => clearTimeout(nextScreenTimer);
  }, [logoOpacity, logoScale]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          resizeMode="contain"
          style={styles.logo}
          accessibilityLabel="SafeTrack"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#78B98A",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 214,
    height: 122,
  },
});
