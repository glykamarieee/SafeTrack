import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  useAuthStore,
} from "../../store/authStore";


import {
  useGeofenceStore,
} from "../../store/geofenceStore";


import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
} from "../../components/location/SafeTrackInteractiveMap";


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";





type FormState = {

  name:string;

  address:string;

  latitude:string;

  longitude:string;

  radius:string;

};



const EMPTY_FORM:FormState = {

  name:"",

  address:"",

  latitude:"10.000000",

  longitude:"123.000000",

  radius:"200",

};








export default function SafeZonesScreen(){


  const guardian =
    useAuthStore(
      state=>state.guardian
    );


  const child =
useAuthStore(
 state=>state.linkedChildren?.[0] ?? null
);

  const trackingSource =
child?.trackingSource ?? "mobile";



  const {

    zones,

    isLoading,

    isSaving,

    error,

    load,

    saveNew,

    saveEdit,

    remove,

  } =
  useGeofenceStore();





  const [
    modalVisible,
    setModalVisible
  ] =
  useState(false);



  const [
    editingId,
    setEditingId
  ] =
  useState<string|null>(null);



  const [
    form,
    setForm
  ] =
  useState<FormState>(
    EMPTY_FORM
  );








  const loadZones =
  useCallback(
    async()=>{

      if(
        !guardian?.id ||
        !child?.id
      ){
        return;
      }


      await load(
        guardian.id,
        child.id
      );


    },
    [
      guardian?.id,
      child?.id
    ]
  );





  useEffect(()=>{

    void loadZones();

  },[loadZones]);









  const openCreate = ()=>{


    setEditingId(null);


    setForm(
      EMPTY_FORM
    );


    setModalVisible(true);

  };








  const openEdit = (
    zone:any
  )=>{


    setEditingId(
      zone.id
    );


    setForm({

      name:
        zone.name,

      address:
        zone.address ?? "",

      latitude:
        String(
          zone.latitude
        ),

      longitude:
        String(
          zone.longitude
        ),

      radius:
        String(
          zone.radiusMeters
        ),

    });


    setModalVisible(true);


  };









  const save = async()=>{


    if(
      !guardian?.id ||
      !child?.id
    ){
      return;
    }



    const latitude =
      Number(
        form.latitude
      );


    const longitude =
      Number(
        form.longitude
      );


    const radiusMeters =
      Number(
        form.radius
      );



    if(
      !form.name.trim()
    ){

      Alert.alert(
        "Missing name",
        "Please enter a Safe Zone name."
      );

      return;

    }



    if(
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ){

      Alert.alert(
        "Invalid location",
        "Please enter valid coordinates."
      );

      return;

    }



    try{


      if(editingId){


        await saveEdit(
          editingId,
          {

            name:
              form.name,

            address:
              form.address,

            latitude,

            longitude,

            radiusMeters,

            isEnabled:true,

          }
        );


      }
      else{


        await saveNew({

          guardianId:
            guardian.id,

          childId:
            child.id,


          name:
            form.name,

          address:
            form.address,


          latitude,

          longitude,


          radiusMeters,


          isEnabled:true,

        });


      }



      setModalVisible(false);

      await loadZones();



    }
    catch(error){


      Alert.alert(

        "Unable to save Safe Zone",

        error instanceof Error
        ?
        error.message
        :
        "Please try again."

      );


    }



  };









  const toggle =
  async(
    zone:any
  )=>{


    try{


      await saveEdit(

        zone.id,

        {

          name:
            zone.name,

          address:
            zone.address,

          latitude:
            zone.latitude,

          longitude:
            zone.longitude,

          radiusMeters:
            zone.radiusMeters,

          isEnabled:
            !zone.isEnabled,

        }

      );


    }
    catch(error){

      Alert.alert(
        "Update failed",
        error instanceof Error
        ?
        error.message
        :
        "Unable to update."
      );

    }


  };









  const deleteZone =
  (
    id:string
  )=>{


    Alert.alert(

      "Delete Safe Zone",

      "Remove this Safe Zone?",

      [

        {
          text:"Cancel",
          style:"cancel"
        },

        {

          text:"Delete",

          style:"destructive",

          onPress:async()=>{

            await remove(id);

          }

        }

      ]

    );


  };









  const markers =
  useMemo<SafeTrackMapMarker[]>(()=>{


    return zones.map(zone=>({

      id:
        zone.id,


      latitude:
        zone.latitude,


      longitude:
        zone.longitude,


      title:
        zone.name,


      detail:
        `${zone.radiusMeters} meter radius`,


      kind:
        "zone",


    }));


  },[zones]);









  return (

<SafeAreaView style={styles.safe}>


<ScrollView
contentContainerStyle={styles.content}
showsVerticalScrollIndicator={false}
>


<Text style={styles.title}>
Safe Zones
</Text>


<Text style={styles.subtitle}>
Manage areas where your child is expected to stay.
{trackingSource === "mobile"
  ? " Location updates come from the child's mobile device."
  : trackingSource === "both"
  ? " Location updates come from smartwatch and mobile sources."
  : " Location updates come from the child's smartwatch."}
</Text>





<View style={styles.map}>

<SafeTrackInteractiveMap

markers={markers}

height={260}

/>

</View>





<Pressable
style={styles.addButton}
onPress={openCreate}
>

<Ionicons
name="add-circle-outline"
size={20}
color="white"
/>


<Text style={styles.addText}>
Create Safe Zone
</Text>


</Pressable>







{
isLoading
?
<ActivityIndicator
color={colors.primary}
/>

:

zones.map(zone=>(


<View
key={zone.id}
style={styles.card}
>


<Text style={styles.zoneName}>
{zone.name}
</Text>


<Text style={styles.detail}>
Radius:
{zone.radiusMeters} meters
</Text>


<Text style={styles.status}>
{
zone.isEnabled
?
"Active monitoring"
:
"Disabled"
}
</Text>




<View style={styles.actions}>


<Pressable
onPress={()=>openEdit(zone)}
>
<Text style={styles.action}>
Edit
</Text>
</Pressable>


<Pressable
onPress={()=>toggle(zone)}
>
<Text style={styles.action}>
Toggle
</Text>
</Pressable>


<Pressable
onPress={()=>deleteZone(zone.id)}
>
<Text style={styles.delete}>
Delete
</Text>
</Pressable>


</View>


</View>


))

}





</ScrollView>









<Modal
visible={modalVisible}
transparent
animationType="slide"
>


<View style={styles.modal}>


<View style={styles.sheet}>


<Text style={styles.modalTitle}>
Safe Zone
</Text>



{
[
["name","Name"],
["address","Address"],
["latitude","Latitude"],
["longitude","Longitude"],
["radius","Radius meters"],
].map(([key,label])=>(


<TextInput

key={key}

placeholder={label}

value={
form[key as keyof FormState]
}

onChangeText={
text=>
setForm({
...form,
[key]:
text
})
}

style={styles.input}

/>


))
}





<Pressable
style={styles.saveButton}
onPress={save}
>

<Text style={styles.saveText}>
{
isSaving
?
"Saving..."
:
"Save"
}
</Text>


</Pressable>



</View>

</View>


</Modal>



</SafeAreaView>

  );

}









