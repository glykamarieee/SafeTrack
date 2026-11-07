// The web map: Leaflet in an iframe, with Mapbox raster tiles when
// EXPO_PUBLIC_MAPBOX_TOKEN is set and Esri's keyless tiles otherwise. The page
// is a constant, so it loads once; markers, zones, the route and camera
// commands arrive as messages. Markers arrive as ready-made HTML
// (markerHtml.ts) so they match the native ones.

import { DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM, ZONE_COLORS } from "./mapTypes";
import { FOOT_SVG, MARKER_CSS } from "./markerHtml";
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
<script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.js"></script>
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

// Two-finger (or Shift + drag) rotate through leaflet-rotate, when it loaded;
// without it the map simply stays north up.
var canRotate=typeof L.Map.prototype.setBearing==="function";
var map=L.map("map",{zoomControl:false,minZoom:${MIN_ZOOM},maxZoom:${MAX_ZOOM},worldCopyJump:true,wheelPxPerZoomLevel:80,
  rotate:canRotate,touchRotate:canRotate,shiftKeyRotate:canRotate,rotateControl:false,compassBearing:false,bearing:0});
function bearingOf(){return canRotate?((map.getBearing()%360)+360)%360:0;}
// Angles turn the short way round: 350 -> 10 goes through 0, not back.
function nearest(from,to){return from+((((to-from)%360)+540)%360)-180;}
var shownBearing=0;
map.attributionControl.setPrefix(false);
map.attributionControl.setPosition("bottomleft");
map.setView([DEFAULT_VIEW.latitude,DEFAULT_VIEW.longitude],DEFAULT_VIEW.zoom);
// Inside the rotating pane (leaflet-rotate), so zones and the route turn with the tiles.
map.createPane("zones",map.getPane("rotatePane")).style.zIndex=410;
map.createPane("route",map.getPane("rotatePane")).style.zIndex=420;

var zoneGroup=L.layerGroup().addTo(map),routeGroup=L.layerGroup().addTo(map),stepGroup=L.layerGroup().addTo(map),markerGroup=L.layerGroup().addTo(map);
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
      state.markers[m.id]={marker:marker,sig:iconSig(m),data:m,fresh:true};
      return;
    }
    var pos=entry.marker.getLatLng();
    if(pos.lat!==m.latitude||pos.lng!==m.longitude)entry.marker.setLatLng([m.latitude,m.longitude]);
    if(entry.sig!==iconSig(m)){entry.marker.setIcon(iconFor(m));entry.sig=iconSig(m);entry.fresh=true;}
    entry.data=m;
  });
  Object.keys(state.markers).forEach(function(id){if(!seen[id]){markerGroup.removeLayer(state.markers[id].marker);delete state.markers[id];}});
  Object.keys(state.markers).forEach(function(id){turnDirection(state.markers[id]);});
}
// The direction arrow and cone: where the person faces minus the map's turn.
function turnDirection(entry){
  var el=entry.marker.getElement(),dir=el&&el.querySelector(".st-dir");
  var hd=entry.data.hd;
  if(!dir||hd==null)return;
  var target=hd-shownBearing;
  entry.angle=entry.angle==null?target:nearest(entry.angle,target);
  if(entry.fresh){dir.style.transition="none";}
  dir.style.transform="rotate("+entry.angle+"deg)";
  if(entry.fresh){void dir.offsetWidth;dir.style.transition="";entry.fresh=false;}
}
function onRotate(){
  shownBearing=nearest(shownBearing,bearingOf());
  map.getContainer().style.setProperty("--map-bearing",shownBearing+"deg");
  Object.keys(state.markers).forEach(function(id){turnDirection(state.markers[id]);});
}
if(canRotate)map.on("rotate",onRotate);

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
  // Road pieces solid green; unknown stretches (gapAfter) dashed grey.
  routeGroup.clearLayers();
  if(path.length<2)return;
  var pieces=[],gaps=[],cur=[];
  path.forEach(function(p,i){
    cur.push([p.latitude,p.longitude]);
    var n=path[i+1];
    if(p.gapAfter&&n){if(cur.length>1)pieces.push(cur);gaps.push([[p.latitude,p.longitude],[n.latitude,n.longitude]]);cur=[];}
  });
  if(cur.length>1)pieces.push(cur);
  pieces.forEach(function(pts){L.polyline(pts,{pane:"route",color:"#FFFFFF",weight:9,opacity:.95,lineCap:"round",lineJoin:"round",interactive:false}).addTo(routeGroup);});
  pieces.forEach(function(pts){L.polyline(pts,{pane:"route",color:"#22B35E",weight:5,opacity:1,lineCap:"round",lineJoin:"round",interactive:false}).addTo(routeGroup);});
  gaps.forEach(function(pts){L.polyline(pts,{pane:"route",color:"#FFFFFF",weight:8,opacity:.9,interactive:false}).addTo(routeGroup);});
  gaps.forEach(function(pts){L.polyline(pts,{pane:"route",color:"#22B35E",weight:5,opacity:1,dashArray:"10 8",interactive:false}).addTo(routeGroup);});
}

