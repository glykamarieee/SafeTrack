import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthBrandPanel } from "./AuthBrandPanel";
import { MapPattern } from "../ui/MapPattern";
import { Text } from "../ui/Text";
import { useDrift, useEntrance } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

/** Laptop and desktop windows: brand panel on the left, the form on the right. */
const WIDE_MIN = 960;
const BRAND_LEAD =
  "Guardians see their child's latest location on real roads, get calm alerts for safe zones and SOS, and review each day, from a smartwatch or phone.";

type Props = {
  title: string;
  subtitle?: string;
  /** Small green label above the title ("GUARDIAN ACCOUNT SETUP"). */
  eyebrow?: string;
  /** Shows a back button; goes back, or to `backHref` when there is no history. */
  back?: boolean;
  backHref?: Href;
  /** "Step 1 of 2" progress in the header. */
  step?: { current: number; total: number };
  /** A smaller header for long forms. */
  compact?: boolean;
  children: ReactNode;
  /** Links under the card ("New to SafeTrack? Create an account"). */
  footer?: ReactNode;
};

/**
 * The sign-in layout from the approved design: a green header with drifting
 * map lines and the white SafeTrack logo, and a white card that slides up
 * over it holding the form.
 */
export function AuthShell({ title, subtitle, eyebrow, back, backHref = "/(auth)/login", step, compact, children, footer }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const drift = useDrift();
  const logo = useEntrance(0, 0, 420);
  const sheet = useEntrance(2, 60, 420);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(backHref);
  };

  if (width >= WIDE_MIN) {
    return (
      <View style={[styles.wide, { backgroundColor: colors.paper }]}>
        <AuthBrandPanel headline={"Know where they are.\nBe there when it matters."} lead={BRAND_LEAD} />

        <View style={styles.wideSide}>
          <View style={[styles.wideCorner, { borderColor: colors.rule }]} pointerEvents="none" />
          <ScrollView contentContainerStyle={styles.wideScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View style={[styles.wideForm, sheet]}>
              {back || step ? (
                <View style={styles.wideTop}>
                  {back ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                      onPress={goBack}
                      style={(state) => [
                        styles.wideBack,
                        { borderColor: colors.rule, backgroundColor: (state as { hovered?: boolean }).hovered ? colors.sunken : colors.surface },
                      ]}
                    >
                      <Ionicons name="arrow-back" size={16} color={colors.ink} />
                      <Text variant="label" weight="700">
                        Back
                      </Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  {step ? (
                    <View accessible accessibilityLabel={`Step ${step.current} of ${step.total}`} style={styles.wideStep}>
                      <Text variant="legend" tone="muted">
                        Step {step.current} of {step.total}
                      </Text>
                      <View style={[styles.stepRail, { backgroundColor: colors.sunken }]}>
                        <View style={[styles.stepFill, { backgroundColor: colors.primary, width: `${(step.current / step.total) * 100}%` }]} />
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.wideTitle}>
                {eyebrow ? (
                  <Text variant="legend" tone="primary">
                    {eyebrow}
                  </Text>
                ) : null}
                <Text variant="display" accessibilityRole="header" style={styles.wideHeading}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text tone="muted" style={styles.wideLead}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              {children}

              {footer ? <View style={[styles.footer, styles.wideFooter, { borderTopColor: colors.rule }]}>{footer}</View> : null}
            </Animated.View>
          </ScrollView>
          <Text variant="caption" tone="muted" style={styles.wideNote}>
            Live location while moving · SafeTrack never contacts emergency services.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SafeAreaView edges={["top"]} style={[styles.header, compact && styles.headerCompact]}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }], right: -40 },
              ]}
            >
              <MapPattern color="#FFFFFF" opacity={scheme === "dark" ? 0.05 : 0.09} />
            </Animated.View>

            <View style={styles.headerBar}>
              {back ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={8} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </Pressable>
              ) : (
                <View style={styles.backSpacer} />
              )}
              {step ? (
                <View accessible accessibilityLabel={`Step ${step.current} of ${step.total}`} style={styles.step}>
                  <Text variant="legend" style={styles.stepText}>
                    Step {step.current} of {step.total}
                  </Text>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepFill, { width: `${(step.current / step.total) * 100}%` }]} />
                  </View>
                </View>
              ) : null}
              <View style={styles.backSpacer} />
            </View>

            <Animated.View style={[styles.logoWrap, logo, { transform: [{ scale: (logo.opacity as Animated.Value).interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
              <Image
                source={require("../../assets/images/logo.png")}
                accessibilityLabel="SafeTrack"
                style={compact ? styles.logoSmall : styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
          </SafeAreaView>

          <Animated.View style={[styles.sheet, sheet, { borderColor: scheme === "dark" ? colors.rule : "transparent", paddingBottom: 48 + insets.bottom }]}>
            <View style={styles.titleBlock}>
              {eyebrow ? (
                <Text variant="legend" tone="primary">
                  {eyebrow}
                </Text>
              ) : null}
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text variant="body">{subtitle}</Text> : null}
            </View>

            {children}

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: scheme === "dark" ? c.forest : "#15803D" },
    flex: { flex: 1 },
    scroll: { flexGrow: 1 },
    header: {
      overflow: "hidden",
      paddingHorizontal: space.gutter,
      paddingBottom: space.xxl + space.lg,
      backgroundColor: scheme === "dark" ? c.forest : "#15803D",
    },
    headerCompact: { paddingBottom: space.xxl },
    headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, marginTop: space.sm },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    backSpacer: { width: 44 },
    step: { alignItems: "center", gap: 6 },
    stepText: { color: "#D5F0DE" },
    stepRail: { width: 120, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" },
    stepFill: { height: "100%", borderRadius: 3, backgroundColor: "#FFFFFF" },
    logoWrap: { alignItems: "center" },
    logo: { width: 150, height: 130 },
    logoSmall: { width: 104, height: 84 },
    sheet: {
      flex: 1,
      marginTop: -space.xl,
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.lg + 2,
      borderTopRightRadius: radius.lg + 2,
      borderTopWidth: 1,
      paddingHorizontal: space.xl,
      paddingTop: space.xxl,
      paddingBottom: space.xxxl,
      gap: space.lg,
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
    },
    titleBlock: { gap: 6, marginBottom: space.xs },
    footer: { marginTop: space.sm, gap: space.md, alignItems: "center" },
    wide: { flex: 1, flexDirection: "row" },
    wideSide: { flex: 1, overflow: "hidden" },
    wideCorner: { position: "absolute", width: 420, height: 420, borderRadius: 210, borderWidth: 1, top: -210, right: -210 },
    wideScroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 56, paddingTop: 48, paddingBottom: 72 },
    wideForm: { width: "100%", maxWidth: 460, alignSelf: "center", gap: space.lg },
    wideTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs },
    wideBack: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
    wideStep: { alignItems: "flex-end", gap: 6 },
    wideTitle: { gap: 8, marginBottom: space.xs },
    wideHeading: { fontSize: 36, lineHeight: 42 },
    wideLead: { fontSize: 15, lineHeight: 23 },
    wideFooter: { borderTopWidth: 1, paddingTop: space.lg },
    wideNote: { position: "absolute", bottom: 22, left: 24, right: 24, textAlign: "center" },
  }),
);
