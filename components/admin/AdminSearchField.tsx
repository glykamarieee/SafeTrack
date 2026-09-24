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
      <Ionicons name="search-outline" size={18} color={colors.muted} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 13,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    paddingVertical: 0,
    outlineStyle: "none",
  } as any,
});
