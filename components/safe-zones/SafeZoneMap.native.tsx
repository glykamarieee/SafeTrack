import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";

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
  animateToRegion(
    region: SafeZoneMapRegion,
    duration?: number
  ): void;
};

type Props = {
  initialRegion: SafeZoneMapRegion;
  region: SafeZoneMapRegion;
  zones: SafeZoneMapZone[];
  primaryColor: string;
  style?: StyleProp<ViewStyle>;

  onRegionChangeComplete(
    region: SafeZoneMapRegion
  ): void;

  onPressCoordinate(
    latitude: number,
    longitude: number
  ): void;

  onZonePress(
    zone: SafeZoneMapZone
  ): void;

  formatRadius(
    radiusMeters: number
  ): string;
};


const SafeZoneMap = forwardRef<
  SafeZoneMapHandle,
  Props
>(function SafeZoneMap(
  {
    initialRegion,
    region,
    zones,
    primaryColor,
    style,
    onRegionChangeComplete,
    onPressCoordinate,
    onZonePress,
    formatRadius,
  },
  ref
) {

  const webRef =
    useRef<WebView | null>(null);


  useImperativeHandle(
    ref,
    () => ({
      animateToRegion(
        nextRegion
      ) {

        webRef.current?.postMessage(
          JSON.stringify({
            type:"center",
            latitude:
              nextRegion.latitude,
            longitude:
              nextRegion.longitude,
            zoom:15,
          })
        );

      },
    })
  );


  const html = useMemo(() => {

    const zoneData =
      JSON.stringify(
        zones.map((zone)=>({
          ...zone,
          radiusLabel:
            formatRadius(
              zone.radiusMeters
            )
        }))
      );


    return `
<!DOCTYPE html>

<html>

<head>

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<link 
rel="stylesheet"
href="https://unpkg.com/leaflet/dist/leaflet.css"
/>

<script
src="https://unpkg.com/leaflet/dist/leaflet.js">
</script>


<style>

html,
body,
#map{

height:100%;
width:100%;
margin:0;
padding:0;

}


.leaflet-control-attribution{

font-size:8px;

}

</style>


</head>


<body>

<div id="map"></div>


<script>


const startLat =
${initialRegion.latitude};


const startLng =
${initialRegion.longitude};


const primary =
"${primaryColor}";


const zones =
${zoneData};



const map =
L.map(
"map",
{
zoomControl:false
}
)
.setView(
[startLat,startLng],
14
);



L.tileLayer(

"https://tile.openstreetmap.org/{z}/{x}/{y}.png",

{
maxZoom:19,
attribution:
"© OpenStreetMap"
}

)
.addTo(map);



zones.forEach(zone=>{


const circle =
L.circle(

[
zone.latitude,
zone.longitude
],

{

radius:
zone.radiusMeters,

color:
zone.isEnabled
? primary
:"#9AA5A0",

fillColor:
zone.isEnabled
? primary
:"#9AA5A0",

fillOpacity:
0.18,

weight:2

}

)
.addTo(map);



const marker =
L.marker(
[
zone.latitude,
zone.longitude
]
)
.addTo(map);



marker.bindPopup(

"<b>"
+zone.name+
"</b><br/>"+
zone.radiusLabel

);



marker.on(
"click",
function(){

window.ReactNativeWebView.postMessage(

JSON.stringify({

type:"zone",

id:zone.id

})

);

}

);



});



map.on(
"click",
function(e){

window.ReactNativeWebView.postMessage(

JSON.stringify({

type:"press",

latitude:e.latlng.lat,

longitude:e.latlng.lng

})

);

}

);



map.on(
"moveend",
function(){

const c =
map.getCenter();


window.ReactNativeWebView.postMessage(

JSON.stringify({

type:"region",

latitude:c.lat,

longitude:c.lng,

latitudeDelta:
0.02,

longitudeDelta:
0.02

})

);


});



document.addEventListener(
"message",
function(event){

const data =
JSON.parse(event.data);


if(data.type==="center"){

map.setView(
[
data.latitude,
data.longitude
],
data.zoom || 15
);

}

}

);


</script>


</body>

</html>
`;

  },[
    zones,
    primaryColor,
    initialRegion.latitude,
    initialRegion.longitude,
    formatRadius
  ]);



  return (

    <View
      style={[
        styles.container,
        style
      ]}
    >

      <WebView

        ref={webRef}

        originWhitelist={[
          "*"
        ]}

        source={{
          html
        }}

        javaScriptEnabled

        domStorageEnabled

        mixedContentMode="always"

        onMessage={(event)=>{

          try{

            const data =
              JSON.parse(
                event.nativeEvent.data
              );


            if(
              data.type==="press"
            ){

              onPressCoordinate(
                data.latitude,
                data.longitude
              );

            }


            if(
              data.type==="region"
            ){

              onRegionChangeComplete({
                latitude:
                  data.latitude,

                longitude:
                  data.longitude,

                latitudeDelta:
                  data.latitudeDelta,

                longitudeDelta:
                  data.longitudeDelta
              });

            }


            if(
              data.type==="zone"
            ){

              const zone =
                zones.find(
                  item =>
                  item.id===data.id
                );


              if(zone){
                onZonePress(zone);
              }

            }


          }catch(e){}

        }}

      />

    </View>

  );

});


export default SafeZoneMap;



const styles =
StyleSheet.create({

container:{
width:"100%",
height:"100%",
overflow:"hidden",
backgroundColor:"#EAF5EF"
}

});