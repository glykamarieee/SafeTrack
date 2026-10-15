import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, View, type TextInput as RNTextInput, type TextInputProps } from "react-native";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";
import { TextInput } from "./NativeText";
import { Text } from "./Text";

type Props = Omit<TextInputProps, "style"> & {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Shows a show/hide toggle and hides the text. */
  secure?: boolean;
  error?: string | null;
  hint?: string;
};

/**
 * A labelled input: rounded, a green outline and soft glow while focused,
 * red when it has an error.
 */
export const Field = forwardRef<RNTextInput, Props>(function Field(
  { label, icon, secure = false, error, hint, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.shell, focused && styles.focused, Boolean(error) && styles.error]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.muted} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          secureTextEntry={secure && !visible}
          autoCorrect={secure ? false : rest.autoCorrect}
          {...rest}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible((current) => !current)}
            hitSlop={10}
            style={styles.toggle}
          >
            <Ionicons name={visible ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.message}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrapper: { gap: space.sm },
    label: { marginLeft: 2 },
    shell: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingHorizontal: space.lg,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.rule,
      backgroundColor: c.sunken,
    },
    focused: {
      borderColor: c.primary,
      backgroundColor: c.surface,
      // A soft glow ring around the focused field.
      shadowColor: c.brand,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    error: { borderColor: c.danger },
    input: {
      flex: 1,
      minHeight: 50,
      color: c.ink,
      fontSize: 15,
      fontWeight: "500",
      paddingVertical: space.sm,
    },
    toggle: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    message: { marginLeft: 2 },
  }),
);
