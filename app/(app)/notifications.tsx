import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  useRouter,
} from "expo-router";

import {
  useAuthStore,
} from "../../store/authStore";

import {
  useSosStore,
} from "../../store/sosStore";


import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";



type NotificationItem = {

  id:string;

  title:string;

  message:string;

  icon:keyof typeof Ionicons.glyphMap;

  time:string;

};





export default function NotificationsScreen(){


  const router = useRouter();


  const child =
    useAuthStore(
      state=>state.linkedChildren?.[0] ?? null
    );


  const sosAlerts =
    useSosStore(
      state=>state.alerts
    );



  const trackingSource =
    child?.trackingSource ?? "mobile";




  const notifications:NotificationItem[] = [];




  /*
    SMARTWATCH ONLY
  */

  if(
    trackingSource==="smartwatch" ||
    trackingSource==="both"
  ){

    notifications.push({

      id:"watch",

      title:"Smartwatch Monitoring",

      message:
        "Registered smartwatch monitoring is active for this child.",

      icon:"watch-outline",

      time:"Available",

    });


  }




  /*
    MOBILE ONLY
  */

  if(
    trackingSource==="mobile" ||
    trackingSource==="both"
  ){

    notifications.push({

      id:"mobile",

      title:"Mobile Location Monitoring",

      message:
        "Child mobile device location tracking is enabled.",

      icon:"phone-portrait-outline",

      time:"Available",

    });

  }





  /*
    SOS
  */

  const activeSOS =
    sosAlerts.filter(
      item=>item.status==="active"
    ).length;



  notifications.push({

    id:"sos",

    title:
      activeSOS>0
      ?
      "Active SOS Alert"
      :
      "SOS Monitoring Ready",


    message:
      activeSOS>0
      ?
      `${activeSOS} SOS alert requires guardian attention.`
      :
      "Emergency alert monitoring is active.",


    icon:
      activeSOS>0
      ?
      "warning-outline"
      :
      "shield-checkmark-outline",


    time:"Current",

  });






  /*
    SAFE ZONE
  */

  notifications.push({

    id:"safezone",

    title:"Safe Zone Monitoring",

    message:
      "Guardian-defined safe zone monitoring is enabled.",

    icon:"location-outline",

    time:"Current",

  });







  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={19} color={colors.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>SAFETY UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Monitoring information derived from the selected child's existing SafeTrack status and tracking source.
          </Text>
        </View>

        <View style={styles.contextBand}>
          <View style={styles.contextIcon}>
            <Ionicons name="person-outline" size={19} color={colors.primaryDark} />
          </View>
          <View style={styles.contextCopy}>
            <Text style={styles.contextLabel}>CURRENT CHILD</Text>
            <Text style={styles.contextValue}>{child?.fullName ?? "No child selected"}</Text>
          </View>
          <View style={styles.sourcePill}>
            <Ionicons
              name={trackingSource === "smartwatch" ? "watch-outline" : trackingSource === "both" ? "git-compare-outline" : "phone-portrait-outline"}
              size={14}
              color={colors.primaryDark}
            />
            <Text style={styles.sourceText}>
              {trackingSource === "smartwatch" ? "Watch" : trackingSource === "both" ? "Both" : "Mobile"}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>MONITORING STATUS</Text>
            <Text style={styles.sectionTitle}>Current updates</Text>
          </View>
          <Text style={styles.countText}>{notifications.length} shown</Text>
        </View>

        <View style={styles.noticeList}>
          {notifications.map((item, index) => {
            const urgent = item.id === "sos" && activeSOS > 0;
            return (
              <View
                key={item.id}
                style={[
                  styles.noticeRow,
                  urgent && styles.noticeRowUrgent,
                  index !== notifications.length - 1 && styles.noticeDivider,
                ]}
              >
                <View style={[styles.iconBox, urgent && styles.iconBoxUrgent]}>
                  <Ionicons name={item.icon} size={20} color={urgent ? colors.danger : colors.primaryDark} />
                </View>
                <View style={styles.content}>
                  <View style={styles.row}>
                    <Text style={[styles.itemTitle, urgent && styles.itemTitleUrgent]}>{item.title}</Text>
                    <Text style={styles.time}>{item.time}</Text>
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footnote}>
          <Ionicons name="information-circle-outline" size={17} color={colors.primaryDark} />
          <Text style={styles.footnoteText}>
            This screen preserves the notification/status information already exposed by the current Guardian interface; it does not generate new monitoring records.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { width: "100%", maxWidth: 960, alignSelf: "center", padding: spacing.lg, paddingBottom: 100 },
  back: { alignSelf: "flex-start", minHeight: 38, flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 18, borderRadius: radius.sm, paddingHorizontal: 3 },
  backText: { fontSize: 11.5, fontWeight: "800", color: colors.ink },
  header: { maxWidth: 680 },
  eyebrow: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.3, color: colors.primary },
  title: { marginTop: 4, fontSize: 30, fontWeight: "900", letterSpacing: -0.8, color: colors.ink },
  subtitle: { marginTop: 7, color: colors.muted, fontSize: 12.5, lineHeight: 19 },
  contextBand: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 24, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  contextIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.softMint, alignItems: "center", justifyContent: "center" },
  contextCopy: { flex: 1 },
  contextLabel: { color: colors.muted, fontSize: 8.5, fontWeight: "900", letterSpacing: 1 },
  contextValue: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 2 },
  sourcePill: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, backgroundColor: colors.softMint, paddingHorizontal: 9 },
  sourceText: { color: colors.primaryDark, fontSize: 9.5, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 28, marginBottom: 10 },
  sectionEyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.05 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  countText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  noticeList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 17 },
  noticeRowUrgent: { backgroundColor: "rgba(253,235,237,0.42)" },
  noticeDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.softMint, justifyContent: "center", alignItems: "center" },
  iconBoxUrgent: { backgroundColor: colors.dangerSoft },
  content: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  itemTitle: { flex: 1, fontSize: 13.5, fontWeight: "900", color: colors.ink },
  itemTitleUrgent: { color: colors.dangerDark },
  time: { fontSize: 9.5, fontWeight: "700", color: colors.muted },
  message: { marginTop: 5, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  footnote: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 19 },
  footnoteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
