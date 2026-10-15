import { Ionicons } from "@expo/vector-icons";
import { Animated, StyleSheet, View } from "react-native";

import { useEntrance } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { space } from "../../theme/tokens";
import { Text } from "./Text";

type Step = { title: string; detail?: string; done?: boolean };

/** A numbered vertical timeline (setup instructions), steps fading in one by one. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <View accessibilityRole="list">
      {steps.map((step, index) => (
        <StepRow key={step.title} step={step} index={index} last={index === steps.length - 1} />
      ))}
    </View>
  );
}

function StepRow({ step, index, last }: { step: Step; index: number; last: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const entrance = useEntrance(index + 2);

  return (
    <Animated.View style={[styles.row, entrance]} accessible accessibilityLabel={`Step ${index + 1}: ${step.title}. ${step.detail ?? ""}`}>
      <View style={styles.rail}>
        <View style={[styles.dot, step.done && styles.dotDone]}>
          {step.done ? (
            <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
          ) : (
            <Text variant="caption" tone="primary" weight="800">
              {index + 1}
            </Text>
          )}
        </View>
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={[styles.copy, last && styles.copyLast]}>
        <Text variant="label" weight="700">
          {step.title}
        </Text>
        {step.detail ? <Text variant="caption">{step.detail}</Text> : null}
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: space.md },
    rail: { alignItems: "center", width: 28 },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primaryTint,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    dotDone: { backgroundColor: c.primary },
    line: { flex: 1, width: 2, minHeight: 18, backgroundColor: c.rule, marginVertical: 2 },
    copy: { flex: 1, gap: 2, paddingBottom: space.lg, paddingTop: 4 },
    copyLast: { paddingBottom: 0 },
  }),
);
