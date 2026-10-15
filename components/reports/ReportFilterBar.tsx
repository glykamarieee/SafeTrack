import {
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Text } from "../ui/NativeText";
import { colors, radii, spacing } from "../../constants/theme";

export type ReportDateFilter = "all" | "last7" | "last30";

interface ReportFilterBarProps {
  selected: ReportDateFilter;
  onSelect: (filter: ReportDateFilter) => void;
}

const OPTIONS: { key: ReportDateFilter; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
];

export function ReportFilterBar({ selected, onSelect }: ReportFilterBarProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.content}>
      {OPTIONS.map((option) => {
        const isActive = option.key === selected;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.md,
  },
  content: {
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
});
