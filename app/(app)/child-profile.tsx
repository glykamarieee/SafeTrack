// C:\SAFETRACK-FINAL\safe-track\app\(app)\child-profile.tsx

import { useState } from "react";

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  Ionicons,
} from "@expo/vector-icons";

import {
  useRouter,
} from "expo-router";


import {
  completeChildRegistration,
  type TrackingSource,
} from "../../services/childOnboardingService";



const COLORS = {

  background:"#F4F7F5",

  card:"#FFFFFF",

  text:"#122019",

  muted:"#6E7D75",

  green:"#2F8F62",

  greenDark:"#176343",

  mint:"#E8F5EE",

  border:"#DDE7E1",

};



const RELATIONSHIPS = [

  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Other",

];



const TRACKING_OPTIONS = [

  {
    value:"smartwatch" as TrackingSource,
    title:"Smartwatch",
    subtitle:
      "Samsung Galaxy Watch8 LTE as primary child device",
    icon:"watch-outline" as const,
  },


  {
    value:"mobile" as TrackingSource,
    title:"Mobile Phone",
    subtitle:
      "Child mobile device provides location updates",
    icon:"phone-portrait-outline" as const,
  },


  {
    value:"both" as TrackingSource,
    title:"Smartwatch + Mobile",
    subtitle:
      "Uses both devices for additional coverage",
    icon:"layers-outline" as const,
  },

];





