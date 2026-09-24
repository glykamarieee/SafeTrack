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
  fetchAdminGuardianAccounts,
  updateAdminGuardianAccountStatus,
  subscribeAdminUpdates,
  type AdminGuardianAccount,
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

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "G";
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminGuardiansScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 980;

  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AdminGuardianAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await fetchAdminGuardianAccounts(search);
        setAccounts(data);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load Guardian accounts.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadAccounts(), 300);
    const unsubscribe = subscribeAdminUpdates(() => void loadAccounts());
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [loadAccounts]);

  const changeStatus = (account: AdminGuardianAccount) => {
    const nextStatus = account.accountStatus === "active" ? "inactive" : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} Guardian account?`,
      `${account.fullName} will be marked as ${nextStatus}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setStatusSavingId(account.guardianId);
            try {
              await updateAdminGuardianAccountStatus(account.guardianId, nextStatus);
              setAccounts((current) =>
                current.map((item) =>
                  item.guardianId === account.guardianId ? { ...item, accountStatus: nextStatus } : item,
                ),
              );
              Alert.alert("Account status saved", `${account.fullName} is now ${nextStatus}.`);
            } catch (reason) {
              Alert.alert(
                "Guardian account update error",
                reason instanceof Error ? reason.message : "SafeTrack could not save the Guardian account status.",
              );
            } finally {
              setStatusSavingId(null);
            }
          },
        },
      ],
    );
  };

  const openDetail = (guardianId: string) =>
    router.push({ pathname: "/(app)/admin-guardian-details", params: { guardianId } });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadAccounts(true)} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.page}>
          <AdminPageHeader
            eyebrow="ACCOUNT ADMINISTRATION"
            title="Guardian accounts"
            description="Search the existing Guardian directory, review linked monitoring context, and use the account-status action already supported by SafeTrack."
          />

          <View style={styles.toolbar}>
            <View style={styles.searchWrap}>
              <AdminSearchField value={search} onChangeText={setSearch} placeholder="Search Guardian name or email" />
            </View>
            <Text style={styles.resultText}>
              {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </Text>
          </View>

          {loading ? (
            <StateBlock icon="refresh-outline" title="Loading Guardian accounts" loading />
          ) : error ? (
            <StateBlock icon="alert-circle-outline" title="Guardian accounts could not be loaded" description={error} error />
          ) : accounts.length === 0 ? (
            <StateBlock
              icon="people-outline"
              title="No Guardian accounts found"
              description={search.trim() ? "Try a different Guardian name or email." : "No Guardian records are available for this view."}
            />
          ) : desktop ? (
            <View style={styles.tableSurface}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.headerCell, styles.guardianColumn]}>GUARDIAN</Text>
                <Text style={[styles.headerCell, styles.smallColumn]}>CHILDREN</Text>
                <Text style={[styles.headerCell, styles.smallColumn]}>DEVICES</Text>
                <Text style={[styles.headerCell, styles.statusColumn]}>STATUS</Text>
                <Text style={[styles.headerCell, styles.dateColumn]}>REGISTERED</Text>
                <Text style={[styles.headerCell, styles.actionColumn]}>ACTION</Text>
              </View>

              {accounts.map((account, index) => {
                const inactive = account.accountStatus === "inactive";
                const saving = statusSavingId === account.guardianId;
                return (
                  <Pressable
                    key={account.guardianId}
                    onPress={() => openDetail(account.guardianId)}
                    style={({ pressed }) => [
                      styles.tableRow,
                      index !== accounts.length - 1 && styles.rowDivider,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={[styles.guardianColumn, styles.personCell]}>
                      <View style={[styles.avatar, inactive && styles.avatarInactive]}>
                        <Text style={styles.avatarText}>{getInitial(account.fullName)}</Text>
                      </View>
                      <View style={styles.personCopy}>
                        <Text style={styles.personName} numberOfLines={1}>{account.fullName}</Text>
                        <Text style={styles.personEmail} numberOfLines={1}>{account.email}</Text>
                      </View>
                    </View>
                    <Text style={[styles.bodyCell, styles.smallColumn]}>{account.registeredChildren}</Text>
                    <Text style={[styles.bodyCell, styles.smallColumn]}>{account.activeDevices}</Text>
                    <View style={styles.statusColumn}>
                      <AdminStatusPill label={inactive ? "Inactive" : "Active"} tone={inactive ? "inactive" : "active"} />
                    </View>
                    <Text style={[styles.bodyCell, styles.dateColumn]}>{formatDate(account.createdAt)}</Text>
                    <View style={[styles.actionColumn, styles.actionCell]}>
                      <Pressable
                        disabled={saving}
                        accessibilityLabel={`${inactive ? "Activate" : "Deactivate"} ${account.fullName}`}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          changeStatus(account);
                        }}
                        style={({ pressed }) => [styles.iconAction, pressed && styles.pressed, saving && styles.disabled]}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons
                            name={inactive ? "play-outline" : "pause-outline"}
                            size={17}
                            color={inactive ? colors.primary : colors.danger}
                          />
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
              {accounts.map((account, index) => {
                const inactive = account.accountStatus === "inactive";
                const saving = statusSavingId === account.guardianId;
                return (
                  <View key={account.guardianId} style={[styles.mobileRow, index !== accounts.length - 1 && styles.rowDivider]}>
                    <Pressable onPress={() => openDetail(account.guardianId)} style={({ pressed }) => [styles.mobileMain, pressed && styles.rowPressed]}>
                      <View style={[styles.avatar, inactive && styles.avatarInactive]}>
                        <Text style={styles.avatarText}>{getInitial(account.fullName)}</Text>
                      </View>
                      <View style={styles.mobileCopy}>
                        <View style={styles.mobileNameRow}>
                          <Text style={styles.personName} numberOfLines={1}>{account.fullName}</Text>
                          <AdminStatusPill label={inactive ? "Inactive" : "Active"} tone={inactive ? "inactive" : "active"} />
                        </View>
                        <Text style={styles.personEmail} numberOfLines={1}>{account.email}</Text>
                        <Text style={styles.mobileMeta}>
                          {account.registeredChildren} child{account.registeredChildren === 1 ? "" : "ren"} · {account.activeDevices} active device{account.activeDevices === 1 ? "" : "s"}
                        </Text>
                        {account.activeSosAlerts > 0 ? (
                          <Text style={styles.alertMeta}>{account.activeSosAlerts} active SOS record{account.activeSosAlerts === 1 ? "" : "s"}</Text>
                        ) : null}
                        <Text style={styles.dateMeta}>Registered {formatDate(account.createdAt)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
                    </Pressable>
                    <Pressable
                      disabled={saving}
                      onPress={() => changeStatus(account)}
                      style={({ pressed }) => [styles.mobileStatusAction, pressed && styles.pressed, saving && styles.disabled]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name={inactive ? "play-outline" : "pause-outline"} size={15} color={inactive ? colors.primary : colors.danger} />
                          <Text style={[styles.mobileStatusText, !inactive && styles.mobileStatusTextDanger]}>
                            {inactive ? "Activate account" : "Deactivate account"}
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

function StateBlock({
  icon,
  title,
  description,
  loading = false,
  error = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={[styles.stateIcon, error && styles.stateIconError]}>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={icon} size={22} color={error ? colors.danger : colors.primary} />}
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
  tableRow: { minHeight: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  tableHeader: { minHeight: 42, backgroundColor: colors.surfaceMuted },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.75 },
  bodyCell: { color: colors.text, fontSize: 12.5, fontWeight: "700" },
  guardianColumn: { flex: 2.2, minWidth: 200 },
  smallColumn: { flex: 0.68, minWidth: 72, textAlign: "center" },
  statusColumn: { flex: 0.9, minWidth: 100, alignItems: "flex-start" },
  dateColumn: { flex: 1, minWidth: 120 },
  actionColumn: { width: 82, textAlign: "right" },
  personCell: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarInactive: { backgroundColor: colors.surfaceStrong },
  avatarText: { color: colors.primaryDark, fontSize: 13, fontWeight: "900" },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  personEmail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  actionCell: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  iconAction: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowPressed: { backgroundColor: colors.primarySoft },
  mobileList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  mobileRow: { backgroundColor: colors.background },
  mobileMain: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 16 },
  mobileCopy: { flex: 1, minWidth: 0 },
  mobileNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  mobileMeta: { color: colors.text, fontSize: 11.5, lineHeight: 17, marginTop: 8 },
  alertMeta: { color: colors.danger, fontSize: 10.5, fontWeight: "800", marginTop: 4 },
  dateMeta: { color: colors.subtle, fontSize: 10.5, marginTop: 4 },
  mobileStatusAction: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginLeft: 47, marginBottom: 13, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  mobileStatusText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  mobileStatusTextDanger: { color: colors.danger },
  stateBlock: { minHeight: 250, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 24, marginTop: 4 },
  stateIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  stateIconError: { backgroundColor: colors.dangerSoft },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: "800", textAlign: "center", marginTop: 13 },
  stateDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5, maxWidth: 440 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
