import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
} from "../../constants/guardianDesign";

export type SafeZoneMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type SafeZoneMapZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
};

export type SafeZoneMapHandle = {
  animateToRegion: (region: SafeZoneMapRegion, duration?: number) => void;
};

type Props = {
  initialRegion: SafeZoneMapRegion;
  region: SafeZoneMapRegion;
  zones: SafeZoneMapZone[];
  primaryColor: string;
  style?: object;
  onRegionChangeComplete: (region: SafeZoneMapRegion) => void;
  onPressCoordinate: (latitude: number, longitude: number) => void;
  onZonePress: (zone: SafeZoneMapZone) => void;
  formatRadius: (radiusMeters: number) => string;
};

function safeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(initialRegion: SafeZoneMapRegion, zones: SafeZoneMapZone[], primaryColor: string, formatRadius: (radiusMeters: number) => string) {
  const payload = JSON.stringify({
    initialRegion,
    primaryColor,
    zones: zones.map((zone) => ({ ...zone, name: safeText(zone.name), radiusLabel: safeText(formatRadius(zone.radiusMeters)) })),
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#EAF4EF;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.leaflet-control-attribution{font-size:8px;background:rgba(255,255,255,.72)!important;color:#607069!important}
#map.map-calm .leaflet-tile-pane{filter:saturate(.68) brightness(1.04) contrast(.93)}
#map.map-standard .leaflet-tile-pane{filter:saturate(.95) contrast(1.02)}
.leaflet-popup-content-wrapper{border-radius:15px;box-shadow:0 12px 28px rgba(9,52,37,.16)}
.zone-dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 7px 16px rgba(12,54,39,.25);background:${primaryColor}}
.zone-dot.paused{background:#94A29B}
.zone-dot:after{content:'';width:8px;height:8px;border-radius:50%;background:#fff}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data=${payload};
let currentStyle='default';
const map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:20,preferCanvas:true}).setView([data.initialRegion.latitude,data.initialRegion.longitude],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap contributors'}).addTo(map);
map.getContainer().classList.add('map-calm');
const layer=L.layerGroup().addTo(map);
const bounds=[];
data.zones.forEach(zone=>{
  const circle=L.circle([zone.latitude,zone.longitude],{radius:zone.radiusMeters,color:zone.isEnabled?data.primaryColor:'#94A29B',fillColor:zone.isEnabled?data.primaryColor:'#AAB5AF',fillOpacity:.16,weight:2.4,dashArray:zone.isEnabled?undefined:'7 7'}).addTo(layer);
  const icon=L.divIcon({className:'',html:'<div class="zone-dot '+(zone.isEnabled?'':'paused')+'"></div>',iconSize:[30,30],iconAnchor:[15,15]});
  const marker=L.marker([zone.latitude,zone.longitude],{icon}).addTo(layer);
  marker.bindPopup('<div style="font-weight:800;font-size:13px;color:#10231B">'+zone.name+'</div><div style="font-size:11px;color:#718078;margin-top:4px">'+zone.radiusLabel+' · '+(zone.isEnabled?'Active':'Paused')+'</div>');
  marker.on('click',()=>post('zone',{id:zone.id}));
  circle.on('click',()=>post('zone',{id:zone.id}));
  bounds.push([zone.latitude,zone.longitude]);
});
function post(type,payload){window.parent.postMessage({source:'safetrack-zone-map',type,...payload},'*')}
function regionPayload(){const c=map.getCenter();const b=map.getBounds();return {latitude:c.lat,longitude:c.lng,latitudeDelta:Math.abs(b.getNorth()-b.getSouth()),longitudeDelta:Math.abs(b.getEast()-b.getWest())}}
function postRegion(){post('region',regionPayload())}
function fit(){if(bounds.length===1)map.setView(bounds[0],16,{animate:true});else if(bounds.length>1)map.fitBounds(bounds,{padding:[48,48],maxZoom:16,animate:true});else map.setView([data.initialRegion.latitude,data.initialRegion.longitude],14,{animate:true})}
function setStyle(style){currentStyle=style==='standard'?'standard':'default';const el=map.getContainer();el.classList.toggle('map-calm',currentStyle==='default');el.classList.toggle('map-standard',currentStyle==='standard')}
window.addEventListener('message',event=>{const m=event.data||{};if(m.source!=='safetrack-zone-shell')return;if(m.command==='center')map.setView([m.latitude,m.longitude],m.zoom||15,{animate:true});if(m.command==='fit')fit();if(m.command==='zoomIn')map.zoomIn();if(m.command==='zoomOut')map.zoomOut();if(m.command==='style')setStyle(m.value)});
map.on('click',e=>post('press',{latitude:e.latlng.lat,longitude:e.latlng.lng}));
map.on('moveend zoomend',postRegion);
setTimeout(()=>{map.invalidateSize();if(bounds.length)fit();postRegion()},160);
</script>
</body>
</html>`;
}

const SafeZoneMap = forwardRef<SafeZoneMapHandle, Props>(function SafeZoneMap(
  {
    initialRegion,
    zones,
    primaryColor,
    style,
    onRegionChangeComplete,
    onPressCoordinate,
    onZonePress,
    formatRadius,
  },
  ref,
) {
  const frameRef = useRef<any>(null);
  const [styleMode, setStyleMode] = useState<"default" | "standard">("default");
  const [menuOpen, setMenuOpen] = useState(false);
  const html = useMemo(
    () => buildHtml(initialRegion, zones, primaryColor, formatRadius),
    [initialRegion.latitude, initialRegion.longitude, zones, primaryColor, formatRadius],
  );

  const command = (message: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ source: "safetrack-zone-shell", ...message }, "*");
  };

  useImperativeHandle(ref, () => ({
    animateToRegion(nextRegion) {
      command({ command: "center", latitude: nextRegion.latitude, longitude: nextRegion.longitude, zoom: 15 });
    },
  }));

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "safetrack-zone-map") return;
      if (data.type === "press") onPressCoordinate(data.latitude, data.longitude);
      if (data.type === "region") {
        onRegionChangeComplete({
          latitude: data.latitude,
          longitude: data.longitude,
          latitudeDelta: data.latitudeDelta,
          longitudeDelta: data.longitudeDelta,
        });
      }
      if (data.type === "zone") {
        const zone = zones.find((item) => item.id === data.id);
        if (zone) onZonePress(zone);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onPressCoordinate, onRegionChangeComplete, onZonePress, zones]);

  useEffect(() => {
    command({ command: "style", value: styleMode });
  }, [styleMode, html]);

  return (
    <View style={[styles.container, style]}>
      {createElement("iframe", {
        ref: frameRef,
        srcDoc: html,
        title: "SafeTrack safe-zone map",
        style: { width: "100%", height: "100%", border: 0, display: "block" },
        onLoad: () => command({ command: "style", value: styleMode }),
      })}

      <View style={styles.leftControls}>
        {menuOpen ? (
          <View style={styles.styleMenu}>
            <Pressable
              onPress={() => { setStyleMode("default"); setMenuOpen(false); }}
              style={[styles.styleOption, styleMode === "default" && styles.styleOptionActive]}
            >
              <Ionicons name="map-outline" size={15} color={styleMode === "default" ? colors.white : colors.primaryDark} />
              <Text style={[styles.styleText, styleMode === "default" && styles.styleTextActive]}>Calm</Text>
            </Pressable>
            <Pressable
              onPress={() => { setStyleMode("standard"); setMenuOpen(false); }}
              style={[styles.styleOption, styleMode === "standard" && styles.styleOptionActive]}
            >
              <Ionicons name="map-outline" size={15} color={styleMode === "standard" ? colors.white : colors.primaryDark} />
              <Text style={[styles.styleText, styleMode === "standard" && styles.styleTextActive]}>Standard</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable accessibilityLabel="Change map style" style={styles.mapButton} onPress={() => setMenuOpen((value) => !value)}>
          <Ionicons name="layers-outline" size={19} color={colors.primaryDark} />
        </Pressable>
      </View>

      <View style={styles.zoomRail}>
        <Pressable accessibilityLabel="Zoom in" style={styles.zoomButton} onPress={() => command({ command: "zoomIn" })}>
          <Ionicons name="add" size={20} color={colors.primaryDeep} />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable accessibilityLabel="Zoom out" style={styles.zoomButton} onPress={() => command({ command: "zoomOut" })}>
          <Ionicons name="remove" size={20} color={colors.primaryDeep} />
        </Pressable>
      </View>

      {zones.length > 0 ? (
        <Pressable accessibilityLabel="Fit all safe zones" style={styles.fitButton} onPress={() => command({ command: "fit" })}>
          <Ionicons name="scan-outline" size={20} color={colors.primaryDark} />
        </Pressable>
      ) : null}
    </View>
  );
});

export default SafeZoneMap;

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%", position: "relative", overflow: "hidden", backgroundColor: colors.backgroundAlt },
  leftControls: { position: "absolute", left: 14, top: 14, alignItems: "flex-start" },
  mapButton: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", ...shadow.soft },
  styleMenu: { width: 132, padding: 5, marginBottom: 7, borderRadius: 17, backgroundColor: colors.glass, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", ...shadow.floating },
  styleOption: { minHeight: 37, paddingHorizontal: 9, borderRadius: 12, flexDirection: "row", alignItems: "center" },
  styleOptionActive: { backgroundColor: colors.primaryDark },
  styleText: { color: colors.primaryDark, fontSize: 10.5, fontWeight: "800", marginLeft: 7 },
  styleTextActive: { color: colors.white },
  zoomRail: { position: "absolute", top: 14, right: 14, width: 44, borderRadius: 15, overflow: "hidden", backgroundColor: colors.glass, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", ...shadow.soft },
  zoomButton: { height: 40, alignItems: "center", justifyContent: "center" },
  zoomDivider: { height: 1, marginHorizontal: 10, backgroundColor: colors.border },
  fitButton: { position: "absolute", right: 14, bottom: 14, width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", ...shadow.floating },
});
