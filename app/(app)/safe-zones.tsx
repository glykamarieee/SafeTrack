import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useGeofenceStore } from "../../store/geofenceStore";
import { fetchLatestLocationForChild } from "../../services/locationService";
import type { Geofence, LocationLog } from "../../types/safetrack";

import {
  SafeTrackInteractiveMap,
  type SafeTrackMapCircle,
  type SafeTrackMapMarker,
} from "../../components/location/SafeTrackInteractiveMap";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

/*
 * SafeTrack Safe Zone screen
 * --------------------------
 * Frontend/UI-only improvement:
 * - No hard-coded coordinates are ever saved.
 * - A Guardian chooses a Safe Zone center using SafeTrack's map or the
 *   child's latest AVAILABLE stored location.
 * - Existing geofence store/service/database behavior is preserved.
 */

type FormState = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radius: string;
};

type PointSource = "child" | "map" | "saved" | null;

type Coordinate = {
  latitude: number;
  longitude: number;
};

const EMPTY_FORM: FormState = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius: "200",
};

/*
 * Used only to give the map somewhere reasonable to open when there are
 * no saved zones and no child location yet. This coordinate is NEVER copied
 * into the Safe Zone form and can never be saved unless the Guardian taps it.
 */
const RADIUS_PRESETS = [50, 100, 200, 500] as const;

