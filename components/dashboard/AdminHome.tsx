import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  fetchAdminSummaryMetrics,
  subscribeAdminUpdates,
} from "../../services/adminService";

import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatLastUpdated(value: string | null) {
  if (!value) return "Awaiting sync";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

type AdminSummaryMetrics = {
  guardianAccounts: number;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  locationRecords: number;
  activeSosAlerts: number;
  generatedReports: number;
};

type AdminAction = {
  index: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route:
    | "/(app)/admin-guardians"
    | "/(app)/admin-devices"
    | "/(app)/admin-reports";
};

const ACTIONS: AdminAction[] = [
  {
    index: "01",
    title: "Guardian accounts",
    description:
      "Review registered guardians and the existing account-status workflow.",
    icon: "people-outline",
    route: "/(app)/admin-guardians",
  },
  {
    index: "02",
    title: "Smartwatch devices",
    description:
      "Review linked watches, child ownership context, and device status.",
    icon: "watch-outline",
    route: "/(app)/admin-devices",
  },
  {
    index: "03",
    title: "System reports",
    description:
      "Retrieve authorized records and export the existing PDF or Excel report.",
    icon: "document-text-outline",
    route: "/(app)/admin-reports",
  },
];

const EMPTY_METRICS: AdminSummaryMetrics = {
  guardianAccounts: 0,
  registeredChildren: 0,
  activeDevices: 0,
  activeSafeZones: 0,
  locationRecords: 0,
  activeSosAlerts: 0,
  generatedReports: 0,
};

export function AdminHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const desktop = width >= 1160;
  const tablet = width >= 820;

  const [metrics, setMetrics] =
    useState<AdminSummaryMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      setError(null);

      const result = await fetchAdminSummaryMetrics();

      setMetrics(result);
      setLastUpdated(new Date().toISOString());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();

    const unsubscribe = subscribeAdminUpdates(() => {
      void loadMetrics();
    });

    return unsubscribe;
  }, [loadMetrics]);

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadMetrics();

    setRefreshing(false);
  };

  const data = metrics ?? EMPTY_METRICS;

  const maxMetric = useMemo(
    () =>
      Math.max(
        data.guardianAccounts,
        data.registeredChildren,
        data.activeDevices,
        data.activeSafeZones,
        data.activeSosAlerts,
        1,
      ),
    [data],
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <View style={[styles.stateCard, shadow.soft]}>
          <View style={styles.stateGlyph}>
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />
          </View>

          <Text style={styles.stateEyebrow}>
            SAFETRACK ADMIN
          </Text>

          <Text style={styles.stateTitle}>
            Preparing the operations view
          </Text>

          <Text style={styles.stateText}>
            Retrieving authorized account, device,
            safety, and report records.
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerState}>
        <View style={[styles.stateCard, shadow.soft]}>
          <View
            style={[
              styles.stateGlyph,
              styles.stateGlyphDanger,
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={colors.danger}
            />
          </View>

          <Text style={styles.stateEyebrow}>
            SAFETRACK ADMIN
          </Text>

          <Text style={styles.stateTitle}>
            Dashboard could not be loaded
          </Text>

          <Text style={styles.stateText}>
            {error}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => void loadMetrics()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color={colors.white}
            />

            <Text style={styles.retryButtonText}>
              Try again
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const needsAttention =
    data.activeSosAlerts > 0;

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.scrollContent}
    >
      <View
        pointerEvents="none"
        style={styles.pageWashOne}
      />

      <View
        pointerEvents="none"
        style={styles.pageWashTwo}
      />

      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={styles.headerKickerRow}>
              <View style={styles.headerKickerMark} />

              <Text style={styles.headerKicker}>
                ADMINISTRATOR WORKSPACE
              </Text>

              <View style={styles.headerKickerRule} />
            </View>

            <Text style={styles.title}>
              SafeTrack operations
            </Text>

            <Text style={styles.subtitle}>
              A clear operational view of the existing
              Guardian, child, smartwatch, location,
              safe-zone, SOS, and report records
              available to administrators.
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Refresh administrator dashboard"
            onPress={() => void handleRefresh()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={17}
              color={colors.primaryDark}
            />

            <Text style={styles.refreshText}>
              Refresh
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.situationBoard,
            shadow.lifted,
          ]}
        >
          <View style={styles.boardTopLine} />

          <View style={styles.boardCornerMark} />

          <View style={styles.boardWash} />

          <View
            style={[
              styles.boardGrid,
              desktop && styles.boardGridDesktop,
            ]}
          >
            <View style={styles.boardMain}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusSeal,
                    needsAttention &&
                      styles.statusSealDanger,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      needsAttention &&
                        styles.statusDotDanger,
                    ]}
                  />

                  <Text
                    style={[
                      styles.statusText,
                      needsAttention &&
                        styles.statusTextDanger,
                    ]}
                  >
                    {needsAttention
                      ? "ATTENTION NEEDED"
                      : "SYSTEM OPERATIONAL"}
                  </Text>
                </View>

                <Text style={styles.syncText}>
                  Last sync ·{" "}
                  {formatLastUpdated(lastUpdated)}
                </Text>
              </View>

              <Text style={styles.boardTitle}>
                The system in one field of view.
              </Text>

              <Text style={styles.boardDescription}>
                The visual field below is built only
                from the current SafeTrack totals. It
                does not add placeholder activity or
                simulated records.
              </Text>

              <View
                style={[
                  styles.fieldRow,
                  !tablet && styles.fieldRowStack,
                ]}
              >
                <View style={styles.orbitField}>
                  <View
                    style={[
                      styles.orbitRing,
                      styles.orbitRingOuter,
                    ]}
                  />

                  <View
                    style={[
                      styles.orbitRing,
                      styles.orbitRingMiddle,
                    ]}
                  />

                  <View
                    style={[
                      styles.orbitRing,
                      styles.orbitRingInner,
                    ]}
                  />

                  <View
                    style={styles.orbitAxisHorizontal}
                  />

                  <View
                    style={styles.orbitAxisVertical}
                  />

                  <OrbitNode
                    style={styles.nodeTop}
                    label="Guardians"
                    value={data.guardianAccounts}
                    maxValue={maxMetric}
                    color={colors.primary}
                  />

                  <OrbitNode
                    style={styles.nodeRight}
                    label="Devices"
                    value={data.activeDevices}
                    maxValue={maxMetric}
                    color={colors.cyan}
                  />

                  <OrbitNode
                    style={styles.nodeBottom}
                    label="Safe zones"
                    value={data.activeSafeZones}
                    maxValue={maxMetric}
                    color={colors.amber}
                  />

                  <OrbitNode
                    style={styles.nodeLeft}
                    label="SOS"
                    value={data.activeSosAlerts}
                    maxValue={maxMetric}
                    color={colors.danger}
                  />

                  <View style={styles.orbitCore}>
                    <Text
                      style={styles.orbitCoreValue}
                    >
                      {formatNumber(
                        data.registeredChildren,
                      )}
                    </Text>

                    <Text
                      style={styles.orbitCoreLabel}
                    >
                      CHILDREN
                    </Text>
                  </View>
                </View>

                <View
                  style={styles.trackingFeature}
                >
                  <Text
                    style={styles.featureEyebrow}
                  >
                    TRACKING RECORDS
                  </Text>

                  <Text style={styles.featureValue}>
                    {formatNumber(
                      data.locationRecords,
                    )}
                  </Text>

                  <Text style={styles.featureLabel}>
                    stored location records
                  </Text>

                  <View style={styles.routeSketch}>
                    <View
                      style={[
                        styles.routeSegment,
                        { flex: 1 },
                      ]}
                    />

                    <View style={styles.routePoint} />

                    <View
                      style={[
                        styles.routeSegment,
                        { flex: 0.7 },
                      ]}
                    />

                    <View
                      style={[
                        styles.routePoint,
                        styles.routePointSecondary,
                      ]}
                    />

                    <View
                      style={[
                        styles.routeSegment,
                        { flex: 1.35 },
                      ]}
                    />
                  </View>

                  <View
                    style={styles.trackingMetaRow}
                  >
                    <View
                      style={
                        styles.trackingMetaItem
                      }
                    >
                      <Text
                        style={
                          styles.trackingMetaValue
                        }
                      >
                        {formatNumber(
                          data.activeSafeZones,
                        )}
                      </Text>

                      <Text
                        style={
                          styles.trackingMetaLabel
                        }
                      >
                        SAFE ZONES
                      </Text>
                    </View>

                    <View
                      style={styles.trackingMetaRule}
                    />

                    <View
                      style={
                        styles.trackingMetaItem
                      }
                    >
                      <Text
                        style={
                          styles.trackingMetaValue
                        }
                      >
                        {formatNumber(
                          data.generatedReports,
                        )}
                      </Text>

                      <Text
                        style={
                          styles.trackingMetaLabel
                        }
                      >
                        REPORTS
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.boardAside}>
              <View
                style={[
                  styles.sosModule,
                  needsAttention &&
                    styles.sosModuleActive,
                ]}
              >
                <View
                  style={styles.sosHeaderRow}
                >
                  <Text style={styles.sosEyebrow}>
                    SOS / PRIORITY
                  </Text>

                  <View
                    style={styles.sosSignalIcon}
                  >
                    <View
                      style={styles.sosSignalCore}
                    />
                  </View>
                </View>

                <Text style={styles.sosValue}>
                  {formatNumber(
                    data.activeSosAlerts,
                  )}
                </Text>

                <Text style={styles.sosLabel}>
                  Active SOS records
                </Text>

                <Text
                  style={styles.sosDescription}
                >
                  {needsAttention
                    ? "Existing active SOS records should be reviewed through the supported SafeTrack workflow."
                    : "No active SOS record currently requires administrator attention."}
                </Text>
              </View>

              <View style={styles.asideLedger}>
                <LedgerLine
                  icon="people-outline"
                  label="Guardian accounts"
                  value={data.guardianAccounts}
                />

                <LedgerLine
                  icon="watch-outline"
                  label="Active devices"
                  value={data.activeDevices}
                />

                <LedgerLine
                  icon="people-circle-outline"
                  label="Children"
                  value={data.registeredChildren}
                  last
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionKicker}>
              RECORD LEDGER
            </Text>

            <Text style={styles.sectionTitle}>
              What is currently stored
            </Text>
          </View>

          <Text style={styles.sectionMeta}>
            Existing SafeTrack totals only
          </Text>
        </View>

        <View
          style={[
            styles.ledgerBand,
            tablet && styles.ledgerBandWide,
          ]}
        >
          <LedgerMetric
            index="A"
            icon="people-circle-outline"
            value={data.registeredChildren}
            label="Children"
            detail="Registered monitoring profiles"
            accent={colors.primary}
          />

          <LedgerMetric
            index="B"
            icon="scan-circle-outline"
            value={data.activeSafeZones}
            label="Safe zones"
            detail="Active guardian-defined boundaries"
            accent={colors.cyan}
          />

          <LedgerMetric
            index="C"
            icon="location-outline"
            value={data.locationRecords}
            label="Location records"
            detail="Stored tracking data points"
            accent={colors.amber}
          />

          <LedgerMetric
            index="D"
            icon="document-text-outline"
            value={data.generatedReports}
            label="Reports"
            detail={
              data.generatedReports > 0
                ? "Generated report records"
                : "No generated reports stored"
            }
            accent={colors.violet}
            last
          />
        </View>

        <View
          style={[
            styles.lowerGrid,
            desktop && styles.lowerGridDesktop,
          ]}
        >
          <View
            style={[
              styles.actionsPanel,
              shadow.soft,
            ]}
          >
            <View style={styles.actionsIntroRow}>
              <View>
                <Text
                  style={styles.sectionKicker}
                >
                  ADMINISTRATIVE FUNCTIONS
                </Text>

                <Text
                  style={styles.sectionTitle}
                >
                  Move directly to the next task
                </Text>
              </View>

              <Ionicons
                name="arrow-forward-circle-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <View style={styles.actionList}>
              {ACTIONS.map((action, index) => (
                <Pressable
                  key={action.index}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(action.route)
                  }
                  style={({ pressed }) => [
                    styles.actionRow,
                    index !==
                      ACTIONS.length - 1 &&
                      styles.actionDivider,
                    pressed &&
                      styles.actionPressed,
                  ]}
                >
                  <Text
                    style={styles.actionIndex}
                  >
                    {action.index}
                  </Text>

                  <View style={styles.actionIcon}>
                    <Ionicons
                      name={action.icon}
                      size={20}
                      color={colors.primaryDark}
                    />
                  </View>

                  <View style={styles.actionCopy}>
                    <Text
                      style={styles.actionTitle}
                    >
                      {action.title}
                    </Text>

                    <Text
                      style={
                        styles.actionDescription
                      }
                    >
                      {action.description}
                    </Text>
                  </View>

                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.primaryDark}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View
            style={[
              styles.boundaryPanel,
              shadow.soft,
            ]}
          >
            <Text style={styles.boundaryIndex}>
              ADMIN / 04
            </Text>

            <Ionicons
              name="shield-checkmark-outline"
              size={27}
              color={colors.primary}
            />

            <Text style={styles.boundaryTitle}>
              Administrative boundary
            </Text>

            <Text style={styles.boundaryText}>
              Administrator actions remain limited
              to the functions already provided by
              SafeTrack. Historical location,
              geofence, SOS, and activity records
              are presented for authorized use and
              are not edited from this workspace.
            </Text>

            <View style={styles.boundaryRule} />

            <Text style={styles.boundaryFoot}>
              AUTHORIZED ADMINISTRATOR SESSION
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function OrbitNode({
  label,
  value,
  maxValue,
  color,
  style,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  style: object;
}) {
  const ratio =
    maxValue > 0 ? value / maxValue : 0;

  const size =
    24 + Math.min(18, ratio * 18);

  return (
    <View
      style={[
        styles.orbitNodeWrap,
        style,
      ]}
    >
      <View
        style={[
          styles.orbitNode,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />

      <View
        style={styles.orbitNodeLabelWrap}
      >
        <Text style={styles.orbitNodeValue}>
          {formatNumber(value)}
        </Text>

        <Text style={styles.orbitNodeLabel}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function LedgerLine({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.ledgerLine,
        !last &&
          styles.ledgerLineDivider,
      ]}
    >
      <Ionicons
        name={icon}
        size={17}
        color={colors.primaryDark}
      />

      <Text style={styles.ledgerLineLabel}>
        {label}
      </Text>

      <Text style={styles.ledgerLineValue}>
        {formatNumber(value)}
      </Text>
    </View>
  );
}

function LedgerMetric({
  index,
  icon,
  value,
  label,
  detail,
  accent,
  last = false,
}: {
  index: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  detail: string;
  accent: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.ledgerMetric,
        !last &&
          styles.ledgerMetricDivider,
      ]}
    >
      <View style={styles.ledgerMetricTop}>
        <Text
          style={styles.ledgerMetricIndex}
        >
          {index}
        </Text>

        <Ionicons
          name={icon}
          size={19}
          color={accent}
        />
      </View>

      <Text style={styles.ledgerMetricValue}>
        {formatNumber(value)}
      </Text>

      <Text style={styles.ledgerMetricLabel}>
        {label}
      </Text>

      <Text
        style={styles.ledgerMetricDetail}
      >
        {detail}
      </Text>

      <View
        style={[
          styles.ledgerMetricAccent,
          {
            backgroundColor: accent,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingBottom: 112,
  },

  pageWashOne: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.overlayOne,
  },

  pageWashTwo: {
    position: "absolute",
    top: 410,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.overlayTwo,
  },

  page: {
    width: "100%",
    maxWidth: adminLayout.pageMax,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 30,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
  },

  headerCopy: {
    flex: 1,
    minWidth: 280,
    maxWidth: 860,
  },

  headerKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    maxWidth: 420,
  },

  headerKickerMark: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  headerKickerRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderStrong,
  },

  headerKicker: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.45,
  },

  title: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1.15,
  },

  subtitle: {
    marginTop: 9,
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 21,
    maxWidth: 780,
  },

  refreshButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.soft,
  },

  refreshText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },

  situationBoard: {
    position: "relative",
    marginTop: 28,
    overflow: "hidden",
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  boardTopLine: {
    height: 5,
    backgroundColor: colors.primary,
  },

  boardCornerMark: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 22,
    height: 22,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.borderStrong,
  },

  boardWash: {
    position: "absolute",
    top: -70,
    right: 150,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.overlayOne,
  },

  boardGrid: {
    padding: 24,
    gap: 20,
  },

  boardGridDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  boardMain: {
    flex: 1.6,
    minWidth: 0,
  },

  boardAside: {
    flex: 0.72,
    minWidth: 280,
    gap: 14,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  statusSeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    minHeight: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#C6E2D5",
  },

  statusSealDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#F1C8CB",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  statusDotDanger: {
    backgroundColor: colors.danger,
  },

  statusText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.15,
  },

  statusTextDanger: {
    color: colors.danger,
  },

  syncText: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "700",
  },

  boardTitle: {
    marginTop: 18,
    maxWidth: 700,
    color: colors.ink,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "800",
    letterSpacing: -0.9,
  },

  boardDescription: {
    marginTop: 8,
    maxWidth: 710,
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 19,
  },

  fieldRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 18,
  },

  fieldRowStack: {
    flexDirection: "column",
  },

  orbitField: {
    flex: 1,
    minHeight: 290,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  orbitRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },

  orbitRingOuter: {
    width: 240,
    height: 240,
  },

  orbitRingMiddle: {
    width: 168,
    height: 168,
  },

  orbitRingInner: {
    width: 98,
    height: 98,
  },

  orbitAxisHorizontal: {
    position: "absolute",
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: colors.border,
  },

  orbitAxisVertical: {
    position: "absolute",
    top: 28,
    bottom: 28,
    width: 1,
    backgroundColor: colors.border,
  },

  orbitCore: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
    ...shadow.soft,
  },

  orbitCoreValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.55,
  },

  orbitCoreLabel: {
    marginTop: 2,
    color: "#DCE8E5",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  orbitNodeWrap: {
    position: "absolute",
    alignItems: "center",
    gap: 6,
  },

  nodeTop: {
    top: 22,
  },

  nodeRight: {
    right: 18,
  },

  nodeBottom: {
    bottom: 20,
  },

  nodeLeft: {
    left: 18,
  },

  orbitNode: {
    borderWidth: 4,
    borderColor: colors.surfaceRaised,
    ...shadow.soft,
  },

  orbitNodeLabelWrap: {
    alignItems: "center",
  },

  orbitNodeValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },

  orbitNodeLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "700",
  },

  trackingFeature: {
    flex: 0.86,
    minWidth: 230,
    minHeight: 290,
    borderRadius: radius.xl,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: "#E9E1D0",
    padding: 18,
  },

  featureEyebrow: {
    color: colors.amber,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.25,
  },

  featureValue: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 43,
    lineHeight: 46,
    fontWeight: "800",
    letterSpacing: -1.4,
  },

  featureLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  routeSketch: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  routeSegment: {
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.amber,
    opacity: 0.65,
  },

  routePoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.cream,
  },

  routePointSecondary: {
    backgroundColor: colors.cyan,
  },

  trackingMetaRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
  },

  trackingMetaItem: {
    flex: 1,
  },

  trackingMetaRule: {
    width: 1,
    height: 42,
    backgroundColor: "#E6DCC7",
    marginHorizontal: 12,
  },

  trackingMetaValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },

  trackingMetaLabel: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sosModule: {
    borderRadius: radius.xl,
    padding: 18,
    backgroundColor: "#FFF7F7",
    borderWidth: 1,
    borderColor: "#F0D7D8",
  },

  sosModuleActive: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#EDBEC1",
  },

  sosHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sosEyebrow: {
    color: colors.danger,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  sosSignalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(214,95,102,0.10)",
  },

  sosSignalCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },

  sosValue: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 44,
    lineHeight: 47,
    fontWeight: "800",
    letterSpacing: -1.3,
  },

  sosLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },

  sosDescription: {
    color: colors.text,
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: 8,
  },

  asideLedger: {
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },

  ledgerLine: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },

  ledgerLineDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  ledgerLineLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 11.5,
    fontWeight: "700",
  },

  ledgerLineValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  sectionHeadingRow: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    flexWrap: "wrap",
  },

  sectionKicker: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.35,
  },

  sectionTitle: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.45,
  },

  sectionMeta: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "700",
  },

  ledgerBand: {
    marginTop: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.soft,
  },

  ledgerBandWide: {
    flexDirection: "row",
  },

  ledgerMetric: {
    flex: 1,
    minWidth: 0,
    padding: 18,
    position: "relative",
  },

  ledgerMetricDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  ledgerMetricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ledgerMetricIndex: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  ledgerMetricValue: {
    marginTop: 18,
    color: colors.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.85,
  },

  ledgerMetricLabel: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 4,
  },

  ledgerMetricDetail: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 4,
    minHeight: 32,
  },

  ledgerMetricAccent: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 0,
    height: 3,
    borderRadius: 2,
  },

  lowerGrid: {
    marginTop: 18,
    gap: 18,
  },

  lowerGridDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  actionsPanel: {
    flex: 1.45,
    minWidth: 0,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },

  actionsIntroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },

  actionList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  actionRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },

  actionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  actionPressed: {
    opacity: 0.72,
    transform: [
      {
        translateX: 3,
      },
    ],
  },

  actionIndex: {
    width: 26,
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },

  actionCopy: {
    flex: 1,
    minWidth: 0,
  },

  actionTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
  },

  actionDescription: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 4,
  },

  boundaryPanel: {
    flex: 0.78,
    minWidth: 0,
    borderRadius: radius.xl,
    backgroundColor: colors.mint,
    borderWidth: 1,
    borderColor: "#CFE4DA",
    padding: 20,
  },

  boundaryIndex: {
    alignSelf: "flex-start",
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },

  boundaryTitle: {
    marginTop: 18,
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  boundaryText: {
    marginTop: 9,
    color: colors.text,
    fontSize: 11.5,
    lineHeight: 18,
  },

  boundaryRule: {
    height: 1,
    backgroundColor: "#C2DCCF",
    marginTop: 20,
  },

  boundaryFoot: {
    marginTop: 10,
    color: colors.primaryDark,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },

  stateCard: {
    width: "100%",
    maxWidth: 540,
    alignItems: "center",
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
  },

  stateGlyph: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },

  stateGlyphDanger: {
    backgroundColor: colors.dangerSoft,
  },

  stateEyebrow: {
    marginTop: 16,
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.25,
  },

  stateTitle: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    textAlign: "center",
  },

  stateText: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 420,
  },

  retryButton: {
    marginTop: 16,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 17,
  },

  retryButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.76,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },
});