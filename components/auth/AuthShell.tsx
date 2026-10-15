import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { MapPattern } from "../ui/MapPattern";
import { Text } from "../ui/Text";
import { useDrift, useEntrance } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

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

          <Animated.View style={[styles.sheet, sheet, { borderColor: colors.rule, paddingBottom: 48 + insets.bottom }]}>
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
      borderTopWidth: scheme === "dark" ? 1 : 0,
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
  }),
);
