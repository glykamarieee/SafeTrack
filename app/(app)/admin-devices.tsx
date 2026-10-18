import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { showAlert } from "../../lib/platformAlert";
import {
  fetchAdminSmartwatchDevices,
  updateAdminSmartwatchDeviceStatus,
  subscribeAdminUpdates,
  type AdminSmartwatchDevice,
} from "../../services/adminService";
import { AdminSearchField } from "../../components/admin/AdminSearchField";
import { WatchIllustration } from "../../components/admin/WatchIllustration";
import { Lift, Rise, Skeleton, SlideOver, TonePill, TopBar, phTime, showToast, timeAgo } from "../../components/admin/kit";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius } from "../../theme/tokens";

type Freshness = "fresh" | "recent" | "old" | "none";

function freshness(value: string | null): Freshness {
  const at = Date.parse(value ?? "");
  if (!Number.isFinite(at)) return "none";
  const minutes = (Date.now() - at) / 60000;
  return minutes < 10 ? "fresh" : minutes < 60 ? "recent" : "old";
}

const FRESH_LABEL: Record<Freshness, string> = {
  fresh: "Fresh · under 10 min",
  recent: "Recent · under 1 hour",
  old: "Older than 1 hour",
  none: "No location yet",
};

/** Watches split into linked (in use) and registered-only, with a detail slide-over. */
export default function AdminDevicesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [search, setSearch] = useState("");
  const [devices, setDevices] = useState<AdminSmartwatchDevice[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        setDevices(await fetchAdminSmartwatchDevices(search));
        setUpdatedAt(new Date().toISOString());
      } catch (reason) {
        if (!silent) setError(reason instanceof Error ? reason.message : "Unable to load smartwatch devices.");
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

  const linked = useMemo(
    () =>
      (devices ?? [])
        .filter((device) => device.childId)
        .sort((a, b) => (Date.parse(b.latestLocationAt ?? "") || 0) - (Date.parse(a.latestLocationAt ?? "") || 0)),
    [devices],
  );
  const unlinked = useMemo(() => (devices ?? []).filter((device) => !device.childId), [devices]);
  const open = devices?.find((device) => device.deviceId === openId) ?? null;

  const changeStatus = (device: AdminSmartwatchDevice) => {
    const next = device.isActive ? "inactive" : "active";
    showAlert(`${next === "active" ? "Turn on" : "Turn off"} this watch?`, `${device.watchId} will be marked as ${next}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: next === "active" ? "Turn on" : "Turn off",
        style: next === "inactive" ? "destructive" : "default",
        onPress: async () => {
          setSavingId(device.deviceId);
          try {
            await updateAdminSmartwatchDeviceStatus(device.deviceId, next);
            setDevices((list) => (list ?? []).map((item) => (item.deviceId === device.deviceId ? { ...item, isActive: next === "active" } : item)));
            showToast(`${device.watchId} is now ${next}.`);
          } catch (reason) {
            showToast(reason instanceof Error ? reason.message : "SafeTrack could not save the device status.", "error");
          } finally {
            setSavingId(null);
          }
        },
      },
    ]);
  };

  const columns = width >= 1500 ? 3 : width >= 900 ? 2 : 1;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <Rise index={0}>
          <TopBar
            crumb="Devices"
            title="Smartwatch devices"
            subtitle="Watches linked to a child, with how fresh their latest location is, and watches that are registered but not in use."
            updatedAt={updatedAt}
          />
        </Rise>

        <Rise index={1} style={styles.toolbar}>
          <View style={styles.search}>
            <AdminSearchField value={search} onChangeText={setSearch} placeholder="Search Watch ID or child name" />
          </View>
          <View style={styles.counts}>
            <TonePill tone="ok" label={`${linked.length} linked`} />
            <TonePill tone="cancelled" label={`${unlinked.length} not linked`} />
          </View>
        </Rise>

        {error ? (
          <View style={[styles.state, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
            <Text weight="800">Devices couldn&apos;t load</Text>
            <Text variant="caption" tone="muted" align="center">
              {error}
            </Text>
            <Button label="Try again" size="sm" icon="refresh" onPress={() => void load()} />
          </View>
        ) : devices === null ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={[styles.cardCell, { flexBasis: `${100 / columns - 2}%` }]}>
                <View style={[styles.card, { gap: 12 }]}>
                  <Skeleton width={46} height={46} radius={14} />
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <>
            <Rise index={2}>
              <SectionTitle title="Linked to a child" note="In use · newest location first" count={linked.length} />
            </Rise>
            {linked.length === 0 ? (
              <EmptyNote text={search.trim() ? "No linked watch matches this search." : "No watch is linked to a child yet."} />
            ) : (
              <View style={styles.grid}>
                {linked.map((device, index) => (
                  <Rise key={device.deviceId} index={3 + index} style={[styles.cardCell, { flexBasis: `${100 / columns - 2}%` }]}>
                    <DeviceCard device={device} onOpen={() => setOpenId(device.deviceId)} />
                  </Rise>
                ))}
              </View>
            )}

            <Rise index={4}>
              <SectionTitle title="Registered, not linked" note="Known Watch IDs that no child uses yet" count={unlinked.length} />
            </Rise>
            {unlinked.length === 0 ? (
              <EmptyNote text="Every registered watch is linked to a child." />
            ) : (
              <Rise index={5} style={[styles.list, { borderColor: colors.rule, backgroundColor: colors.surface }]}>
                {unlinked.map((device, index) => (
                  <Pressable
                    key={device.deviceId}
                    accessibilityRole="button"
                    accessibilityLabel={`${device.watchId}, not linked. Open`}
                    onPress={() => setOpenId(device.deviceId)}
                    style={(state) => [
                      styles.listRow,
                      index !== unlinked.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.rule },
                      ((state as { hovered?: boolean }).hovered || state.pressed) && { backgroundColor: colors.sunken },
                    ]}
                  >
                    <View style={[styles.smallIcon, { backgroundColor: colors.sunken }]}>
                      <Ionicons name="watch-outline" size={16} color={colors.muted} />
                    </View>
                    <Text weight="800" style={styles.flex} numberOfLines={1}>
                      {device.watchId}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {device.pairedAt ? `Paired ${phTime(device.pairedAt)}` : "Never paired"}
                    </Text>
                    <TonePill center tone={device.isActive ? "ok" : "off"} label={device.isActive ? "Enabled" : "Turned off"} icon={false} />
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                ))}
              </Rise>
            )}
          </>
        )}
      </ScrollView>

      <SlideOver open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.watchId ?? "Device"} width={Math.min(520, width)}>
        {open ? (
          <ScrollView contentContainerStyle={styles.panel}>
            <View style={[styles.panelHero, { backgroundColor: colors.forest }]}>
              <WatchIllustration size={140} />
              <View style={styles.flex}>
                <Text variant="legend" style={{ color: "#3DDC84" }}>
                  {open.childId ? "Linked to a child" : "Registered, not linked"}
                </Text>
                <Text variant="heading" weight="800" style={{ color: "#FFFFFF" }} numberOfLines={2}>
                  {open.childId ? open.childName : open.watchId}
                </Text>
                <Text variant="caption" style={{ color: "#BFD8C9" }}>
                  {open.childId ? `Guardian ${open.guardianName}` : "No child uses this watch yet."}
                </Text>
              </View>
            </View>

            <Info label="Watch ID" value={open.watchId} />
            <Info label="Latest location" value={open.latestLocationAt ? `${timeAgo(open.latestLocationAt)} · ${phTime(open.latestLocationAt)} (PHT)` : "No location yet"} />
            <Info label="Location freshness" value={FRESH_LABEL[freshness(open.latestLocationAt)]} />
            <Info label="Paired" value={open.pairedAt ? `${phTime(open.pairedAt)} (PHT)` : "—"} />
            {open.childId ? <Info label="Guardian account" value={open.guardianAccountStatus === "inactive" ? "Turned off" : "Active"} /> : null}
            <View style={styles.infoRow}>
              <Text variant="caption" tone="muted">
                Device status
              </Text>
              <TonePill tone={open.isActive ? "ok" : "off"} label={open.isActive ? "Active" : "Turned off"} />
            </View>

            <Text variant="caption" tone="muted">
              The latest location is the last position the watch sent, not a live feed.
            </Text>

            <View style={styles.panelActions}>
              <Button
                label={open.isActive ? "Turn off watch" : "Turn on watch"}
                variant={open.isActive ? "danger" : "primary"}
                icon={open.isActive ? "pause" : "play"}
                loading={savingId === open.deviceId}
                onPress={() => changeStatus(open)}
              />
              <Button
                label="Full details"
                variant="secondary"
                iconRight="arrow-forward"
                onPress={() => {
                  setOpenId(null);
                  router.push({ pathname: "/(app)/admin-device-details", params: { deviceId: open.deviceId } });
                }}
              />
            </View>
          </ScrollView>
        ) : null}
      </SlideOver>
    </SafeAreaView>
  );
}

function DeviceCard({ device, onOpen }: { device: AdminSmartwatchDevice; onOpen: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const level = freshness(device.latestLocationAt);
  const color = level === "fresh" ? colors.brand : level === "recent" ? "#E0A43A" : colors.offline;
  const share = level === "fresh" ? 1 : level === "recent" ? 0.6 : level === "old" ? 0.25 : 0.05;

  return (
    <Lift onPress={onOpen} accessibilityLabel={`${device.childName}, ${device.watchId}. Open`} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.watchIcon, { backgroundColor: colors.primaryTint }]}>
          <Ionicons name="watch" size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="heading" weight="800" numberOfLines={1}>
            {device.childName}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            Guardian {device.guardianName}
          </Text>
        </View>
        <TonePill center tone={device.isActive ? "ok" : "off"} label={device.isActive ? "Active" : "Turned off"} />
      </View>

      <View style={[styles.freshBox, { backgroundColor: colors.sunken }]}>
        <View style={styles.freshTop}>
          <View style={[styles.freshDot, { backgroundColor: color }]} />
          <Text weight="800" tabular>
            {timeAgo(device.latestLocationAt, "No location yet")}
          </Text>
          <Text variant="caption" tone="muted" style={styles.flexRight}>
            {device.latestLocationAt ? `${phTime(device.latestLocationAt)} PHT` : ""}
          </Text>
        </View>
        <View style={[styles.freshTrack, { backgroundColor: colors.rule }]}>
          <View style={[styles.freshFill, { width: `${share * 100}%`, backgroundColor: color }]} />
        </View>
        <Text variant="caption" tone="muted">
          Latest location · {FRESH_LABEL[level].toLowerCase()}
        </Text>
      </View>

      <View style={styles.cardFoot}>
        <Text variant="caption" weight="700" tone="ink2">
          {device.watchId}
        </Text>
        {device.guardianAccountStatus === "inactive" ? <TonePill center tone="off" label="Guardian off" icon={false} /> : null}
        <Ionicons name="arrow-forward" size={16} color={colors.primary} style={styles.flexRight} />
      </View>
    </Lift>
  );
}

function SectionTitle({ title, note, count }: { title: string; note: string; count: number }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text variant="heading" weight="800">
        {title}
      </Text>
      <Text variant="caption" weight="800" tone="primary">
        {count}
      </Text>
      <Text variant="caption" tone="muted" style={styles.flex}>
        · {note}
      </Text>
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 18, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.ruleStrong }}>
      <Text variant="caption" tone="muted">
        {text}
      </Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="label" weight="700" align="right" style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.paper },
    content: { width: "100%", maxWidth: 1360, alignSelf: "center", padding: 24, paddingTop: 30, paddingBottom: 120, gap: 18 },
    flex: { flex: 1, minWidth: 0 },
    flexRight: { marginLeft: "auto" },
    toolbar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
    search: { flex: 1, minWidth: 260, maxWidth: 560 },
    counts: { flexDirection: "row", gap: 8 },
    section: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    cardCell: { flexGrow: 1, minWidth: 280 },
    card: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.rule, padding: 18, gap: 14 },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    watchIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    freshBox: { borderRadius: 14, padding: 12, gap: 8 },
    freshTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    freshDot: { width: 10, height: 10, borderRadius: 5 },
    freshTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
    freshFill: { height: 5, borderRadius: 3 },
    cardFoot: { flexDirection: "row", alignItems: "center", gap: 8 },
    list: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
    listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 54 },
    smallIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    state: { alignItems: "center", gap: 8, padding: 28, borderRadius: radius.md, borderWidth: 1 },
    panel: { padding: 20, gap: 14, paddingBottom: 40 },
    panelHero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.md },
    infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.rule },
    infoValue: { flexShrink: 1 },
    panelActions: { gap: 10, marginTop: 6 },
  }),
);