// Footprints behind a walking or running child, keyed by id so only new
// prints are added (fresh ones press in): [id, lat, lng, heading, opacity, "l"|"r", "walk"|"run", fresh].
var FOOT=${JSON.stringify(FOOT_SVG)};
var steps={};
function footSize(){var z=map.getZoom();return z>=19?30:z>=18?24:z>=17?18:z>=16?13:9;}
function footIcon(s,size){
  return L.divIcon({className:"st-icon",iconSize:[size,size],iconAnchor:[size/2,size/2],
    html:'<div class="st-foot '+s[5]+' '+s[6]+(s[7]?' fresh':'')+'" style="--hd:'+s[3]+';width:'+size+'px;height:'+size+'px;opacity:'+s[4]+'">'+FOOT[s[6]]+'</div>'});
}
function renderSteps(list,resize){
  var seen={},size=footSize();
  // Below street zoom only every other print, so the trail doesn't clump.
  var every=map.getZoom()<16?3:map.getZoom()<17?2:1;
  list.forEach(function(s,i){
    if((list.length-1-i)%every!==0)return;
    seen[s[0]]=true;
    var entry=steps[s[0]];
    if(!entry){
      // Marker pane (upright); the CSS turns each print by its heading minus the map's turn.
      steps[s[0]]={marker:L.marker([s[1],s[2]],{icon:footIcon(s,size),interactive:false,keyboard:false,zIndexOffset:-20000}).addTo(stepGroup),op:s[4],size:size};
      return;
    }
    if(resize||entry.size!==size){s[7]=false;entry.marker.setIcon(footIcon(s,size));entry.size=size;entry.op=s[4];}
    else if(entry.op!==s[4]){var el=entry.marker.getElement();if(el&&el.firstChild)el.firstChild.style.opacity=s[4];entry.op=s[4];}
    entry.marker.setLatLng([s[1],s[2]]);
  });
  Object.keys(steps).forEach(function(id){if(!seen[id]){stepGroup.removeLayer(steps[id].marker);delete steps[id];}});
}
map.on("zoomend",function(){renderSteps(state.data.steps||[],true);});

function setData(d){
  state.data={markers:d.markers||[],circles:d.circles||[],path:d.path||[],steps:d.steps||[]};
  renderCircles(state.data.circles);
  renderPath(state.data.path);
  renderSteps(state.data.steps);
  renderMarkers(state.data.markers);
  if(!state.fitted&&contentBounds().isValid())fitContent(false);
}

function postState(){
  var c=map.getCenter();
  post({type:"state",latitude:c.lat,longitude:c.lng,zoom:map.getZoom(),bearing:bearingOf()});
}
if(canRotate)map.on("rotate",function(){post({type:"bearing",bearing:bearingOf()});});
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
    case "north":if(canRotate)map.setBearing(0);break;
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
