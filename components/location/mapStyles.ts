// Google Maps style JSON for the Default map type. Satellite and terrain
// imagery are not styled. Rebuilt from the first SafeTrack design: soft land,
// white roads, muted points of interest and light cyan water.

type StyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

export const LIGHT_MAP_STYLE: StyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#F3F5F2" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5F6B66" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFFFFF" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#C9D3CE" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#ECEFEB" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#E6EFE3" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ saturation: -60 }, { lightness: 20 }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7A8681" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#D5ECD4" }] },
  { featureType: "poi.school", elementType: "geometry", stylers: [{ color: "#E8EEF8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E1E6E3" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ saturation: -80 }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FDF4DC" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#F1DFAE" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#8A9690" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#DCE2DF" }] },
  { featureType: "transit.station", elementType: "labels.icon", stylers: [{ saturation: -50 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#B9E3EE" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4F8FA0" }] },
];

export const DARK_MAP_STYLE: StyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#1D2427" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9AA8A2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#151A1C" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3A4448" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#1F2A27" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#232C2E" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7D8B85" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1E3328" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2E3739" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1A2022" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8C9993" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4A4636" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#2A2820" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2A3335" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0F2A33" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4E7480" }] },
];

/** Auto theme: dark from 6 pm to 6 am, like a navigation app at night. */
export function isNightTime(date = new Date()) {
  const hour = date.getHours();

  return hour >= 18 || hour < 6;
}
