import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function formatTime(value: string | null) {
  if (!value) {
    return "No stored location record";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No stored location record";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminDevicesScreen() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [devices, setDevices] = useState<AdminSmartwatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const data = await fetchAdminSmartwatchDevices(search);
        setDevices(data);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load smartwatch devices."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search]
  );

useEffect(() => {

  const timer = setTimeout(() => {
    void loadDevices();
  }, 300);


  const unsubscribe =
    subscribeAdminUpdates(() => {

      void loadDevices();

    });


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
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setStatusSavingId(device.deviceId);

            try {
              await updateAdminSmartwatchDeviceStatus(
                device.deviceId,
                nextStatus
              );

              setDevices((current) =>
                current.map((item) =>
                  item.deviceId === device.deviceId
                    ? {
                        ...item,
                        isActive: nextStatus === "active",
                      }
                    : item
                )
              );

              Alert.alert(
                "Device status saved",
                `${device.watchId} is now ${nextStatus}.`
              );
            } catch (reason) {
              Alert.alert(
                "Smartwatch device update error",
                reason instanceof Error
                  ? reason.message
                  : "SafeTrack could not save the device status."
              );
            } finally {
              setStatusSavingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDevices(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.eyebrow}>DEVICE MANAGEMENT</Text>
        <Text style={styles.heading}>Smartwatch devices</Text>
        <Text style={styles.subtitle}>
          View linked devices, child ownership, and approved device status.
        </Text>

        <View style={styles.searchShell}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.primary}
          />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search Watch ID or child name"
            placeholderTextColor="#98A49F"
            style={styles.searchInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <View style={styles.resultPill}>
          <Ionicons
            name="watch-outline"
            size={16}
            color={colors.primaryDark}
          />

          <Text style={styles.resultPillText}>
            {devices.length} device{devices.length === 1 ? "" : "s"} found
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading device records...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={colors.danger}
            />

            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && devices.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="watch-outline"
              size={34}
              color={colors.primary}
            />

            <Text style={styles.emptyTitle}>No smartwatch devices found</Text>

            <Text style={styles.emptyText}>
              Registered smartwatch records appear here.
            </Text>
          </View>
        ) : null}

        {devices.map((device) => {
          const saving = statusSavingId === device.deviceId;

          return (
            <View key={device.deviceId} style={styles.deviceCard}>
              <View
                style={[
                  styles.deviceIcon,
                  !device.isActive && styles.deviceIconInactive,
                ]}
              >
                <Ionicons
                  name="watch-outline"
                  size={22}
                  color={device.isActive ? "#2875A8" : colors.muted}
                />
              </View>

              <View style={styles.deviceCopy}>
                <View style={styles.topRow}>
                  <Text style={styles.watchId} numberOfLines={1}>
                    {device.watchId}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      !device.isActive && styles.statusPillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        !device.isActive && styles.statusTextInactive,
                      ]}
                    >
                      {device.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.childName} numberOfLines={1}>
                  {device.childName}
                </Text>

                <Text style={styles.guardianName} numberOfLines={1}>
                  Guardian: {device.guardianName}
                </Text>

                <Text style={styles.latestRecord}>
                  Latest: {formatTime(device.latestLocationAt)}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/admin-device-details",
                        params: {
                          deviceId: device.deviceId,
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.detailsButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.detailsButtonText}>View details</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={colors.primaryDark}
                    />
                  </Pressable>

                  <Pressable
                    disabled={saving}
                    onPress={() => changeStatus(device)}
                    style={({ pressed }) => [
                      styles.statusButton,
                      !device.isActive && styles.activateButton,
                      (pressed || saving) && styles.pressed,
                      saving && styles.disabled,
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          device.isActive
                            ? colors.danger
                            : colors.primaryDark
                        }
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            device.isActive
                              ? "pause-circle-outline"
                              : "checkmark-circle-outline"
                          }
                          size={15}
                          color={
                            device.isActive
                              ? colors.danger
                              : colors.primaryDark
                          }
                        />

                        <Text
                          style={[
                            styles.statusButtonText,
                            !device.isActive &&
                              styles.activateButtonText,
                          ]}
                        >
                          {device.isActive ? "Deactivate" : "Activate"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
    paddingBottom: 120,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  heading: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 5,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },

  searchShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 20,
    ...shadow.soft,
  },

  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 9,
    paddingVertical: 10,
  },

  resultPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 12,
  },

  resultPillText: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "900",
    marginLeft: 6,
  },

  loading: {
    alignItems: "center",
    paddingVertical: 35,
  },

  loadingText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    marginTop: 18,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 8,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 42,
    paddingHorizontal: 26,
  },

  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 9,
  },

  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },

  deviceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 11,
    ...shadow.soft,
  },

  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9F4FC",
  },

  deviceIconInactive: {
    backgroundColor: "#EEF1F0",
  },

  deviceCopy: {
    flex: 1,
    marginLeft: 11,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  watchId: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "900",
    marginRight: 7,
  },

  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
  },

  statusPillInactive: {
    backgroundColor: "#F1EEEE",
  },

  statusText: {
    color: colors.primaryDark,
    fontSize: 8.5,
    fontWeight: "900",
  },

  statusTextInactive: {
    color: colors.muted,
  },

  childName: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "800",
    marginTop: 4,
  },

  guardianName: {
    color: colors.muted,
    fontSize: 10.5,
    marginTop: 2,
  },

  latestRecord: {
    color: colors.primaryDark,
    fontSize: 9.5,
    marginTop: 7,
  },

  actions: {
    flexDirection: "row",
    marginTop: 12,
  },

  detailsButton: {
    minHeight: 33,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginRight: 8,
  },

  detailsButtonText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    marginRight: 5,
  },

  statusButton: {
    minHeight: 33,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },

  activateButton: {
    backgroundColor: colors.softMint,
  },

  statusButtonText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 5,
  },

  activateButtonText: {
    color: colors.primaryDark,
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },

  disabled: {
    opacity: 0.58,
  },
});