export default function ChildProfileScreen(){


  const router =
    useRouter();



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





  async function handleSubmit(){


    const childAge =
      Number(age);



    if(!fullName.trim()){

      Alert.alert(
        "Missing Information",
        "Enter the child's name.",
      );

      return;

    }



    if(
      !Number.isInteger(childAge) ||
      childAge < 6 ||
      childAge > 15
    ){

      Alert.alert(
        "Invalid Age",
        "SafeTrack supports children aged 6 to 15 years old.",
      );

      return;

    }





    if(
      (
        trackingSource==="smartwatch" ||
        trackingSource==="both"
      )
      &&
      !watchId.trim()
    ){

      Alert.alert(
        "Watch ID Required",
        "Enter the registered smartwatch ID.",
      );

      return;

    }





    try{


      setLoading(true);



      const result =
        await completeChildRegistration({

          fullName,

          age:childAge,

          relationship,

          trackingSource,

          watchId:
            watchId.trim(),

        });





      /*
        SMARTWATCH ONLY
        OR BOTH
      */

      if(
        result.deviceSetup.requiresWatch
      ){

        router.replace({

          pathname:
            "/device-connection",


          params:{

            childId:
              result.child.id,


            watchId:
              result.deviceSetup.watchId ?? "",


            nextStep:
              result.deviceSetup.requiresMobile
              ? "mobile"
              : "done",

          },

        });


        return;

      }





      /*
        MOBILE ONLY
      */

      if(
        result.deviceSetup.requiresMobile
      ){

        router.replace({

          pathname:
            "/connection-code",

          params:{

            childId:
              result.child.id,

          },

        });


        return;

      }




      router.replace("/home");



    }
    catch(error){


      Alert.alert(

        "Registration Failed",

        error instanceof Error
        ? error.message
        : "Unable to create child profile.",

      );


    }
    finally{

      setLoading(false);

    }


  }





  return(

    <SafeAreaView style={styles.safe}>


      <KeyboardAvoidingView

        style={{flex:1}}

        behavior={
          Platform.OS==="ios"
          ?"padding"
          :undefined
        }

      >


      <ScrollView

        contentContainerStyle={
          styles.container
        }

      >



        <View style={styles.header}>


          <View style={styles.iconCircle}>

            <Ionicons

              name="person-add-outline"

              size={32}

              color={COLORS.green}

            />

          </View>



          <Text style={styles.title}>

            Register Child Profile

          </Text>



          <Text style={styles.subtitle}>

            Add child information and select the monitoring device.

          </Text>


        </View>






        <View style={styles.card}>


          <Text style={styles.label}>
            CHILD NAME
          </Text>


          <TextInput

            value={fullName}

            onChangeText={setFullName}

            placeholder="Child full name"

            style={styles.input}

          />



          <Text style={styles.label}>
            AGE
          </Text>



          <TextInput

            value={age}

            onChangeText={setAge}

            keyboardType="number-pad"

            placeholder="6 - 15"

            style={styles.input}

          />





          <Text style={styles.label}>
            RELATIONSHIP
          </Text>



          <View style={styles.row}>


          {
            RELATIONSHIPS.map(item=>(

              <Pressable

                key={item}

                onPress={()=>
                  setRelationship(item)
                }

                style={[

                  styles.chip,

                  relationship===item &&
                  styles.chipActive

                ]}

              >

                <Text

                  style={[

                    styles.chipText,

                    relationship===item &&
                    styles.chipTextActive

                  ]}

                >

                  {item}

                </Text>


              </Pressable>

            ))
          }


          </View>







          <Text style={styles.label}>
            TRACKING SOURCE
          </Text>




          {
            TRACKING_OPTIONS.map(option=>(


              <Pressable

                key={option.value}

                onPress={()=>
                  setTrackingSource(option.value)
                }

                style={[

                  styles.deviceCard,

                  trackingSource===option.value &&
                  styles.deviceActive

                ]}

              >


                <Ionicons

                  name={option.icon}

                  size={28}

                  color={
                    trackingSource===option.value
                    ?COLORS.green
                    :COLORS.muted
                  }

                />


                <View style={{flex:1}}>


                  <Text style={styles.deviceTitle}>

                    {option.title}

                  </Text>



                  <Text style={styles.deviceSubtitle}>

                    {option.subtitle}

                  </Text>



                </View>



              </Pressable>


            ))
          }





          {
            trackingSource!=="mobile" &&

            <>

            <Text style={styles.label}>
              SMARTWATCH ID
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






        <Pressable

          onPress={handleSubmit}

          disabled={loading}

          style={styles.button}

        >

          <Text style={styles.buttonText}>

            {
              loading
              ?"Creating Profile..."
              :"Continue Setup"
            }

          </Text>


        </Pressable>



      </ScrollView>


      </KeyboardAvoidingView>


    </SafeAreaView>

  );

}






const styles=StyleSheet.create({


safe:{
 flex:1,
 backgroundColor:COLORS.background,
},


container:{
 padding:22,
},


header:{
 alignItems:"center",
 marginBottom:20,
},


iconCircle:{
 width:70,
 height:70,
 borderRadius:35,
 backgroundColor:COLORS.mint,
 justifyContent:"center",
 alignItems:"center",
},


title:{
 marginTop:15,
 fontSize:26,
 fontWeight:"900",
 color:COLORS.text,
},


subtitle:{
 marginTop:8,
 color:COLORS.muted,
 textAlign:"center",
},


card:{
 backgroundColor:COLORS.card,
 padding:20,
 borderRadius:24,
 borderWidth:1,
 borderColor:COLORS.border,
},


label:{
 marginTop:15,
 marginBottom:8,
 fontSize:11,
 fontWeight:"900",
 color:COLORS.muted,
},


input:{
 height:50,
 borderWidth:1,
 borderColor:COLORS.border,
 borderRadius:14,
 paddingHorizontal:15,
 color:COLORS.text,
},


row:{
 flexDirection:"row",
 flexWrap:"wrap",
},


chip:{
 paddingHorizontal:14,
 paddingVertical:9,
 borderRadius:20,
 borderWidth:1,
 borderColor:COLORS.border,
 marginRight:8,
 marginBottom:8,
},


chipActive:{
 backgroundColor:COLORS.mint,
 borderColor:COLORS.green,
},


chipText:{
 color:COLORS.muted,
 fontWeight:"700",
},


chipTextActive:{
 color:COLORS.greenDark,
},


deviceCard:{
 flexDirection:"row",
 alignItems:"center",
 gap:15,
 padding:16,
 borderRadius:18,
 borderWidth:1,
 borderColor:COLORS.border,
 marginBottom:12,
},


deviceActive:{
 backgroundColor:COLORS.mint,
 borderColor:COLORS.green,
},


deviceTitle:{
 fontWeight:"900",
 color:COLORS.text,
},


deviceSubtitle:{
 color:COLORS.muted,
 fontSize:12,
 marginTop:3,
},


button:{
 height:55,
 backgroundColor:COLORS.green,
 borderRadius:30,
 justifyContent:"center",
 alignItems:"center",
 marginTop:20,
},


buttonText:{
 color:"#fff",
 fontWeight:"900",
 fontSize:16,
},


});