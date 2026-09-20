import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";


import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { useSosStore } from "../../store/sosStore";


import { supabase } from "../../lib/supabase";


import {
  fetchSmartwatchForChild,
  type SmartwatchStatus,
} from "../../services/smartwatchService";


import { LocationMapCard } from "../location/LocationMapCard";


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";





function firstName(
  value?: string
){

  return (
    value
      ?.trim()
      .split(/\s+/)[0]
      ||
    "Guardian"
  );

}





function formatTime(
  value?: string | null
){

  if(!value){
    return "No update";
  }


  const date =
    new Date(value);



  if(
    Number.isNaN(
      date.getTime()
    )
  ){
    return "No update";
  }



  const minutes =
    Math.floor(
      (
        Date.now()
        -
        date.getTime()
      )
      /
      60000
    );



  if(minutes <= 0){
    return "Just now";
  }



  if(minutes < 60){
    return `${minutes} min ago`;
  }



  return `${Math.floor(minutes / 60)} hr ago`;

}






function DeviceStatus({
  watch,
}:{
  watch:SmartwatchStatus | null;
}): {
  title:string;
  subtitle:string;
  icon:keyof typeof Ionicons.glyphMap;
  connected:boolean;
}{


  if(!watch){

    return {

      title:
      "No smartwatch linked",

      subtitle:
      "Generate a connection code to pair the child watch",

      icon:
      "watch-outline" as keyof typeof Ionicons.glyphMap,

      connected:false,

    };

  }




  return {

    title:
      watch.connectionStatus === "connected"

      ? "Smartwatch Connected"

      :
      watch.connectionStatus === "offline"

      ? "Smartwatch Offline"

      :
      "Smartwatch Disabled",



    subtitle:
      `${watch.watchId} • ${
        watch.lastSeenAt
        ?
        formatTime(watch.lastSeenAt)
        :
        "No signal"
      }`,



    icon:
  watch.connectionStatus === "connected"

  ?
  ("watch" as keyof typeof Ionicons.glyphMap)

  :
  ("watch-outline" as keyof typeof Ionicons.glyphMap),



    connected:
      watch.connectionStatus === "connected",

  };


}








