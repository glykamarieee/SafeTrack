import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";

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
  path?: { latitude:number; longitude:number }[];
  height?: number;
  style?: StyleProp<ViewStyle>;
  recenterSignal?: number;
  mapStyleControlTop?: number;
  mapStyleControlLeft?: number;
  showMapStyleControl?: boolean;
  onMapPress?: (coordinate:{latitude:number;longitude:number}) => void;
  onMapStateChange?: (state:SafeTrackMapState) => void;
};

const CENTER = {
  latitude: 10.3157,
  longitude: 123.8854,
};

function buildHtml(
  markers: SafeTrackMapMarker[],
  circles: SafeTrackMapCircle[],
  path: {latitude:number;longitude:number}[]
){
  const payload = JSON.stringify({
    markers,
    circles,
    path,
    center:CENTER,
  });

  return `
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{height:100%;margin:0;padding:0}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data=${payload};

const map=L.map("map").setView(
[data.center.latitude,data.center.longitude],15
);

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
).addTo(map);

let bounds=[];

data.path.length>1 &&
L.polyline(
data.path.map(p=>[p.latitude,p.longitude]),
{color:"#1EA96B",weight:5}
).addTo(map);

data.circles.forEach(z=>{
L.circle(
[z.latitude,z.longitude],
{
radius:z.radiusMeters,
color:"#1EA96B",
fillOpacity:.2
}
).addTo(map);
bounds.push([z.latitude,z.longitude]);
});

data.markers.forEach(m=>{
L.marker([m.latitude,m.longitude])
.addTo(map)
.bindPopup(m.title);

bounds.push([m.latitude,m.longitude]);
});

if(bounds.length){
map.fitBounds(bounds,{padding:[30,30]});
}

window.recenterSafeTrackMap=()=>{
if(bounds.length){
map.fitBounds(bounds,{padding:[30,30]});
}
};

map.on("click",e=>{
window.ReactNativeWebView.postMessage(
JSON.stringify({
type:"press",
latitude:e.latlng.lat,
longitude:e.latlng.lng
})
);
});
</script>
</body>
</html>
`;
}

export function SafeTrackInteractiveMap({
  markers=[],
  circles=[],
  path=[],
  height=320,
  style,
  recenterSignal,
  mapStyleControlTop=14,
  mapStyleControlLeft=14,
  showMapStyleControl=true,
  onMapPress,
}:Props){

const ref=useRef<WebView>(null);

const source=useMemo(
()=>({html:buildHtml(markers,circles,path)}),
[markers,circles,path]
);

useEffect(()=>{
ref.current?.injectJavaScript(
"window.recenterSafeTrackMap&&window.recenterSafeTrackMap();true;"
);
},[recenterSignal]);

return (
<View style={[styles.container,{height},style]}>

<WebView
ref={ref}
source={source}
javaScriptEnabled
domStorageEnabled
originWhitelist={["*"]}
onMessage={(event)=>{
try{
const data=JSON.parse(event.nativeEvent.data);

if(data.type==="press"){
onMapPress?.({
latitude:data.latitude,
longitude:data.longitude,
});
}

}catch{}
}}
/>

{showMapStyleControl && (
<View
style={[
styles.controls,
{
top:mapStyleControlTop,
left:mapStyleControlLeft,
},
]}
>

<Pressable style={styles.iconButton}>
<Ionicons
name="layers-outline"
size={18}
color={colors.primaryDark}
/>
</Pressable>

</View>
)}

<Pressable
style={styles.recenter}
onPress={()=>
ref.current?.injectJavaScript(
"window.recenterSafeTrackMap&&window.recenterSafeTrackMap();true;"
)
}
>
<Ionicons
name="locate-outline"
size={21}
color={colors.primaryDark}
/>
</Pressable>

</View>
);
}

const styles=StyleSheet.create({

container:{
overflow:"hidden",
borderRadius:radius.lg,
...shadow.card,
},

controls:{
position:"absolute",
backgroundColor:colors.white,
borderRadius:radius.md,
padding:5,
},

iconButton:{
padding:8,
},

recenter:{
position:"absolute",
right:14,
bottom:14,
width:42,
height:42,
borderRadius:21,
backgroundColor:colors.white,
alignItems:"center",
justifyContent:"center",
...shadow.soft,
},

});
