import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useRouter,
} from "expo-router";

import {
  Ionicons,
} from "@expo/vector-icons";


import {
  SafeTrackBackButton,
} from "../../components/common/SafeTrackBackButton";


import {
  SafeTrackButton,
} from "../../components/common/SafeTrackButton";


import {
  useAuthStore,
} from "../../store/authStore";


import {
  supabase,
} from "../../lib/supabase";


import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";



type AlertStatus =
  | "active"
  | "acknowledged"
  | "resolved"
  | string;



type AlertRow = {

  id:string;

  activation_method:string;

  status:AlertStatus;

  latitude:number|null;

  longitude:number|null;

  triggered_at:string;

  acknowledged_at:string|null;

  is_test:boolean;

};





function displayTime(
  value:string
){

  return new Date(
    value
  ).toLocaleString(
    "en-PH",
    {
      timeZone:"Asia/Manila",
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit",
    }
  );

}





function formatMethod(
  value:string
){

  if(value==="app_test"){

    return "System test";

  }


  return value
    .replaceAll("_"," ")
    .replace(
      /\b\w/g,
      letter=>letter.toUpperCase()
    );

}








export default function SosAlertsScreen(){


  const router =
    useRouter();



  const guardian =
    useAuthStore(
      state=>state.guardian
    );


  const child =
    useAuthStore(
      state=>state.linkedChildren[0]
    );

  const trackingSource =
    child?.trackingSource ?? "smartwatch";



  const [
    alerts,
    setAlerts
  ] =
  useState<AlertRow[]>([]);



  const [
    loading,
    setLoading
  ] =
  useState(true);



  const [
    acknowledging,
    setAcknowledging
  ] =
  useState<string|null>(null);







  const loadAlerts =
  useCallback(
    async()=>{


      if(
        !guardian?.id ||
        !child?.id
      ){

        setAlerts([]);

        setLoading(false);

        return;

      }



      try{


        setLoading(true);



        const {
          data,
          error
        } = await supabase

        .from("sos_alerts")

        .select(
          `
          id,
          activation_method,
          status,
          latitude,
          longitude,
          triggered_at,
          acknowledged_at,
          is_test
          `
        )

        .eq(
          "guardian_id",
          guardian.id
        )

        .eq(
          "child_id",
          child.id
        )

        .order(
          "triggered_at",
          {
            ascending:false
          }
        );



        if(error){

          throw error;

        }



        setAlerts(

          (data ?? [])
          .map(
            row=>({

              ...row,

              latitude:
              row.latitude === null
              ?
              null
              :
              Number(row.latitude),


              longitude:
              row.longitude === null
              ?
              null
              :
              Number(row.longitude),

            })
          )

        );



      }

      catch(error){


        Alert.alert(
          "Unable to load SOS alerts",
          error instanceof Error
          ?
          error.message
          :
          "Please try again."
        );


      }

      finally{


        setLoading(false);


      }


    },
    [
      guardian?.id,
      child?.id
    ]
  );







  useEffect(()=>{

    void loadAlerts();

  },[loadAlerts]);









  const acknowledge =
  async(
    alert:AlertRow
  )=>{


    try{


      setAcknowledging(
        alert.id
      );



      const {
        data,
        error
      } =
      await supabase.rpc(
        "acknowledge_my_sos_alert",
        {
          p_alert_id:
          alert.id
        }
      );



      if(error){

        throw error;

      }



      const response =
      data as
      {
        ok?:boolean;
        message?:string;
      }
      |
      null;



      if(
        response?.ok===false
      ){

        throw new Error(
          response.message ||
          "Unable to acknowledge alert."
        );

      }



      await loadAlerts();



      Alert.alert(
        "SOS acknowledged",
        response?.message ||
        "SOS alert acknowledged successfully."
      );



    }

    catch(error){


      Alert.alert(
        "Unable to acknowledge SOS",
        error instanceof Error
        ?
        error.message
        :
        "Please try again."
      );


    }

    finally{


      setAcknowledging(
        null
      );


    }


  };







  const activeCount =
    alerts.filter(
      item=>
      item.status==="active"
    ).length;








  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <SafeTrackBackButton />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>EMERGENCY MONITORING</Text>
            <Text style={styles.heading}>SOS alerts</Text>
            <Text style={styles.subtitle}>
              Review confirmed emergency records for {child?.fullName ?? "the selected child"} and acknowledge active alerts through the existing SafeTrack workflow.
            </Text>
          </View>
        </View>

        <View style={[styles.statusBand, activeCount > 0 && styles.statusBandActive]}>
          <View style={[styles.statusSymbol, activeCount > 0 && styles.statusSymbolActive]}>
            <Ionicons
              name={activeCount > 0 ? "warning-outline" : "shield-checkmark-outline"}
              size={21}
              color={activeCount > 0 ? colors.danger : colors.primaryDark}
            />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, activeCount > 0 && styles.statusTitleActive]}>
              {activeCount > 0
                ? `${activeCount} active SOS alert${activeCount > 1 ? "s" : ""}`
                : "No active SOS requires acknowledgment"}
            </Text>
            <Text style={styles.statusText}>
              {trackingSource === "mobile"
                ? "SOS records are associated with the child's mobile tracking source."
                : trackingSource === "both"
                  ? "SOS records may be associated with the registered smartwatch or mobile source."
                  : "SOS records are associated with the registered smartwatch."}
            </Text>
          </View>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>ALERT HISTORY</Text>
            <Text style={styles.sectionTitle}>Recorded SOS activity</Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh SOS alerts"
            onPress={() => void loadAlerts()}
            style={({ pressed }) => [styles.refreshAction, pressed && styles.pressed]}
          >
            <Ionicons name="refresh-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading SOS records...</Text>
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="shield-checkmark-outline" size={25} color={colors.primaryDark} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No confirmed SOS records</Text>
              <Text style={styles.emptyText}>SafeTrack has no SOS record to display for this child.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.timeline}>
            {alerts.map((alert, index) => {
              const active = alert.status === "active";
              const hasLocation = alert.latitude !== null && alert.longitude !== null;

              return (
                <View
                  key={alert.id}
                  style={[
                    styles.alertRow,
                    active && styles.alertRowActive,
                    index !== alerts.length - 1 && styles.alertDivider,
                  ]}
                >
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, active && styles.timelineDotActive]}>
                      <Ionicons
                        name={active ? "warning" : "checkmark"}
                        size={12}
                        color={active ? colors.white : colors.primaryDark}
                      />
                    </View>
                    {index !== alerts.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>

                  <View style={styles.alertContent}>
                    <View style={styles.alertTopRow}>
                      <View style={styles.alertTitleWrap}>
                        <Text style={styles.alertTitle}>
                          {alert.is_test ? "Test SOS alert" : "SOS alert"}
                        </Text>
                        <Text style={styles.alertTime}>{displayTime(alert.triggered_at)}</Text>
                      </View>
                      <View style={[styles.alertStatus, active ? styles.alertStatusActive : styles.alertStatusDone]}>
                        <Text style={[styles.alertStatusText, active && styles.alertStatusTextActive]}>
                          {active ? "Needs acknowledgment" : "Acknowledged"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.alertMetaRow}>
                      <Ionicons name="hand-left-outline" size={15} color={colors.primaryDark} />
                      <Text style={styles.alertMeta}>{formatMethod(alert.activation_method)}</Text>
                    </View>
                    <View style={styles.alertMetaRow}>
                      <Ionicons name="location-outline" size={15} color={colors.primaryDark} />
                      <Text style={styles.alertMeta}>
                        {hasLocation
                          ? `${alert.latitude!.toFixed(5)}, ${alert.longitude!.toFixed(5)}`
                          : "Location unavailable"}
                      </Text>
                    </View>

                    {active ? (
                      <View style={styles.acknowledgeWrap}>
                        <SafeTrackButton
                          label="Acknowledge SOS"
                          icon="checkmark-circle-outline"
                          loading={acknowledging === alert.id}
                          onPress={() => void acknowledge(alert)}
                        />
                      </View>
                    ) : (
                      <View style={styles.resolvedLine}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        <Text style={styles.resolvedText}>Acknowledgment recorded</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => router.push("/safety-center")}
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
        >
          <Text style={styles.returnText}>Return to Safety Center</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.primaryDark} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: 72,
  },
  header: { flexDirection: "row", alignItems: "flex-start" },
  headerCopy: { flex: 1, marginLeft: 14, maxWidth: 700 },
  eyebrow: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.25, color: colors.primary },
  heading: { marginTop: 4, fontSize: 28, fontWeight: "900", letterSpacing: -0.7, color: colors.ink },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 12.5, lineHeight: 19 },
  statusBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statusBandActive: { borderColor: "#F0C7CB", backgroundColor: colors.dangerSoft, paddingHorizontal: 14, borderRadius: radius.md },
  statusSymbol: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.softMint, alignItems: "center", justifyContent: "center" },
  statusSymbolActive: { backgroundColor: colors.white },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  statusTitleActive: { color: colors.dangerDark },
  statusText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 28, marginBottom: 10 },
  sectionEyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.05 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  refreshAction: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: radius.sm },
  refreshText: { color: colors.primaryDark, fontSize: 10.5, fontWeight: "900" },
  loading: { minHeight: 140, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  loadingText: { color: colors.muted, fontSize: 11.5, marginTop: 8 },
  empty: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  emptyIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.softMint, alignItems: "center", justifyContent: "center" },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.ink, fontSize: 13.5, fontWeight: "900" },
  emptyText: { marginTop: 3, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  timeline: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  alertRow: { flexDirection: "row", paddingVertical: 18 },
  alertRowActive: { backgroundColor: "rgba(253,235,237,0.42)" },
  alertDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  timelineRail: { width: 34, alignItems: "center" },
  timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.softMint, alignItems: "center", justifyContent: "center" },
  timelineDotActive: { backgroundColor: colors.danger },
  timelineLine: { flex: 1, width: 1, backgroundColor: colors.borderStrong, marginTop: 5, marginBottom: -23 },
  alertContent: { flex: 1, minWidth: 0, paddingLeft: 5, paddingRight: 4 },
  alertTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  alertTitleWrap: { flex: 1 },
  alertTitle: { color: colors.ink, fontSize: 13.5, fontWeight: "900" },
  alertTime: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  alertStatus: { minHeight: 25, justifyContent: "center", borderRadius: radius.pill, paddingHorizontal: 8 },
  alertStatusActive: { backgroundColor: colors.dangerSoft },
  alertStatusDone: { backgroundColor: colors.softMint },
  alertStatusText: { color: colors.primaryDark, fontSize: 9, fontWeight: "900" },
  alertStatusTextActive: { color: colors.dangerDark },
  alertMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  alertMeta: { flex: 1, color: colors.muted, fontSize: 11.5 },
  acknowledgeWrap: { maxWidth: 320, marginTop: 14 },
  resolvedLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 13 },
  resolvedText: { color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" },
  returnButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 23, minHeight: 42 },
  returnText: { color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
