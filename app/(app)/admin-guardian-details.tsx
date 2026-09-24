import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchAdminGuardianDetail,
  updateAdminGuardianAccountStatus,
  subscribeAdminUpdates,
  type AccountStatus,
  type AdminGuardianDetail,
} from "../../services/adminService";
import { AdminStatusPill } from "../../components/admin/AdminStatusPill";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

function formatDate(value: string | null) {
  if (!value) return "No stored record";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No stored record";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminGuardianDetailsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const { guardianId } = useLocalSearchParams<{ guardianId?: string }>();

  const [detail, setDetail] = useState<AdminGuardianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!guardianId) {
      setError("Guardian account ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchAdminGuardianDetail(guardianId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Guardian account details.");
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  useEffect(() => {
    void loadDetail();
    const unsubscribe = subscribeAdminUpdates(() => void loadDetail());
    return unsubscribe;
  }, [loadDetail]);

  const changeStatus = () => {
    if (!detail) return;
    const nextStatus: AccountStatus = detail.accountStatus === "active" ? "inactive" : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} account?`,
      `${detail.fullName} will be marked as ${nextStatus}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setSaving(true);
            try {
              await updateAdminGuardianAccountStatus(detail.guardianId, nextStatus);
              setDetail((current) => (current ? { ...current, accountStatus: nextStatus } : current));
              Alert.alert("Account status saved", `${detail.fullName} is now ${nextStatus}.`);
            } catch (reason) {
              Alert.alert(
                "Guardian account update error",
                reason instanceof Error ? reason.message : "SafeTrack could not save the account status.",
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading || error || !detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={[styles.stateIcon, error && styles.stateIconError]}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
            )}
          </View>
          <Text style={styles.stateTitle}>{loading ? "Loading Guardian details" : "Unable to load account"}</Text>
          {!loading ? <Text style={styles.stateText}>{error || "Guardian account details are unavailable."}</Text> : null}
          {!loading ? (
            <Pressable onPress={() => void loadDetail()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Ionicons name="refresh-outline" size={16} color={colors.white} />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const inactive = detail.accountStatus === "inactive";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.page}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={18} color={colors.primaryDark} />
            <Text style={styles.backText}>Guardian accounts</Text>
          </Pressable>

          <View style={styles.identityHeader}>
            <View style={[styles.avatar, inactive && styles.avatarInactive]}>
              <Text style={styles.avatarText}>{detail.fullName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.eyebrow}>GUARDIAN ACCOUNT</Text>
              <View style={styles.nameLine}>
                <Text style={styles.name}>{detail.fullName}</Text>
                <AdminStatusPill label={inactive ? "Inactive" : "Active"} tone={inactive ? "inactive" : "active"} />
              </View>
              <Text style={styles.email}>{detail.email}</Text>
              <Text style={styles.registered}>Registered {formatDate(detail.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.summaryRail}>
            <SummaryItem label="Children" value={detail.registeredChildren} icon="people-outline" />
            <SummaryItem label="Active devices" value={detail.activeDevices} icon="watch-outline" />
            <SummaryItem label="Safe zones" value={detail.activeSafeZones} icon="shield-outline" />
            <SummaryItem
              label="Active SOS"
              value={detail.activeSosAlerts}
              icon="alert-circle-outline"
              danger={detail.activeSosAlerts > 0}
              last
            />
          </View>

          <View style={[styles.detailGrid, wide && styles.detailGridWide]}>
            <View style={styles.childrenColumn}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>LINKED MONITORING PROFILES</Text>
                <Text style={styles.sectionTitle}>Registered children</Text>
              </View>

              {detail.children.length === 0 ? (
                <View style={styles.emptyLine}>
                  <Ionicons name="person-outline" size={20} color={colors.muted} />
                  <View style={styles.emptyCopy}>
                    <Text style={styles.emptyTitle}>No child profile registered</Text>
                    <Text style={styles.emptyText}>This Guardian does not currently have a linked child profile.</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.childrenList}>
                  {detail.children.map((child, index) => (
                    <View key={child.childId} style={[styles.childRow, index !== detail.children.length - 1 && styles.divider]}>
                      <View style={styles.childAvatar}>
                        <Text style={styles.childAvatarText}>{child.fullName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.childCopy}>
                        <Text style={styles.childName}>{child.fullName}</Text>
                        <Text style={styles.childDetail}>
                          {child.age ? `${child.age} years old` : "Age unavailable"}
                          {child.relationship ? ` · ${child.relationship}` : ""}
                        </Text>
                        <View style={styles.childMetaRow}>
                          <Text style={styles.childMeta}>{child.activeDeviceCount} active device{child.activeDeviceCount === 1 ? "" : "s"}</Text>
                          <View style={styles.metaDot} />
                          <Text style={styles.childMeta}>{child.safeZoneCount} safe zone{child.safeZoneCount === 1 ? "" : "s"}</Text>
                        </View>
                        <View style={styles.locationLine}>
                          <Ionicons name="location-outline" size={13} color={colors.muted} />
                          <Text style={styles.locationText}>Latest stored update: {formatDate(child.latestLocationAt)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.statusColumn, wide && styles.statusColumnWide]}>
              <Text style={styles.sectionEyebrow}>ACCOUNT CONTROL</Text>
              <Text style={styles.sectionTitle}>{inactive ? "Account inactive" : "Account active"}</Text>
              <Text style={styles.statusDescription}>
                {inactive
                  ? "This Guardian account is currently marked inactive in the existing SafeTrack account-status workflow."
                  : "This Guardian account is currently marked active in the existing SafeTrack account-status workflow."}
              </Text>

              <View style={styles.statusBoundary}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.statusBoundaryText}>
                  This action changes only the account status through the existing administrator function. Historical monitoring records are not edited here.
                </Text>
              </View>

              <Pressable
                disabled={saving}
                onPress={changeStatus}
                style={({ pressed }) => [
                  styles.statusButton,
                  inactive ? styles.activateButton : styles.deactivateButton,
                  pressed && styles.pressed,
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={inactive ? colors.primaryDark : colors.white} />
                ) : (
                  <Ionicons name={inactive ? "play-outline" : "pause-outline"} size={18} color={inactive ? colors.primaryDark : colors.white} />
                )}
                <Text style={[styles.statusButtonText, inactive && styles.activateButtonText]}>
                  {inactive ? "Activate Guardian account" : "Deactivate Guardian account"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryItem({
  label,
  value,
  icon,
  danger = false,
  last = false,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.summaryItem, !last && styles.summaryDivider]}>
      <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.primary} />
      <View>
        <Text style={[styles.summaryValue, danger && styles.summaryValueDanger]}>{value.toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 110 },
  page: { width: "100%", maxWidth: adminLayout.pageMax, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: 24 },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, minHeight: 38, paddingRight: 10 },
  backText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  identityHeader: { flexDirection: "row", alignItems: "center", gap: 15, marginTop: 17 },
  avatar: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarInactive: { backgroundColor: colors.surfaceStrong },
  avatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: "900" },
  identityCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.primary, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.35 },
  nameLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9, marginTop: 4 },
  name: { color: colors.ink, fontSize: 27, lineHeight: 32, fontWeight: "800", letterSpacing: -0.65 },
  email: { color: colors.text, fontSize: 12.5, marginTop: 4 },
  registered: { color: colors.muted, fontSize: 10.5, marginTop: 4 },
  summaryRail: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 24, paddingVertical: 16 },
  summaryItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12 },
  summaryDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  summaryValue: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  summaryValueDanger: { color: colors.danger },
  summaryLabel: { color: colors.muted, fontSize: 10.5, marginTop: 1 },
  detailGrid: { marginTop: 30, gap: 30 },
  detailGridWide: { flexDirection: "row", alignItems: "flex-start", gap: 38 },
  childrenColumn: { flex: 1.55, minWidth: 0 },
  statusColumn: { flex: 0.85, minWidth: 0 },
  statusColumnWide: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 32 },
  sectionHeader: { marginBottom: 8 },
  sectionEyebrow: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.15 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.3, marginTop: 5 },
  childrenList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 10 },
  childRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  childAvatar: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft },
  childAvatarText: { color: colors.blue, fontSize: 13, fontWeight: "900" },
  childCopy: { flex: 1 },
  childName: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  childDetail: { color: colors.muted, fontSize: 11.5, marginTop: 3 },
  childMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 8 },
  childMeta: { color: colors.text, fontSize: 11 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.subtle },
  locationLine: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 7 },
  locationText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  emptyLine: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 18, marginTop: 10 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  statusDescription: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  statusBoundary: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 13, marginTop: 18 },
  statusBoundaryText: { flex: 1, color: colors.primaryDark, fontSize: 11.2, lineHeight: 17 },
  statusButton: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.md, marginTop: 16, paddingHorizontal: 14 },
  activateButton: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderStrong },
  deactivateButton: { backgroundColor: colors.danger },
  statusButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  activateButtonText: { color: colors.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  stateIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  stateIconError: { backgroundColor: colors.dangerSoft },
  stateTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginTop: 14, textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5, maxWidth: 420 },
  retryButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16, marginTop: 16, ...shadow.soft },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
