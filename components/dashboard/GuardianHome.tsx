import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { useSosStore } from "../../store/sosStore";
import { useGeofenceStore } from "../../store/geofenceStore";
import { useAnomalyStore } from "../../store/anomalyStore";
import { fetchSmartwatchForChild, type SmartwatchStatus } from "../../services/smartwatchService";
import { LocationMapCard } from "../location/LocationMapCard";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function formatTime(v?: string | null) {
  if (!v) return "No update";
  const m = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} hr ago`;
}

export function GuardianHome() {
  const router = useRouter();

  const guardian = useAuthStore(s => s.guardian);
  const child = useAuthStore(s => s.linkedChildren?.[0] ?? null);

  const latestLocation = useLocationStore(s => s.latest);
  const locationHistory = useLocationStore(s => s.history);
  const locationLoading = useLocationStore(s => s.isLoading);
  const loadLocation = useLocationStore(s => s.loadForChild);

  const sosAlerts = useSosStore(s => s.alerts);
  const loadSos = useSosStore(s => s.loadForChild);

  const zones = useGeofenceStore(s => s.zones);
  const loadZones = useGeofenceStore(s => s.load);

  const latestAnomaly = useAnomalyStore(s => s.latestAnomaly);
  const loadAnomaly = useAnomalyStore(s => s.loadForChild);

  const [watch, setWatch] = useState<SmartwatchStatus | null>(null);

  const trackingSource = child?.trackingSource ?? "mobile";
  const hasWatch = trackingSource === "smartwatch" || trackingSource === "both";

  useEffect(() => {
    if (!child) return;

    void loadLocation(child.id, child.fullName);
    void loadSos(child.id, child.fullName);
    void loadZones(child.guardianId, child.id);
    void loadAnomaly(child.id);

    if (hasWatch) {
      fetchSmartwatchForChild(child.id)
        .then(setWatch)
        .catch(() => setWatch(null));
    } else {
      setWatch(null);
    }
  }, [child?.id, hasWatch]);

  const activeSOS = useMemo(
    () => sosAlerts.find(i => i.status === "active"),
    [sosAlerts]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>SAFETRACK</Text>
          <Text style={styles.title}>
            Hi, {guardian?.fullName?.split(" ")[0] ?? "Guardian"}
          </Text>
        </View>

        <Pressable
          style={styles.circle}
          onPress={() => router.push("/(app)/notifications")}
        >
          <Ionicons name="notifications-outline" size={25} color={colors.primaryDark}/>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>CHILD PROFILE</Text>
        <Text style={styles.name}>{child?.fullName ?? "No child registered"}</Text>
        {child && <Text style={styles.text}>{child.age} years old • {child.relationship}</Text>}
      </View>

      <View style={styles.row}>
        <View style={styles.small}>
          <Text style={styles.section}>SAFE ZONE</Text>
          <Text style={styles.value}>{zones.length ? "Assigned" : "No Safe Zone"}</Text>
        </View>
        <View style={styles.small}>
          <Text style={styles.section}>AI STATUS</Text>
          <Text style={styles.value}>{latestAnomaly ? "Attention Needed" : "Normal"}</Text>
        </View>
      </View>

      {hasWatch && <View style={styles.card}>
        <Text style={styles.section}>SMARTWATCH</Text>
        <Text style={styles.name}>{watch?.deviceModel ?? "Samsung Galaxy Watch8 LTE"}</Text>
        <Text style={styles.text}>{watch?.connectionStatus === "connected" ? "Connected" : "Offline"}</Text>
        <Text style={styles.text}>Last seen: {formatTime(watch?.lastSeenAt)}</Text>
      </View>}

      <View style={styles.ai}>
        <Ionicons name="hardware-chip-outline" size={30} color={colors.primary}/>
        <Text style={styles.value}>AI Safety Monitoring</Text>
      </View>

      <Text style={styles.section}>LIVE LOCATION</Text>

      <LocationMapCard
        location={latestLocation}
        loading={locationLoading}
        height={350}
        onRefresh={() => child && loadLocation(child.id, child.fullName)}
      />

      <View style={styles.card}>
        <Text style={styles.section}>SOS MONITORING</Text>
        <Text style={styles.value}>{activeSOS ? "Active SOS Alert" : "No Active SOS"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>DAILY ACTIVITY</Text>
        <Text style={styles.value}>{locationHistory.length} Locations</Text>
        <Text style={styles.value}>{sosAlerts.length} SOS</Text>
      </View>

      <Text style={styles.section}>QUICK ACTIONS</Text>

      <Pressable
        style={styles.action}
        onPress={() => child && router.push({
          pathname:"/(app)/device-connection-code",
          params:{ childId: child.id }
        })}
      >
        <Ionicons name="watch-outline" size={24} color={colors.primary}/>
        <View style={{marginLeft:12}}>
          <Text style={styles.value}>Device Connection Code</Text>
          <Text style={styles.text}>Generate child device pairing code</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{flexGrow:1,padding:spacing.lg,paddingBottom:120,backgroundColor:colors.background},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  brand:{fontSize:11,fontWeight:"900",color:colors.primary},
  title:{fontSize:28,fontWeight:"900",color:colors.ink},
  circle:{width:48,height:48,borderRadius:24,alignItems:"center",justifyContent:"center",backgroundColor:colors.white,...shadow.soft},
  card:{backgroundColor:colors.white,borderRadius:radius.lg,padding:18,marginBottom:16,...shadow.soft},
  section:{fontSize:11,fontWeight:"900",color:colors.muted,letterSpacing:1},
  name:{marginTop:8,fontSize:18,fontWeight:"900",color:colors.ink},
  text:{marginTop:5,color:colors.muted,fontSize:13},
  value:{marginTop:8,fontWeight:"900",color:colors.ink},
  row:{flexDirection:"row",gap:12,marginBottom:16},
  small:{flex:1,padding:16,backgroundColor:colors.white,borderRadius:radius.md,...shadow.soft},
  ai:{flexDirection:"row",gap:12,padding:18,borderRadius:radius.lg,backgroundColor:colors.softMint,marginBottom:16,alignItems:"center"},
  action:{flexDirection:"row",alignItems:"center",backgroundColor:colors.white,padding:18,borderRadius:radius.lg,marginTop:12,...shadow.soft}
});
