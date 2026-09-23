import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";


import {
  useChildMobileStore,
} from "../../store/childMobileStore";


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";




function sourceLabel(source:string){

  const normalized =
    source.trim().toLowerCase();



  if(normalized==="both"){

    return "Smartwatch and child phone";

  }



  if(normalized==="mobile"){

    return "Child phone";

  }



  return "Smartwatch";

}






export default function ChildProfileScreen(){


  const router =
    useRouter();



  const context =
    useChildMobileStore(
      state=>state.context
    );



  const disconnect =
    useChildMobileStore(
      state=>state.disconnect
    );



  const isLoading =
    useChildMobileStore(
      state=>state.isLoading
    );





  if(!context){

    return null;

  }





  const removeLink = ()=>{


    Alert.alert(

      "Disconnect child phone?",


      "This removes Child Dashboard access from this phone. The Guardian must generate a new temporary code before this phone can connect again.",


      [

        {
          text:"Cancel",
          style:"cancel",
        },


        {

          text:"Disconnect",

          style:"destructive",


          onPress:async()=>{


            try{


              await disconnect(
                context.deviceId ?? undefined
              );


              router.replace(
                "/(auth)/child-device-link" as never
              );


            }
            catch(error){


              Alert.alert(

                "Unable to disconnect child phone",

                error instanceof Error
                ?
                error.message
                :
                "SafeTrack could not disconnect this child phone."

              );


            }


          },


        },


      ]


    );


  };







  return (

    <SafeAreaView
      style={styles.safe}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >


      <ScrollView

        contentContainerStyle={
          styles.content
        }

        showsVerticalScrollIndicator={false}

      >



        <Text style={styles.eyebrow}>
          CHILD PROFILE
        </Text>



        <Text style={styles.title}>
          My SafeTrack profile
        </Text>



        <Text style={styles.subtitle}>
          Basic child device and linked Guardian information.
        </Text>






        <View style={styles.profileCard}>


          <View style={styles.avatar}>


            <Text style={styles.avatarText}>

              {
                context.childName
                .charAt(0)
                .toUpperCase()
              }

            </Text>


          </View>




          <Text style={styles.name}>
            {context.childName}
          </Text>




          <View style={styles.linkedPill}>


            <Ionicons

              name="shield-checkmark-outline"

              size={16}

              color={colors.primaryDark}

            />


            <Text style={styles.linkedText}>
              LINKED CHILD PHONE
            </Text>


          </View>



        </View>







        <Text style={styles.sectionTitle}>
          LINKED GUARDIAN
        </Text>



        <View style={styles.card}>


          <Info

            icon="people-outline"

            label="Guardian name"

            value={
              context.guardianName ??
              "Not available"
            }

          />



          <View style={styles.divider}/>



          <Info

            icon="mail-outline"

            label="Guardian email"

            value={
              context.guardianEmail ??
              "Not available"
            }

          />


        </View>








        <Text style={styles.sectionTitle}>
          REGISTERED DEVICE
        </Text>



        <View style={styles.card}>


          <Info

            icon="phone-portrait-outline"

            label="Tracking source"

            value={
              sourceLabel(
                context.trackingSource
              )
            }

          />



          <View style={styles.divider}/>



          <Info

            icon="shield-checkmark-outline"

            label="Child phone status"

            value={
              context.mobileDeviceActive
              ?
              "Active and linked"
              :
              "Inactive"
            }

          />



        </View>







        <View style={styles.note}>


          <Ionicons

            name="lock-closed-outline"

            size={19}

            color={colors.primary}

          />


          <Text style={styles.noteText}>

            Child access is limited to location updates, safe-zone status, and SOS. Guardian settings, reports, and historical records cannot be edited here.

          </Text>


        </View>








        <Pressable

          onPress={removeLink}

          disabled={isLoading}


          style={({pressed})=>[

            styles.disconnectButton,

            pressed &&
            styles.pressed,


            isLoading &&
            styles.disabled,

          ]}


        >


          <Ionicons

            name="log-out-outline"

            size={21}

            color={colors.danger}

          />


          <Text style={styles.disconnectText}>
            Disconnect child phone
          </Text>


        </Pressable>





      </ScrollView>


    </SafeAreaView>


  );

}







function Info({

  icon,

  label,

  value,

}:{

  icon:keyof typeof Ionicons.glyphMap;

  label:string;

  value:string;

}){


  return (

    <View style={styles.info}>


      <Ionicons

        name={icon}

        size={20}

        color={colors.primary}

      />



      <View style={styles.infoCopy}>


        <Text style={styles.infoLabel}>
          {label}
        </Text>


        <Text style={styles.infoValue}>
          {value}
        </Text>


      </View>


    </View>

  );


}







const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:colors.background,
},


content:{
  padding:spacing.lg,
  paddingTop:40,
  paddingBottom:115,
},


eyebrow:{
  color:colors.primary,
  fontSize:10,
  fontWeight:"900",
  letterSpacing:1.3,
},


title:{
  color:colors.ink,
  fontSize:30,
  fontWeight:"900",
  marginTop:5,
},


subtitle:{
  color:colors.muted,
  fontSize:13,
  marginTop:6,
},


profileCard:{
  alignItems:"center",
  padding:24,
  borderRadius:radius.lg,
  backgroundColor:colors.white,
  marginTop:23,
  ...shadow.card,
},


avatar:{
  width:78,
  height:78,
  borderRadius:26,
  alignItems:"center",
  justifyContent:"center",
  backgroundColor:colors.primary,
},


avatarText:{
  color:colors.white,
  fontSize:31,
  fontWeight:"900",
},


name:{
  color:colors.ink,
  fontSize:21,
  fontWeight:"900",
  marginTop:13,
},


linkedPill:{
  flexDirection:"row",
  alignItems:"center",
  paddingHorizontal:11,
  paddingVertical:8,
  borderRadius:radius.pill,
  backgroundColor:colors.softMint,
  marginTop:9,
},


linkedText:{
  color:colors.primaryDark,
  fontSize:9,
  fontWeight:"900",
  marginLeft:5,
},


sectionTitle:{
  color:colors.muted,
  fontSize:10,
  fontWeight:"900",
  marginTop:22,
  marginBottom:9,
},


card:{
  padding:16,
  borderRadius:radius.md,
  backgroundColor:colors.white,
  ...shadow.soft,
},


info:{
  flexDirection:"row",
},


infoCopy:{
  flex:1,
  marginLeft:9,
},


infoLabel:{
  color:colors.muted,
  fontSize:10,
  fontWeight:"800",
},


infoValue:{
  color:colors.ink,
  fontSize:12.5,
  fontWeight:"800",
  marginTop:2,
},


divider:{
  height:1,
  backgroundColor:colors.border,
  marginVertical:14,
},


note:{
  flexDirection:"row",
  padding:15,
  borderRadius:radius.md,
  backgroundColor:colors.softMint,
  marginTop:17,
},


noteText:{
  flex:1,
  color:colors.primaryDark,
  fontSize:11,
  lineHeight:16,
  marginLeft:8,
},


disconnectButton:{
  height:54,
  flexDirection:"row",
  justifyContent:"center",
  alignItems:"center",
  borderRadius:radius.pill,
  backgroundColor:colors.dangerSoft,
  marginTop:18,
},


disconnectText:{
  color:colors.danger,
  fontWeight:"900",
  marginLeft:8,
},


pressed:{
  opacity:0.8,
},


disabled:{
  opacity:0.58,
},


});