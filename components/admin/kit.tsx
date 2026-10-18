/**
 * Building blocks of the admin "control room" dashboard: live pulse, counting
 * numbers, status pills with one colour language, hover-lift surfaces,
 * shimmering skeletons, a slide-over panel, toasts and the page top bar.
 * Animated API only (no extra native libraries); every effect respects the
 * reduce-motion setting.
 */
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "../ui/Text";
import { useTheme } from "../../theme/ThemeProvider";
import { nativeDriver } from "../../theme/motion";

export type IconName = ComponentProps<typeof Ionicons>["name"];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatNumber(value: number) {
  return value.toLocaleString("en-PH");
}

/** "just now", "12 min ago", "3 hrs ago", "2 days ago". */
export function timeAgo(value?: string | null, empty = "No record yet") {
  if (!value) return empty;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "–";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Philippine time, e.g. "Oct 18, 3:05 PM". */
export function phTime(value: string | null | undefined) {
  if (!value) return "–";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Status colour language
// ---------------------------------------------------------------------------

export type ToneKey =
  | "active" // active SOS
  | "acknowledged"
  | "cancelled"
  | "entry"
  | "exit"
  | "anomaly"
  | "inactivity"
  | "offline" // watch disconnected
  | "ok" // account/device active
  | "off"; // account/device turned off

/** Foreground and background for each status, in Light and Dark. */
export function useTone(key: ToneKey) {
  const { colors, scheme } = useTheme();
  const dark = scheme === "dark";
  const pair = (fg: string, bgLight: string, bgDark: string) => ({ fg, bg: dark ? bgDark : bgLight });
  switch (key) {
    case "active":
      return { ...pair(colors.danger, colors.dangerTint, colors.dangerTint), icon: "alert-circle" as IconName };
    case "acknowledged":
    case "entry":
    case "ok":
      return {
        ...pair(colors.primary, colors.primaryTint, colors.primaryTint),
        icon: (key === "entry" ? "enter-outline" : "checkmark-circle") as IconName,
      };
    case "exit":
      return { ...pair(dark ? "#F5B46B" : "#B54708", "#FEF3E2", "rgba(245,180,107,0.14)"), icon: "exit-outline" as IconName };
    case "anomaly":
      return { ...pair(dark ? "#B9A6FF" : "#6941C6", "#F1ECFD", "rgba(185,166,255,0.14)"), icon: "analytics-outline" as IconName };
    case "inactivity":
      return { ...pair(dark ? "#84ADFF" : "#175CD3", "#E8F0FD", "rgba(132,173,255,0.14)"), icon: "hourglass-outline" as IconName };
    case "off":
      return { ...pair(colors.danger, colors.dangerTint, colors.dangerTint), icon: "pause-circle" as IconName };
    case "cancelled":
    case "offline":
    default:
      return {
        ...pair(colors.ink2, colors.sunken, colors.sunken),
        icon: (key === "offline" ? "cloud-offline-outline" : "close-circle-outline") as IconName,
      };
  }
}

/** Database values to tone keys. */
export function toneFor(value: string): ToneKey {
  const v = value.toLowerCase().replaceAll(" ", "_");
  if (v === "active") return "active";
  if (v === "acknowledged") return "acknowledged";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "entry") return "entry";
  if (v === "exit") return "exit";
  if (v === "possible_anomaly") return "anomaly";
  if (v === "prolonged_inactivity") return "inactivity";
  if (v === "watch_disconnected") return "offline";
  return "cancelled";
}

export function TonePill({ tone, label, icon = true }: { tone: ToneKey; label: string; icon?: boolean }) {
  const t = useTone(tone);
  return (
    <View style={[kit.pill, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={t.icon} size={12} color={t.fg} /> : null}
      <Text variant="caption" weight="800" style={{ color: t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Live pulse
// ---------------------------------------------------------------------------

/** An 8 px dot with an expanding ring: "this updates live". */
export function LivePulse({ color, size = 8 }: { color?: string; size?: number }) {
  const { colors, reduceMotion } = useTheme();
  const ring = useRef(new Animated.Value(0)).current;
  const tint = color ?? colors.brand;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [ring, reduceMotion]);

  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {!reduceMotion ? (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: tint,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: tint }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Counting number
// ---------------------------------------------------------------------------

/**
 * Counts up from 0 on first show (500 ms); later changes tick to the new value
 * and call `onChange` (the card flashes). Shows "–" while `value` is null.
 */
export function CountUp({
  value,
  style,
  onChange,
  variant = "display",
}: {
  value: number | null;
  style?: ComponentProps<typeof Text>["style"];
  onChange?: () => void;
  variant?: ComponentProps<typeof Text>["variant"];
}) {
  const { reduceMotion } = useTheme();
  const animated = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const id = animated.addListener(({ value: v }) => setShown(Math.round(v)));
    return () => animated.removeListener(id);
  }, [animated]);

  useEffect(() => {
    if (value === null) return;
    const first = previous.current === null;
    if (!first && previous.current !== value) onChange?.();
    previous.current = value;
    if (reduceMotion) {
      animated.setValue(value);
      setShown(value);
      return;
    }
    Animated.timing(animated, {
      toValue: value,
      duration: first ? 500 : 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // onChange is a fresh closure each render; the value change is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion, animated]);

  return (
    <Text variant={variant} weight="800" tabular style={style}>
      {value === null ? "–" : formatNumber(shown)}
    </Text>
  );
}

/** A border flash for a card whose number just changed: call `flash()`. */
export function useFlash() {
  const { reduceMotion } = useTheme();
  const value = useRef(new Animated.Value(0)).current;
  const flash = () => {
    if (reduceMotion) return;
    value.setValue(1);
    Animated.timing(value, { toValue: 0, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  };
  return { value, flash };
}

// ---------------------------------------------------------------------------
// Hover-lift surface
// ---------------------------------------------------------------------------

/** A pressable card that lifts 2 px with a soft shadow on hover, presses to 0.98. */
export function Lift({
  children,
  onPress,
  style,
  hoverStyle,
  accessibilityLabel,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const { reduceMotion, scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={(state) => {
        const hovered = Boolean((state as { hovered?: boolean }).hovered) && Boolean(onPress);
        return [
          style,
          Platform.OS === "web" && ({ transitionProperty: "transform, box-shadow", transitionDuration: "150ms" } as ViewStyle),
          hovered && !reduceMotion && { transform: [{ translateY: -2 }] },
          hovered && {
            shadowColor: "#0D2A1E",
            shadowOpacity: scheme === "dark" ? 0.4 : 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
          },
          hovered && hoverStyle,
          state.pressed && !reduceMotion && { transform: [{ scale: 0.98 }] },
        ];
      }}
    >
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function Skeleton({ width, height, radius = 8, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors, reduceMotion } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduceMotion]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.sunken, opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

/** Breadcrumb, page title, a sentence, the "updated" time with a live pulse, actions. */
export function TopBar({
  crumb,
  title,
  subtitle,
  updatedAt,
  actions,
}: {
  crumb: string;
  title: string;
  subtitle?: string;
  updatedAt?: string | null;
  actions?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={kit.topBar}>
      <View style={kit.topCopy}>
        <View style={kit.crumbs}>
          <Text variant="caption" tone="muted">
            Admin
          </Text>
          <Ionicons name="chevron-forward" size={12} color={colors.muted} />
          <Text variant="caption" weight="800" tone="primary">
            {crumb}
          </Text>
        </View>
        <Text variant="display" accessibilityRole="header" style={kit.topTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" style={kit.topSubtitle}>
            {subtitle}
          </Text>
        ) : null}
        {updatedAt !== undefined ? (
          <View style={kit.updated}>
            <LivePulse size={7} />
            <Text variant="caption" tone="muted">
              {updatedAt ? `Updated ${timeAgo(updatedAt)} · refreshes when records change` : "Loading…"}
            </Text>
          </View>
        ) : null}
      </View>
      {actions ? <View style={kit.topActions}>{actions}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Slide-over
// ---------------------------------------------------------------------------

/** A panel that slides in from the right over a dimmed backdrop; Esc closes (web). */
export function SlideOver({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  const { colors, reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress, reduceMotion]);

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close panel" onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          kit.panel,
          {
            width,
            backgroundColor: colors.paper,
            borderLeftColor: colors.rule,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }],
          },
        ]}
      >
        <View style={[kit.panelHead, { borderBottomColor: colors.rule, backgroundColor: colors.surface }]}>
          <Text variant="heading" weight="800" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[kit.close, { backgroundColor: colors.sunken }]}>
            <Ionicons name="close" size={18} color={colors.ink} />
          </Pressable>
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

type ToastItem = { id: number; text: string; tone: "ok" | "error" };
let toastId = 0;
const toastListeners = new Set<(item: ToastItem) => void>();

/** Shows a short message bottom-right (admin screens). */
export function showToast(text: string, tone: "ok" | "error" = "ok") {
  const item = { id: ++toastId, text, tone };
  toastListeners.forEach((listener) => listener(item));
}

/** Mount once in the admin shell. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const listener = (item: ToastItem) => {
      setItems((list) => [...list, item]);
      setTimeout(() => setItems((list) => list.filter((entry) => entry.id !== item.id)), 3600);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);
  return (
    <View pointerEvents="box-none" style={kit.toasts}>
      {items.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </View>
  );
}

function Toast({ item }: { item: ToastItem }) {
  const { colors, reduceMotion } = useTheme();
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [enter]);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        kit.toast,
        {
          backgroundColor: colors.forest,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <Ionicons name={item.tone === "ok" ? "checkmark-circle" : "alert-circle"} size={18} color={item.tone === "ok" ? "#3DDC84" : "#FF8A80"} />
      <Text variant="label" weight="700" style={{ color: "#FFFFFF", flexShrink: 1 }}>
        {item.text}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Entrance (staggered fade-up)
// ---------------------------------------------------------------------------

/** Fades up 12 px, 280 ms, staggered 40 ms per index. */
export function Rise({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useTheme();
  const value = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(value, { toValue: 1, duration: 280, delay: index * 40, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [value, index, reduceMotion]);
  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const kit = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  topBar: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: 16 },
  topCopy: { flex: 1, minWidth: 260, gap: 4 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: 6 },
  topTitle: { fontSize: 34, lineHeight: 40, marginTop: 2 },
  topSubtitle: { maxWidth: 720, lineHeight: 21 },
  updated: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, marginLeft: -4 },
  topActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  panel: { position: "absolute", top: 0, right: 0, bottom: 0, maxWidth: "100%", borderLeftWidth: 1 },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  toasts: { position: "absolute", right: 24, bottom: 24, gap: 8, alignItems: "flex-end", zIndex: 1000 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, maxWidth: 380 },
});
