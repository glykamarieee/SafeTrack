// The web map: Leaflet in an iframe, with Mapbox raster tiles when
// EXPO_PUBLIC_MAPBOX_TOKEN is set and Esri's keyless tiles otherwise. The page
// is a constant, so it loads once; markers, zones, the route and camera
// commands arrive as messages. Markers arrive as ready-made HTML
// (markerHtml.ts) so they match the native ones.

import { DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM, ZONE_COLORS } from "./mapTypes";
import { MARKER_CSS } from "./markerHtml";
import { MAPBOX_TOKEN } from "./mapSupport";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

const STREET = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
const IMAGERY = "Imagery &copy; Esri, Maxar, Earthstar Geographics";

function esri(service: string, attribution: string, extra: Record<string, unknown> = {}) {
  return {
    url: `${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`,
    options: { maxNativeZoom: 19, maxZoom: MAX_ZOOM + 1, attribution, ...extra },
  };
}

const CANVAS = { maxNativeZoom: 16 };

const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank"><b>Improve this map</b></a>';

/** Mapbox style rendered as raster tiles (Static Tiles API). */
function mapbox(style: string) {
  return {
    url: `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`,
    options: { tileSize: 512, zoomOffset: -1, maxNativeZoom: 20, maxZoom: MAX_ZOOM + 1, attribution: MAPBOX_ATTRIBUTION },
  };
}

const MAPBOX_BASES = {
  standard: [mapbox("streets-v12")],
  "standard-dark": [mapbox("dark-v11")],
  satellite: [mapbox("satellite-v9")],
  "satellite-labels": [mapbox("satellite-streets-v12")],
  terrain: [mapbox("outdoors-v12")],
};

/** Base layers for each map type, keyed as `${mapType}` or `${mapType}-labels` / `-dark`. */
const ESRI_BASES = {
  standard: [esri("World_Street_Map", STREET)],
  "standard-dark": [
    esri("Canvas/World_Dark_Gray_Base", STREET, CANVAS),
    esri("Canvas/World_Dark_Gray_Reference", "", { ...CANVAS, zIndex: 2 }),
  ],
  satellite: [esri("World_Imagery", IMAGERY)],
  "satellite-labels": [
    esri("World_Imagery", IMAGERY),
    esri("Reference/World_Transportation", "", { zIndex: 2 }),
    esri("Reference/World_Boundaries_and_Places", "Labels &copy; Esri", { zIndex: 3 }),
  ],
  terrain: [esri("World_Topo_Map", "Tiles &copy; Esri, HERE, Garmin, USGS, NGA")],
};

// Mapbox when a token is set; Esri's keyless tiles otherwise.
const BASES = MAPBOX_TOKEN ? MAPBOX_BASES : ESRI_BASES;

/** Keyless preview thumbnails for the layer sheet (a central Manila tile). */
export const PREVIEW_TILES: Record<"standard" | "satellite" | "terrain", string> = (() => {
  const zoom = 15;
  const latitude = 14.5975;
  const longitude = 120.9905;
  const scale = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const y = Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale);
  const tile = (service: string) => `${ESRI}/${service}/MapServer/tile/${zoom}/${y}/${x}`;

  return { standard: tile("World_Street_Map"), satellite: tile("World_Imagery"), terrain: tile("World_Topo_Map") };
})();

