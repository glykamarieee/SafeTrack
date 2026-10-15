import { forwardRef } from "react";
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";

import { fontStyle, useFontsReady } from "../../theme/fonts";

/**
 * Drop-in replacements for React Native's Text and TextInput that render in
 * Plus Jakarta Sans. Android picks a custom font's file by family name, not
 * by fontWeight, so the weight in `style` is mapped to the matching family.
 * Screens import these instead of the react-native ones; nothing else changes.
 */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const ready = useFontsReady();
  const flat = StyleSheet.flatten(style) ?? {};
  // A style that sets its own family (icons, monospace codes) is left alone.
  const font = flat.fontFamily ? null : fontStyle(flat.fontWeight, ready);

  return <RNText ref={ref} {...rest} style={[style, font]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  const ready = useFontsReady();
  const flat = StyleSheet.flatten(style) ?? {};
  const font = flat.fontFamily ? null : fontStyle(flat.fontWeight ?? "500", ready);

  return <RNTextInput ref={ref} {...rest} style={[style, font]} />;
});