export function GuardianHome(){


const router =
useRouter();




const guardian =
useAuthStore(
 state=>state.guardian
);



const linkedChildren =
useAuthStore(
 state=>state.linkedChildren
);



const primaryChild =
linkedChildren[0] ?? null;





const latest =
useLocationStore(
 state=>state.latest
);



const loadLocation =
useLocationStore(
 state=>state.loadForChild
);



const locationLoading =
useLocationStore(
 state=>state.isLoading
);





const alerts =
useSosStore(
 state=>state.alerts
);



const loadSos =
useSosStore(
 state=>state.loadForChild
);




const [watch,setWatch] =
useState<SmartwatchStatus | null>(
 null
);



const [safeZones,setSafeZones] =
useState(0);



const [refreshing,setRefreshing] =
useState(false);



const pulse =
useRef(
 new Animated.Value(1)
).current;
const activeSosCount =
useMemo(()=>{

  return alerts.filter(
    alert =>
      alert.status !== "resolved"
  ).length;


},[
  alerts
]);





const deviceStatus =
useMemo(
()=>DeviceStatus({
  watch
}),
[
 watch
]
);







const loadDashboardData =
useCallback(
async()=>{


if(!primaryChild){

  return;

}



await Promise.all([


loadLocation(
 primaryChild.id,
 primaryChild.fullName
),



loadSos(
 primaryChild.id,
 primaryChild.fullName
),



]);





const smartwatch =
await fetchSmartwatchForChild(
 primaryChild.id
);



setWatch(
 smartwatch
);






const {
 data,
 error
}
=
await supabase
.from("geofences")
.select(
"id",
{
 count:"exact",
 head:true
}
)
.eq(
"guardian_person_id",
guardian?.id
)
.eq(
"child_person_id",
primaryChild.id
);



if(!error){

 setSafeZones(
  data?.length ?? 0
 );

}



},
[
primaryChild,
guardian,
loadLocation,
loadSos
]
);






useEffect(()=>{


const animation =
Animated.loop(

Animated.sequence([


Animated.timing(
pulse,
{
toValue:1.05,
duration:900,
useNativeDriver:true,
}
),



Animated.timing(
pulse,
{
toValue:1,
duration:900,
useNativeDriver:true,
}
),



])

);



animation.start();



return()=>{

animation.stop();

};



},[
pulse
]);







useFocusEffect(

useCallback(()=>{


void loadDashboardData();




if(!primaryChild){

 return;

}



const channel =
supabase
.channel(
`guardian-dashboard-${primaryChild.id}`
)



.on(

"postgres_changes",

{

event:"*",

schema:"public",

table:"smartwatch_devices",

filter:
`child_id=eq.${primaryChild.id}`

},


()=>{

 void loadDashboardData();

}

)



.on(

"postgres_changes",

{

event:"*",

schema:"public",

table:"sos_alerts",

filter:
`child_id=eq.${primaryChild.id}`

},


()=>{

 void loadDashboardData();

}

)



.on(

"postgres_changes",

{

event:"*",

schema:"public",

table:"location_logs",

filter:
`child_id=eq.${primaryChild.id}`

},


()=>{

 void loadDashboardData();

}

)



.subscribe();





return()=>{


supabase.removeChannel(
 channel
);


};



},[
primaryChild?.id,
loadDashboardData
])

);







async function refresh(){


setRefreshing(true);


await loadDashboardData();


setRefreshing(false);


}







if(!primaryChild){


return (

<View
style={styles.emptyContainer}
>


<Ionicons

name="person-add-outline"

size={45}

color={colors.primary}

/>



<Text
style={styles.emptyTitle}
>
No Child Registered
</Text>



<Text
style={styles.emptyDescription}
>
Register a child profile before using SafeTrack monitoring.
</Text>


<Pressable

style={styles.primaryButton}

onPress={()=>{

router.push(
"/(auth)/child-registration"
);

}}

>

<Text
style={styles.primaryButtonText}
>
Register Child
</Text>


</Pressable>


</View>

);


}
return (

<ScrollView

style={styles.container}

contentContainerStyle={
styles.content
}

showsVerticalScrollIndicator={false}

refreshControl={undefined}

>


<View
style={styles.header}
>


<View>

<Text
style={styles.greeting}
>

Hello, {
firstName(
 guardian?.fullName
)
}

</Text>



<Text
style={styles.subtitle}
>
Guardian Dashboard
</Text>


</View>




<Pressable

style={styles.refreshButton}

onPress={refresh}

>

<Ionicons

name="refresh"

size={22}

color={colors.primary}

/>


</Pressable>



</View>








<View
style={styles.childCard}
>


<View
style={styles.childAvatar}
>

<Ionicons

name="person"

size={30}

color={colors.primary}

/>


</View>



<View
style={styles.childInfo}
>


<Text
style={styles.childName}
>
{
primaryChild.fullName
}
</Text>



<Text
style={styles.childDetails}
>
Age {
primaryChild.age
}
 • {
primaryChild.relationship
}
</Text>



</View>



</View>









<View
style={styles.sectionTitleRow}
>


<Text
style={styles.sectionTitle}
>
Live Safety Status
</Text>


</View>








<View
style={styles.statusGrid}
>





<View
style={styles.statusCard}
>


<Ionicons

name="location"

size={24}

color={colors.primary}

/>



<Text
style={styles.statusValue}
>

{
latest
?
"Active"
:
"Waiting"
}

</Text>



<Text
style={styles.statusLabel}
>
Location
</Text>


</View>








<View
style={styles.statusCard}
>


<Ionicons

name={
deviceStatus.icon
}

size={24}

color={
deviceStatus.connected
?
colors.primary
:
"#94A3B8"
}

/>



<Text
style={styles.statusValue}
>

{
deviceStatus.connected
?
"Online"
:
"Offline"
}

</Text>



<Text
style={styles.statusLabel}
>
Watch
</Text>


</View>








<View
style={styles.statusCard}
>


<Animated.View

style={{
transform:[
{
scale:pulse
}
]
}}

>


<Ionicons

name={
activeSosCount > 0
?
"alert-circle"
:
"shield-checkmark"
}

size={24}

color={
activeSosCount > 0
?
"#DC2626"
:
colors.primary
}

/>



</Animated.View>





<Text
style={[
styles.statusValue,
activeSosCount > 0 &&
styles.dangerText
]}
>

{
activeSosCount
}

</Text>



<Text
style={styles.statusLabel}
>
SOS
</Text>



</View>









<View
style={styles.statusCard}
>


<Ionicons

name="map"

size={24}

color={colors.primary}

/>



<Text
style={styles.statusValue}
>

{
safeZones
}

</Text>



<Text
style={styles.statusLabel}
>
Safe Zones
</Text>



</View>





</View>









<View
style={styles.sectionTitleRow}
>


<Text
style={styles.sectionTitle}
>
Child Location
</Text>


</View>







<View
style={styles.mapCard}
>


<LocationMapCard

location={latest}

loading={
locationLoading
}

/>



</View>









<View
style={styles.watchCard}
>


<View
style={styles.watchHeader}
>


<Ionicons

name="watch-outline"

size={25}

color={colors.primary}

/>


<View
style={styles.watchText}
>


<Text
style={styles.watchTitle}
>
{
deviceStatus.title
}
</Text>



<Text
style={styles.watchSubtitle}
>
{
deviceStatus.subtitle
}
</Text>


</View>


</View>




<Pressable

style={styles.connectionButton}

onPress={()=>{


router.push({

pathname:
"/watch-connection",

params:{
childId:
primaryChild.id
}

});


}}

>


<Text
style={styles.connectionButtonText}
>
Generate Device Connection Code
</Text>


</Pressable>



</View>








<View
style={styles.aiCard}
>


<Ionicons

name="analytics-outline"

size={25}

color={colors.primary}

/>


<View
style={styles.aiText}
>


<Text
style={styles.aiTitle}
>
AI Safety Monitoring
</Text>



<Text
style={styles.aiDescription}
>
SafeTrack analyzes normal movement patterns and provides explainable anomaly notifications for unusual activity.
</Text>



</View>



</View>






</ScrollView>

);


}
const styles = StyleSheet.create({

container:{
  flex:1,
  backgroundColor:colors.background,
},



content:{
  padding:spacing.lg,
  paddingBottom:50,
},



emptyContainer:{
  flex:1,
  alignItems:"center",
  justifyContent:"center",
  padding:30,
  backgroundColor:colors.background,
},



emptyTitle:{
  marginTop:20,
  fontSize:24,
  fontWeight:"900",
  color:colors.ink,
},



emptyDescription:{
  marginTop:10,
  textAlign:"center",
  color:colors.muted,
  lineHeight:20,
},



primaryButton:{
  marginTop:25,
  backgroundColor:colors.primary,
  paddingHorizontal:25,
  paddingVertical:14,
  borderRadius:radius.pill,
},



primaryButtonText:{
  color:colors.white,
  fontWeight:"900",
},




header:{
  flexDirection:"row",
  alignItems:"center",
  justifyContent:"space-between",
  marginBottom:20,
},



greeting:{
  fontSize:26,
  fontWeight:"900",
  color:colors.ink,
},



subtitle:{
  marginTop:5,
  color:colors.muted,
  fontSize:14,
},



refreshButton:{
  width:45,
  height:45,
  borderRadius:22,
  backgroundColor:colors.white,
  alignItems:"center",
  justifyContent:"center",
  ...shadow.soft,
},




childCard:{
  flexDirection:"row",
  alignItems:"center",
  backgroundColor:colors.white,
  padding:18,
  borderRadius:radius.lg,
  ...shadow.card,
},



childAvatar:{
  width:55,
  height:55,
  borderRadius:20,
  backgroundColor:colors.softMint,
  alignItems:"center",
  justifyContent:"center",
},



childInfo:{
  marginLeft:15,
},



childName:{
  fontSize:19,
  fontWeight:"900",
  color:colors.ink,
},



childDetails:{
  marginTop:5,
  color:colors.muted,
},





sectionTitleRow:{
  marginTop:22,
  marginBottom:12,
},



sectionTitle:{
  fontSize:18,
  fontWeight:"900",
  color:colors.ink,
},





statusGrid:{
  flexDirection:"row",
  flexWrap:"wrap",
  justifyContent:"space-between",
},



statusCard:{
  width:"48%",
  backgroundColor:colors.white,
  borderRadius:radius.md,
  padding:18,
  marginBottom:12,
  alignItems:"center",
  ...shadow.soft,
},



statusValue:{
  marginTop:8,
  fontSize:18,
  fontWeight:"900",
  color:colors.ink,
},



statusLabel:{
  marginTop:4,
  fontSize:12,
  color:colors.muted,
},



dangerText:{
  color:"#DC2626",
},





mapCard:{
  backgroundColor:colors.white,
  borderRadius:radius.lg,
  overflow:"hidden",
  ...shadow.card,
},





watchCard:{
  backgroundColor:colors.white,
  padding:18,
  borderRadius:radius.lg,
  ...shadow.card,
},



watchHeader:{
  flexDirection:"row",
  alignItems:"center",
},



watchText:{
  flex:1,
  marginLeft:14,
},



watchTitle:{
  fontSize:16,
  fontWeight:"900",
  color:colors.ink,
},



watchSubtitle:{
  marginTop:5,
  color:colors.muted,
  fontSize:13,
},



connectionButton:{
  marginTop:18,
  backgroundColor:colors.primary,
  padding:14,
  borderRadius:radius.pill,
  alignItems:"center",
},



connectionButtonText:{
  color:colors.white,
  fontWeight:"900",
},





aiCard:{
  marginTop:18,
  flexDirection:"row",
  backgroundColor:colors.softMint,
  padding:18,
  borderRadius:radius.lg,
},



aiText:{
  flex:1,
  marginLeft:12,
},



aiTitle:{
  fontSize:16,
  fontWeight:"900",
  color:colors.ink,
},



aiDescription:{
  marginTop:5,
  color:colors.muted,
  lineHeight:18,
  fontSize:13,
},


});