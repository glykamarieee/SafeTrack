import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";


import {
  fetchAdminSummaryMetrics,
  subscribeAdminUpdates,
} from "../../services/adminService";


import {
  safeTrackColors as colors,
} from "../../constants/safeTrackDesign";

type AdminSummaryMetrics = {
  guardianAccounts: number;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  locationRecords: number;
  activeSosAlerts: number;
  generatedReports: number;
};

function formatNumber(
  value:number
){
  return value.toLocaleString();
}




type QuickAction = {

  title:string;

  subtitle:string;

  icon:keyof typeof Ionicons.glyphMap;

  route:string;

};




const QUICK_ACTIONS:QuickAction[] = [

  {
    title:"Guardian Accounts",
    subtitle:"Manage registered guardians",
    icon:"people-outline",
    route:"/admin-guardians",
  },


  {
    title:"Smartwatch Devices",
    subtitle:"Monitor connected watches",
    icon:"watch-outline",
    route:"/admin-devices",
  },


  {
    title:"SOS Alerts",
    subtitle:"Review emergency events",
    icon:"alert-circle-outline",
    route:"/admin-sos",
  },


  {
    title:"Reports",
    subtitle:"Generate system reports",
    icon:"document-text-outline",
    route:"/admin-reports",
  },

];





export function AdminHome(){


const [metrics,setMetrics] =
useState<AdminSummaryMetrics | null>(
  null
);



const [loading,setLoading] =
useState(true);



const [refreshing,setRefreshing] =
useState(false);



const [error,setError] =
useState<string | null>(
  null
);





const loadMetrics =
useCallback(
async()=>{


try{


setError(null);


const result =
await fetchAdminSummaryMetrics();



setMetrics(result);



}

catch(error){


setError(
 error instanceof Error
 ?
 error.message
 :
 "Unable to load dashboard data."
);



}

finally{


setLoading(false);



}



},
[]
);






useEffect(()=>{


void loadMetrics();



const unsubscribe =
subscribeAdminUpdates(
()=>{

void loadMetrics();

}
);



return unsubscribe;



},[
loadMetrics
]);






async function handleRefresh(){


setRefreshing(true);


await loadMetrics();


setRefreshing(false);


}







if(loading){


return (

<View
style={styles.loadingContainer}
>

<ActivityIndicator
size="large"
color={colors.primary}
/>


<Text
style={styles.loadingText}
>
Loading admin dashboard...
</Text>


</View>

);


}






if(error){


return (

<View
style={styles.errorContainer}
>

<Ionicons
name="warning-outline"
size={40}
color={colors.danger}
/>


<Text
style={styles.errorText}
>
{error}
</Text>



<Pressable
style={styles.retryButton}
onPress={loadMetrics}
>

<Text
style={styles.retryText}
>
Retry
</Text>


</Pressable>


</View>

);


}





const safeMetrics =
metrics ?? {

guardianAccounts:0,

registeredChildren:0,

activeDevices:0,

activeSafeZones:0,

locationRecords:0,

activeSosAlerts:0,

generatedReports:0,

};




return (
<ScrollView
style={styles.container}
contentContainerStyle={
styles.content
}
showsVerticalScrollIndicator={false}
>
<View
style={styles.header}
>

<View>

<Text
style={styles.greeting}
>
SafeTrack Admin
</Text>


<Text
style={styles.subtitle}
>
System monitoring and management
</Text>

</View>


<Pressable
style={styles.refreshButton}
onPress={handleRefresh}
>

<Ionicons
name="refresh"
size={22}
color={colors.primary}
/>

</Pressable>


</View>





<View
style={styles.heroCard}
>

<View
style={styles.heroTop}
>

<View
style={styles.heroIcon}
>

<Ionicons
name="shield-checkmark"
size={34}
color={colors.primary}
/>

</View>



<View
style={styles.heroTextContainer}
>

<Text
style={styles.heroTitle}
>
SafeTrack Monitoring Center
</Text>


<Text
style={styles.heroDescription}
>
Authorized system control and child safety monitoring
</Text>

</View>


</View>




<View
style={styles.statusBadge}
>

<Ionicons
name="pulse-outline"
size={16}
color={colors.primary}
/>


<Text
style={styles.statusText}
>
System Active
</Text>


</View>


</View>






<View
style={styles.sectionHeader}
>

<Text
style={styles.sectionTitle}
>
System Overview
</Text>


</View>






<View
style={styles.metricsGrid}
>


<MetricCard

title="Guardians"

value={
safeMetrics.guardianAccounts
}

icon="people-outline"

/>



<MetricCard

title="Children"

value={
safeMetrics.registeredChildren
}

icon="person-outline"

/>



<MetricCard

title="Active Watches"

value={
safeMetrics.activeDevices
}

icon="watch-outline"

/>



<MetricCard

title="SOS Alerts"

value={
safeMetrics.activeSosAlerts
}

icon="alert-circle-outline"

/>



<MetricCard

title="Locations"

value={
safeMetrics.locationRecords
}

icon="location-outline"

/>



<MetricCard

title="Reports"

value={
safeMetrics.generatedReports
}

icon="document-text-outline"

/>



</View>








<View
style={styles.sectionHeader}
>

<Text
style={styles.sectionTitle}
>
Management Tools
</Text>


</View>







<View
style={styles.actionsContainer}
>

{

QUICK_ACTIONS.map(
(action)=>(


<Pressable

key={
action.title
}

style={styles.actionCard}

onPress={()=>{


router.push(
action.route as any
);


}}

>



<View
style={styles.actionIcon}
>

<Ionicons

name={
action.icon
}

size={26}

color={colors.primary}

/>


</View>




<View
style={styles.actionTextContainer}
>


<Text
style={styles.actionTitle}
>

{
action.title
}

</Text>



<Text
style={styles.actionSubtitle}
>

{
action.subtitle
}

</Text>



</View>




<Ionicons

name="chevron-forward"

size={20}

color="#94A3B8"

/>



</Pressable>


)

)

}



</View>








<View
style={styles.infoCard}
>

<Ionicons
name="information-circle-outline"
size={24}
color={colors.primary}
/>


<View
style={styles.infoContent}
>


<Text
style={styles.infoTitle}
>
Realtime Monitoring Enabled
</Text>


<Text
style={styles.infoText}
>
Guardian accounts, child profiles, smartwatch devices, locations, geofence events, and SOS alerts update automatically.
</Text>


</View>


</View>







</ScrollView>

);

}







