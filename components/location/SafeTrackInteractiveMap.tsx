import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
} from "../../constants/guardianDesign";

export type SafeTrackMapState = {
  latitude: number;
  longitude: number;
  zoom: number;
  style: "default" | "satellite";
};

export type SafeTrackMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  detail?: string;
  kind?: "location" | "start" | "end" | "zone" | "sos";
};

export type SafeTrackMapCircle = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  label?: string;
  enabled?: boolean;
};

type Props = {
  markers?: SafeTrackMapMarker[];
  circles?: SafeTrackMapCircle[];
  path?: { latitude: number; longitude: number }[];
  height?: number;
  style?: StyleProp<ViewStyle>;
  recenterSignal?: number;
  mapStyleControlTop?: number;
  mapStyleControlLeft?: number;
  showMapStyleControl?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onMapStateChange?: (state: SafeTrackMapState) => void;
};

const CENTER = {
  latitude: 10.3157,
  longitude: 123.8854,
};

function safeText(value?: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(
  markers: SafeTrackMapMarker[],
  circles: SafeTrackMapCircle[],
  path: { latitude: number; longitude: number }[],
) {
  const payload = JSON.stringify({
    markers: markers.map((marker) => ({
      ...marker,
      title: safeText(marker.title),
      detail: safeText(marker.detail),
    })),
    circles,
    path,
    center: CENTER,
  });

  return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#EAF4EF}
.leaflet-control-attribution{font-size:8px;background:rgba(255,255,255,.72)!important;color:#5d6d65!important}
.leaflet-popup-content-wrapper{border-radius:16px;box-shadow:0 12px 30px rgba(9,52,37,.16)}
.leaflet-popup-content{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:12px 14px;color:#10231B}
#map.map-calm .leaflet-tile-pane{filter:saturate(.72) brightness(1.035) contrast(.94)}
#map.map-detail .leaflet-tile-pane{filter:saturate(.94) contrast(1.02)}
.st-marker{width:34px;height:34px;border-radius:18px 18px 18px 6px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 8px 18px rgba(12,54,39,.28);background:#18A96E}
.st-marker > span{transform:rotate(45deg);display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#fff;color:#08754E;font:800 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.st-marker.start{background:#4B82E9}.st-marker.start>span{color:#315FB2}
.st-marker.end{background:#766AE8}.st-marker.end>span{color:#584BBF}
.st-marker.zone{background:#18A96E}.st-marker.zone>span{color:#08754E}
.st-marker.sos{background:#DF5C63}.st-marker.sos>span{color:#B93A45}
.st-marker.location{background:#2F7FEA}.st-marker.location>span{color:#235EAC}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data=${payload};
let currentStyle="default";
const map=L.map("map",{zoomControl:false,minZoom:3,maxZoom:20,preferCanvas:true}).setView([data.center.latitude,data.center.longitude],15);

const street=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:20,
  attribution:"© OpenStreetMap contributors"
});
street.addTo(map);
map.getContainer().classList.add("map-calm");

let bounds=[];

if(data.path.length>1){
  L.polyline(data.path.map(p=>[p.latitude,p.longitude]),{
    color:"#18A96E",weight:6,opacity:.94,lineCap:"round",lineJoin:"round"
  }).addTo(map);
  L.polyline(data.path.map(p=>[p.latitude,p.longitude]),{
    color:"#FFFFFF",weight:2,opacity:.82,dashArray:"1 12",lineCap:"round"
  }).addTo(map);
}

data.circles.forEach(z=>{
  L.circle([z.latitude,z.longitude],{
    radius:z.radiusMeters,
    color:z.enabled===false?"#98A59E":"#18A96E",
    fillColor:z.enabled===false?"#C9D9D0":"#62D39B",
    fillOpacity:.19,
    weight:2.5,
    dashArray:z.enabled===false?"7 7":undefined
  }).addTo(map);
  bounds.push([z.latitude,z.longitude]);
});

function markerLabel(kind){
  if(kind==="start") return "S";
  if(kind==="end") return "E";
  if(kind==="zone") return "Z";
  if(kind==="sos") return "!";
  return "●";
}

data.markers.forEach(m=>{
  const kind=m.kind||"location";
  const icon=L.divIcon({
    className:"",
    html:'<div class="st-marker '+kind+'"><span>'+markerLabel(kind)+'</span></div>',
    iconSize:[34,34],
    iconAnchor:[17,32],
    popupAnchor:[0,-30]
  });
  const marker=L.marker([m.latitude,m.longitude],{icon}).addTo(map);
  const details=m.detail?'<div style="font-size:11px;color:#718078;margin-top:4px">'+m.detail+'</div>':'';
  marker.bindPopup('<div style="font-weight:800;font-size:13px">'+m.title+'</div>'+details);
  bounds.push([m.latitude,m.longitude]);
});

function fit(){
  if(bounds.length===1){
    map.setView(bounds[0],17,{animate:true});
  } else if(bounds.length>1){
    map.fitBounds(bounds,{padding:[44,44],maxZoom:17,animate:true});
  } else {
    map.setView([data.center.latitude,data.center.longitude],15,{animate:true});
  }
}
fit();

window.recenterSafeTrackMap=fit;
window.zoomInSafeTrackMap=()=>map.zoomIn();
window.zoomOutSafeTrackMap=()=>map.zoomOut();
window.setSafeTrackMapStyle=(style)=>{
  currentStyle=style==="satellite"?"satellite":"default";
  const container=map.getContainer();
  container.classList.toggle("map-calm",currentStyle==="default");
  container.classList.toggle("map-detail",currentStyle==="satellite");
  postState();
};

function postState(){
  const c=map.getCenter();
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type:"state",latitude:c.lat,longitude:c.lng,zoom:map.getZoom(),style:currentStyle
  }));
}

map.on("click",e=>{
  window.ReactNativeWebView?.postMessage(JSON.stringify({type:"press",latitude:e.latlng.lat,longitude:e.latlng.lng}));
});
map.on("moveend zoomend",postState);
setTimeout(postState,250);
</script>
</body>
</html>
`;
}

export function SafeTrackInteractiveMap({
  markers = [],
  circles = [],
  path = [],
  height = 320,
  style,
  recenterSignal,
  mapStyleControlTop = 14,
  mapStyleControlLeft = 14,
  showMapStyleControl = true,
  onMapPress,
  onMapStateChange,
}: Props) {
  const ref = useRef<WebView>(null);
  const [mapStyle, setMapStyle] = useState<"default" | "satellite">("default");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  const source = useMemo(
    () => ({ html: buildHtml(markers, circles, path) }),
    [markers, circles, path],
  );

  const inject = (script: string) => {
    ref.current?.injectJavaScript(`${script};true;`);
  };

  useEffect(() => {
    inject("window.recenterSafeTrackMap&&window.recenterSafeTrackMap() ");
  }, [recenterSignal]);

  useEffect(() => {
    inject(`window.setSafeTrackMapStyle&&window.setSafeTrackMapStyle("${mapStyle}")`);
  }, [mapStyle, source]);

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={ref}
        source={source}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        mixedContentMode="always"
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === "press") {
              onMapPress?.({
                latitude: data.latitude,
                longitude: data.longitude,
              });
            }

            if (data.type === "state") {
              onMapStateChange?.({
                latitude: data.latitude,
                longitude: data.longitude,
                zoom: data.zoom,
                style: data.style === "satellite" ? "satellite" : "default",
              });
            }
          } catch {
            // Ignore malformed map messages.
          }
        }}
        onLoadEnd={() => {
          inject(`window.setSafeTrackMapStyle&&window.setSafeTrackMapStyle("${mapStyle}")`);
        }}
      />

      {showMapStyleControl && (
        <View
          style={[
            styles.styleControl,
            { top: mapStyleControlTop, left: mapStyleControlLeft },
          ]}
        >
          {styleMenuOpen && (
            <View style={styles.styleMenu}>
              <Pressable
                onPress={() => {
                  setMapStyle("default");
                  setStyleMenuOpen(false);
                }}
                style={[styles.styleOption, mapStyle === "default" && styles.styleOptionActive]}
              >
                <Ionicons
                  name="map-outline"
                  size={16}
                  color={mapStyle === "default" ? colors.white : colors.primaryDark}
                />
                <Text style={[styles.styleOptionText, mapStyle === "default" && styles.styleOptionTextActive]}>
                  Calm
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMapStyle("satellite");
                  setStyleMenuOpen(false);
                }}
                style={[styles.styleOption, mapStyle === "satellite" && styles.styleOptionActive]}
              >
                <Ionicons
                  name="earth-outline"
                  size={16}
                  color={mapStyle === "satellite" ? colors.white : colors.primaryDark}
                />
                <Text style={[styles.styleOptionText, mapStyle === "satellite" && styles.styleOptionTextActive]}>
                  Standard
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            accessibilityLabel="Change map style"
            style={styles.floatingButton}
            onPress={() => setStyleMenuOpen((value) => !value)}
          >
            <Ionicons
              name={mapStyle === "satellite" ? "map-outline" : "layers-outline"}
              size={19}
              color={colors.primaryDark}
            />
          </Pressable>
        </View>
      )}

      <View style={styles.zoomRail}>
        <Pressable
          accessibilityLabel="Zoom in"
          style={styles.zoomButton}
          onPress={() => inject("window.zoomInSafeTrackMap&&window.zoomInSafeTrackMap()")}
        >
          <Ionicons name="add" size={20} color={colors.primaryDeep} />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable
          accessibilityLabel="Zoom out"
          style={styles.zoomButton}
          onPress={() => inject("window.zoomOutSafeTrackMap&&window.zoomOutSafeTrackMap()")}
        >
          <Ionicons name="remove" size={20} color={colors.primaryDeep} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Recenter map"
        style={styles.recenter}
        onPress={() => inject("window.recenterSafeTrackMap&&window.recenterSafeTrackMap()")}
      >
        <Ionicons name="locate" size={21} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundAlt,
    ...shadow.card,
  },
  styleControl: {
    position: "absolute",
    alignItems: "flex-start",
  },
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.86)",
    ...shadow.soft,
  },
  styleMenu: {
    width: 132,
    padding: 5,
    marginBottom: 7,
    borderRadius: 17,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    ...shadow.floating,
  },
  styleOption: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  styleOptionActive: {
    backgroundColor: colors.primaryDark,
  },
  styleOptionText: {
    marginLeft: 8,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
  },
  styleOptionTextActive: {
    color: colors.white,
  },
  zoomRail: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 44,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.88)",
    ...shadow.soft,
  },
  zoomButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: {
    height: 1,
    marginHorizontal: 10,
    backgroundColor: colors.border,
  },
  recenter: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    ...shadow.floating,
  },
});
