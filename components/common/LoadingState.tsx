import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { colors, spacing, typography } from "../../constants/theme";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.emerald} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  message: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
});
