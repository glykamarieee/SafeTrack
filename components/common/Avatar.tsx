import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";

interface AvatarProps {
  name: string;
  uri?: string;
  size?: number;
}

export function Avatar({ name, uri, size = 56 }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: Math.max(14, size * 0.34) }]}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.48} color={colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.emerald,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    color: colors.white,
    fontWeight: "800",
  },
});
