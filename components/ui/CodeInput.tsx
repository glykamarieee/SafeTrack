import { useRef, useState } from "react";
import { Pressable, StyleSheet, View, type TextInput as RNTextInput } from "react-native";

import { makeStyles } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";
import { TextInput } from "./NativeText";
import { Text } from "./Text";

type Props = {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  accessibilityLabel: string;
  error?: boolean;
  onComplete?: (digits: string) => void;
};

/**
 * A one-time-code entry: one real (invisible) input under a row of boxes.
 * Each box shows a digit and turns green as it fills; the next empty box is
 * outlined as the cursor.
 */
export function CodeInput({ value, onChange, length = 6, accessibilityLabel, error, onComplete }: Props) {
  const styles = useStyles();
  const input = useRef<RNTextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable accessible={false} onPress={() => input.current?.focus()} style={styles.row}>
      {Array.from({ length }, (_, index) => {
        const digit = value[index] ?? "";
        const isCursor = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            style={[styles.box, digit !== "" && styles.filled, isCursor && styles.cursor, error && styles.error]}
          >
            <Text variant="title" tone={digit ? "primary" : "muted"} tabular>
              {digit || "·"}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={`${value.length} of ${length} digits entered`}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "center", gap: space.sm, alignSelf: "center", width: "100%", maxWidth: 380 },
    box: {
      flex: 1,
      maxWidth: 56,
      aspectRatio: 0.82,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.rule,
      backgroundColor: c.sunken,
      alignItems: "center",
      justifyContent: "center",
    },
    filled: { borderColor: c.primary, backgroundColor: c.primaryTint },
    cursor: { borderColor: c.primary, backgroundColor: c.surface },
    error: { borderColor: c.danger },
    // Covers the boxes so taps and paste reach the real input on every platform.
    hidden: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: "transparent" },
  }),
);
