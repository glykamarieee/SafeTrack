import { StyleSheet, View, type StyleProp, type TextStyle } from "react-native";

import { Text } from "../ui/NativeText";
import { usePlace } from "../../hooks/usePlaceDetails";

/**
 * The street address for a point (OpenStreetMap), for SOS, events and
 * records. Shows nothing until it is known; never a guessed address.
 */
export function PlaceLine({
  latitude,
  longitude,
  style,
  landmark = true,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  style?: StyleProp<TextStyle>;
  landmark?: boolean;
}) {
  const place = usePlace(latitude, longitude);
  if (latitude == null || longitude == null) return null;
  if (place === undefined) return <Text style={[styles.text, style, styles.muted]}>Finding the address…</Text>;
  if (!place?.label) return <Text style={[styles.text, style, styles.muted]}>Address unavailable</Text>;

  return (
    <View>
      <Text style={[styles.text, style]}>{place.label}</Text>
      {landmark && place.landmark ? (
        <Text style={[styles.text, style, styles.muted]}>
          Near {place.landmark.name} ({place.landmark.distanceMeters} m)
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12, lineHeight: 17 },
  muted: { opacity: 0.7 },
});
