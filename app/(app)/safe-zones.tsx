import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, {
  Circle,
  Marker,
  type Region,
} from "react-native-maps";

import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

type SafeZone = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type ZoneForm = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
};

const DEFAULT_REGION: Region = {
  latitude: 10.3103,
  longitude: 123.949,
  latitudeDelta: 0.13,
  longitudeDelta: 0.13,
};

function createZoneForm(latitude: number, longitude: number): ZoneForm {
  return {
    name: "",
    address: "",
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    radiusMeters: "200",
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? ""));

  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableText(value: unknown): string | null {
  const text = toText(value).trim();
  return text.length > 0 ? text : null;
}

function mapSafeZone(row: unknown): SafeZone {
  const value = (row ?? {}) as Record<string, unknown>;

  return {
    id: toText(value.id),
    name: toText(value.name),
    address: toNullableText(value.address),
    latitude: toNumber(value.latitude),
    longitude: toNumber(value.longitude),
    radiusMeters: toNumber(value.radius_meters, 200),
    isEnabled: value.is_enabled !== false,
    createdAt: toNullableText(value.created_at),
    updatedAt: toNullableText(value.updated_at),
  };
}

function formatRadius(radiusMeters: number): string {
  if (radiusMeters >= 1000) {
    return `${(radiusMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(radiusMeters)} m`;
}

function getZoneRegion(latitude: number, longitude: number): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: 0.018,
    longitudeDelta: 0.018,
  };
}