export const LEAFLET_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{height:100%;width:100%;margin:0;padding:0;overflow:hidden;overscroll-behavior:none}
body{background:#E9EDEB;-webkit-tap-highlight-color:transparent}
body.dark{background:#0E1A14}
#map{background:inherit;touch-action:none}
body.picking .leaflet-container{cursor:crosshair}
.leaflet-control-attribution{font-size:9px;line-height:14px;padding:0 6px;background:rgba(255,255,255,.78)!important;color:#636D68!important;border-top-right-radius:6px}
.leaflet-control-attribution a{color:#15803D!important}
.st-icon{background:none;border:0}
${MARKER_CSS}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
function post(message){
  var text=JSON.stringify(message);
  if(window.parent&&window.parent!==window){window.parent.postMessage({source:"safetrack-map",payload:text},"*");}
}
if(!window.L){post({type:"error",reason:"Map library could not load. Check the internet connection."});return;}

var BASES=${JSON.stringify(BASES)};
var ZONE_COLORS=${JSON.stringify(ZONE_COLORS)};
var DEFAULT_VIEW=${JSON.stringify(DEFAULT_VIEW)};

var map=L.map("map",{zoomControl:false,minZoom:${MIN_ZOOM},maxZoom:${MAX_ZOOM},worldCopyJump:true,wheelPxPerZoomLevel:80});
map.attributionControl.setPrefix(false);
map.attributionControl.setPosition("bottomleft");
map.setView([DEFAULT_VIEW.latitude,DEFAULT_VIEW.longitude],DEFAULT_VIEW.zoom);
map.createPane("zones").style.zIndex=410;
map.createPane("route").style.zIndex=420;

var zoneGroup=L.layerGroup().addTo(map),routeGroup=L.layerGroup().addTo(map),markerGroup=L.layerGroup().addTo(map);
var state={base:null,baseLayers:[],markers:{},circles:{},routeOuter:null,routeInner:null,
  data:{markers:[],circles:[],path:[]},picking:false,fitted:false,
  padding:{top:56,right:64,bottom:56,left:56},tiles:{}};

// ---- Base map.
function setBase(b){
  var key=b.mapType==="satellite"?(b.labels?"satellite-labels":"satellite"):(b.mapType==="standard"&&b.dark?"standard-dark":b.mapType);
  if(!BASES[key])key="standard";
  document.body.classList.toggle("dark",!!b.dark);
  if(key===state.base)return;
  var next=BASES[key].map(function(def){
    var layer=L.tileLayer(def.url,def.options);
    var stats=state.tiles[key]||(state.tiles[key]={loaded:0,failed:0,reported:false});
    layer.on("tileload",function(){stats.loaded++;if(!stats.reported){stats.reported=true;post({type:"tiles",ok:true});}});
    layer.on("tileerror",function(){stats.failed++;if(!stats.reported&&stats.failed>=6&&stats.loaded===0){stats.reported=true;post({type:"tiles",ok:false});}});
    return layer;
  });
  next.forEach(function(layer){layer.addTo(map);});
  state.baseLayers.forEach(function(layer){map.removeLayer(layer);});
  state.baseLayers=next;state.base=key;
}

// ---- Camera: data updates never move it after the first fit.
function contentBounds(){
  var b=L.latLngBounds([]);
  state.data.markers.forEach(function(m){if(m.kind!=="replay")b.extend([m.latitude,m.longitude]);});
  state.data.circles.forEach(function(c){if(c.status!=="accuracy")b.extend(L.latLng(c.latitude,c.longitude).toBounds(c.radiusMeters*2));});
  state.data.path.forEach(function(p){b.extend([p.latitude,p.longitude]);});
  return b;
}
function fitOptions(animate){
  var p=state.padding;
  return {paddingTopLeft:[p.left,p.top],paddingBottomRight:[p.right,p.bottom],maxZoom:17,animate:animate};
}
function fitContent(animate){
  var b=contentBounds();
  if(!b.isValid())return;
  state.fitted=true;
  if(b.getNorthEast().distanceTo(b.getSouthWest())<30)map.setView(b.getCenter(),16,{animate:animate});
  else map.fitBounds(b,fitOptions(animate));
}
function focusOn(t){
  state.fitted=true;
  var c=L.latLng(t.latitude,t.longitude);
  if(t.radiusMeters>0)map.fitBounds(c.toBounds(t.radiusMeters*2.3),fitOptions(true));
  else map.flyTo(c,Math.max(map.getZoom(),t.zoom||16),{duration:.6});
}
// Leaflet ignores a zoom request while it is still animating the last one, so
// quick taps are queued: the target accumulates and is applied when free.
var targetZoom=null,zoomWaiting=false;
function applyZoom(){
  zoomWaiting=false;
  if(targetZoom==null||targetZoom===map.getZoom())return;
  if(map._animatingZoom){zoomWaiting=true;map.once("zoomend",function(){setTimeout(applyZoom,0);});return;}
  map.setZoom(targetZoom);
}
function zoomBy(delta){
  var base=targetZoom==null?map.getZoom():targetZoom;
  targetZoom=Math.min(${MAX_ZOOM},Math.max(${MIN_ZOOM},Math.round(base)+delta));
  if(!zoomWaiting)applyZoom();
}

// ---- Markers, keyed by id and updated in place.
function iconFor(m){
  return L.divIcon({className:"st-icon",html:m.html,iconSize:[m.w,m.h],iconAnchor:[m.ax,m.ay]});
}
function iconSig(m){return m.html+"|"+m.w+"|"+m.h+"|"+m.ax+"|"+m.ay;}
function renderMarkers(list){
  var seen={};
  list.forEach(function(m){
    seen[m.id]=true;
    var entry=state.markers[m.id];
    if(!entry){
      var marker=L.marker([m.latitude,m.longitude],{icon:iconFor(m),keyboard:false,interactive:m.kind!=="replay",zIndexOffset:m.z||0});
      marker.on("click",function(ev){
        L.DomEvent.stopPropagation(ev);
        if(state.picking){post({type:"press",latitude:ev.latlng.lat,longitude:ev.latlng.lng});return;}
        post({type:"marker",id:m.id});
      });
      marker.addTo(markerGroup);
      state.markers[m.id]={marker:marker,sig:iconSig(m),data:m};
      return;
    }
    var pos=entry.marker.getLatLng();
    if(pos.lat!==m.latitude||pos.lng!==m.longitude)entry.marker.setLatLng([m.latitude,m.longitude]);
    if(entry.sig!==iconSig(m)){entry.marker.setIcon(iconFor(m));entry.sig=iconSig(m);}
    entry.data=m;
  });
  Object.keys(state.markers).forEach(function(id){if(!seen[id]){markerGroup.removeLayer(state.markers[id].marker);delete state.markers[id];}});
}

// ---- Circles: Safe Zones and accuracy, true to scale at every zoom.
function circleStyle(c){
  var s=c.status||(c.enabled===false?"inactive":"active"),color=ZONE_COLORS[s];
  if(s==="accuracy")return {pane:"zones",stroke:false,fillColor:color,fillOpacity:.12,interactive:false};
  return {pane:"zones",color:color,weight:2,opacity:.95,fillColor:color,interactive:false,
    fillOpacity:s==="inactive"?.06:(s==="outside"?.1:(s==="draft"?.16:.14)),dashArray:(s==="inactive"||s==="draft")?"6 6":null};
}
function renderCircles(list){
  var seen={};
  list.forEach(function(c){
    seen[c.id]=true;
    var sig=JSON.stringify(c),entry=state.circles[c.id];
    if(!entry){
      var circle=L.circle([c.latitude,c.longitude],Object.assign({radius:c.radiusMeters},circleStyle(c))).addTo(zoneGroup);
      state.circles[c.id]={circle:circle,sig:sig};
    }else if(entry.sig!==sig){
      entry.sig=sig;
      entry.circle.setLatLng([c.latitude,c.longitude]);
      entry.circle.setRadius(c.radiusMeters);
      entry.circle.setStyle(circleStyle(c));
    }
  });
  Object.keys(state.circles).forEach(function(id){if(!seen[id]){zoneGroup.removeLayer(state.circles[id].circle);delete state.circles[id];}});
}

function renderPath(path){
  var pts=path.map(function(p){return [p.latitude,p.longitude];});
  if(pts.length<2){routeGroup.clearLayers();state.routeOuter=state.routeInner=null;return;}
  if(!state.routeOuter){
    state.routeOuter=L.polyline(pts,{pane:"route",color:"#FFFFFF",weight:9,opacity:.95,lineCap:"round",lineJoin:"round",interactive:false}).addTo(routeGroup);
    state.routeInner=L.polyline(pts,{pane:"route",color:"#22B35E",weight:5,opacity:1,lineCap:"round",lineJoin:"round",interactive:false}).addTo(routeGroup);
  }else{state.routeOuter.setLatLngs(pts);state.routeInner.setLatLngs(pts);}
}

function setData(d){
  state.data={markers:d.markers||[],circles:d.circles||[],path:d.path||[]};
  renderCircles(state.data.circles);
  renderPath(state.data.path);
  renderMarkers(state.data.markers);
  if(!state.fitted&&contentBounds().isValid())fitContent(false);
}

function postState(){
  var c=map.getCenter();
  post({type:"state",latitude:c.lat,longitude:c.lng,zoom:map.getZoom()});
}
map.on("click",function(e){post({type:"press",latitude:e.latlng.lat,longitude:e.latlng.lng});});
map.on("moveend",function(){if(targetZoom===map.getZoom()&&!zoomWaiting)targetZoom=null;postState();});
// A drag or wheel zoom replaces any queued button zoom.
map.on("dragstart",function(){targetZoom=null;});
map.getContainer().addEventListener("wheel",function(){targetZoom=null;},{passive:true});

function receive(text){
  var m;try{m=JSON.parse(text);}catch(err){return;}
  switch(m.type){
    case "data":setData(m);break;
    case "base":setBase(m);break;
    case "padding":state.padding=m.padding;break;
    case "picking":state.picking=!!m.value;document.body.classList.toggle("picking",state.picking);break;
    case "view":map.setView([m.latitude,m.longitude],m.zoom,{animate:false});state.fitted=true;break;
    case "fit":fitContent(true);break;
    case "focus":focusOn(m);break;
    case "zoomBy":zoomBy(m.delta);break;
    case "resize":map.invalidateSize({pan:false});break;
  }
}
window.__safetrack={receive:receive};
window.addEventListener("message",function(e){var d=e.data;if(d&&d.source==="safetrack-shell"&&typeof d.payload==="string")receive(d.payload);});
post({type:"ready"});
})();
</script>
</body>
</html>`;
