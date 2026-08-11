import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { useSosStore } from "../../store/sosStore";
import { supabase } from "../../lib/supabase";
import { LocationMapCard } from "../location/LocationMapCard";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function firstName(value?: string) {
  return value?.trim().split(/\s+/)[0] || "Guardian";
}

function relativeTime(value?: string | null) {
  if (!value) {
    return "No update recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No update recorded";
  }

  const difference = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.round(difference / 60_000);

  if (minutes < 1) {
    return "Updated just now";
  }

  if (minutes < 60) {
    return `Updated ${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `Updated ${hours} hr ago`;
  }

  return `Updated ${Math.round(hours / 24)} day(s) ago`;
}

function getChildMobileAccessText(source?: string) {
  const normalized = source?.trim().toLowerCase();

  if (normalized === "both") {
    return "Smartwatch and child phone access";
  }

  if (normalized === "mobile") {
    return "Child phone access is available";
  }

  return "Mobile access requires Mobile or Both";
}

function QuickAction({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.quickIcon,
          danger && styles.quickIconDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={23}
          color={danger ? colors.danger : colors.primary}
        />
      </View>

      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

export function GuardianHome() {
  const router = useRouter();

  const guardian = useAuthStore((state) => state.guardian);
  const linkedChildren = useAuthStore((state) => state.linkedChildren);

  const primaryChild = linkedChildren[0] ?? null;

  const childInfo = primaryChild as
    | (typeof primaryChild & {
        age?: number;
        relationship?: string;
        trackingSource?: string;
      })
    | null;

  const latest = useLocationStore((state) => state.latest);
  const isLocationLoading = useLocationStore((state) => state.isLoading);
  const loadLocation = useLocationStore((state) => state.loadForChild);

  const alerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);

  const [activeZones, setActiveZones] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const activeSos = useMemo(
    () => alerts.filter((alert) => alert.status === "active").length,
    [alerts]
  );

  const hasActiveSos = activeSos > 0;

  useEffect(() => {
    if (!primaryChild?.id) {
      return;
    }

    void loadLocation(primaryChild.id);
    void loadSos(primaryChild.id);

    const intervalId = setInterval(() => {
      void loadLocation(primaryChild.id);
      void loadSos(primaryChild.id);
    }, 30_000);

    return () => clearInterval(intervalId);
  }, [primaryChild?.id, loadLocation, loadSos]);

  useEffect(() => {
    if (!guardian?.id || !primaryChild?.id) {
      setActiveZones(0);
      return;
    }

    const loadSafeZones = async () => {
      const { count, error } = await supabase
        .from("geofences")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("guardian_id", guardian.id)
        .eq("child_id", primaryChild.id)
        .eq("is_enabled", true);

      if (!error) {
        setActiveZones(count ?? 0);
      }
    };

    void loadSafeZones();
  }, [guardian?.id, primaryChild?.id]);

  const refresh = async () => {
    if (!primaryChild) {
      return;
    }

    setRefreshing(true);

    try {
      await Promise.all([
        loadLocation(primaryChild.id),
        loadSos(primaryChild.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!primaryChild) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>
          Hello, {firstName(guardian?.fullName)}
        </Text>

        <Text style={styles.subtitle}>
          Complete child setup to begin monitoring.
        </Text>

        <Pressable
          onPress={() => router.push("/(auth)/child-registration")}
          style={({ pressed }) => [
            styles.setupCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.setupIcon}>
            <Ionicons
              name="person-add-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.setupCopy}>
            <Text style={styles.setupTitle}>Register your child</Text>

            <Text style={styles.setupText}>
              Add a child profile before using SafeTrack location, safe-zone,
              SOS, and child-device features.
            </Text>
          </View>

          <Ionicons
            name="arrow-forward"
            size={20}
            color={colors.primaryDark}
          />
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>
            Hello, {firstName(guardian?.fullName)}
          </Text>

          <Text style={styles.subtitle}>
            {primaryChild.fullName}&apos;s latest safety information.
          </Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {primaryChild.fullName.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <LocationMapCard
        location={latest}
        height={286}
        loading={refreshing || isLocationLoading}
        onRefresh={() => void refresh()}
      />

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons
            name="shield-checkmark-outline"
            color={colors.primary}
            size={20}
          />

          <Text style={styles.metricValue}>{activeZones}</Text>
          <Text style={styles.metricLabel}>Safe zones</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Ionicons
            name="warning-outline"
            color={hasActiveSos ? colors.danger : colors.primary}
            size={20}
          />

          <Text style={styles.metricValue}>{activeSos}</Text>
          <Text style={styles.metricLabel}>Active SOS</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Ionicons
            name="location-outline"
            color={colors.primary}
            size={20}
          />

          <Text style={styles.metricValue}>{latest ? "1" : "0"}</Text>
          <Text style={styles.metricLabel}>Location record</Text>
        </View>
      </View>

      <View style={styles.notice}>
        <Ionicons
          name={
            hasActiveSos
              ? "alert-circle-outline"
              : "checkmark-circle-outline"
          }
          size={19}
          color={hasActiveSos ? colors.danger : colors.primary}
        />

        <Text
          style={[
            styles.noticeText,
            hasActiveSos && styles.noticeDanger,
          ]}
        >
          {hasActiveSos
            ? "An SOS alert requires your acknowledgement."
            : "No active safety alert needs your attention."}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Quick access</Text>

      <View style={styles.quickActions}>
        <QuickAction
          icon="location-outline"
          label="Location"
          onPress={() => router.push("/location")}
        />

        <QuickAction
          icon="shield-checkmark-outline"
          label="Safety"
          onPress={() => router.push("/safety-center")}
        />

        <QuickAction
          icon="warning-outline"
          label="SOS alerts"
          danger={hasActiveSos}
          onPress={() => router.push("/sos-alerts")}
        />
      </View>

      <Text style={styles.sectionTitle}>Child connection</Text>

      <Pressable
        onPress={() => router.push("/child-mobile-link")}
        style={({ pressed }) => [
          styles.childRow,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.childAvatar}>
          <Text style={styles.childInitial}>
            {primaryChild.fullName.trim().charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.childCopy}>
          <Text style={styles.childName}>{primaryChild.fullName}</Text>

          <Text style={styles.childDetail}>
            {childInfo?.age ? `${childInfo.age} years old · ` : ""}
            {childInfo?.relationship || "Guardian"}
          </Text>

          <Text style={styles.watchText}>
            {getChildMobileAccessText(childInfo?.trackingSource)}
          </Text>
        </View>

        <View style={styles.childAction}>
          <Ionicons
            name="phone-portrait-outline"
            size={18}
            color={colors.primaryDark}
          />

          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.primaryDark}
          />
        </View>
      </Pressable>

      <Text style={styles.latestRecordText}>
        Latest stored location: {relativeTime(latest?.recordedAt)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingTop: 44,
    paddingBottom: 36,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerCopy: {
    flex: 1,
    marginRight: 14,
  },

  greeting: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -0.9,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 4,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "900",
  },

  metrics: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingVertical: 13,
    marginTop: 18,
    ...shadow.soft,
  },

  metric: {
    flex: 1,
    alignItems: "center",
  },

  metricValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  metricLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },

  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 3,
  },

  noticeText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "800",
    marginLeft: 8,
  },

  noticeDanger: {
    color: colors.danger,
  },

  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 21,
    marginBottom: 10,
  },

  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  quickAction: {
    width: "30%",
    alignItems: "center",
  },

  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 19,
    backgroundColor: colors.softMint,
    alignItems: "center",
    justifyContent: "center",
  },

  quickIconDanger: {
    backgroundColor: colors.dangerSoft,
  },

  quickText: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },

  childRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },

  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },

  childInitial: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
  },

  childCopy: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },

  childName: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "900",
  },

  childDetail: {
    color: colors.muted,
    fontSize: 12.5,
    marginTop: 2,
  },

  watchText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
  },

  childAction: {
    width: 45,
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: colors.softMint,
  },

  latestRecordText: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },

  setupCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 24,
    ...shadow.card,
  },

  setupIcon: {
    width: 47,
    height: 47,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.softMint,
  },

  setupCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  setupTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  setupText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
});