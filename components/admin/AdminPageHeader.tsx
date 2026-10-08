import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { adminColors as colors } from "../../constants/adminDesign";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerMark} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <View style={styles.kickerLine} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
  },
  copy: {
    flex: 1,
    maxWidth: 840,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    maxWidth: 420,
  },
  kickerMark: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  kickerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.9,
    marginTop: 10,
  },
  description: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 800,
  },
  action: {
    paddingTop: 2,
  },
});
