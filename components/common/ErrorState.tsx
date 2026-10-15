import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { Button } from "./Button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong. Please try again.", onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="outline" fullWidth={false} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.dangerLight,
    borderRadius: radii.lg,
  },
  message: {
    ...typography.body,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
