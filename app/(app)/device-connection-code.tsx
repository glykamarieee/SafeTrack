import { useEffect, useState } from "react";

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
  type SmartwatchPairingCode,
} from "../../services/smartwatchPairingService";


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



  const [
    result,
    setResult
  ] =
  useState<SmartwatchPairingCode|null>(null);



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


    if(!childId){
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
      .single();



    if(!error){

      setChild(
        data as ChildInfo
      );

    }

  }





  async function generate(){


    if(!childId){

      setError(
        "Child profile is missing."
      );

      return;

    }



    try{


      setLoading(true);

      setError(null);



      const response =
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


      setLoading(false);


    }

  }





  useEffect(()=>{

    void loadChild();

    void generate();

  },[childId]);






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

            name="watch-outline"

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

          Create a temporary code for your
          child's SafeTrack smartwatch.

        </Text>






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

          disabled={loading}

          onPress={generate}

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

          Enter this code on the SafeTrack
          smartwatch application.
          After successful pairing, the device
          will appear as connected.

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