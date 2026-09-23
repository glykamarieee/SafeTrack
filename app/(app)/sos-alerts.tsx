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
  SafeTrackBackButton,
} from "../../components/common/SafeTrackBackButton";


import {
  SafeTrackButton,
} from "../../components/common/SafeTrackButton";


import {
  useAuthStore,
} from "../../store/authStore";


import {
  supabase,
} from "../../lib/supabase";


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";



type AlertStatus =
  | "active"
  | "acknowledged"
  | "resolved"
  | string;



type AlertRow = {

  id:string;

  activation_method:string;

  status:AlertStatus;

  latitude:number|null;

  longitude:number|null;

  triggered_at:string;

  acknowledged_at:string|null;

  is_test:boolean;

};





function displayTime(
  value:string
){

  return new Date(
    value
  ).toLocaleString(
    "en-PH",
    {
      timeZone:"Asia/Manila",
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit",
    }
  );

}





function formatMethod(
  value:string
){

  if(value==="app_test"){

    return "System test";

  }


  return value
    .replaceAll("_"," ")
    .replace(
      /\b\w/g,
      letter=>letter.toUpperCase()
    );

}








export default function SosAlertsScreen(){


  const router =
    useRouter();



  const guardian =
    useAuthStore(
      state=>state.guardian
    );


  const child =
    useAuthStore(
      state=>state.linkedChildren[0]
    );

  const trackingSource =
    child?.trackingSource ?? "smartwatch";



  const [
    alerts,
    setAlerts
  ] =
  useState<AlertRow[]>([]);



  const [
    loading,
    setLoading
  ] =
  useState(true);



  const [
    acknowledging,
    setAcknowledging
  ] =
  useState<string|null>(null);







  const loadAlerts =
  useCallback(
    async()=>{


      if(
        !guardian?.id ||
        !child?.id
      ){

        setAlerts([]);

        setLoading(false);

        return;

      }



      try{


        setLoading(true);



        const {
          data,
          error
        } = await supabase

        .from("sos_alerts")

        .select(
          `
          id,
          activation_method,
          status,
          latitude,
          longitude,
          triggered_at,
          acknowledged_at,
          is_test
          `
        )

        .eq(
          "guardian_id",
          guardian.id
        )

        .eq(
          "child_id",
          child.id
        )

        .order(
          "triggered_at",
          {
            ascending:false
          }
        );



        if(error){

          throw error;

        }



        setAlerts(

          (data ?? [])
          .map(
            row=>({

              ...row,

              latitude:
              row.latitude === null
              ?
              null
              :
              Number(row.latitude),


              longitude:
              row.longitude === null
              ?
              null
              :
              Number(row.longitude),

            })
          )

        );



      }

      catch(error){


        Alert.alert(
          "Unable to load SOS alerts",
          error instanceof Error
          ?
          error.message
          :
          "Please try again."
        );


      }

      finally{


        setLoading(false);


      }


    },
    [
      guardian?.id,
      child?.id
    ]
  );







  useEffect(()=>{

    void loadAlerts();

  },[loadAlerts]);









  const acknowledge =
  async(
    alert:AlertRow
  )=>{


    try{


      setAcknowledging(
        alert.id
      );



      const {
        data,
        error
      } =
      await supabase.rpc(
        "acknowledge_my_sos_alert",
        {
          p_alert_id:
          alert.id
        }
      );



      if(error){

        throw error;

      }



      const response =
      data as
      {
        ok?:boolean;
        message?:string;
      }
      |
      null;



      if(
        response?.ok===false
      ){

        throw new Error(
          response.message ||
          "Unable to acknowledge alert."
        );

      }



      await loadAlerts();



      Alert.alert(
        "SOS acknowledged",
        response?.message ||
        "SOS alert acknowledged successfully."
      );



    }

    catch(error){


      Alert.alert(
        "Unable to acknowledge SOS",
        error instanceof Error
        ?
        error.message
        :
        "Please try again."
      );


    }

    finally{


      setAcknowledging(
        null
      );


    }


  };







  const activeCount =
    alerts.filter(
      item=>
      item.status==="active"
    ).length;








  return (

    <SafeAreaView
      style={styles.safe}
      edges={[
        "top",
        "left",
        "right"
      ]}
    >


      <ScrollView
        style={styles.flex}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
      >



        <View style={styles.header}>


          <SafeTrackBackButton/>


          <View style={styles.headerCopy}>


            <Text style={styles.heading}>
              SOS Alerts
            </Text>


            <Text style={styles.subtitle}>
              Child emergency alerts requiring guardian review.
              {trackingSource === "mobile"
                ? " Alerts are received from the child's mobile device."
                : trackingSource === "both"
                ? " Alerts may be received from smartwatch and mobile sources."
                : " Alerts are received from the child's smartwatch."}
            </Text>


          </View>


        </View>





        <View style={styles.notice}>


          <Ionicons
            name="warning-outline"
            size={22}
            color={colors.danger}
          />


          <Text style={styles.noticeText}>

            {
              activeCount > 0
              ?
              `${activeCount} active SOS alert${activeCount>1?"s":""} needs acknowledgment.`
              :
              "No active SOS alert currently needs acknowledgment."
            }

          </Text>


        </View>





        {
          loading
          ?

          <View style={styles.loading}>

            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

          </View>


          :

          alerts.length===0

          ?

          <View style={styles.empty}>


            <Ionicons
              name="shield-checkmark-outline"
              size={35}
              color={colors.primary}
            />


            <Text style={styles.emptyTitle}>
              No SOS Alerts
            </Text>


            <Text style={styles.emptyText}>
              No confirmed SOS record has been received.
            </Text>


          </View>



          :


          alerts.map(
            alert=>{


              const active =
                alert.status==="active";


              return (

                <View
                  key={alert.id}
                  style={styles.card}
                >


                  <View style={styles.row}>


                    <Ionicons
                      name={
                        active
                        ?
                        "warning-outline"
                        :
                        "checkmark-circle-outline"
                      }
                      size={25}
                      color={
                        active
                        ?
                        colors.danger
                        :
                        colors.primary
                      }
                    />


                    <View style={styles.copy}>


                      <Text style={styles.title}>
                        {
                          alert.is_test
                          ?
                          "Test SOS Alert"
                          :
                          "SOS Alert"
                        }
                      </Text>


                      <Text style={styles.time}>
                        {
                          displayTime(
                            alert.triggered_at
                          )
                        }
                      </Text>


                    </View>


                  </View>




                  <Text style={styles.detail}>

                    Location ({trackingSource === "mobile"
                      ? "Mobile"
                      : trackingSource === "both"
                      ? "Smartwatch + Mobile"
                      : "Smartwatch"}):
                    {
                      alert.latitude!==null &&
                      alert.longitude!==null
                      ?
                      ` ${alert.latitude.toFixed(5)}, ${alert.longitude.toFixed(5)}`
                      :
                      " unavailable"
                    }

                  </Text>




                  <Text style={styles.method}>
                    {formatMethod(alert.activation_method)}
                  </Text>




                  {
                    active
                    ?

                    <SafeTrackButton
                      label="Acknowledge SOS"
                      icon="checkmark-circle-outline"
                      loading={
                        acknowledging===alert.id
                      }
                      onPress={()=>
                        void acknowledge(alert)
                      }
                    />

                    :

                    <Text style={styles.done}>
                      SOS acknowledged
                    </Text>

                  }


                </View>

              );


            }
          )

        }




        <Pressable
          onPress={()=>
            router.push("/safety-center")
          }
          style={styles.returnButton}
        >

          <Text style={styles.returnText}>
            Return to Safety Center
          </Text>


          <Ionicons
            name="arrow-forward"
            size={17}
            color={colors.primaryDark}
          />

        </Pressable>



      </ScrollView>


    </SafeAreaView>

  );

}






