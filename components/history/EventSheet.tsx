import { useMemo, useState } from "react";
import {
  Linking,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/NativeText";

import { MapSheet, SheetButton, SheetRow, sheetStyles } from "../location/MapSheet";
import { SafeTrackInteractiveMap, type SafeTrackMapMarker } from "../location/SafeTrackInteractiveMap";
import { directionsUrl } from "../location/mapTypes";
import { eventLook } from "./eventLook";
import { timeLabel } from "./dates";
import { showAlert } from "../../lib/platformAlert";
import {
  acknowledgeHistorySos,
  errorMessage,
  type ActivityEvent,
} from "../../services/activityHistoryService";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
type Props = {
  event: ActivityEvent | null;
  onClose(): void;
  onShowOnMap(event: ActivityEvent): void;
  /** Called after an SOS was acknowledged, so the day reloads. */
  onAcknowledged(): void;
};

/** Details of one safety event, with a small map and SOS acknowledgement. */
export function EventSheet({ event, onClose, onShowOnMap, onAcknowledged }: Props) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const look = event ? eventLook(event) : null;
  const located = event?.latitude != null && event?.longitude != null;

  const markers = useMemo<SafeTrackMapMarker[]>(
    () =>
      event && located && look
        ? [
            {
              id: `event-${event.id}`,
              latitude: event.latitude!,
              longitude: event.longitude!,
              title: event.title,
              kind: "event",
              tint: look.tint,
              icon: look.icon,
            },
          ]
        : [],
    [event, located, look],
  );

  const acknowledge = () => {
    if (!event) return;
    showAlert("Acknowledge this SOS?", "This tells SafeTrack you have seen the alert and stops repeat notifications.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Acknowledge",
        onPress: async () => {
          setBusy(true);
          try {
            await acknowledgeHistorySos(event.id);
            onAcknowledged();
            onClose();
          } catch (reason) {
            showAlert("Could not acknowledge", errorMessage(reason));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <MapSheet
      visible={Boolean(event)}
      title={event?.title ?? ""}
      subtitle={event && look ? `${look.label} · ${timeLabel(event.occurredAt)}` : undefined}
      onClose={onClose}
    >
      {event ? (
        <>
          {event.detail ? <Text style={styles.detail}>{event.detail}</Text> : null}

          {located ? (
            <View style={styles.mapBox}>
              <SafeTrackInteractiveMap
                markers={markers}
                height={170}
                allowExpand={false}
                showMapStyleControl={false}
                showMyLocation={false}
                onMarkerPress={() => undefined}
              />
            </View>
          ) : (
            <Text style={sheetStyles.note}>No location was stored with this event.</Text>
          )}

          <SheetRow icon="time-outline" label="Time" value={new Date(event.occurredAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} />
          {event.sosStatus ? <SheetRow icon="flag-outline" label="Status" value={event.sosStatus} /> : null}
          {located ? (
            <SheetRow
              icon="navigate-circle-outline"
              label="Position"
              value={`${event.latitude!.toFixed(5)}, ${event.longitude!.toFixed(5)}`}
            />
          ) : null}
          <Text style={sheetStyles.note}>
            Battery and network at the time of an event are not stored; the map pin shows the watch's current values.
          </Text>

          <View style={sheetStyles.actions}>
            {located ? (
              <SheetButton
                icon="map-outline"
                label="Show on map"
                onPress={() => {
                  onShowOnMap(event);
                  onClose();
                }}
              />
            ) : null}
            {located ? (
              <SheetButton
                icon="navigate-outline"
                label="Directions"
                onPress={() =>
                  void Linking.openURL(directionsUrl({ latitude: event.latitude!, longitude: event.longitude! })).catch(() =>
                    showAlert("Directions unavailable", "Google Maps could not be opened on this device."),
                  )
                }
              />
            ) : null}
          </View>
          {event.type === "sos" && event.sosStatus === "active" ? (
            <View style={sheetStyles.actions}>
              <SheetButton icon="checkmark-done-outline" label={busy ? "Acknowledging…" : "Acknowledge SOS"} primary disabled={busy} onPress={acknowledge} />
            </View>
          ) : null}
        </>
      ) : null}
    </MapSheet>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
  detail: { color: c.ink, fontSize: 13.5, lineHeight: 19, marginBottom: 10 },
  mapBox: { marginBottom: 6, borderRadius: 16, overflow: "hidden" },
}),
);
