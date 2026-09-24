import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  useAuthStore,
} from "../../store/authStore";


import {
  useGeofenceStore,
} from "../../store/geofenceStore";


import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
} from "../../components/location/SafeTrackInteractiveMap";


import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";





type FormState = {

  name:string;

  address:string;

  latitude:string;

  longitude:string;

  radius:string;

};



const EMPTY_FORM:FormState = {

  name:"",

  address:"",

  latitude:"10.000000",

  longitude:"123.000000",

  radius:"200",

};








export default function SafeZonesScreen(){


  const guardian =
    useAuthStore(
      state=>state.guardian
    );


  const child =
useAuthStore(
 state=>state.linkedChildren?.[0] ?? null
);

  const trackingSource =
child?.trackingSource ?? "mobile";



  const {

    zones,

    isLoading,

    isSaving,

    error,

    load,

    saveNew,

    saveEdit,

    remove,

  } =
  useGeofenceStore();





  const [
    modalVisible,
    setModalVisible
  ] =
  useState(false);



  const [
    editingId,
    setEditingId
  ] =
  useState<string|null>(null);



  const [
    form,
    setForm
  ] =
  useState<FormState>(
    EMPTY_FORM
  );








  const loadZones =
  useCallback(
    async()=>{

      if(
        !guardian?.id ||
        !child?.id
      ){
        return;
      }


      await load(
        guardian.id,
        child.id
      );


    },
    [
      guardian?.id,
      child?.id
    ]
  );





  useEffect(()=>{

    void loadZones();

  },[loadZones]);









  const openCreate = ()=>{


    setEditingId(null);


    setForm(
      EMPTY_FORM
    );


    setModalVisible(true);

  };








  const openEdit = (
    zone:any
  )=>{


    setEditingId(
      zone.id
    );


    setForm({

      name:
        zone.name,

      address:
        zone.address ?? "",

      latitude:
        String(
          zone.latitude
        ),

      longitude:
        String(
          zone.longitude
        ),

      radius:
        String(
          zone.radiusMeters
        ),

    });


    setModalVisible(true);


  };









  const save = async()=>{


    if(
      !guardian?.id ||
      !child?.id
    ){
      return;
    }



    const latitude =
      Number(
        form.latitude
      );


    const longitude =
      Number(
        form.longitude
      );


    const radiusMeters =
      Number(
        form.radius
      );



    if(
      !form.name.trim()
    ){

      Alert.alert(
        "Missing name",
        "Please enter a Safe Zone name."
      );

      return;

    }



    if(
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ){

      Alert.alert(
        "Invalid location",
        "Please enter valid coordinates."
      );

      return;

    }



    try{


      if(editingId){


        await saveEdit(
          editingId,
          {

            name:
              form.name,

            address:
              form.address,

            latitude,

            longitude,

            radiusMeters,

            isEnabled:true,

          }
        );


      }
      else{


        await saveNew({

          guardianId:
            guardian.id,

          childId:
            child.id,


          name:
            form.name,

          address:
            form.address,


          latitude,

          longitude,


          radiusMeters,


          isEnabled:true,

        });


      }



      setModalVisible(false);

      await loadZones();



    }
    catch(error){


      Alert.alert(

        "Unable to save Safe Zone",

        error instanceof Error
        ?
        error.message
        :
        "Please try again."

      );


    }



  };









  const toggle =
  async(
    zone:any
  )=>{


    try{


      await saveEdit(

        zone.id,

        {

          name:
            zone.name,

          address:
            zone.address,

          latitude:
            zone.latitude,

          longitude:
            zone.longitude,

          radiusMeters:
            zone.radiusMeters,

          isEnabled:
            !zone.isEnabled,

        }

      );


    }
    catch(error){

      Alert.alert(
        "Update failed",
        error instanceof Error
        ?
        error.message
        :
        "Unable to update."
      );

    }


  };









  const deleteZone =
  (
    id:string
  )=>{


    Alert.alert(

      "Delete Safe Zone",

      "Remove this Safe Zone?",

      [

        {
          text:"Cancel",
          style:"cancel"
        },

        {

          text:"Delete",

          style:"destructive",

          onPress:async()=>{

            await remove(id);

          }

        }

      ]

    );


  };









  const markers =
  useMemo<SafeTrackMapMarker[]>(()=>{


    return zones.map(zone=>({

      id:
        zone.id,


      latitude:
        zone.latitude,


      longitude:
        zone.longitude,


      title:
        zone.name,


      detail:
        `${zone.radiusMeters} meter radius`,


      kind:
        "zone",


    }));


  },[zones]);









  const activeCount = zones.filter((zone) => zone.isEnabled).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>GEOFENCE MONITORING</Text>
            <Text style={styles.title}>Safe zones</Text>
            <Text style={styles.subtitle}>
              Manage guardian-defined boundaries for the registered child device. Entry and exit notices continue to use the existing SafeTrack geofence workflow.
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Create safe zone"
            onPress={openCreate}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={19} color={colors.white} />
            <Text style={styles.createButtonText}>New zone</Text>
          </Pressable>
        </View>

        <View style={styles.mapSection}>
          <View style={styles.mapMeta}>
            <View>
              <Text style={styles.mapMetaLabel}>MONITORING SOURCE</Text>
              <Text style={styles.mapMetaValue}>
                {trackingSource === "mobile"
                  ? "Mobile device"
                  : trackingSource === "both"
                    ? "Smartwatch + mobile"
                    : "Smartwatch"}
              </Text>
            </View>
            <View style={styles.zoneCount}>
              <View style={styles.zoneCountDot} />
              <Text style={styles.zoneCountText}>{activeCount} active</Text>
            </View>
          </View>

          <View style={styles.map}>
            <SafeTrackInteractiveMap markers={markers} height={420} />
          </View>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>SAVED BOUNDARIES</Text>
            <Text style={styles.sectionTitle}>Guardian-defined zones</Text>
          </View>
          <Text style={styles.zoneTotal}>{zones.length} total</Text>
        </View>

        {isLoading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading safe zones...</Text>
          </View>
        ) : zones.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="map-outline" size={23} color={colors.primaryDark} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>No safe zones yet</Text>
              <Text style={styles.emptyText}>Create a boundary when you are ready to monitor an expected location.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.zoneList}>
            {zones.map((zone, index) => (
              <View key={zone.id} style={[styles.zoneRow, index !== zones.length - 1 && styles.zoneDivider]}>
                <View style={[styles.zoneMarker, !zone.isEnabled && styles.zoneMarkerDisabled]}>
                  <Ionicons name="location-outline" size={18} color={zone.isEnabled ? colors.primaryDark : colors.muted} />
                </View>
                <View style={styles.zoneCopy}>
                  <View style={styles.zoneNameRow}>
                    <Text style={styles.zoneName} numberOfLines={1}>{zone.name}</Text>
                    <View style={[styles.statusPill, !zone.isEnabled && styles.statusPillDisabled]}>
                      <View style={[styles.statusDot, !zone.isEnabled && styles.statusDotDisabled]} />
                      <Text style={[styles.statusText, !zone.isEnabled && styles.statusTextDisabled]}>
                        {zone.isEnabled ? "Active" : "Paused"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.detail}>{zone.radiusMeters} m radius</Text>
                  <View style={styles.zoneActions}>
                    <Pressable onPress={() => openEdit(zone)} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
                      <Ionicons name="create-outline" size={15} color={colors.primaryDark} />
                      <Text style={styles.inlineActionText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => toggle(zone)} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
                      <Ionicons name={zone.isEnabled ? "pause-outline" : "play-outline"} size={15} color={colors.primaryDark} />
                      <Text style={styles.inlineActionText}>{zone.isEnabled ? "Pause" : "Enable"}</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteZone(zone.id)} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.noteText}>Safe-zone notices depend on successfully received location records and the boundaries already stored by SafeTrack.</Text>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>SAFE ZONE</Text>
                <Text style={styles.modalTitle}>Boundary details</Text>
              </View>
              <Pressable accessibilityLabel="Close safe zone form" onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            {[
              ["name", "Name"],
              ["address", "Address"],
              ["latitude", "Latitude"],
              ["longitude", "Longitude"],
              ["radius", "Radius meters"],
            ].map(([key, label]) => (
              <View key={key} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  placeholder={label}
                  placeholderTextColor={colors.mutedLight}
                  value={form[key as keyof FormState]}
                  onChangeText={(text) => setForm({ ...form, [key]: text })}
                  style={styles.input}
                />
              </View>
            ))}

            <Pressable disabled={isSaving} onPress={save} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]}>
              {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="checkmark" size={18} color={colors.white} />}
              <Text style={styles.saveText}>{isSaving ? "Saving..." : "Save safe zone"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1160, alignSelf: "center", padding: spacing.lg, paddingBottom: 120 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  headerCopy: { flex: 1, maxWidth: 690 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: -0.8, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 7 },
  createButton: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.md, backgroundColor: colors.primaryDark, paddingHorizontal: 14, ...shadow.soft },
  createButtonText: { color: colors.white, fontSize: 11.5, fontWeight: "900" },
  mapSection: { marginTop: 25 },
  mapMeta: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  mapMetaLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  mapMetaValue: { color: colors.ink, fontSize: 12.5, fontWeight: "800", marginTop: 3 },
  zoneCount: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.softMint, borderRadius: radius.pill, paddingHorizontal: 10, minHeight: 29 },
  zoneCountDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  zoneCountText: { color: colors.primaryDark, fontSize: 10, fontWeight: "900" },
  map: { borderRadius: radius.xl, overflow: "hidden", ...shadow.card },
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 30, marginBottom: 10 },
  sectionEyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.15 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  zoneTotal: { color: colors.muted, fontSize: 10.5, fontWeight: "800" },
  zoneList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  zoneRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 16 },
  zoneDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  zoneMarker: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.softMint },
  zoneMarkerDisabled: { backgroundColor: colors.backgroundAlt },
  zoneCopy: { flex: 1, minWidth: 0 },
  zoneNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  zoneName: { flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: "900" },
  detail: { color: colors.muted, fontSize: 11, marginTop: 4 },
  statusPill: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, backgroundColor: colors.softMint, paddingHorizontal: 8 },
  statusPillDisabled: { backgroundColor: colors.backgroundAlt },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  statusDotDisabled: { backgroundColor: colors.muted },
  statusText: { color: colors.primaryDark, fontSize: 9.5, fontWeight: "900" },
  statusTextDisabled: { color: colors.muted },
  zoneActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 },
  inlineAction: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9 },
  inlineActionText: { color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" },
  deleteText: { color: colors.danger, fontSize: 10.5, fontWeight: "800" },
  stateBlock: { minHeight: 130, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  stateText: { color: colors.muted, fontSize: 11.5, marginTop: 8 },
  emptyState: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  emptyIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.softMint },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 18 },
  noteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheet: { width: "100%", maxWidth: 720, alignSelf: "center", maxHeight: "92%", backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 28 },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 3 },
  closeButton: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundAlt },
  fieldGroup: { marginTop: 12 },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, color: colors.ink, paddingHorizontal: 13, fontSize: 12.5 },
  saveButton: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.md, backgroundColor: colors.primaryDark, marginTop: 18 },
  saveText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