const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:colors.background,
},

flex:{
  flex:1,
},

content:{
  padding:spacing.lg,
  paddingBottom:40,
},


header:{
  flexDirection:"row",
  alignItems:"center",
},

headerCopy:{
  marginLeft:14,
},


heading:{
  fontSize:28,
  fontWeight:"900",
  color:colors.ink,
},


subtitle:{
  marginTop:4,
  color:colors.muted,
},


notice:{
  flexDirection:"row",
  alignItems:"center",
  marginTop:20,
  padding:14,
  borderRadius:radius.md,
  backgroundColor:"#FFF5F5",
},


noticeText:{
  flex:1,
  marginLeft:10,
  color:colors.muted,
},


loading:{
  padding:40,
  alignItems:"center",
},


card:{
  backgroundColor:colors.white,
  padding:16,
  borderRadius:radius.md,
  marginTop:14,
},


row:{
  flexDirection:"row",
  alignItems:"center",
},


copy:{
  marginLeft:10,
},


title:{
  fontWeight:"900",
  color:colors.ink,
},


time:{
  color:colors.muted,
  marginTop:3,
},


detail:{
  marginTop:14,
  color:colors.muted,
},


method:{
  marginTop:8,
  color:colors.primaryDark,
  fontWeight:"800",
},


done:{
  marginTop:15,
  color:colors.primaryDark,
  fontWeight:"900",
},


empty:{
  alignItems:"center",
  padding:40,
},


emptyTitle:{
  marginTop:10,
  fontSize:17,
  fontWeight:"900",
},


emptyText:{
  marginTop:5,
  color:colors.muted,
  textAlign:"center",
},


returnButton:{
  flexDirection:"row",
  alignItems:"center",
  justifyContent:"center",
  marginTop:20,
},


returnText:{
  marginRight:5,
  color:colors.primaryDark,
  fontWeight:"900",
},


});