function validCoordinate(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function locationCoordinate(
  location: LocationLog | null
): Coordinate | null {
  if (!location) {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  return validCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

function formCoordinate(form: FormState): Coordinate | null {
  if (!form.latitude.trim() || !form.longitude.trim()) {
    return null;
  }

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);

  return validCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function formatRadius(meters: number): string {
  if (!Number.isFinite(meters)) {
    return "Not set";
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}

function sourceLabel(value: unknown): string {
  const source = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    [
      "watch",
      "smartwatch",
      "wear_os",
      "galaxy_watch",
      "watch8",
    ].includes(source)
  ) {
    return "Smartwatch";
  }

  if (
    [
      "mobile",
      "phone",
      "child_mobile",
      "android",
    ].includes(source)
  ) {
    return "Child phone";
  }

  return source ? "SafeTrack device" : "Unknown source";
}

function relativeTime(value?: string | null): string {
  if (!value) {
    return "No recorded update";
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "No recorded update";
  }

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitude1 = toRadians(a.latitude);
  const latitude2 = toRadians(b.latitude);
  const latitudeDelta = toRadians(
    b.latitude - a.latitude
  );
  const longitudeDelta = toRadians(
    b.longitude - a.longitude
  );

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )
  );
}

function selectionLabel(source: PointSource): string {
  if (source === "child") {
    return "Using child's latest available location";
  }

  if (source === "map") {
    return "Selected on the SafeTrack map";
  }

  if (source === "saved") {
    return "Saved Safe Zone center";
  }

  return "No location selected";
}

export default function SafeZonesScreen() {
  const guardian = useAuthStore(
    (state) => state.guardian
  );

  const child = useAuthStore(
    (state) => state.linkedChildren[0]
  );

  const trackingSource =
    child?.trackingSource ?? "smartwatch";

  const {
    zones,
    isLoading,
    isSaving,
    error,
    load,
    saveNew,
    saveEdit,
    remove,
  } = useGeofenceStore();

  const [modalVisible, setModalVisible] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editingEnabled, setEditingEnabled] =
    useState(true);

  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);

  const [pointSource, setPointSource] =
    useState<PointSource>(null);

  const [pickingLocation, setPickingLocation] =
    useState(false);

  const [latestLocation, setLatestLocation] =
    useState<LocationLog | null>(null);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [recenterSignal, setRecenterSignal] =
    useState(0);

  const latestPoint = useMemo(
    () => locationCoordinate(latestLocation),
    [latestLocation]
  );

  const selectedPoint = useMemo(
    () => formCoordinate(form),
    [form.latitude, form.longitude]
  );

  const selectedRadius = Number(form.radius);

  const editingZone = useMemo(
    () =>
      zones.find((zone) => zone.id === editingId) ??
      null,
    [editingId, zones]
  );

  const loadZones = useCallback(async () => {
    if (!guardian?.id || !child?.id) {
      return;
    }

    await load(guardian.id, child.id);
  }, [guardian?.id, child?.id, load]);

  const loadLatestLocation = useCallback(
    async (showLoader = true): Promise<LocationLog | null> => {
      if (!child?.id) {
        setLatestLocation(null);
        return null;
      }

      if (showLoader) {
        setLocationLoading(true);
      }

      try {
        const location =
          await fetchLatestLocationForChild(
            child.id,
            child.fullName ?? "Child"
          );

        setLatestLocation(location);
        return location;
      } catch (reason) {
        console.log(
          "SafeTrack latest location unavailable",
          reason
        );
        setLatestLocation(null);
        return null;
      } finally {
        setLocationLoading(false);
      }
    },
    [child?.id, child?.fullName]
  );

  useEffect(() => {
    void loadZones();
    void loadLatestLocation();
  }, [loadZones, loadLatestLocation]);

  const mapMarkers = useMemo<SafeTrackMapMarker[]>(
    () => {
      const showDraft =
        Boolean(selectedPoint) &&
        (modalVisible || pickingLocation);

      const savedMarkers = zones
        .filter(
          (zone) =>
            !showDraft || zone.id !== editingId
        )
        .map((zone) => ({
          id: `zone-${zone.id}`,
          latitude: Number(zone.latitude),
          longitude: Number(zone.longitude),
          title: zone.name,
          detail: `${formatRadius(
            Number(zone.radiusMeters)
          )} Safe Zone${
            zone.isEnabled ? "" : " • Disabled"
          }`,
          kind: "zone" as const,
        }));

      const markers: SafeTrackMapMarker[] = [
        ...savedMarkers,
      ];

      if (latestPoint) {
        markers.push({
          id: "child-latest-location",
          latitude: latestPoint.latitude,
          longitude: latestPoint.longitude,
          title:
            child?.fullName ?? "Child location",
          detail: `Latest available location • ${sourceLabel(
            latestLocation?.source
          )}`,
          kind: "location",
        });
      }

      if (showDraft && selectedPoint) {
        markers.push({
          id: "safe-zone-draft-center",
          latitude: selectedPoint.latitude,
          longitude: selectedPoint.longitude,
          title:
            form.name.trim() || "Safe Zone center",
          detail: `${formatRadius(
            selectedRadius
          )} radius • ${selectionLabel(pointSource)}`,
          kind: "zone",
        });
      }

      return markers;
    },
    [
      zones,
      editingId,
      modalVisible,
      pickingLocation,
      latestPoint,
      latestLocation?.source,
      child?.fullName,
      selectedPoint,
      form.name,
      selectedRadius,
      pointSource,
    ]
  );

  const mapCircles = useMemo<SafeTrackMapCircle[]>(
    () => {
      const showDraft =
        Boolean(selectedPoint) &&
        (modalVisible || pickingLocation);

      const savedCircles = zones
        .filter(
          (zone) =>
            !showDraft || zone.id !== editingId
        )
        .map((zone) => ({
          id: `zone-circle-${zone.id}`,
          latitude: Number(zone.latitude),
          longitude: Number(zone.longitude),
          radiusMeters: Number(zone.radiusMeters),
          label: zone.name,
          enabled: zone.isEnabled,
        }));

      if (
        showDraft &&
        selectedPoint &&
        Number.isFinite(selectedRadius) &&
        selectedRadius > 0
      ) {
        savedCircles.push({
          id: "safe-zone-draft-circle",
          latitude: selectedPoint.latitude,
          longitude: selectedPoint.longitude,
          radiusMeters: selectedRadius,
          label: form.name.trim() || "New Safe Zone",
          enabled: true,
        });
      }

      return savedCircles;
    },
    [
      zones,
      editingId,
      modalVisible,
      pickingLocation,
      selectedPoint,
      selectedRadius,
      form.name,
    ]
  );

  const childDistance = useMemo(() => {
    if (!latestPoint || !selectedPoint) {
      return null;
    }

    return Math.round(
      distanceMeters(latestPoint, selectedPoint)
    );
  }, [latestPoint, selectedPoint]);

  const accuracyMeters =
    latestLocation?.accuracyMeters == null
      ? null
      : Number(latestLocation.accuracyMeters);

  const radiusAccuracyWarning =
    pointSource === "child" &&
    accuracyMeters !== null &&
    Number.isFinite(accuracyMeters) &&
    Number.isFinite(selectedRadius) &&
    selectedRadius > 0 &&
    selectedRadius <= accuracyMeters;

  const activeCount = zones.filter(
    (zone) => zone.isEnabled
  ).length;

  const canSave =
    Boolean(form.name.trim()) &&
    Boolean(selectedPoint) &&
    Number.isFinite(selectedRadius) &&
    selectedRadius >= 50 &&
    selectedRadius <= 5000;

  const resetEditor = () => {
    setEditingId(null);
    setEditingEnabled(true);
    setPointSource(null);
    setPickingLocation(false);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    resetEditor();
    setModalVisible(true);

    if (latestPoint) {
      setRecenterSignal((value) => value + 1);
    }
  };

  const openCreateFromChild = () => {
    if (!latestPoint) {
      Alert.alert(
        "No child location available",
        "SafeTrack has not received a usable location for this child yet. You can still choose the Safe Zone center directly on the SafeTrack map."
      );
      return;
    }

    setEditingId(null);
    setEditingEnabled(true);
    setPointSource("child");
    setForm({
      ...EMPTY_FORM,
      latitude: formatCoordinate(latestPoint.latitude),
      longitude: formatCoordinate(latestPoint.longitude),
    });
    setModalVisible(true);
    setRecenterSignal((value) => value + 1);
  };

  const openEdit = (zone: Geofence) => {
    setEditingId(zone.id);
    setEditingEnabled(zone.isEnabled);
    setPointSource("saved");
    setForm({
      name: zone.name,
      address: zone.address ?? "",
      latitude: formatCoordinate(
        Number(zone.latitude)
      ),
      longitude: formatCoordinate(
        Number(zone.longitude)
      ),
      radius: String(
        Math.round(Number(zone.radiusMeters))
      ),
    });
    setModalVisible(true);
    setRecenterSignal((value) => value + 1);
  };

  const useChildLocation = async () => {
    let point = latestPoint;

    if (!point) {
      const refreshedLocation = await loadLatestLocation();
      point = locationCoordinate(refreshedLocation);
    }

    if (!point) {
      Alert.alert(
        "No child location available",
        "SafeTrack has not received a usable latest location for this child yet. Keep the child's tracking device connected or choose the location directly on the SafeTrack map."
      );
      return;
    }

    setForm((current) => ({
      ...current,
      latitude: formatCoordinate(point.latitude),
      longitude: formatCoordinate(point.longitude),
    }));
    setPointSource("child");
    setRecenterSignal((value) => value + 1);
  };

  const startMapPick = () => {
    setPickingLocation(true);
    setModalVisible(false);
    setRecenterSignal((value) => value + 1);
  };

  const cancelMapPick = () => {
    setPickingLocation(false);
    setModalVisible(true);
  };

  const handleMapPress = (coordinate: Coordinate) => {
    if (!pickingLocation) {
      return;
    }

    if (
      !validCoordinate(
        coordinate.latitude,
        coordinate.longitude
      )
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      latitude: formatCoordinate(coordinate.latitude),
      longitude: formatCoordinate(coordinate.longitude),
    }));
    setPointSource("map");
    setPickingLocation(false);
    setRecenterSignal((value) => value + 1);

    setTimeout(() => {
      setModalVisible(true);
    }, 180);
  };

  const closeEditor = () => {
    if (isSaving) {
      return;
    }

    setModalVisible(false);
    resetEditor();
  };

  const save = async () => {
    if (!guardian?.id || !child?.id) {
      Alert.alert(
        "Unable to save",
        "SafeTrack could not find the linked Guardian and child information."
      );
      return;
    }

    const point = formCoordinate(form);
    const radiusMeters = Number(form.radius);

    if (!form.name.trim()) {
      Alert.alert(
        "Safe Zone name required",
        "Enter a name such as Home, School, or Grandmother's House."
      );
      return;
    }

    if (!point) {
      Alert.alert(
        "Choose a Safe Zone center",
        "Use the child's latest available location or choose the center directly on the SafeTrack map."
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
        "Enter a radius from 50 to 5000 meters."
      );
      return;
    }

    try {
      if (editingId) {
        await saveEdit(editingId, {
          name: form.name.trim(),
          address: form.address.trim(),
          latitude: point.latitude,
          longitude: point.longitude,
          radiusMeters: Math.round(radiusMeters),
          isEnabled: editingEnabled,
        });
      } else {
        await saveNew({
          guardianId: guardian.id,
          childId: child.id,
          name: form.name.trim(),
          address: form.address.trim(),
          latitude: point.latitude,
          longitude: point.longitude,
          radiusMeters: Math.round(radiusMeters),
          isEnabled: true,
        });
      }

      setModalVisible(false);
      resetEditor();
      await loadZones();

      Alert.alert(
        editingId ? "Safe Zone updated" : "Safe Zone created",
        "The Safe Zone center and radius were saved using the location selected in SafeTrack."
      );
    } catch (reason) {
      Alert.alert(
        "Unable to save Safe Zone",
        reason instanceof Error
          ? reason.message
          : "Please try again."
      );
    }
  };

  const toggle = async (zone: Geofence) => {
    try {
      await saveEdit(zone.id, {
        name: zone.name,
        address: zone.address ?? "",
        latitude: Number(zone.latitude),
        longitude: Number(zone.longitude),
        radiusMeters: Number(zone.radiusMeters),
        isEnabled: !zone.isEnabled,
      });
    } catch (reason) {
      Alert.alert(
        "Update failed",
        reason instanceof Error
          ? reason.message
          : "Unable to update this Safe Zone."
      );
    }
  };

  const deleteZone = (zone: Geofence) => {
    Alert.alert(
      "Delete Safe Zone?",
      `Remove ${zone.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await remove(zone.id);

              if (editingId === zone.id) {
                setModalVisible(false);
                resetEditor();
              }
            } catch (reason) {
              Alert.alert(
                "Delete failed",
                reason instanceof Error
                  ? reason.message
                  : "Unable to delete this Safe Zone."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>SAFE ZONES</Text>
            <Text style={styles.title}>
              Boundaries you can see.
            </Text>
            <Text style={styles.subtitle}>
              Choose trusted places directly in SafeTrack. No manual coordinate lookup is required.
            </Text>
          </View>

          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>
              {activeCount} active
            </Text>
          </View>
        </View>

        <View style={styles.mapShell}>
          <SafeTrackInteractiveMap
            markers={mapMarkers}
            circles={mapCircles}
            height={390}
            recenterSignal={recenterSignal}
            onMapPress={handleMapPress}
          />

          {pickingLocation ? (
            <View style={styles.pickOverlay}>
              <View style={styles.pickIcon}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={colors.primaryDark}
                />
              </View>

              <View style={styles.pickCopy}>
                <Text style={styles.pickTitle}>
                  Set the Safe Zone center
                </Text>
                <Text style={styles.pickText}>
                  Zoom in, then tap the exact place on the map.
                </Text>
              </View>

              <Pressable
                onPress={cancelMapPick}
                style={({ pressed }) => [
                  styles.pickCancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pickCancelText}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendMarker,
                styles.childLegendMarker,
              ]}
            />
            <Text style={styles.legendText}>
              Child latest location
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendMarker,
                styles.zoneLegendMarker,
              ]}
            />
            <Text style={styles.legendText}>
              Safe Zone center
            </Text>
          </View>
        </View>

        <View style={styles.locationSection}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionLabel}>
                CHILD'S LATEST AVAILABLE LOCATION
              </Text>
              <Text style={styles.sectionTitle}>
                {child?.fullName ?? "Child"}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                void loadLatestLocation()
              }
              disabled={locationLoading}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              {locationLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={colors.primaryDark}
                />
              )}
            </Pressable>
          </View>

          {latestPoint ? (
            <>
              <Text style={styles.coordinateMain}>
                {formatCoordinate(latestPoint.latitude)}, {formatCoordinate(latestPoint.longitude)}
              </Text>

              <View style={styles.locationMetaRow}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={15}
                    color={colors.muted}
                  />
                  <Text style={styles.metaText}>
                    {sourceLabel(latestLocation?.source)}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={colors.muted}
                  />
                  <Text style={styles.metaText}>
                    {relativeTime(latestLocation?.recordedAt)}
                  </Text>
                </View>

                {accuracyMeters !== null &&
                Number.isFinite(accuracyMeters) ? (
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="locate-outline"
                      size={15}
                      color={colors.muted}
                    />
                    <Text style={styles.metaText}>
                      ±{Math.round(accuracyMeters)} m
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.locationNote}>
                This is the latest location SafeTrack successfully received. It is not treated as an exact or continuously live position.
              </Text>

              <Pressable
                onPress={openCreateFromChild}
                style={({ pressed }) => [
                  styles.inlineAction,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.primaryDark}
                />
                <Text style={styles.inlineActionText}>
                  Use this position for a new Safe Zone
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.noLocationRow}>
              <Ionicons
                name="location-outline"
                size={22}
                color={colors.muted}
              />
              <View style={styles.noLocationCopy}>
                <Text style={styles.noLocationTitle}>
                  No child location available yet
                </Text>
                <Text style={styles.noLocationText}>
                  You can still create a Safe Zone by selecting its center directly on the SafeTrack map.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.savedHeader}>
          <View style={styles.headingCopy}>
            <Text style={styles.sectionLabel}>
              SAVED SAFE ZONES
            </Text>
            <Text style={styles.savedSubtitle}>
              {trackingSource === "mobile"
                ? "Evaluated against available child-phone location records."
                : trackingSource === "both"
                ? "Evaluated against available smartwatch and child-phone location records."
                : "Evaluated against available smartwatch location records."}
            </Text>
          </View>

          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={20}
              color={colors.white}
            />
            <Text style={styles.createButtonText}>
              Add zone
            </Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.danger}
            />
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator
              color={colors.primary}
            />
            <Text style={styles.loadingText}>
              Loading Safe Zones…
            </Text>
          </View>
        ) : zones.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="map-outline"
              size={34}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>
              No Safe Zones yet
            </Text>
            <Text style={styles.emptyText}>
              Add Home, School, or another trusted place. SafeTrack will use the center and radius you select here.
            </Text>
          </View>
        ) : (
          zones.map((zone, index) => (
            <View
              key={zone.id}
              style={[
                styles.zoneRow,
                index < zones.length - 1 &&
                  styles.zoneRowBorder,
              ]}
            >
              <View
                style={[
                  styles.zonePin,
                  !zone.isEnabled &&
                    styles.zonePinDisabled,
                ]}
              >
                <Ionicons
                  name="location"
                  size={17}
                  color={
                    zone.isEnabled
                      ? colors.primaryDark
                      : colors.muted
                  }
                />
              </View>

              <View style={styles.zoneCopy}>
                <View style={styles.zoneTitleRow}>
                  <Text style={styles.zoneName}>
                    {zone.name}
                  </Text>
                  <Text
                    style={[
                      styles.zoneStatus,
                      !zone.isEnabled &&
                        styles.zoneStatusDisabled,
                    ]}
                  >
                    {zone.isEnabled ? "Active" : "Disabled"}
                  </Text>
                </View>

                {zone.address ? (
                  <Text
                    style={styles.zoneAddress}
                    numberOfLines={1}
                  >
                    {zone.address}
                  </Text>
                ) : null}

                <Text style={styles.zoneDetail}>
                  {formatCoordinate(Number(zone.latitude))}, {formatCoordinate(Number(zone.longitude))} • {formatRadius(Number(zone.radiusMeters))} radius
                </Text>

                <View style={styles.zoneActions}>
                  <Pressable
                    onPress={() => openEdit(zone)}
                    style={({ pressed }) => [
                      styles.textAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.textActionPrimary}>
                      Edit
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void toggle(zone)}
                    style={({ pressed }) => [
                      styles.textAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.textActionNeutral}>
                      {zone.isEnabled ? "Disable" : "Enable"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteZone(zone)}
                    style={({ pressed }) => [
                      styles.textAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.textActionDanger}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
        >
          <Pressable
            style={styles.backdropDismiss}
            onPress={closeEditor}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.headingCopy}>
                <Text style={styles.sheetEyebrow}>
                  {editingId
                    ? "EDIT SAFE ZONE"
                    : "NEW SAFE ZONE"}
                </Text>
                <Text style={styles.sheetTitle}>
                  {editingId
                    ? editingZone?.name ?? "Safe Zone"
                    : "Choose a trusted place"}
                </Text>
              </View>

              <Pressable
                onPress={closeEditor}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.ink}
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.fieldLabel}>
                NAME
              </Text>
              <TextInput
                value={form.name}
                onChangeText={(name) =>
                  setForm((current) => ({
                    ...current,
                    name,
                  }))
                }
                placeholder="Home, School, Relative's House"
                placeholderTextColor={colors.muted}
                style={styles.input}
                editable={!isSaving}
              />

              <Text style={styles.fieldLabel}>
                ADDRESS OR NOTE
              </Text>
              <TextInput
                value={form.address}
                onChangeText={(address) =>
                  setForm((current) => ({
                    ...current,
                    address,
                  }))
                }
                placeholder="Optional location description"
                placeholderTextColor={colors.muted}
                style={styles.input}
                editable={!isSaving}
              />

              <View style={styles.sectionBreak} />

              <Text style={styles.fieldLabel}>
                SAFE-ZONE CENTER
              </Text>

              <View style={styles.locationActions}>
                <Pressable
                  onPress={() => void useChildLocation()}
                  disabled={isSaving || locationLoading}
                  style={({ pressed }) => [
                    styles.locationAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.locationActionIcon}>
                    <Ionicons
                      name="navigate-outline"
                      size={20}
                      color={colors.primaryDark}
                    />
                  </View>
                  <View style={styles.locationActionCopy}>
                    <Text style={styles.locationActionTitle}>
                      Use child's latest location
                    </Text>
                    <Text style={styles.locationActionText}>
                      Uses the latest successfully stored SafeTrack location record.
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={startMapPick}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.locationAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.locationActionIcon}>
                    <Ionicons
                      name="map-outline"
                      size={20}
                      color={colors.primaryDark}
                    />
                  </View>
                  <View style={styles.locationActionCopy}>
                    <Text style={styles.locationActionTitle}>
                      Pick on SafeTrack map
                    </Text>
                    <Text style={styles.locationActionText}>
                      Zoom in and tap the exact center of Home, School, or another place.
                    </Text>
                  </View>
                </Pressable>
              </View>

              <View
                style={[
                  styles.coordinatePanel,
                  selectedPoint &&
                    styles.coordinatePanelSelected,
                ]}
              >
                <View style={styles.coordinateHeader}>
                  <Ionicons
                    name={
                      selectedPoint
                        ? "checkmark-circle"
                        : "location-outline"
                    }
                    size={20}
                    color={
                      selectedPoint
                        ? colors.primary
                        : colors.muted
                    }
                  />
                  <Text
                    style={[
                      styles.coordinateStatus,
                      selectedPoint &&
                        styles.coordinateStatusSelected,
                    ]}
                  >
                    {selectionLabel(pointSource)}
                  </Text>
                </View>

                {selectedPoint ? (
                  <>
                    <Text style={styles.coordinateValue}>
                      {formatCoordinate(selectedPoint.latitude)}, {formatCoordinate(selectedPoint.longitude)}
                    </Text>
                    <Text style={styles.coordinateHelp}>
                      These exact coordinates will be used as the center of this Safe Zone.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.coordinateHelp}>
                    Choose the center before saving. SafeTrack will not use placeholder latitude or longitude values.
                  </Text>
                )}
              </View>

              {selectedPoint && latestPoint ? (
                <View style={styles.distanceRow}>
                  <Ionicons
                    name="navigate-circle-outline"
                    size={18}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.distanceText}>
                    Child's latest position is approximately {formatRadius(childDistance ?? 0)} from this Safe Zone center.
                  </Text>
                </View>
              ) : null}

              {radiusAccuracyWarning &&
              accuracyMeters !== null ? (
                <View style={styles.warningRow}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color="#A56A18"
                  />
                  <Text style={styles.warningText}>
                    The latest child location reports about ±{Math.round(accuracyMeters)} m accuracy, which is wider than this Safe Zone radius. Consider a larger radius to reduce boundary changes caused by location uncertainty.
                  </Text>
                </View>
              ) : null}

              <View style={styles.sectionBreak} />

              <Text style={styles.fieldLabel}>
                RADIUS
              </Text>

              <View style={styles.radiusPresets}>
                {RADIUS_PRESETS.map((meters) => {
                  const active =
                    Number(form.radius) === meters;

                  return (
                    <Pressable
                      key={meters}
                      onPress={() =>
                        setForm((current) => ({
                          ...current,
                          radius: String(meters),
                        }))
                      }
                      disabled={isSaving}
                      style={({ pressed }) => [
                        styles.radiusPreset,
                        active &&
                          styles.radiusPresetActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusPresetText,
                          active &&
                            styles.radiusPresetTextActive,
                        ]}
                      >
                        {meters} m
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.customRadiusRow}>
                <View style={styles.customRadiusCopy}>
                  <Text style={styles.customRadiusTitle}>
                    Custom radius
                  </Text>
                  <Text style={styles.customRadiusText}>
                    50–5000 meters
                  </Text>
                </View>

                <View style={styles.radiusInputWrap}>
                  <TextInput
                    value={form.radius}
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        radius: value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 4),
                      }))
                    }
                    keyboardType="number-pad"
                    style={styles.radiusInput}
                    editable={!isSaving}
                    maxLength={4}
                  />
                  <Text style={styles.radiusUnit}>
                    m
                  </Text>
                </View>
              </View>

              <Text style={styles.radiusNote}>
                The green circle on the SafeTrack map previews the selected radius around the exact Safe Zone center.
              </Text>

              <Pressable
                onPress={() => void save()}
                disabled={!canSave || isSaving}
                style={({ pressed }) => [
                  styles.saveButton,
                  (!canSave || isSaving) &&
                    styles.saveButtonDisabled,
                  pressed &&
                    canSave &&
                    !isSaving &&
                    styles.pressed,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator
                    color={colors.white}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={
                        canSave
                          ? colors.white
                          : colors.muted
                      }
                    />
                    <Text
                      style={[
                        styles.saveButtonText,
                        !canSave &&
                          styles.saveButtonTextDisabled,
                      ]}
                    >
                      {editingId
                        ? "Save changes"
                        : "Create Safe Zone"}
                    </Text>
                  </>
                )}
              </Pressable>

              {!canSave ? (
                <Text style={styles.saveHelp}>
                  Add a name, choose a Safe Zone center, and use a radius from 50 to 5000 meters.
                </Text>
              ) : null}

              {editingZone ? (
                <Pressable
                  onPress={() => deleteZone(editingZone)}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text style={styles.deleteButtonText}>
                    Delete this Safe Zone
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flex: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 70,
  },

  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 20,
  },

  headingCopy: {
    flex: 1,
  },

  eyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  title: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },

  activeBadge: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: colors.softMint,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  activeBadgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },

  mapShell: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#E9EFEA",
    ...shadow.soft,
  },

  pickOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.97)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadow.soft,
  },

  pickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.softMint,
    alignItems: "center",
    justifyContent: "center",
  },

  pickCopy: {
    flex: 1,
  },

  pickTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },

  pickText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },

  pickCancel: {
    paddingHorizontal: 9,
    paddingVertical: 8,
  },

  pickCancelText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 11,
    paddingHorizontal: 3,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  legendMarker: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  childLegendMarker: {
    backgroundColor: "#1E88E5",
  },

  zoneLegendMarker: {
    backgroundColor: colors.primary,
  },

  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },

  locationSection: {
    marginTop: 24,
  },

  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  sectionLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  sectionTitle: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.softMint,
    alignItems: "center",
    justifyContent: "center",
  },

  coordinateMain: {
    marginTop: 12,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  locationMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 9,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  locationNote: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },

  inlineAction: {
    alignSelf: "flex-start",
    marginTop: 14,
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 21,
    backgroundColor: colors.softMint,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  inlineActionText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  noLocationRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  noLocationCopy: {
    flex: 1,
  },

  noLocationTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  noLocationText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 25,
  },

  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 9,
  },

  savedSubtitle: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },

  createButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  createButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
  },

  errorRow: {
    marginTop: 8,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },

  loadingBlock: {
    paddingVertical: 30,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
  },

  emptyState: {
    paddingVertical: 34,
    alignItems: "center",
  },

  emptyTitle: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  emptyText: {
    maxWidth: 360,
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  zoneRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 17,
  },

  zoneRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  zonePin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.softMint,
    alignItems: "center",
    justifyContent: "center",
  },

  zonePinDisabled: {
    backgroundColor: "#EDF1EE",
  },

  zoneCopy: {
    flex: 1,
  },

  zoneTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  zoneName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },

  zoneStatus: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
  },

  zoneStatusDisabled: {
    color: colors.muted,
  },

  zoneAddress: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },

  zoneDetail: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },

  zoneActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 10,
  },

  textAction: {
    minHeight: 34,
    justifyContent: "center",
  },

  textActionPrimary: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  textActionNeutral: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },

  textActionDanger: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,30,24,0.38)",
    justifyContent: "flex-end",
  },

  backdropDismiss: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },

  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: colors.border,
  },

  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  sheetEyebrow: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  sheetTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF2EF",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },

  fieldLabel: {
    marginTop: 12,
    marginBottom: 7,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.0,
  },

  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
  },

  sectionBreak: {
    height: 1,
    marginTop: 22,
    marginBottom: 7,
    backgroundColor: colors.border,
  },

  locationActions: {
    gap: 8,
  },

  locationAction: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  locationActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.softMint,
    alignItems: "center",
    justifyContent: "center",
  },

  locationActionCopy: {
    flex: 1,
  },

  locationActionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },

  locationActionText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },

  coordinatePanel: {
    marginTop: 10,
    padding: 13,
    borderRadius: 17,
    backgroundColor: "#F0F3F1",
    borderWidth: 1,
    borderColor: colors.border,
  },

  coordinatePanelSelected: {
    backgroundColor: colors.softMint,
    borderColor: "rgba(39,127,86,0.22)",
  },

  coordinateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  coordinateStatus: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  coordinateStatusSelected: {
    color: colors.primaryDark,
  },

  coordinateValue: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  coordinateHelp: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },

  distanceRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },

  distanceText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },

  warningRow: {
    marginTop: 11,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#FFF5E5",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  warningText: {
    flex: 1,
    color: "#805318",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },

  radiusPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  radiusPreset: {
    minWidth: 67,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  radiusPresetActive: {
    borderColor: colors.primary,
    backgroundColor: colors.softMint,
  },

  radiusPresetText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },

  radiusPresetTextActive: {
    color: colors.primaryDark,
  },

  customRadiusRow: {
    marginTop: 12,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  customRadiusCopy: {
    flex: 1,
  },

  customRadiusTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },

  customRadiusText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
  },

  radiusInputWrap: {
    minWidth: 104,
    height: 46,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
  },

  radiusInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },

  radiusUnit: {
    marginLeft: 5,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },

  radiusNote: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },

  saveButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveButtonDisabled: {
    backgroundColor: "#E4E8E5",
  },

  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
  },

  saveButtonTextDisabled: {
    color: colors.muted,
  },

  saveHelp: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },

  deleteButton: {
    marginTop: 12,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  deleteButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.72,
  },
});
