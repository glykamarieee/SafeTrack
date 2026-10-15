import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../constants/theme";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { themePalette } from "../../theme/legacy";

interface ScreenContainerProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({ children, scroll = true, style, contentStyle }: ScreenContainerProps) {
  const styles = useStyles();

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.noScrollContent, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = themePalette(__c);
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.softGray,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  noScrollContent: {
    flex: 1,
  },
});
});
