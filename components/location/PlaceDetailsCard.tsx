import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "../ui/Text";
import type { PlaceDetails } from "../../hooks/usePlaceDetails";
import type { LocationLog } from "../../types/safetrack";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

function age(recordedAt: string) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(recordedAt)) / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Where the child is, in words: address, landmark, how they are moving, the
 * nearest safe zone, how long they have been there, and how fresh and exact
 * the point is. `tone="dark"` sits on the full-screen map, `"light"` in cards.
 */
export function PlaceDetailsCard({
  location,
  details,
  batteryPercent,
  networkType,
  tone = "light",
  compact = false,
}: {
  location: LocationLog;
  details: PlaceDetails;
  batteryPercent?: number | null;
  networkType?: string | null;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const dark = tone === "dark";
  const ink = dark ? "#FFFFFF" : colors.ink;
  const soft = dark ? "rgba(255,255,255,0.72)" : colors.muted;
  const iconColor = dark ? "#3DDC84" : colors.primary;
  const { place, motion, zone, inside, stay, live } = details;

  const address =
    place === undefined
      ? "Finding the address…"
      : place?.label
        ? place.near
          ? `Near ${place.label}`
          : place.label
        : `Address unavailable · ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;

  const isWatch = location.source === "smartwatch";
  const device = [
    isWatch ? "From watch" : "From phone",
    location.accuracyMeters != null ? `±${Math.round(location.accuracyMeters)} m` : null,
    isWatch && batteryPercent != null ? `Battery ${batteryPercent}%` : null,
    isWatch && networkType ? networkType : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const rowColors = { icon: iconColor, ink, soft };

  return (
    <View
      style={[styles.card, dark ? styles.dark : { backgroundColor: colors.surface, borderColor: colors.rule }]}
      accessible
      accessibilityLabel={`${live ? "Live. " : ""}${motion?.label ?? ""}. ${address}. ${zone ?? ""}. ${stay ?? ""}`}
    >
      <View style={styles.head}>
        <View style={[styles.badge, live ? styles.badgeLive : dark ? styles.badgeDark : { backgroundColor: colors.sunken }]}>
          {live ? <View style={styles.liveDot} /> : null}
          <Text variant="caption" weight="800" style={{ color: live ? "#FFFFFF" : ink }}>
            {live ? "Live" : `Updated ${age(location.recordedAt)}`}
          </Text>
        </View>
        {motion ? (
          <View style={styles.motion}>
            <MaterialCommunityIcons
              name={motion.glyph as ComponentProps<typeof MaterialCommunityIcons>["name"]}
              size={17}
              color={iconColor}
            />
            <Text variant="label" weight="800" style={{ color: ink }} numberOfLines={1}>
              {motion.label}
            </Text>
          </View>
        ) : null}
      </View>

      <Row colors={rowColors} icon="location" text={address} strong />
      {!compact && place?.landmark ? (
        <Row colors={rowColors} icon="business-outline" text={`Near ${place.landmark.name} (${place.landmark.distanceMeters} m)`} />
      ) : null}
      {zone ? <Row colors={rowColors} icon={inside ? "shield-checkmark" : "shield-outline"} text={stay ? `${zone} · ${stay}` : zone} /> : stay ? <Row colors={rowColors} icon="time-outline" text={stay} /> : null}
      {!compact ? <Row colors={rowColors} icon={isWatch ? "watch-outline" : "phone-portrait-outline"} text={device} /> : null}
    </View>
  );
}

function Row({ icon, text, strong, colors }: { icon: IconName; text: string; strong?: boolean; colors: { icon: string; ink: string; soft: string } }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.icon} style={styles.rowIcon} />
      <Text variant={strong ? "label" : "caption"} weight={strong ? "700" : "500"} style={[styles.flex, { color: strong ? colors.ink : colors.soft }]}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    card: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: 6 },
    dark: { backgroundColor: "rgba(10, 26, 18, 0.86)", borderColor: "rgba(255,255,255,0.12)" },
    flex: { flex: 1, minWidth: 0 },
    head: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap", marginBottom: 2 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    badgeLive: { backgroundColor: "#16A34A" },
    badgeDark: { backgroundColor: "rgba(255,255,255,0.14)" },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
    motion: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
    row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    rowIcon: { marginTop: 1 },
  }),
);
