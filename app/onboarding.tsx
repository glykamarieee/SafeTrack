import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Scene, type SceneName } from "../components/onboarding/Scenes";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Notice";
import { Text } from "../components/ui/Text";
import { markOnboardingSeen, type OnboardingAudience } from "../services/onboardingService";
import { registerGuardianPushToken } from "../services/pushRegistrationService";
import { useAuthStore } from "../store/authStore";
import { nativeDriver } from "../theme/motion";
import { makeStyles, useTheme } from "../theme/ThemeProvider";
import { space } from "../theme/tokens";

type Page = { scene: SceneName; title: string; body: string };

const PAGES: Record<OnboardingAudience, Page[]> = {
  guardian: [
    {
      scene: "pin",
      title: "Know where they are",
      body: "See your child's latest location from their SafeTrack watch or phone. A green ring means they're inside a safe place. It's the last location they sent, usually a few minutes old.",
    },
    {
      scene: "zone",
      title: "Draw a safe place",
      body: "Add Home or School as a circle on the map. SafeTrack tells you when your child arrives or leaves.",
    },
    {
      scene: "sos",
      title: "SOS reaches you first",
      body: "When your child holds SOS on the watch or phone, you get an alert with their location, and reminders until someone acknowledges it.",
    },
    {
      scene: "route",
      title: "Their day, retraced",
      body: "History replays where they went, their stops and zone visits. AI notices about unusual activity are advice to check, never alarms.",
    },
    {
      scene: "bell",
      title: "Turn on alerts",
      body: "Allow notifications so SOS and safe-zone alerts reach you even when SafeTrack is closed.",
    },
  ],
  child: [
    {
      scene: "share",
      title: "Your guardian can see where you are",
      body: "When this phone shares its location, your guardian sees it on their SafeTrack map.",
    },
    {
      scene: "hold",
      title: "Hold SOS if you need help",
      body: "Press and hold the SOS button. A 5-second countdown starts: tap Cancel if it was a mistake.",
    },
    {
      scene: "auto",
      title: "Share automatically",
      body: "Turn on Auto-share and this phone sends its location every 5 minutes or 100 m, even when the app is closed.",
    },
    {
      scene: "done",
      title: "You're all set",
      body: "SafeTrack is ready. You can replay this tour any time from your profile.",
    },
  ],
};

/**
 * The first-run tour. Opened after the first guardian login and after a child
 * phone is linked, and replayable from Help & Support or the child profile.
 * Skip is always available; finishing or skipping is remembered per device.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ audience?: string; next?: string; replay?: string }>();
  const audience: OnboardingAudience = params.audience === "child" ? "child" : "guardian";
  const pages = PAGES[audience];
  const next = (typeof params.next === "string" && params.next ? params.next : audience === "child" ? "/(child)/child-home" : "/(app)/home") as Href;
  const linkedChildren = useAuthStore((state) => state.linkedChildren);

  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 640);
  const scroller = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const [push, setPush] = useState<"idle" | "asking" | "on" | "unavailable">("idle");
  const last = index === pages.length - 1;

  const goTo = (target: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, target));
    scroller.current?.scrollTo({ x: clamped * pageWidth, animated: true });
    setIndex(clamped);
  };

  const finish = (target: Href = next) => {
    void markOnboardingSeen(audience);
    router.replace(target);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  const allowNotifications = async () => {
    setPush("asking");
    try {
      const token = await registerGuardianPushToken();
      setPush(token ? "on" : "unavailable");
    } catch {
      setPush("unavailable");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.column, { width: pageWidth }]}>
        <View style={styles.topBar}>
          <Image source={scheme === "dark" ? require("../assets/images/logo.png") : require("../assets/images/logo-black.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="SafeTrack" />
          {last ? (
            <View />
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Skip the tour" onPress={() => finish()} hitSlop={10} style={styles.skip}>
              <Text variant="body" tone="ink2" weight="700">
                Skip
              </Text>
            </Pressable>
          )}
        </View>

        <Animated.ScrollView
          ref={scroller as never}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: nativeDriver })}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          {pages.map((page, pageIndex) => (
            <View key={page.title} style={[styles.page, { width: pageWidth }]} accessible={pageIndex === index}>
              <View style={styles.sceneWrap}>
                <Scene name={page.scene} active={pageIndex === index} />
              </View>
              <View style={styles.copy}>
                <Text variant="display" accessibilityRole="header">
                  {page.title}
                </Text>
                <Text variant="body">{page.body}</Text>
              </View>
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${pages.length}`}>
            {pages.map((page, dot) => {
              const widthAnim = scrollX.interpolate({
                inputRange: [(dot - 1) * pageWidth, dot * pageWidth, (dot + 1) * pageWidth],
                outputRange: [1, 4, 1],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={page.title}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: dot === index ? colors.primary : colors.ruleStrong,
                      transform: [{ scaleX: widthAnim }],
                      marginHorizontal: dot === index ? 10 : 3,
                    },
                  ]}
                />
              );
            })}
          </View>

          {last && audience === "guardian" ? (
            <View style={styles.finalActions}>
              {push === "on" ? <Notice tone="success">Notifications are on.</Notice> : null}
              {push === "unavailable" ? (
                <Notice tone="info">
                  Notifications need the installed SafeTrack app on a phone with permission allowed. You can change this later in Settings.
                </Notice>
              ) : null}
              {push === "idle" || push === "asking" ? (
                <Button label="Allow notifications" icon="notifications-outline" size="lg" loading={push === "asking"} onPress={() => void allowNotifications()} />
              ) : null}
              {linkedChildren.length === 0 ? (
                <Button label="Register your child" variant="forest" icon="person-add-outline" onPress={() => finish("/(auth)/child-registration")} />
              ) : (
                <Button label="Go to Home" variant={push === "idle" ? "secondary" : "forest"} iconRight="arrow-forward" onPress={() => finish()} />
              )}
            </View>
          ) : (
            <View style={styles.nav}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous page"
                disabled={index === 0}
                onPress={() => goTo(index - 1)}
                style={[styles.back, index === 0 && styles.hidden]}
              >
                <Ionicons name="chevron-back" size={22} color={colors.ink} />
              </Pressable>
              <Button
                label={last ? "Start" : "Next"}
                iconRight={last ? "checkmark" : "arrow-forward"}
                size="lg"
                onPress={() => (last ? finish() : goTo(index + 1))}
                style={styles.nextButton}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.surface, alignItems: "center" },
    column: { flex: 1 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, paddingTop: space.sm },
    logo: { width: 52, height: 52 },
    skip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
    pager: { flex: 1 },
    page: { flex: 1, paddingHorizontal: space.xl, justifyContent: "center", gap: space.xl },
    sceneWrap: { alignItems: "center" },
    copy: { gap: space.md },
    footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xl },
    dots: { flexDirection: "row", alignItems: "center", height: 8 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    nav: { flexDirection: "row", alignItems: "center", gap: space.md },
    back: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 1.5,
      borderColor: c.rule,
      alignItems: "center",
      justifyContent: "center",
    },
    hidden: { opacity: 0 },
    nextButton: { flex: 1 },
    finalActions: { gap: space.md },
  }),
);

