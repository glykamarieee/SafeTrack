import {
  useCallback,
  useEffect,
  useRef,
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



const COUNTDOWN_SECONDS = 5;

const REALERT_INTERVAL_MS = 60_000;



function formatTime(
  value?:string|null
){

  if(!value){

    return "just now";

  }


  const date =
    new Date(value);



  if(
    Number.isNaN(
      date.getTime()
    )
  ){

    return "just now";

  }


  return date.toLocaleString(
    "en-PH",
    {
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit",
    }
  );

}







export default function ChildSosScreen(){


  const activeSos =
    useChildMobileStore(
      state=>state.activeSos
    );



  const isLoading =
    useChildMobileStore(
      state=>state.isLoading
    );



  const triggerSos =
    useChildMobileStore(
      state=>state.triggerSos
    );



  const refreshActiveSos =
    useChildMobileStore(
      state=>state.refreshActiveSos
    );



  const recordRealert =
    useChildMobileStore(
      state=>state.recordRealert
    );




  const [
    countdown,
    setCountdown
  ] =
  useState<number|null>(null);



  const [
    sending,
    setSending
  ] =
  useState(false);



  const countdownRef =
    useRef<number|null>(null);






  useEffect(()=>{

    countdownRef.current =
      countdown;

  },[countdown]);







  const cancelCountdown =
    useCallback(
      (
        showAlert=true
      )=>{


        if(
          countdownRef.current===null
          ||
          sending
        ){

          return;

        }



        setCountdown(null);



        if(showAlert){

          Alert.alert(
            "SOS Cancelled",
            "The SOS request was cancelled."
          );

        }


      },
      [
        sending
      ]
    );








  const sendSos =
    useCallback(
      async()=>{


        if(sending){

          return;

        }



        try{


          setSending(true);



          await triggerSos();



          Alert.alert(
            "SOS Sent",
            "Your Guardian has received the emergency alert."
          );



        }
        catch(error){


          Alert.alert(
            "SOS Failed",
            error instanceof Error
            ?
            error.message
            :
            "Unable to send SOS."
          );


        }
        finally{


          setSending(false);


        }



      },
      [
        sending,
        triggerSos
      ]
    );









  useEffect(()=>{


    if(countdown===null){

      return;

    }



    const timer =
      setTimeout(()=>{


        if(countdown<=1){


          setCountdown(null);


          void sendSos();


          return;

        }



        setCountdown(
          countdown-1
        );



      },1000);



    return ()=>clearTimeout(timer);



  },[
    countdown,
    sendSos
  ]);










  useEffect(()=>{


    void refreshActiveSos();



    const timer =
      setInterval(()=>{

        void refreshActiveSos();

      },15000);



    return ()=>clearInterval(timer);



  },[
    refreshActiveSos
  ]);









  useEffect(()=>{


    if(
      !activeSos
      ||
      activeSos.status!=="active"
    ){

      return;

    }





    const timer =
      setInterval(()=>{


        void recordRealert(
          activeSos.id
        );



      },REALERT_INTERVAL_MS);





    return ()=>clearInterval(timer);



  },[
    activeSos,
    recordRealert
  ]);










  const beginCountdown = ()=>{


    if(

      activeSos?.status==="active"
      ||
      sending
      ||
      isLoading
      ||
      countdownRef.current!==null

    ){

      return;

    }



    setCountdown(
      COUNTDOWN_SECONDS
    );

  };








  const sosActive =
    activeSos?.status==="active";







  return (

    <SafeAreaView
      style={styles.safe}
    >


      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >


        <Text style={styles.eyebrow}>
          EMERGENCY ALERT
        </Text>



        <Text style={styles.title}>
          SOS Help
        </Text>



        <Text style={styles.subtitle}>
          Press and hold the SOS button to notify your Guardian.
        </Text>






        {
          sosActive ?

          <View style={styles.card}>


            <Ionicons
              name="warning-outline"
              size={50}
              color={colors.danger}
            />


            <Text style={styles.activeTitle}>
              SOS Active
            </Text>


            <Text style={styles.text}>
              Guardian notification is active.
            </Text>



            <Text style={styles.text}>
              Sent {formatTime(activeSos?.triggeredAt)}
            </Text>



            <Text style={styles.text}>
              Re-alert count: {activeSos?.realertCount ?? 0}
            </Text>


          </View>


          :


          <View style={styles.card}>


            <Ionicons
              name="warning-outline"
              size={60}
              color={colors.danger}
            />



            <Text style={styles.activeTitle}>
              {
                countdown!==null
                ?
                `Sending in ${countdown}`
                :
                "Press and Hold SOS"
              }
            </Text>




            <Pressable

              onPressIn={beginCountdown}

              onPressOut={()=>{
                if(countdownRef.current!==null){
                  cancelCountdown(false);
                }
              }}

              style={styles.button}

            >


              {
                sending ?

                <ActivityIndicator
                  color={colors.white}
                />

                :

                <Ionicons
                  name="hand-left-outline"
                  size={25}
                  color={colors.white}
                />

              }


              <Text style={styles.buttonText}>
                {
                  sending
                  ?
                  "Sending..."
                  :
                  "Hold SOS"
                }
              </Text>


            </Pressable>





            {
              countdown!==null &&

              <Pressable
                onPress={()=>
                  cancelCountdown(true)
                }

                style={styles.cancel}
              >

                <Text style={styles.cancelText}>
                  Cancel SOS
                </Text>

              </Pressable>

            }



          </View>

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


content:{
  padding:spacing.lg,
},


eyebrow:{
  color:colors.danger,
  fontWeight:"900",
  fontSize:11,
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
},


card:{
  marginTop:25,
  backgroundColor:colors.white,
  borderRadius:radius.lg,
  padding:25,
  alignItems:"center",
  ...shadow.card,
},


activeTitle:{
  marginTop:15,
  fontSize:20,
  fontWeight:"900",
  color:colors.danger,
},


text:{
  marginTop:8,
  color:colors.muted,
  textAlign:"center",
},


button:{
  marginTop:25,
  width:"100%",
  height:55,
  borderRadius:radius.pill,
  backgroundColor:colors.danger,
  alignItems:"center",
  justifyContent:"center",
  flexDirection:"row",
},


buttonText:{
  color:colors.white,
  fontWeight:"900",
  marginLeft:8,
},


cancel:{
  marginTop:15,
  padding:14,
},


cancelText:{
  color:colors.danger,
  fontWeight:"900",
},

});