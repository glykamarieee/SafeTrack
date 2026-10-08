import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminColors as colors, adminRadius as radius } from "../../constants/adminDesign";

export function AdminSearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
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

const styles = StyleSheet.create({
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