export default function SafeZonesScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const guardian = useAuthStore((state) => state.guardian);
  const linkedChildren = useAuthStore((state) => state.linkedChildren);

  const child = linkedChildren[0] ?? null;

  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [mapPoint, setMapPoint] = useState({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });

  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingZone, setEditingZone] = useState<SafeZone | null>(null);

  const [form, setForm] = useState<ZoneForm>(
    createZoneForm(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude)
  );

  const hasRequiredProfile = Boolean(guardian?.id && child?.id);

  const activeZoneCount = zones.filter((zone) => zone.isEnabled).length;

  const loadZones = async (showLoader = true) => {
    if (!guardian?.id || !child?.id) {
      setZones([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from("geofences")
      .select(
        `
          id,
          name,
          address,
          latitude,
          longitude,
          radius_meters,
          is_enabled,
          created_at,
          updated_at
        `
      )
      .eq("guardian_id", guardian.id)
      .eq("child_id", child.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      Alert.alert(
        "Unable to load safe zones",
        error.message || "SafeTrack could not retrieve your saved safe zones."
      );

      setZones([]);
    } else {
      const mappedZones = (data ?? []).map(mapSafeZone);
      setZones(mappedZones);

      const firstActiveZone = mappedZones.find((zone) => zone.isEnabled);

      if (firstActiveZone) {
        const nextRegion = getZoneRegion(
          firstActiveZone.latitude,
          firstActiveZone.longitude
        );

        setRegion(nextRegion);
        setMapPoint({
          latitude: firstActiveZone.latitude,
          longitude: firstActiveZone.longitude,
        });
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadZones();
  }, [guardian?.id, child?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadZones(false);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/safety-center" as Href);
  };

  const centerMap = (
    latitude = mapPoint.latitude,
    longitude = mapPoint.longitude
  ) => {
    const nextRegion = getZoneRegion(latitude, longitude);

    setRegion(nextRegion);
    setMapPoint({
      latitude,
      longitude,
    });

    mapRef.current?.animateToRegion(nextRegion, 450);
  };

  const updateForm = (field: keyof ZoneForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateSheet = () => {
    if (!hasRequiredProfile) {
      Alert.alert(
        "Child registration required",
        "Register a child first before creating a safe zone."
      );
      return;
    }

    setEditingZone(null);
    setForm(createZoneForm(mapPoint.latitude, mapPoint.longitude));
    setSheetVisible(true);
  };

  const openEditSheet = (zone: SafeZone) => {
    setEditingZone(zone);

    setForm({
      name: zone.name,
      address: zone.address ?? "",
      latitude: zone.latitude.toFixed(6),
      longitude: zone.longitude.toFixed(6),
      radiusMeters: String(Math.round(zone.radiusMeters)),
    });

    centerMap(zone.latitude, zone.longitude);
    setSheetVisible(true);
  };

  const closeSheet = () => {
    if (saving) {
      return;
    }

    setSheetVisible(false);
    setEditingZone(null);
  };

  const saveSafeZone = async () => {
    if (!guardian?.id || !child?.id) {
      Alert.alert(
        "Unable to save",
        "Guardian and child information could not be found."
      );
      return;
    }

    const name = form.name.trim();
    const address = form.address.trim();

    const latitude = Number.parseFloat(form.latitude);
    const longitude = Number.parseFloat(form.longitude);
    const radiusMeters = Number.parseInt(form.radiusMeters, 10);

    if (!name) {
      Alert.alert(
        "Zone name required",
        "Enter a zone name such as Home, School, or Grandmother's House."
      );
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert(
        "Invalid coordinates",
        "Enter a valid latitude and longitude."
      );
      return;
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      Alert.alert(
        "Invalid coordinates",
        "Latitude must be between -90 and 90. Longitude must be between -180 and 180."
      );
      return;
    }

    if (
      !Number.isFinite(radiusMeters) ||
      radiusMeters < 50 ||
      radiusMeters > 5000
    ) {
      Alert.alert(
        "Invalid radius",
        "SafeTrack accepts a whole-number radius from 50 to 5000 meters."
      );
      return;
    }

    setSaving(true);

    const payload = {
      name,
      address: address || null,
      latitude,
      longitude,
      radius_meters: radiusMeters,
    };

    let errorMessage: string | null = null;
    const wasEditing = Boolean(editingZone);

    if (editingZone) {
      const { error } = await supabase
        .from("geofences")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingZone.id)
        .eq("guardian_id", guardian.id)
        .eq("child_id", child.id);

      errorMessage = error?.message ?? null;
    } else {
      const { error } = await supabase.from("geofences").insert({
        guardian_id: guardian.id,
        child_id: child.id,
        ...payload,
        is_enabled: true,
      });

      errorMessage = error?.message ?? null;
    }

    setSaving(false);

    if (errorMessage) {
      Alert.alert("Unable to save safe zone", errorMessage);
      return;
    }

    centerMap(latitude, longitude);
    setSheetVisible(false);
    setEditingZone(null);

    await loadZones(false);

    Alert.alert(
      wasEditing ? "Safe zone updated" : "Safe zone added",
      wasEditing
        ? `${name} has been updated successfully.`
        : `${name} is now active for ${child.fullName}.`
    );
  };

  const toggleSafeZone = async (zone: SafeZone) => {
    if (!guardian?.id || !child?.id) {
      return;
    }

    const nextStatus = !zone.isEnabled;

    setZones((current) =>
      current.map((item) =>
        item.id === zone.id
          ? {
              ...item,
              isEnabled: nextStatus,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("geofences")
      .update({
        is_enabled: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", zone.id)
      .eq("guardian_id", guardian.id)
      .eq("child_id", child.id);

    if (error) {
      Alert.alert("Unable to update safe zone", error.message);
      await loadZones(false);
      return;
    }

    Alert.alert(
      nextStatus ? "Safe zone enabled" : "Safe zone paused",
      nextStatus
        ? `${zone.name} will now monitor entry and exit events.`
        : `${zone.name} will not monitor entry and exit events until enabled again.`
    );
  };

  const deleteSafeZone = (zone: SafeZone) => {
    Alert.alert(
      "Delete safe zone?",
      `Delete "${zone.name}"? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!guardian?.id || !child?.id) {
              return;
            }

            const { error } = await supabase
              .from("geofences")
              .delete()
              .eq("id", zone.id)
              .eq("guardian_id", guardian.id)
              .eq("child_id", child.id);

            if (error) {
              Alert.alert("Unable to delete safe zone", error.message);
              return;
            }

            setZones((current) =>
              current.filter((item) => item.id !== zone.id)
            );

            setSheetVisible(false);
            setEditingZone(null);

            Alert.alert("Safe zone deleted", `${zone.name} has been removed.`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.mapArea} collapsable={false}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            region={region}
            mapType="standard"
            scrollEnabled
            zoomEnabled
            rotateEnabled={false}
            pitchEnabled={false}
            showsCompass={false}
            showsScale={false}
            showsBuildings={false}
            loadingEnabled
            loadingIndicatorColor={colors.primary}
            loadingBackgroundColor="#EAF5EF"
            onRegionChangeComplete={(nextRegion) => {
              setRegion(nextRegion);
              setMapPoint({
                latitude: nextRegion.latitude,
                longitude: nextRegion.longitude,
              });
            }}
            onPress={(event) => {
              const coordinate = event.nativeEvent.coordinate;

              setMapPoint({
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
              });
            }}
          >
            {zones
              .filter((zone) => zone.isEnabled)
              .map((zone) => (
                <Circle
                  key={`circle-${zone.id}`}
                  center={{
                    latitude: zone.latitude,
                    longitude: zone.longitude,
                  }}
                  radius={zone.radiusMeters}
                  strokeWidth={2}
                  strokeColor="rgba(24, 165, 101, 0.86)"
                  fillColor="rgba(24, 165, 101, 0.15)"
                />
              ))}

            {zones.map((zone) => (
              <Marker
                key={`marker-${zone.id}`}
                coordinate={{
                  latitude: zone.latitude,
                  longitude: zone.longitude,
                }}
                title={zone.name}
                description={
                  zone.isEnabled
                    ? `${formatRadius(zone.radiusMeters)} active radius`
                    : "Safe zone monitoring paused"
                }
                onPress={() => openEditSheet(zone)}
                pinColor={zone.isEnabled ? colors.primary : "#9AA5A0"}
              />
            ))}
          </MapView>

          <View pointerEvents="box-none" style={styles.mapHeader}>
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="chevron-back" size={28} color={colors.ink} />
            </Pressable>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>Safe zones</Text>

              <Text style={styles.subtitle}>
                Guardian-defined expected places
              </Text>
            </View>

            <Pressable
              onPress={() => centerMap()}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="locate-outline"
                size={22}
                color={colors.primaryDark}
              />
            </Pressable>
          </View>

          <View pointerEvents="none" style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={23}
                color={colors.primary}
              />
            </View>

            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>
                {activeZoneCount} active zone
                {activeZoneCount === 1 ? "" : "s"}
              </Text>

              <Text style={styles.summaryText}>
                Tap and move the map freely. Zone circles use saved center
                points and radii.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.sectionLabel}>SAVED ZONES</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />

              <Text style={styles.loadingText}>
                Loading saved safe zones...
              </Text>
            </View>
          ) : zones.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="location-outline"
                size={52}
                color={colors.primary}
              />

              <Text style={styles.emptyTitle}>No safe zones yet</Text>

              <Text style={styles.emptyText}>
                Add a place such as Home or School to begin safe-zone
                monitoring.
              </Text>
            </View>
          ) : (
            <View style={styles.zoneList}>
              {zones.map((zone) => (
                <View
                  key={zone.id}
                  style={[
                    styles.zoneCard,
                    !zone.isEnabled && styles.zoneCardPaused,
                  ]}
                >
                  <Pressable
                    onPress={() => openEditSheet(zone)}
                    style={({ pressed }) => [
                      styles.zoneMain,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.zoneIcon,
                        !zone.isEnabled && styles.zoneIconPaused,
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={22}
                        color={zone.isEnabled ? colors.primary : colors.muted}
                      />
                    </View>

                    <View style={styles.zoneCopy}>
                      <View style={styles.zoneTitleRow}>
                        <Text numberOfLines={1} style={styles.zoneName}>
                          {zone.name}
                        </Text>

                        <View
                          style={[
                            styles.statusPill,
                            !zone.isEnabled && styles.statusPillPaused,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              !zone.isEnabled && styles.statusTextPaused,
                            ]}
                          >
                            {zone.isEnabled ? "Active" : "Paused"}
                          </Text>
                        </View>
                      </View>

                      <Text numberOfLines={1} style={styles.zoneAddress}>
                        {zone.address ||
                          `${zone.latitude.toFixed(
                            6
                          )}, ${zone.longitude.toFixed(6)}`}
                      </Text>

                      <Text style={styles.zoneRadius}>
                        {formatRadius(zone.radiusMeters)} monitoring radius
                      </Text>
                    </View>

                    <Ionicons
                      name="pencil-outline"
                      size={19}
                      color={colors.primaryDark}
                    />
                  </Pressable>

                  <View style={styles.zoneActions}>
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>
                        {zone.isEnabled
                          ? "Monitoring enabled"
                          : "Monitoring paused"}
                      </Text>

                      <Switch
                        value={zone.isEnabled}
                        onValueChange={() => toggleSafeZone(zone)}
                        trackColor={{
                          false: "#D9E0DB",
                          true: "#AEEBCB",
                        }}
                        thumbColor={zone.isEnabled ? colors.primary : "#FFFFFF"}
                      />
                    </View>

                    <Pressable
                      onPress={() => deleteSafeZone(zone)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.danger}
                      />

                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.note}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.primary}
            />

            <Text style={styles.noteText}>
              SafeTrack can process entry and exit events only after location
              records are received from the child device.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable
            onPress={openCreateSheet}
            disabled={!hasRequiredProfile}
            style={({ pressed }) => [
              styles.addButton,
              !hasRequiredProfile && styles.addButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={30} color={colors.white} />

            <Text style={styles.addButtonText}>Add safe zone</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissArea} onPress={closeSheet} />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetKeyboard}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleCopy}>
                  <Text style={styles.sheetTitle}>
                    {editingZone ? "Edit safe zone" : "Add safe zone"}
                  </Text>

                  <Text style={styles.sheetSubtitle}>
                    Save an exact center point and monitoring radius.
                  </Text>
                </View>

                <Pressable
                  onPress={closeSheet}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="close" size={28} color={colors.ink} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.fieldLabel}>Zone name</Text>

                <TextInput
                  value={form.name}
                  onChangeText={(value) => updateForm("name", value)}
                  placeholder="Example: Home"
                  placeholderTextColor="#9AA5A0"
                  style={styles.textInput}
                  editable={!saving}
                  maxLength={60}
                />

                <Text style={styles.fieldLabel}>
                  Address or location label
                </Text>

                <TextInput
                  value={form.address}
                  onChangeText={(value) => updateForm("address", value)}
                  placeholder="Example: Babag II, Lapu-Lapu City"
                  placeholderTextColor="#9AA5A0"
                  style={styles.textInput}
                  editable={!saving}
                  maxLength={140}
                />

                <View style={styles.coordinateRow}>
                  <View style={styles.coordinateField}>
                    <Text style={styles.fieldLabel}>Latitude</Text>

                    <TextInput
                      value={form.latitude}
                      onChangeText={(value) => updateForm("latitude", value)}
                      placeholder="10.310000"
                      placeholderTextColor="#9AA5A0"
                      style={styles.textInput}
                      editable={!saving}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.coordinateField}>
                    <Text style={styles.fieldLabel}>Longitude</Text>

                    <TextInput
                      value={form.longitude}
                      onChangeText={(value) => updateForm("longitude", value)}
                      placeholder="123.949000"
                      placeholderTextColor="#9AA5A0"
                      style={styles.textInput}
                      editable={!saving}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Radius in meters</Text>

                <TextInput
                  value={form.radiusMeters}
                  onChangeText={(value) =>
                    updateForm("radiusMeters", value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="200"
                  placeholderTextColor="#9AA5A0"
                  style={styles.textInput}
                  editable={!saving}
                  keyboardType="number-pad"
                  maxLength={4}
                />

                <Text style={styles.radiusHint}>
                  SafeTrack accepts whole-number radii from 50 to 5000 meters.
                </Text>

                <Pressable
                  onPress={saveSafeZone}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    saving && styles.saveButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Ionicons name="checkmark" size={29} color={colors.white} />
                  )}

                  <Text style={styles.saveButtonText}>
                    {saving
                      ? "Saving..."
                      : editingZone
                        ? "Save changes"
                        : "Save safe zone"}
                  </Text>
                </Pressable>

                {editingZone ? (
                  <Pressable
                    onPress={() => deleteSafeZone(editingZone)}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.sheetDeleteButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.danger}
                    />

                    <Text style={styles.sheetDeleteText}>
                      Delete this safe zone
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  mapArea: {
    height: 300,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#EAF5EF",
  },

  map: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EAF5EF",
  },

  mapHeader: {
    position: "absolute",
    top: 18,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    ...shadow.card,
  },

  titleBlock: {
    flex: 1,
    marginHorizontal: 14,
  },

  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  summaryCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 15,
    zIndex: 10,
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.96)",
    ...shadow.card,
  },

  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  summaryCopy: {
    flex: 1,
    marginLeft: 12,
  },

  summaryTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "900",
  },

  summaryText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 3,
  },

  contentScroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
    paddingBottom: 20,
  },

  sectionLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 15,
  },

  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },

  loadingText: {
    color: colors.muted,
    fontSize: 12.5,
    marginTop: 11,
  },

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 37,
    paddingBottom: 32,
  },

  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },

  emptyText: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },

  zoneList: {
    gap: 12,
  },

  zoneCard: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: colors.white,
    ...shadow.card,
  },

  zoneCardPaused: {
    opacity: 0.78,
    backgroundColor: "#F7F9F7",
  },

  zoneMain: {
    minHeight: 91,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  zoneIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  zoneIconPaused: {
    backgroundColor: "#EDF1EE",
  },

  zoneCopy: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  zoneTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  zoneName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginRight: 8,
  },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
  },

  statusPillPaused: {
    backgroundColor: "#E8ECE9",
  },

  statusText: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
  },

  statusTextPaused: {
    color: colors.muted,
  },

  zoneAddress: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },

  zoneRadius: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 4,
  },

  zoneActions: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF1EE",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  toggleLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginRight: 8,
  },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 10,
  },

  deleteText: {
    color: colors.danger,
    fontSize: 10.5,
    fontWeight: "900",
    marginLeft: 5,
  },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 7,
    marginTop: 26,
  },

  noteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginLeft: 10,
  },

  bottomArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5ECE7",
    backgroundColor: colors.background,
  },

  addButton: {
    minHeight: 61,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.card,
  },

  addButtonDisabled: {
    opacity: 0.45,
  },

  addButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
    marginLeft: 10,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16, 31, 23, 0.48)",
  },

  modalDismissArea: {
    flex: 1,
  },

  sheetKeyboard: {
    width: "100%",
  },

  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.white,
    overflow: "hidden",
  },

  sheetHandle: {
    width: 45,
    height: 5,
    borderRadius: radius.pill,
    alignSelf: "center",
    backgroundColor: "#D8E5DE",
    marginTop: 11,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 18,
    paddingBottom: 11,
  },

  sheetTitleCopy: {
    flex: 1,
    paddingRight: 12,
  },

  sheetTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  sheetSubtitle: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },

  closeButton: {
    width: 49,
    height: 49,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },

  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 7,
  },

  textInput: {
    minHeight: 56,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 15,
    borderRadius: 17,
    backgroundColor: "#F6FAF7",
    borderWidth: 1,
    borderColor: "#E8F0EB",
  },

  coordinateRow: {
    flexDirection: "row",
    gap: 12,
  },

  coordinateField: {
    flex: 1,
  },

  radiusHint: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 10,
  },

  saveButton: {
    minHeight: 61,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 22,
  },

  saveButtonDisabled: {
    opacity: 0.62,
  },

  saveButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
    marginLeft: 10,
  },

  sheetDeleteButton: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  sheetDeleteText: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: "900",
    marginLeft: 6,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});