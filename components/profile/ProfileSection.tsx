import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";
import { Card } from "../common/Card";
import { spacing, typography } from "../../constants/theme";

interface ProfileSectionProps {
  title: string;
  children: ReactNode;
}

export function ProfileSection({ title, children }: ProfileSectionProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
});