function MetricCard({

title,

value,

icon,

}:{

title:string;

value:number;

icon:keyof typeof Ionicons.glyphMap;

}){


return (

<View
style={styles.metricCard}
>


<View
style={styles.metricIcon}
>

<Ionicons

name={icon}

size={22}

color={colors.primary}

/>


</View>



<Text
style={styles.metricValue}
>

{
formatNumber(value)
}

</Text>



<Text
style={styles.metricTitle}
>

{
title
}

</Text>



</View>

);


}
const styles = StyleSheet.create({

container:{
  flex:1,
  backgroundColor:"#F5F7F8",
},


content:{
  padding:20,
  paddingBottom:40,
},



loadingContainer:{
  flex:1,
  alignItems:"center",
  justifyContent:"center",
  backgroundColor:"#F5F7F8",
},


loadingText:{
  marginTop:12,
  fontSize:15,
  color:"#64748B",
},



errorContainer:{
  flex:1,
  alignItems:"center",
  justifyContent:"center",
  padding:30,
  backgroundColor:"#F5F7F8",
},


errorText:{
  marginTop:15,
  textAlign:"center",
  color:"#475569",
  fontSize:15,
},


retryButton:{
  marginTop:20,
  backgroundColor:colors.primary,
  paddingHorizontal:25,
  paddingVertical:12,
  borderRadius:20,
},


retryText:{
  color:"#FFFFFF",
  fontWeight:"700",
},




header:{
  flexDirection:"row",
  alignItems:"center",
  justifyContent:"space-between",
  marginBottom:20,
},



greeting:{
  fontSize:26,
  fontWeight:"800",
  color:"#111827",
},



subtitle:{
  marginTop:5,
  color:"#64748B",
  fontSize:14,
},



refreshButton:{
  width:44,
  height:44,
  borderRadius:22,
  backgroundColor:"#FFFFFF",
  justifyContent:"center",
  alignItems:"center",
  shadowColor:"#000",
  shadowOpacity:0.08,
  shadowRadius:8,
  elevation:3,
},




heroCard:{
  backgroundColor:"#FFFFFF",
  borderRadius:24,
  padding:20,
  marginBottom:22,
  shadowColor:"#000",
  shadowOpacity:0.06,
  shadowRadius:12,
  elevation:3,
},


heroTop:{
  flexDirection:"row",
  alignItems:"center",
},


heroIcon:{
  width:60,
  height:60,
  borderRadius:30,
  backgroundColor:"#E8F5EE",
  alignItems:"center",
  justifyContent:"center",
},


heroTextContainer:{
  flex:1,
  marginLeft:15,
},


heroTitle:{
  fontSize:18,
  fontWeight:"800",
  color:"#111827",
},


heroDescription:{
  marginTop:5,
  color:"#64748B",
  fontSize:13,
  lineHeight:18,
},



statusBadge:{
  marginTop:18,
  alignSelf:"flex-start",
  flexDirection:"row",
  alignItems:"center",
  backgroundColor:"#E8F5EE",
  paddingHorizontal:14,
  paddingVertical:8,
  borderRadius:20,
},


statusText:{
  marginLeft:7,
  color:colors.primary,
  fontWeight:"700",
  fontSize:13,
},





sectionHeader:{
  marginBottom:12,
},


sectionTitle:{
  fontSize:18,
  fontWeight:"800",
  color:"#111827",
},





metricsGrid:{
  flexDirection:"row",
  flexWrap:"wrap",
  justifyContent:"space-between",
  marginBottom:25,
},




metricCard:{
  width:"31%",
  minWidth:100,
  backgroundColor:"#FFFFFF",
  borderRadius:20,
  padding:15,
  marginBottom:14,
  alignItems:"center",
  shadowColor:"#000",
  shadowOpacity:0.05,
  shadowRadius:8,
  elevation:2,
},



metricIcon:{
  width:40,
  height:40,
  borderRadius:20,
  backgroundColor:"#E8F5EE",
  justifyContent:"center",
  alignItems:"center",
},



metricValue:{
  marginTop:10,
  fontSize:22,
  fontWeight:"800",
  color:"#111827",
},



metricTitle:{
  marginTop:4,
  fontSize:12,
  color:"#64748B",
  textAlign:"center",
},





actionsContainer:{
  gap:12,
  marginBottom:20,
},



actionCard:{
  backgroundColor:"#FFFFFF",
  borderRadius:20,
  padding:16,
  flexDirection:"row",
  alignItems:"center",
  shadowColor:"#000",
  shadowOpacity:0.05,
  shadowRadius:8,
  elevation:2,
},



actionIcon:{
  width:48,
  height:48,
  borderRadius:24,
  backgroundColor:"#E8F5EE",
  alignItems:"center",
  justifyContent:"center",
},



actionTextContainer:{
  flex:1,
  marginLeft:15,
},



actionTitle:{
  fontSize:16,
  fontWeight:"700",
  color:"#111827",
},



actionSubtitle:{
  marginTop:4,
  color:"#64748B",
  fontSize:13,
},





infoCard:{
  flexDirection:"row",
  backgroundColor:"#FFFFFF",
  borderRadius:20,
  padding:18,
  alignItems:"flex-start",
},



infoContent:{
  flex:1,
  marginLeft:12,
},



infoTitle:{
  fontWeight:"800",
  color:"#111827",
  fontSize:15,
},



infoText:{
  marginTop:6,
  color:"#64748B",
  fontSize:13,
  lineHeight:19,
},


});