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
  fetchAdminGuardianAccounts,
  updateAdminGuardianAccountStatus,
  subscribeAdminUpdates,
  type AdminGuardianAccount,
} from "../../services/adminService";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "G";
}

function formatDate(value: string | null) {
  if (!value) {
    return "No registration date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No registration date";
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminGuardiansScreen() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AdminGuardianAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const data = await fetchAdminGuardianAccounts(search);
        setAccounts(data);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load Guardian accounts."
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
    void loadAccounts();
  }, 300);


  const unsubscribe =
    subscribeAdminUpdates(() => {

      void loadAccounts();

    });


  return () => {

    clearTimeout(timer);

    unsubscribe();

  };


}, [loadAccounts]);

  const changeStatus = (account: AdminGuardianAccount) => {
    const nextStatus =
      account.accountStatus === "active" ? "inactive" : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} Guardian account?`,
      `${account.fullName} will be marked as ${nextStatus}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setStatusSavingId(account.guardianId);

            try {
              await updateAdminGuardianAccountStatus(
                account.guardianId,
                nextStatus
              );

              setAccounts((current) =>
                current.map((item) =>
                  item.guardianId === account.guardianId
                    ? {
                        ...item,
                        accountStatus: nextStatus,
                      }
                    : item
                )
              );

              Alert.alert(
                "Account status saved",
                `${account.fullName} is now ${nextStatus}.`
              );
            } catch (reason) {
              Alert.alert(
                "Guardian account update error",
                reason instanceof Error
                  ? reason.message
                  : "SafeTrack could not save the Guardian account status."
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
            onRefresh={() => void loadAccounts(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.eyebrow}>ADMINISTRATIVE RECORDS</Text>
        <Text style={styles.heading}>Guardian accounts</Text>
        <Text style={styles.subtitle}>
          View authorized accounts, review linked children, and manage account
          status.
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
            placeholder="Search Guardian name or email"
            placeholderTextColor="#98A49F"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.resultPill}>
          <Ionicons
            name="people-outline"
            size={16}
            color={colors.primaryDark}
          />

          <Text style={styles.resultPillText}>
            {accounts.length} Guardian account
            {accounts.length === 1 ? "" : "s"} found
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading Guardian records...</Text>
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

        {!loading && !error && accounts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="people-outline"
              size={34}
              color={colors.primary}
            />

            <Text style={styles.emptyTitle}>No Guardian accounts found</Text>

            <Text style={styles.emptyText}>
              Try a different Guardian name or email.
            </Text>
          </View>
        ) : null}

        {accounts.map((account) => {
          const isInactive = account.accountStatus === "inactive";
          const saving = statusSavingId === account.guardianId;

          return (
            <View key={account.guardianId} style={styles.accountCard}>
              <View
                style={[
                  styles.avatar,
                  isInactive && styles.avatarInactive,
                ]}
              >
                <Text style={styles.avatarText}>
                  {getInitial(account.fullName)}
                </Text>
              </View>

              <View style={styles.accountCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {account.fullName}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      isInactive && styles.statusPillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isInactive && styles.statusTextInactive,
                      ]}
                    >
                      {isInactive ? "Inactive" : "Active"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.email} numberOfLines={1}>
                  {account.email}
                </Text>

                <Text style={styles.meta}>
                  {account.registeredChildren} child
                  {account.registeredChildren === 1 ? "" : "ren"} ·{" "}
                  {account.activeDevices} active device
                  {account.activeDevices === 1 ? "" : "s"}
                </Text>

                <Text style={styles.dateText}>
                  Registered {formatDate(account.createdAt)}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/admin-guardian-details",
                        params: {
                          guardianId: account.guardianId,
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
                    onPress={() => changeStatus(account)}
                    style={({ pressed }) => [
                      styles.statusButton,
                      isInactive && styles.activateButton,
                      (pressed || saving) && styles.pressed,
                      saving && styles.disabled,
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          isInactive ? colors.primaryDark : colors.danger
                        }
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            isInactive
                              ? "checkmark-circle-outline"
                              : "pause-circle-outline"
                          }
                          size={15}
                          color={
                            isInactive ? colors.primaryDark : colors.danger
                          }
                        />

                        <Text
                          style={[
                            styles.statusButtonText,
                            isInactive && styles.activateButtonText,
                          ]}
                        >
                          {isInactive ? "Activate" : "Deactivate"}
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

  accountCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 11,
    ...shadow.soft,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  avatarInactive: {
    backgroundColor: colors.muted,
  },

  avatarText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "900",
  },

  accountCopy: {
    flex: 1,
    marginLeft: 11,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
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

  email: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },

  meta: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 7,
  },

  dateText: {
    color: colors.muted,
    fontSize: 9.5,
    marginTop: 4,
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