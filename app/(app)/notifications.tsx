import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  useRouter,
} from "expo-router";

import {
  useAuthStore,
} from "../../store/authStore";

import {
  useSosStore,
} from "../../store/sosStore";


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";



type NotificationItem = {

  id:string;

  title:string;

  message:string;

  icon:keyof typeof Ionicons.glyphMap;

  time:string;

};





export default function NotificationsScreen(){


  const router = useRouter();


  const child =
    useAuthStore(
      state=>state.linkedChildren?.[0] ?? null
    );


  const sosAlerts =
    useSosStore(
      state=>state.alerts
    );



  const trackingSource =
    child?.trackingSource ?? "mobile";




  const notifications:NotificationItem[] = [];




  /*
    SMARTWATCH ONLY
  */

  if(
    trackingSource==="smartwatch" ||
    trackingSource==="both"
  ){

    notifications.push({

      id:"watch",

      title:"Smartwatch Monitoring",

      message:
        "Registered smartwatch monitoring is active for this child.",

      icon:"watch-outline",

      time:"Available",

    });


  }




  /*
    MOBILE ONLY
  */

  if(
    trackingSource==="mobile" ||
    trackingSource==="both"
  ){

    notifications.push({

      id:"mobile",

      title:"Mobile Location Monitoring",

      message:
        "Child mobile device location tracking is enabled.",

      icon:"phone-portrait-outline",

      time:"Available",

    });

  }





  /*
    SOS
  */

  const activeSOS =
    sosAlerts.filter(
      item=>item.status==="active"
    ).length;



  notifications.push({

    id:"sos",

    title:
      activeSOS>0
      ?
      "Active SOS Alert"
      :
      "SOS Monitoring Ready",


    message:
      activeSOS>0
      ?
      `${activeSOS} SOS alert requires guardian attention.`
      :
      "Emergency alert monitoring is active.",


    icon:
      activeSOS>0
      ?
      "warning-outline"
      :
      "shield-checkmark-outline",


    time:"Current",

  });






  /*
    SAFE ZONE
  */

  notifications.push({

    id:"safezone",

    title:"Safe Zone Monitoring",

    message:
      "Guardian-defined safe zone monitoring is enabled.",

    icon:"location-outline",

    time:"Current",

  });







  return (

    <SafeAreaView
      style={styles.safe}
    >


      <ScrollView

        contentContainerStyle={
          styles.container
        }

        showsVerticalScrollIndicator={false}

      >



        <Pressable

          style={styles.back}

          onPress={()=>
            router.back()
          }

        >

          <Ionicons

            name="chevron-back"

            size={20}

            color={colors.ink}

          />


          <Text style={styles.backText}>
            Back
          </Text>


        </Pressable>





        <Text style={styles.eyebrow}>
          SAFETRACK
        </Text>


        <Text style={styles.title}>
          Notifications
        </Text>


        <Text style={styles.subtitle}>

          Safety updates based on the
          registered child tracking source.

        </Text>






        {
          notifications.map(

            item=>(

              <View

                key={item.id}

                style={styles.card}

              >



                <View style={styles.iconBox}>


                  <Ionicons

                    name={item.icon}

                    size={23}

                    color={colors.primary}

                  />


                </View>




                <View style={styles.content}>


                  <View style={styles.row}>


                    <Text style={styles.itemTitle}>
                      {item.title}
                    </Text>


                    <Text style={styles.time}>
                      {item.time}
                    </Text>


                  </View>



                  <Text style={styles.message}>

                    {item.message}

                  </Text>


                </View>



              </View>


            )

          )
        }





      </ScrollView>


    </SafeAreaView>

  );

}





const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:colors.background,
},


container:{
  padding:spacing.lg,
  paddingBottom:100,
},


back:{
  flexDirection:"row",
  alignItems:"center",
  marginBottom:25,
},


backText:{
  marginLeft:5,
  fontWeight:"800",
  color:colors.ink,
},


eyebrow:{
  fontSize:10,
  fontWeight:"900",
  letterSpacing:1.3,
  color:colors.primary,
},


title:{
  marginTop:5,
  fontSize:30,
  fontWeight:"900",
  color:colors.ink,
},


subtitle:{
  marginTop:8,
  color:colors.muted,
  lineHeight:20,
},


card:{
  flexDirection:"row",
  backgroundColor:colors.white,
  padding:16,
  borderRadius:radius.md,
  marginTop:16,
  ...shadow.soft,
},


iconBox:{
  width:45,
  height:45,
  borderRadius:22,
  backgroundColor:colors.softMint,
  justifyContent:"center",
  alignItems:"center",
},


content:{
  flex:1,
  marginLeft:12,
},


row:{
  flexDirection:"row",
  justifyContent:"space-between",
},


itemTitle:{
  flex:1,
  fontSize:14,
  fontWeight:"900",
  color:colors.ink,
},


time:{
  fontSize:10,
  color:colors.muted,
},


message:{
  marginTop:6,
  color:colors.muted,
  fontSize:12,
  lineHeight:17,
},


});