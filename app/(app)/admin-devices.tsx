import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  fetchAdminSmartwatchDevices,
  updateAdminSmartwatchDeviceStatus,
  subscribeAdminUpdates,
  type AdminSmartwatchDevice,
} from "../../services/adminService";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { AdminSearchField } from "../../components/admin/AdminSearchField";
import { AdminStatusPill } from "../../components/admin/AdminStatusPill";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

function formatTime(value: string | null) {
  if (!value) return "No stored location";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No stored location";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminDevicesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;

  const [search, setSearch] = useState("");
  const [devices, setDevices] = useState<AdminSmartwatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        setDevices(await fetchAdminSmartwatchDevices(search));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load smartwatch devices.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadDevices(), 300);
    const unsubscribe = subscribeAdminUpdates(() => void loadDevices());
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [loadDevices]);

  const changeStatus = (device: AdminSmartwatchDevice) => {
    const nextStatus = device.isActive ? "inactive" : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} smartwatch device?`,
      `${device.watchId} will be marked as ${nextStatus}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setStatusSavingId(device.deviceId);
            try {
              await updateAdminSmartwatchDeviceStatus(device.deviceId, nextStatus);
              setDevices((current) =>
                current.map((item) =>
                  item.deviceId === device.deviceId ? { ...item, isActive: nextStatus === "active" } : item,
                ),
              );
              Alert.alert("Device status saved", `${device.watchId} is now ${nextStatus}.`);
            } catch (reason) {
              Alert.alert(
                "Smartwatch device update error",
                reason instanceof Error ? reason.message : "SafeTrack could not save the device status.",
              );
            } finally {
              setStatusSavingId(null);
            }
          },
        },
      ],
    );
  };

  const openDetail = (deviceId: string) =>
    router.push({ pathname: "/(app)/admin-device-details", params: { deviceId } });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadDevices(true)} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.page}>
          <AdminPageHeader
            eyebrow="DEVICE ADMINISTRATION"
            title="Smartwatch devices"
            description="Review the existing watch registry, linked child and Guardian context, latest stored location time, and supported device-status action."
          />

          <View style={styles.toolbar}>
            <View style={styles.searchWrap}>
              <AdminSearchField value={search} onChangeText={setSearch} placeholder="Search Watch ID or child name" />
            </View>
            <Text style={styles.resultText}>{devices.length} device{devices.length === 1 ? "" : "s"}</Text>
          </View>

          {loading ? (
            <StateBlock title="Loading smartwatch devices" loading />
          ) : error ? (
            <StateBlock title="Smartwatch devices could not be loaded" description={error} error />
          ) : devices.length === 0 ? (
            <StateBlock
              title="No smartwatch devices found"
              description={search.trim() ? "Try a different Watch ID or child name." : "No registered smartwatch records are available for this view."}
            />
          ) : desktop ? (
            <View style={styles.tableSurface}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.headerCell, styles.deviceColumn]}>WATCH</Text>
                <Text style={[styles.headerCell, styles.childColumn]}>LINKED CHILD</Text>
                <Text style={[styles.headerCell, styles.guardianColumn]}>GUARDIAN</Text>
                <Text style={[styles.headerCell, styles.locationColumn]}>LATEST LOCATION</Text>
                <Text style={[styles.headerCell, styles.statusColumn]}>STATUS</Text>
                <Text style={[styles.headerCell, styles.actionColumn]}>ACTION</Text>
              </View>

              {devices.map((device, index) => {
                const saving = statusSavingId === device.deviceId;
                return (
                  <Pressable
                    key={device.deviceId}
                    onPress={() => openDetail(device.deviceId)}
                    style={({ pressed }) => [styles.tableRow, index !== devices.length - 1 && styles.rowDivider, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.deviceColumn, styles.deviceCell]}>
                      <View style={[styles.watchIcon, !device.isActive && styles.watchIconInactive]}>
                        <Ionicons name="watch-outline" size={18} color={device.isActive ? colors.blue : colors.muted} />
                      </View>
                      <Text style={styles.watchId} numberOfLines={1}>{device.watchId}</Text>
                    </View>
                    <Text style={[styles.bodyCell, styles.childColumn]} numberOfLines={1}>{device.childName}</Text>
                    <View style={styles.guardianColumn}>
                      <Text style={styles.bodyCell} numberOfLines={1}>{device.guardianName}</Text>
                      {device.guardianAccountStatus === "inactive" ? (
                        <Text style={styles.guardianInactive}>Guardian inactive</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.secondaryCell, styles.locationColumn]} numberOfLines={2}>{formatTime(device.latestLocationAt)}</Text>
                    <View style={styles.statusColumn}>
                      <AdminStatusPill label={device.isActive ? "Active" : "Inactive"} tone={device.isActive ? "active" : "inactive"} />
                    </View>
                    <View style={[styles.actionColumn, styles.actionCell]}>
                      <Pressable
                        disabled={saving}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          changeStatus(device);
                        }}
                        accessibilityLabel={`${device.isActive ? "Deactivate" : "Activate"} ${device.watchId}`}
                        style={({ pressed }) => [styles.iconAction, pressed && styles.pressed, saving && styles.disabled]}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons name={device.isActive ? "pause-outline" : "play-outline"} size={17} color={device.isActive ? colors.danger : colors.primary} />
                        )}
                      </Pressable>
                      <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.mobileList}>
              {devices.map((device, index) => {
                const saving = statusSavingId === device.deviceId;
                return (
                  <View key={device.deviceId} style={[styles.mobileRow, index !== devices.length - 1 && styles.rowDivider]}>
                    <Pressable onPress={() => openDetail(device.deviceId)} style={({ pressed }) => [styles.mobileMain, pressed && styles.rowPressed]}>
                      <View style={[styles.watchIcon, !device.isActive && styles.watchIconInactive]}>
                        <Ionicons name="watch-outline" size={19} color={device.isActive ? colors.blue : colors.muted} />
                      </View>
                      <View style={styles.mobileCopy}>
                        <View style={styles.mobileTitleRow}>
                          <Text style={styles.watchId} numberOfLines={1}>{device.watchId}</Text>
                          <AdminStatusPill label={device.isActive ? "Active" : "Inactive"} tone={device.isActive ? "active" : "inactive"} />
                        </View>
                        <Text style={styles.childName} numberOfLines={1}>{device.childName}</Text>
                        <Text style={styles.guardianName} numberOfLines={1}>Guardian: {device.guardianName}</Text>
                        <View style={styles.locationMetaRow}>
                          <Ionicons name="location-outline" size={13} color={colors.muted} />
                          <Text style={styles.locationMeta}>{formatTime(device.latestLocationAt)}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
                    </Pressable>
                    <Pressable
                      disabled={saving}
                      onPress={() => changeStatus(device)}
                      style={({ pressed }) => [styles.mobileStatusAction, pressed && styles.pressed, saving && styles.disabled]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name={device.isActive ? "pause-outline" : "play-outline"} size={15} color={device.isActive ? colors.danger : colors.primary} />
                          <Text style={[styles.mobileStatusText, device.isActive && styles.mobileStatusTextDanger]}>
                            {device.isActive ? "Deactivate device" : "Activate device"}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StateBlock({ title, description, loading = false, error = false }: { title: string; description?: string; loading?: boolean; error?: boolean }) {
  return (
    <View style={styles.stateBlock}>
      <View style={[styles.stateIcon, error && styles.stateIconError]}>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={error ? "alert-circle-outline" : "watch-outline"} size={22} color={error ? colors.danger : colors.blue} />}
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {description ? <Text style={styles.stateDescription}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 110 },
  page: { width: "100%", maxWidth: adminLayout.pageMax, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: 28 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 24, marginBottom: 13 },
  searchWrap: { flex: 1, maxWidth: 520 },
  resultText: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  tableSurface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden", ...shadow.soft },
  tableRow: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 15 },
  tableHeader: { minHeight: 42, backgroundColor: colors.surfaceMuted },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.72 },
  bodyCell: { color: colors.ink, fontSize: 12.3, fontWeight: "700" },
  secondaryCell: { color: colors.muted, fontSize: 11.2, lineHeight: 16 },
  deviceColumn: { flex: 1.25, minWidth: 145 },
  childColumn: { flex: 1.15, minWidth: 120 },
  guardianColumn: { flex: 1.25, minWidth: 130 },
  locationColumn: { flex: 1.12, minWidth: 125 },
  statusColumn: { flex: 0.82, minWidth: 94, alignItems: "flex-start" },
  actionColumn: { width: 82 },
  deviceCell: { flexDirection: "row", alignItems: "center", gap: 9 },
  watchIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  watchIconInactive: { backgroundColor: colors.surfaceStrong },
  watchId: { flexShrink: 1, color: colors.ink, fontSize: 12.5, fontWeight: "900", letterSpacing: 0.1 },
  guardianInactive: { color: colors.danger, fontSize: 9.5, fontWeight: "700", marginTop: 3 },
  actionCell: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  iconAction: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowPressed: { backgroundColor: colors.blueSoft },
  mobileList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  mobileRow: { backgroundColor: colors.background },
  mobileMain: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 16 },
  mobileCopy: { flex: 1, minWidth: 0 },
  mobileTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  childName: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 7 },
  guardianName: { color: colors.muted, fontSize: 11, marginTop: 3 },
  locationMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 },
  locationMeta: { color: colors.muted, fontSize: 10.5 },
  mobileStatusAction: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginLeft: 48, marginBottom: 13, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  mobileStatusText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  mobileStatusTextDanger: { color: colors.danger },
  stateBlock: { minHeight: 250, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 24, marginTop: 4 },
  stateIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft },
  stateIconError: { backgroundColor: colors.dangerSoft },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", textAlign: "center", marginTop: 13 },
  stateDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5, maxWidth: 440 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
