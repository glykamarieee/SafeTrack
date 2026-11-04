import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "../ui/NativeText";
import { colorFor, initialsOf } from "../location/mapTypes";
import { useSelectedChild } from "../../hooks/useSelectedChild";
import { guardianRadius as radius } from "../../constants/guardianDesign";
import { makeStyles } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

/**
 * One chip per registered child; shown only when there is more than one.
 * The choice is shared by every guardian screen (useSelectedChild).
 * `alertChildIds` marks children with an active SOS.
 */
export function ChildSwitcher({ alertChildIds = [], style }: { alertChildIds?: string[]; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { child, children, select } = useSelectedChild();
  if (children.length < 2) return null;

  return (
    <View style={[styles.row, style]} accessibilityRole="tablist">
      {children.map((item) => {
        const selected = item.id === child?.id;
        const alert = alertChildIds.includes(item.id);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.fullName}${alert ? ", active SOS" : ""}`}
            onPress={() => select(item.id)}
            style={[styles.chip, selected && styles.chipSelected, alert && styles.chipAlert]}
          >
            <View style={[styles.dot, { backgroundColor: colorFor(item.fullName) }]}>
              <Text style={styles.dotText}>{initialsOf(item.fullName)}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.text, selected && styles.textSelected, alert && styles.textAlert]}>
              {item.fullName}
            </Text>
            {alert ? <View style={styles.alertDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = guardianPalette(__c);
  return StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    chip: {
      maxWidth: 200,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingLeft: 4,
      paddingRight: 12,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.softMint },
    chipAlert: { borderColor: colors.danger },
    dot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    dotText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" },
    text: { flexShrink: 1, color: colors.ink, fontSize: 12.5, fontWeight: "700" },
    textSelected: { color: colors.primaryDeep },
    textAlert: { color: colors.danger },
    alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  });
});