const styles =
StyleSheet.create({


safe:{
flex:1,
backgroundColor:colors.background,
},


content:{
padding:spacing.lg,
paddingBottom:50,
},


title:{
fontSize:30,
fontWeight:"900",
color:colors.ink,
},


subtitle:{
marginTop:8,
color:colors.muted,
},


map:{
marginTop:20,
borderRadius:radius.lg,
overflow:"hidden",
},


addButton:{
marginTop:18,
height:52,
borderRadius:radius.pill,
backgroundColor:colors.primary,
flexDirection:"row",
alignItems:"center",
justifyContent:"center",
},


addText:{
color:"white",
fontWeight:"900",
marginLeft:8,
},


card:{
backgroundColor:"white",
padding:16,
borderRadius:radius.md,
marginTop:14,
...shadow.soft,
},


zoneName:{
fontSize:16,
fontWeight:"900",
color:colors.ink,
},


detail:{
marginTop:5,
color:colors.muted,
},


status:{
marginTop:8,
color:colors.primaryDark,
fontWeight:"800",
},


actions:{
flexDirection:"row",
gap:18,
marginTop:15,
},


action:{
color:colors.primaryDark,
fontWeight:"900",
},


delete:{
color:colors.danger,
fontWeight:"900",
},


modal:{
flex:1,
backgroundColor:"rgba(0,0,0,.4)",
justifyContent:"flex-end",
},


sheet:{
backgroundColor:"white",
padding:24,
borderTopLeftRadius:30,
borderTopRightRadius:30,
},


modalTitle:{
fontSize:22,
fontWeight:"900",
marginBottom:15,
},


input:{
height:48,
borderWidth:1,
borderColor:colors.border,
borderRadius:14,
paddingHorizontal:14,
marginBottom:12,
},


saveButton:{
height:50,
backgroundColor:colors.primary,
borderRadius:25,
alignItems:"center",
justifyContent:"center",
},


saveText:{
color:"white",
fontWeight:"900",
},


});