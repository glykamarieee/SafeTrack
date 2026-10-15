import {
  StyleSheet,
  View,
} from "react-native";
import { TextInput } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { adminColors as colors, adminRadius as radius } from "../../constants/adminDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { adminPalette } from "../../theme/legacy";

export function AdminSearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const styles = useStyles();
  const colors = adminPalette(useTheme().colors);

  return (
    <View style={styles.root}>
      <Ionicons name="search-outline" size={18} color={colors.primaryDark} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.trim() ? <View style={styles.activeMarker} /> : null}
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = adminPalette(__c);
  return StyleSheet.create({
  root: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    paddingVertical: 0,
    outlineStyle: "none",
  } as any,
  activeMarker: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
});
