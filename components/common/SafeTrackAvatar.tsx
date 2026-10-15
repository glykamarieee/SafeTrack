import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { safeTrackColors as colors, safeTrackShadow as shadow } from "../../constants/safeTrackDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { safeTrackPalette } from "../../theme/legacy";

type SafeTrackAvatarProps = {
  imageUri?: string | null;
  name?: string | null;
  size?: number;
  editable?: boolean;
  onPress?: () => void;
};

function getInitials(name?: string | null) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "ST";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SafeTrackAvatar({
  imageUri = null,
  name = null,
  size = 56,
  editable = false,
  onPress,
}: SafeTrackAvatarProps) {
  const styles = useStyles();
  const colors = safeTrackPalette(useTheme().colors);

  const radius = Math.round(size * 0.32);
  const initials = getInitials(name);
  const canEdit = editable && typeof onPress === "function";

  const avatarContent = (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
          }}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.fallback}>
          <Text
            style={[
              styles.initials,
              {
                fontSize: Math.max(13, Math.round(size * 0.31)),
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
      ]}
    >
      {canEdit ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {avatarContent}
        </Pressable>
      ) : (
        avatarContent
      )}

      {editable ? (
        <View
          style={[
            styles.cameraBadge,
            {
              width: Math.max(26, Math.round(size * 0.34)),
              height: Math.max(26, Math.round(size * 0.34)),
              borderRadius: Math.max(13, Math.round(size * 0.17)),
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons
            name="camera-outline"
            size={Math.max(13, Math.round(size * 0.17))}
            color={colors.white}
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = safeTrackPalette(__c);
  return StyleSheet.create({
  container: {
    position: "relative",
  },

  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
    borderWidth: 2,
    borderColor: colors.white,
    ...shadow.soft,
  },

  fallback: {
    // Fill the whole avatar: in a centred parent, flex alone shrinks it to the
    // width of the initials (a green bar inside a mint frame).
    alignSelf: "stretch",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  initials: {
    color: colors.white,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  cameraBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
    ...shadow.soft,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
});