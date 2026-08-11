import { Image, StyleSheet, View } from "react-native";

type LogoVariant = "light" | "dark";

type LogoProps = {
  size?: number;
  variant?: LogoVariant;
};

/**
 * SafeTrack logo component.
 *
 * logo.png
 * → white SafeTrack logo
 * → use on sage-green, dark, or video backgrounds
 *
 * logo-black.png
 * → dark SafeTrack logo
 * → use on mint-white[object Object] or light backgrounds
 */
export function Logo({
  size = 120,
  variant = "dark",
}: LogoProps) {
  const imageSource =
    variant === "light"
      ? require("../../assets/images/logo.png")
      : require("../../assets/images/logo-black.png");

  return (
    <View style={styles.container}>
      <Image
        source={imageSource}
        resizeMode="contain"
        style={[
          styles.image,
          {
            width: size,
            height: size * 0.90,
          },
        ]}
        accessibilityLabel="SafeTrack logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    alignSelf: "center",
  },
});