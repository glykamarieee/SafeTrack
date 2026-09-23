import { useState } from "react";

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useRouter,
} from "expo-router";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  completeChildRegistration,
  type TrackingSource,
} from "../../services/childOnboardingService";



const C = {

  background:"#F4F7F5",
  card:"#FFFFFF",
  text:"#122019",
  muted:"#6E7D75",
  primary:"#2F8F62",
  primaryDark:"#176343",
  light:"#E8F5EE",
  border:"#DDE7E1",
  danger:"#B84A4A",

};



const relationships = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Other",
];





const trackingOptions:
Array<{
  value:TrackingSource;
  title:string;
  description:string;
  icon:keyof typeof Ionicons.glyphMap;
}>
=
[
  {
    value:"smartwatch",
    title:"Smartwatch Only",
    description:
      "Uses the child's registered SafeTrack smartwatch for location tracking.",
    icon:"watch-outline",
  },


  {
    value:"mobile",
    title:"Mobile Only",
    description:
      "Uses the child's registered mobile device for location tracking.",
    icon:"phone-portrait-outline",
  },


  {
    value:"both",
    title:"Smartwatch + Mobile",
    description:
      "Smartwatch remains the primary device with mobile as additional source.",
    icon:"git-compare-outline",
  },

];








export default function ChildRegistrationScreen(){


const router = useRouter();



const [fullName,setFullName] =
useState("");



const [age,setAge] =
useState("");



const [relationship,setRelationship] =
useState("Guardian");



const [trackingSource,setTrackingSource] =
useState<TrackingSource>("smartwatch");



const [watchId,setWatchId] =
useState("");



const [loading,setLoading] =
useState(false);



const [error,setError] =
useState<string|null>(null);







async function registerChild(){


setError(null);



const childAge =
Number(age);




if(fullName.trim().length < 2){

setError(
"Enter child's full name."
);

return;

}




if(
!Number.isInteger(childAge)
||
childAge < 6
||
childAge > 15
){

setError(
"Child age must be between 6 and 15 years old."
);

return;

}





if(
trackingSource !== "mobile"
&&
watchId.trim().length === 0
){

setError(
"Smartwatch ID is required for smartwatch tracking."
);

return;

}






try{


setLoading(true);



const result =
await completeChildRegistration({

fullName:
fullName.trim(),


age:
childAge,


relationship,


trackingSource,


watchId:
trackingSource === "mobile"
?
undefined
:
watchId.trim().toUpperCase(),

});





router.push({

pathname:
"/(app)/connection-code",


params:{

childId:
result.child.id,


// A phone-only child gets a child phone code, not a watch code.
device:
trackingSource === "mobile"
?
"phone"
:
"watch",


watchId:
trackingSource === "mobile"
?
""
:
watchId.trim().toUpperCase(),

},


});



}
catch(err){


setError(

err instanceof Error
?
err.message
:
"Unable to register child."

);


}
finally{


setLoading(false);


}



}









return (

<SafeAreaView style={styles.safe}>


<ScrollView
contentContainerStyle={styles.container}
>



<View style={styles.header}>


<Ionicons
name="shield-checkmark-outline"
size={45}
color={C.primary}
/>


<Text style={styles.title}>
Register Child
</Text>


<Text style={styles.subtitle}>
Add child details and connect the SafeTrack device.
</Text>


</View>







<View style={styles.card}>


<Text style={styles.section}>
Child Information
</Text>




<Text style={styles.label}>
Full Name
</Text>


<TextInput

value={fullName}

onChangeText={setFullName}

placeholder="Child full name"

style={styles.input}

/>






<Text style={styles.label}>
Age
</Text>


<TextInput

value={age}

onChangeText={setAge}

keyboardType="number-pad"

placeholder="6 - 15"

style={styles.input}

/>






<Text style={styles.label}>
Relationship
</Text>


<View style={styles.wrap}>


{
relationships.map(item=>(

<Pressable

key={item}

onPress={()=>setRelationship(item)}

style={[
styles.chip,
relationship===item && styles.activeChip
]}

>


<Text
style={[
styles.chipText,
relationship===item && styles.activeChipText
]}
>

{item}

</Text>


</Pressable>

))
}


</View>







<Text style={styles.label}>
Tracking Source
</Text>





{
trackingOptions.map(item=>(


<Pressable

key={item.value}

onPress={()=>
setTrackingSource(item.value)
}

style={[
styles.option,
trackingSource===item.value &&
styles.activeOption
]}

>


<Ionicons
name={item.icon}
size={25}
color={C.primary}
/>


<View style={{flex:1}}>


<Text style={styles.optionTitle}>
{item.title}
</Text>


<Text style={styles.optionDesc}>
{item.description}
</Text>


</View>


</Pressable>


))

}







{
trackingSource !== "mobile" &&
<>

<Text style={styles.label}>
Watch ID
</Text>


<TextInput

value={watchId}

onChangeText={setWatchId}

autoCapitalize="characters"

placeholder="ST-WATCH-XXXXXXXX"

style={styles.input}

/>

</>

}






</View>








{
error &&
<View style={styles.errorBox}>


<Ionicons
name="alert-circle-outline"
size={20}
color={C.danger}
/>


<Text style={styles.errorText}>
{error}
</Text>


</View>
}







<Pressable

disabled={loading}

onPress={registerChild}

style={styles.button}

>


<Text style={styles.buttonText}>

{
loading
?
"Registering..."
:
"Register Child"
}

</Text>


</Pressable>





</ScrollView>


</SafeAreaView>

);


}









const styles = StyleSheet.create({

safe:{
flex:1,
backgroundColor:C.background,
},


container:{
padding:22,
},


header:{
alignItems:"center",
marginTop:20,
},


title:{
marginTop:10,
fontSize:30,
fontWeight:"900",
color:C.text,
},


subtitle:{
marginTop:8,
textAlign:"center",
color:C.muted,
},


card:{
marginTop:25,
padding:20,
backgroundColor:C.card,
borderRadius:24,
borderWidth:1,
borderColor:C.border,
},


section:{
fontSize:18,
fontWeight:"900",
color:C.text,
},


label:{
marginTop:15,
marginBottom:8,
fontWeight:"800",
color:C.muted,
},


input:{
height:52,
borderWidth:1,
borderColor:C.border,
borderRadius:14,
paddingHorizontal:15,
backgroundColor:"#FAFCFB",
},


wrap:{
flexDirection:"row",
flexWrap:"wrap",
gap:8,
},


chip:{
paddingHorizontal:14,
paddingVertical:9,
borderRadius:20,
borderWidth:1,
borderColor:C.border,
},


activeChip:{
backgroundColor:C.primary,
},


chipText:{
color:C.text,
},


activeChipText:{
color:"#FFFFFF",
},


option:{
flexDirection:"row",
alignItems:"center",
gap:12,
padding:15,
borderRadius:18,
borderWidth:1,
borderColor:C.border,
marginBottom:10,
},


activeOption:{
backgroundColor:C.light,
borderColor:C.primary,
},


optionTitle:{
fontWeight:"900",
color:C.text,
},


optionDesc:{
color:C.muted,
fontSize:12,
marginTop:3,
},


errorBox:{
marginTop:15,
padding:14,
borderRadius:14,
backgroundColor:"#FCEEEE",
flexDirection:"row",
},


errorText:{
marginLeft:8,
flex:1,
color:C.danger,
},


button:{
marginTop:20,
height:55,
borderRadius:28,
backgroundColor:C.primary,
alignItems:"center",
justifyContent:"center",
},


buttonText:{
color:"#FFFFFF",
fontWeight:"900",
fontSize:16,
},


});