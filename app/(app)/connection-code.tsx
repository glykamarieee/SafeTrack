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
  generateSmartwatchPairingCode,
  type SmartwatchPairingCode,
} from "../../services/smartwatchPairingService";



const C = {

  background:"#F4F7F5",

  card:"#FFFFFF",

  ink:"#122019",

  muted:"#6E7D75",

  green:"#2F8F62",

  greenDark:"#176343",

  mint:"#E8F5EE",

  border:"#DDE7E1",

  danger:"#B84A4A",

};




export default function ConnectionCodeScreen(){

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

    if(childId){

      void generate();

    }

  },[childId]);





  return(

    <SafeAreaView
      style={styles.safe}
    >

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >



        <Pressable
          style={styles.back}
          onPress={()=>router.back()}
        >

          <Ionicons
            name="chevron-back"
            size={20}
            color={C.ink}
          />

          <Text style={styles.backText}>
            Back
          </Text>

        </Pressable>




        <View style={styles.iconCircle}>

          <Ionicons
            name="watch-outline"
            size={34}
            color={C.green}
          />

        </View>




        <Text style={styles.eyebrow}>
          CHILD DEVICE CONNECTION
        </Text>



        <Text style={styles.title}>
          Connect Child Smartwatch
        </Text>




        <Text style={styles.subtitle}>
          Enter this temporary code on the child's SafeTrack smartwatch application to connect the device.
        </Text>





        <View style={styles.card}>


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

          style={[
            styles.primary,
            loading && {
              opacity:0.6
            }
          ]}

          disabled={loading}

          onPress={generate}

        >


          <Ionicons
            name="refresh-outline"
            size={20}
            color="#FFFFFF"
          />


          <Text style={styles.primaryText}>

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

          The generated code is valid for a limited time.
          After successful connection, the smartwatch will appear as an active SafeTrack child device.

        </Text>




      </ScrollView>

    </SafeAreaView>

  );

}




const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:C.background,
},


content:{
  flexGrow:1,
  justifyContent:"center",
  padding:22,
},


back:{
  position:"absolute",
  top:20,
  left:20,
  flexDirection:"row",
  alignItems:"center",
},


backText:{
  marginLeft:5,
  fontWeight:"800",
  color:C.ink,
},


iconCircle:{
  width:72,
  height:72,
  borderRadius:36,
  backgroundColor:C.mint,
  justifyContent:"center",
  alignItems:"center",
  alignSelf:"center",
},


eyebrow:{
  marginTop:18,
  textAlign:"center",
  fontSize:10,
  fontWeight:"900",
  letterSpacing:1.5,
  color:C.green,
},


title:{
  marginTop:8,
  textAlign:"center",
  fontSize:28,
  fontWeight:"900",
  color:C.ink,
},


subtitle:{
  marginTop:10,
  textAlign:"center",
  color:C.muted,
  lineHeight:20,
},


card:{
  marginTop:25,
  backgroundColor:C.card,
  borderRadius:24,
  padding:28,
  alignItems:"center",
  borderWidth:1,
  borderColor:C.border,
},


label:{
  fontSize:10,
  fontWeight:"900",
  color:C.muted,
},


code:{
  marginTop:15,
  fontSize:36,
  fontWeight:"900",
  letterSpacing:5,
  color:C.greenDark,
},


expiry:{
  marginTop:10,
  fontSize:12,
  color:C.muted,
},


errorBox:{
  marginTop:15,
  padding:12,
  borderRadius:14,
  backgroundColor:"#FCEEEE",
  flexDirection:"row",
},


errorText:{
  marginLeft:8,
  flex:1,
  color:C.danger,
},


primary:{
  height:52,
  marginTop:20,
  borderRadius:26,
  backgroundColor:C.green,
  alignItems:"center",
  justifyContent:"center",
  flexDirection:"row",
},


primaryText:{
  marginLeft:8,
  fontWeight:"900",
  color:"#FFFFFF",
},


note:{
  marginTop:16,
  textAlign:"center",
  fontSize:11,
  lineHeight:16,
  color:C.muted,
},


});