import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { space } from "../../theme/tokens";

type Props = {
  children: ReactNode;
  /** Scrolls by default; pass false for screens that manage their own scrolling (maps, lists). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  /** Readable column width on tablets and the web. */
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Paper background, safe-area insets, a 16-px gutter and a readable column. */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  edges = ["top", "left", "right"],
  maxWidth = 720,
  contentStyle,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const column = [styles.column, { maxWidth }, contentStyle];

  return (
    <SafeAreaView edges={edges} style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          <View style={column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.fill, column]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    fill: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: space.xxxl },
    column: {
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: space.gutter,
      paddingTop: space.lg,
      gap: space.lg,
    },
  }),
);
