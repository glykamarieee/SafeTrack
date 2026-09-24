import { useEffect, useRef, useState } from "react";

import {
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
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  supabase,
} from "../../lib/supabase";

import {
  generateSmartwatchPairingCode,
} from "../../services/smartwatchPairingService";

import {
  generateMobilePairingCode,
} from "../../services/mobilePairingService";


type Device = "watch" | "phone";

type PairingCode = {
  connectionCode: string;
  expiresAt: string;
};


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";




type ChildInfo = {
  id:string;
  full_name:string;
  tracking_source:
    | "mobile"
    | "smartwatch"
    | "both";
};




export default function DeviceConnectionCodeScreen(){


  const router = useRouter();


  const params =
    useLocalSearchParams<{
      childId?:string;
    }>();


  const childId =
    String(
      params.childId ?? ""
    ).trim();




  const [
    child,
    setChild
  ] =
  useState<ChildInfo|null>(null);



  // Chosen from the child's tracking source once loaded.
  const [
    device,
    setDevice
  ] =
  useState<Device|null>(null);



  const [
    result,
    setResult
  ] =
  useState<PairingCode|null>(null);



  // A new code replaces the previous one on the server, so
  // overlapping requests could leave a stale code on screen.
  const generating =
    useRef(false);



  const [
    loading,
    setLoading
  ] =
  useState(false);



  const [
    error,
    setError
  ] =
  useState<string|null>(null);





  async function loadChild(){


    setChild(null);

    setDevice(null);

    setResult(null);

    setError(null);


    if(!childId){

      setError(
        "Child profile is missing."
      );

      return;

    }


    const {
      data,
      error
    } =
    await supabase
      .from("children")
      .select(
        `
        id,
        full_name,
        tracking_source
        `
      )
      .eq(
        "id",
        childId
      )
      .maybeSingle();



    if(error || !data){

      setError(
        error?.message ??
        "Child profile not found."
      );

      return;

    }


    const loaded =
      data as ChildInfo;


    setChild(loaded);


    // Phone-only children link a phone; everyone else starts
    // with the watch (Both can switch below).
    setDevice(
      loaded.tracking_source === "mobile"
      ?
      "phone"
      :
      "watch"
    );

  }





  async function generate(){


    if(!childId || !device || generating.current){

      return;

    }



    try{


      generating.current = true;

      setLoading(true);

      setError(null);

      // Never leave a previous code next to a new error.
      setResult(null);



      const response =
        device === "phone"
        ?
        await generateMobilePairingCode({
          childId,
        })
        :
        await generateSmartwatchPairingCode({
          childId,
        });



      setResult(response);



    }
    catch(error){


      setError(
        error instanceof Error
        ?
        error.message
        :
        "Unable to generate connection code."
      );


    }
    finally{


      generating.current = false;

      setLoading(false);


    }

  }





  useEffect(()=>{

    void loadChild();

  },[childId]);



  useEffect(()=>{

    void generate();

  },[childId, device]);



  const isPhone =
    device === "phone";






  return(

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





        <View style={styles.iconBox}>

          <Ionicons

            name={isPhone ? "phone-portrait-outline" : "watch-outline"}

            size={34}

            color={colors.primary}

          />

        </View>





        <Text style={styles.eyebrow}>
          CHILD DEVICE CONNECTION
        </Text>




        <Text style={styles.title}>
          Generate Connection Code
        </Text>




        <Text style={styles.subtitle}>

          {
            isPhone
            ?
            "Create a temporary code for your child's phone."
            :
            "Create a temporary code for your child's SafeTrack smartwatch."
          }

        </Text>




        {
          child?.tracking_source === "both" &&

          <View style={styles.devices}>

            {
              (["watch", "phone"] as const).map(option => (

                <Pressable

                  key={option}

                  disabled={loading}

                  onPress={() => setDevice(option)}

                  style={[
                    styles.deviceOption,
                    device === option && styles.deviceOptionSelected,
                  ]}

                >

                  <Ionicons
                    name={option === "phone" ? "phone-portrait-outline" : "watch-outline"}
                    size={18}
                    color={device === option ? colors.primaryDark : colors.muted}
                  />

                  <Text
                    style={[
                      styles.deviceOptionText,
                      device === option && styles.deviceOptionTextSelected,
                    ]}
                  >
                    {option === "phone" ? "Phone" : "Smartwatch"}
                  </Text>

                </Pressable>

              ))
            }

          </View>

        }






        {
          child &&

          <View style={styles.childCard}>


            <Text style={styles.label}>
              CHILD
            </Text>


            <Text style={styles.childName}>
              {child.full_name}
            </Text>


            <Text style={styles.source}>

              Tracking Source:
              {" "}

              {
                child.tracking_source === "both"
                ?
                "Smartwatch + Mobile"
                :
                child.tracking_source === "smartwatch"
                ?
                "Smartwatch"
                :
                "Mobile"
              }

            </Text>


          </View>

        }







        <View style={styles.codeCard}>


          <Text style={styles.label}>
            CONNECTION CODE
          </Text>



          <Text style={styles.code}>

            {
              result?.connectionCode ??
              (
                loading
                ?
                "••••••••"
                :
                "--------"
              )
            }

          </Text>




          {
            result?.expiresAt &&

            <Text style={styles.expiry}>

              Expires:

              {" "}

              {
                new Date(
                  result.expiresAt
                )
                .toLocaleTimeString(
                  [],
                  {
                    hour:"numeric",
                    minute:"2-digit",
                  }
                )
              }


            </Text>

          }


        </View>





        {
          error &&

          <View style={styles.error}>


            <Ionicons

              name="alert-circle-outline"

              size={20}

              color={colors.danger}

            />


            <Text style={styles.errorText}>
              {error}
            </Text>


          </View>

        }







        <Pressable

          disabled={loading || !device}

          onPress={() => void generate()}

          style={[
            styles.button,
            loading &&
            {
              opacity:.6
            }
          ]}

        >


          <Ionicons

            name="refresh-outline"

            size={20}

            color={colors.white}

          />


          <Text style={styles.buttonText}>

            {
              loading
              ?
              "Generating..."
              :
              "Generate New Code"
            }

          </Text>


        </Pressable>







        <Text style={styles.note}>

          {
            isPhone
            ?
            "On the child's phone, open SafeTrack, tap \"Using a child's phone? Link child device\" on the login screen, and enter this code within 10 minutes."
            :
            "Enter this code on the SafeTrack smartwatch application within 10 minutes. After successful pairing, the device will appear as connected."
          }

        </Text>




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
  flexGrow:1,
  padding:spacing.lg,
  paddingTop:40,
},


back:{
  flexDirection:"row",
  alignItems:"center",
  marginBottom:25,
},


backText:{
  marginLeft:5,
  color:colors.ink,
  fontWeight:"800",
},


iconBox:{
  width:72,
  height:72,
  borderRadius:36,
  backgroundColor:colors.softMint,
  justifyContent:"center",
  alignItems:"center",
  alignSelf:"center",
},


eyebrow:{
  textAlign:"center",
  marginTop:18,
  fontSize:10,
  fontWeight:"900",
  letterSpacing:1.4,
  color:colors.primary,
},


title:{
  marginTop:8,
  textAlign:"center",
  fontSize:28,
  fontWeight:"900",
  color:colors.ink,
},


subtitle:{
  marginTop:8,
  textAlign:"center",
  color:colors.muted,
  lineHeight:20,
},


childCard:{
  marginTop:25,
  padding:18,
  backgroundColor:colors.white,
  borderRadius:radius.lg,
  ...shadow.soft,
},


label:{
  fontSize:10,
  fontWeight:"900",
  color:colors.muted,
},


childName:{
  marginTop:8,
  fontSize:20,
  fontWeight:"900",
  color:colors.ink,
},


source:{
  marginTop:5,
  color:colors.muted,
},


devices:{
  marginTop:20,
  padding:4,
  flexDirection:"row",
  borderRadius:radius.md,
  backgroundColor:colors.surfaceMuted,
},


deviceOption:{
  flex:1,
  minHeight:44,
  flexDirection:"row",
  alignItems:"center",
  justifyContent:"center",
},


deviceOptionSelected:{
  backgroundColor:colors.white,
  borderRadius:radius.sm,
  ...shadow.soft,
},


deviceOptionText:{
  marginLeft:6,
  color:colors.muted,
  fontWeight:"800",
},


deviceOptionTextSelected:{
  color:colors.primaryDark,
},


codeCard:{
  marginTop:16,
  backgroundColor:colors.white,
  borderRadius:radius.lg,
  padding:28,
  alignItems:"center",
  ...shadow.soft,
},


code:{
  marginTop:15,
  fontSize:36,
  fontWeight:"900",
  letterSpacing:5,
  color:colors.primaryDark,
},


expiry:{
  marginTop:10,
  color:colors.muted,
},


error:{
  marginTop:15,
  padding:12,
  borderRadius:radius.md,
  backgroundColor:"#FCEEEE",
  flexDirection:"row",
},


errorText:{
  marginLeft:8,
  flex:1,
  color:colors.danger,
},


button:{
  marginTop:20,
  height:52,
  borderRadius:radius.pill,
  backgroundColor:colors.primary,
  alignItems:"center",
  justifyContent:"center",
  flexDirection:"row",
},


buttonText:{
  marginLeft:8,
  color:colors.white,
  fontWeight:"900",
},


note:{
  marginTop:18,
  textAlign:"center",
  color:colors.muted,
  fontSize:12,
  lineHeight:18,
},


});