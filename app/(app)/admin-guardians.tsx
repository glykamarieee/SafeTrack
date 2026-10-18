import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { showAlert } from "../../lib/platformAlert";
import {
  fetchAdminGuardianAccounts,
  fetchAdminGuardianDetail,
  subscribeAdminUpdates,
  updateAdminGuardianAccountStatus,
  type AdminGuardianAccount,
  type AdminGuardianDetail,
} from "../../services/adminService";
import { AdminSearchField } from "../../components/admin/AdminSearchField";
import { Rise, Skeleton, SlideOver, TonePill, TopBar, initials, phTime, showToast, timeAgo } from "../../components/admin/kit";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius } from "../../theme/tokens";

type Sort = "name" | "newest" | "sos";
const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "newest", label: "Newest" },
  { id: "sos", label: "Active SOS" },
];

const SOURCE: Record<string, string> = { smartwatch: "Smartwatch", mobile: "Phone", both: "Watch + phone" };

function dateOnly(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}

/** Guardian accounts: searchable, sortable table with a detail slide-over. */
export default function AdminGuardiansScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const table = width >= 900;

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [accounts, setAccounts] = useState<AdminGuardianAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminGuardianDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        setAccounts(await fetchAdminGuardianAccounts(search));
        setUpdatedAt(new Date().toISOString());
      } catch (reason) {
        if (!silent) setError(reason instanceof Error ? reason.message : "Unable to load guardian accounts.");
      }
    },
    [search],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    const unsubscribe = subscribeAdminUpdates(() => void load(true));
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
    if (!openId) return;
    let live = true;
    fetchAdminGuardianDetail(openId)
      .then((value) => live && setDetail(value))
      .catch((reason: Error) => live && setDetailError(reason.message));
    return () => {
      live = false;
    };
  }, [openId]);

  const sorted = useMemo(() => {
    const list = [...(accounts ?? [])];
    if (sort === "name") list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (sort === "newest") list.sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
    if (sort === "sos") list.sort((a, b) => b.activeSosAlerts - a.activeSosAlerts || a.fullName.localeCompare(b.fullName));
    return list;
  }, [accounts, sort]);

  const changeStatus = (account: { guardianId: string; fullName: string; accountStatus: "active" | "inactive" }) => {
    const next = account.accountStatus === "active" ? "inactive" : "active";
    showAlert(`${next === "active" ? "Turn on" : "Turn off"} this guardian account?`, `${account.fullName} will be marked as ${next}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: next === "active" ? "Turn on" : "Turn off",
        style: next === "inactive" ? "destructive" : "default",
        onPress: async () => {
          setSavingId(account.guardianId);
          try {
            await updateAdminGuardianAccountStatus(account.guardianId, next);
            setAccounts((list) => (list ?? []).map((item) => (item.guardianId === account.guardianId ? { ...item, accountStatus: next } : item)));
            setDetail((value) => (value && value.guardianId === account.guardianId ? { ...value, accountStatus: next } : value));
            showToast(`${account.fullName} is now ${next}.`);
          } catch (reason) {
            showToast(reason instanceof Error ? reason.message : "SafeTrack could not save the account status.", "error");
          } finally {
            setSavingId(null);
          }
        },
      },
    ]);
  };

  const totalSos = (accounts ?? []).reduce((sum, account) => sum + account.activeSosAlerts, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]} edges={["top", "left", "right"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <Rise index={0}>
          <TopBar
            crumb="Guardians"
            title="Guardian accounts"
            subtitle="Every guardian, their children, linked watches and active SOS alerts. Open one to see the full picture."
            updatedAt={updatedAt}
          />
        </Rise>

        <Rise index={1} style={styles.toolbar}>
          <View style={styles.search}>
            <AdminSearchField value={search} onChangeText={setSearch} placeholder="Search name or email" />
          </View>
          <View style={[styles.sortBox, { backgroundColor: colors.sunken }]}>
            {SORTS.map((item) => {
              const selected = item.id === sort;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Sort by ${item.label}`}
                  onPress={() => setSort(item.id)}
                  style={[styles.sortItem, selected && { backgroundColor: colors.surface }]}
                >
                  <Text variant="label" weight={selected ? "800" : "600"} tone={selected ? "ink" : "muted"}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.summary}>
            <TonePill tone="ok" label={`${accounts?.length ?? "–"} accounts`} />
            {totalSos > 0 ? <TonePill tone="active" label={`${totalSos} active SOS`} /> : null}
          </View>
        </Rise>

        {error ? (
          <View style={[styles.state, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
            <Text weight="800">Guardians couldn&apos;t load</Text>
            <Text variant="caption" tone="muted" align="center">
              {error}
            </Text>
            <Button label="Try again" size="sm" icon="refresh" onPress={() => void load()} />
          </View>
        ) : (
          <Rise index={2} style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
            {table ? (
              <View style={[styles.row, styles.head, { borderBottomColor: colors.rule, backgroundColor: colors.sunken }]}>
                <Text variant="legend" style={styles.colName}>Guardian</Text>
                <Text variant="legend" style={styles.colNum}>Children</Text>
                <Text variant="legend" style={styles.colNum}>Devices</Text>
                <Text variant="legend" style={styles.colNum}>Active SOS</Text>
                <Text variant="legend" style={styles.colStatus}>Status</Text>
                <Text variant="legend" style={styles.colDate}>Registered</Text>
                <View style={styles.colAction} />
              </View>
            ) : null}

            {accounts === null
              ? [0, 1, 2, 3, 4].map((index) => (
                  <View key={index} style={[styles.row, { borderBottomColor: colors.rule }]}>
                    <Skeleton width={36} height={36} radius={18} />
                    <View style={{ flex: 1, gap: 6, marginLeft: 12 }}>
                      <Skeleton width="30%" height={13} />
                      <Skeleton width="45%" height={10} />
                    </View>
                  </View>
                ))
              : sorted.length === 0
                ? (
                  <View style={styles.empty}>
                    <Ionicons name="people-outline" size={26} color={colors.muted} />
                    <Text variant="caption" tone="muted">
                      {search.trim() ? "No guardian matches this search." : "No guardian accounts yet."}
                    </Text>
                  </View>
                )
                : sorted.map((account) => (
                    <Pressable
                      key={account.guardianId}
                      accessibilityRole="button"
                      accessibilityLabel={`${account.fullName}, ${account.registeredChildren} children, ${account.activeSosAlerts} active SOS. Open`}
                      onPress={() => setOpenId(account.guardianId)}
                      style={(state) => [
                        styles.row,
                        { borderBottomColor: colors.rule },
                        ((state as { hovered?: boolean }).hovered || state.pressed) && { backgroundColor: colors.sunken },
                      ]}
                    >
                      {(state) => {
                        const hovered = Boolean((state as { hovered?: boolean }).hovered);
                        const off = account.accountStatus !== "active";
                        return (
                          <>
                            <View style={[styles.colName, styles.who]}>
                              <View style={[styles.avatar, { backgroundColor: off ? colors.sunken : colors.primaryTint, borderColor: off ? colors.ruleStrong : colors.brand }]}>
                                <Text variant="caption" weight="800" tone={off ? "muted" : "primary"}>
                                  {initials(account.fullName)}
                                </Text>
                              </View>
                              <View style={styles.flex}>
                                <Text weight="800" numberOfLines={1}>
                                  {account.fullName}
                                </Text>
                                <Text variant="caption" tone="muted" numberOfLines={1}>
                                  {account.email}
                                </Text>
                              </View>
                            </View>
                            {table ? (
                              <>
                                <Text weight="700" tabular style={styles.colNum}>{account.registeredChildren}</Text>
                                <Text weight="700" tabular style={styles.colNum}>{account.activeDevices}</Text>
                                <Text weight="800" tabular style={[styles.colNum, account.activeSosAlerts > 0 && { color: colors.danger }]}>
                                  {account.activeSosAlerts}
                                </Text>
                                <View style={styles.colStatus}>
                                  <TonePill tone={off ? "off" : "ok"} label={off ? "Turned off" : "Active"} center />
                                </View>
                                <Text variant="caption" tone="muted" style={styles.colDate}>{dateOnly(account.createdAt)}</Text>
                              </>
                            ) : (
                              <TonePill tone={off ? "off" : "ok"} label={off ? "Off" : "Active"} center />
                            )}
                            <View style={[styles.colAction, styles.actions, { opacity: hovered || !table ? 1 : 0 }]}>
                              {savingId === account.guardianId ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`${off ? "Turn on" : "Turn off"} ${account.fullName}`}
                                  onPress={(event) => {
                                    event.stopPropagation?.();
                                    changeStatus(account);
                                  }}
                                  style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.rule }]}
                                >
                                  <Ionicons name={off ? "play" : "pause"} size={14} color={off ? colors.primary : colors.danger} />
                                </Pressable>
                              )}
                              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                            </View>
                          </>
                        );
                      }}
                    </Pressable>
                  ))}
          </Rise>
        )}
      </ScrollView>

      <SlideOver open={Boolean(openId)} onClose={() => setOpenId(null)} title={detail?.fullName ?? "Guardian"} width={Math.min(540, width)}>
        <ScrollView contentContainerStyle={styles.panel}>
          {detailError ? (
            <Text tone="danger">{detailError}</Text>
          ) : !detail ? (
            <View style={{ gap: 12 }}>
              <Skeleton width="100%" height={110} radius={18} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="100%" height={70} radius={14} />
            </View>
          ) : (
            <>
              <View style={[styles.panelHero, { backgroundColor: colors.forest }]}>
                <View style={[styles.bigAvatar, { borderColor: "#3DDC84" }]}>
                  <Text variant="heading" weight="800" style={{ color: "#3DDC84" }}>
                    {initials(detail.fullName)}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="heading" weight="800" style={{ color: "#FFFFFF" }} numberOfLines={1}>
                    {detail.fullName}
                  </Text>
                  <Text variant="caption" style={{ color: "#BFD8C9" }} numberOfLines={1}>
                    {detail.email} · since {dateOnly(detail.createdAt)}
                  </Text>
                </View>
                <TonePill tone={detail.accountStatus === "active" ? "ok" : "off"} label={detail.accountStatus === "active" ? "Active" : "Turned off"} center />
              </View>

              <View style={styles.stats}>
                <Stat label="Children" value={detail.registeredChildren} />
                <Stat label="Linked devices" value={detail.activeDevices} />
                <Stat label="Safe zones" value={detail.activeSafeZones} />
                <Stat label="Active SOS" value={detail.activeSosAlerts} danger={detail.activeSosAlerts > 0} />
              </View>

              <Text variant="legend" tone="muted">
                Children
              </Text>
              {detail.children.length === 0 ? (
                <Text variant="caption" tone="muted">
                  No child registered yet.
                </Text>
              ) : (
                detail.children.map((child) => (
                  <View key={child.childId} style={[styles.child, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
                    <View style={styles.childTop}>
                      <Text weight="800" style={styles.flex} numberOfLines={1}>
                        {child.fullName}
                        {child.age ? <Text variant="caption" tone="muted">{`  ·  ${child.age} yrs`}</Text> : null}
                      </Text>
                      <TonePill tone="ok" label={SOURCE[String(child.trackingSource)] ?? "Tracking"} icon={false} center />
                    </View>
                    <View style={styles.childFacts}>
                      <Fact icon="watch-outline" text={`${child.activeDeviceCount}/${child.deviceCount} watch${child.deviceCount === 1 ? "" : "es"} active`} />
                      <Fact icon="shield-checkmark-outline" text={`${child.safeZoneCount} safe zone${child.safeZoneCount === 1 ? "" : "s"}`} />
                      <Fact icon="location-outline" text={child.latestLocationAt ? `${timeAgo(child.latestLocationAt)} (${phTime(child.latestLocationAt)})` : "No location yet"} />
                    </View>
                  </View>
                ))
              )}

              <View style={styles.panelActions}>
                <Button
                  label={detail.accountStatus === "active" ? "Turn off account" : "Turn on account"}
                  variant={detail.accountStatus === "active" ? "danger" : "primary"}
                  icon={detail.accountStatus === "active" ? "pause" : "play"}
                  loading={savingId === detail.guardianId}
                  onPress={() => changeStatus(detail)}
                />
                <Button
                  label="Full details"
                  variant="secondary"
                  iconRight="arrow-forward"
                  onPress={() => {
                    const id = detail.guardianId;
                    setOpenId(null);
                    router.push({ pathname: "/(app)/admin-guardian-details", params: { guardianId: id } });
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>
      </SlideOver>
    </SafeAreaView>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: danger ? colors.dangerTint : colors.surface, borderColor: danger ? colors.danger : colors.rule }]}>
      <Text variant="heading" weight="800" tabular style={danger ? { color: colors.danger } : undefined}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text variant="caption" tone="ink2">
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    safe: { flex: 1 },
    content: { width: "100%", maxWidth: 1360, alignSelf: "center", padding: 24, paddingTop: 30, paddingBottom: 120, gap: 18 },
    flex: { flex: 1, minWidth: 0 },
    toolbar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
    search: { flex: 1, minWidth: 240, maxWidth: 480 },
    sortBox: { flexDirection: "row", padding: 4, borderRadius: 12, gap: 4 },
    sortItem: { paddingHorizontal: 12, height: 34, borderRadius: 9, justifyContent: "center" },
    summary: { flexDirection: "row", gap: 8, marginLeft: "auto" },
    table: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
    head: { minHeight: 44 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 66, paddingHorizontal: 18, borderBottomWidth: 1 },
    colName: { flex: 2.4, minWidth: 0 },
    colNum: { width: 92 },
    colStatus: { width: 120 },
    colDate: { width: 120 },
    colAction: { width: 72 },
    who: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
    quick: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    empty: { alignItems: "center", gap: 6, padding: 32 },
    state: { alignItems: "center", gap: 8, padding: 28, borderRadius: radius.md, borderWidth: 1 },
    panel: { padding: 20, gap: 14, paddingBottom: 40 },
    panelHero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.md },
    bigAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#163D2B" },
    stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stat: { flexGrow: 1, flexBasis: "22%", minWidth: 100, padding: 12, borderRadius: 14, borderWidth: 1, gap: 2 },
    child: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
    childTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    childFacts: { gap: 6 },
    panelActions: { gap: 10, marginTop: 8 },
  }),
);
