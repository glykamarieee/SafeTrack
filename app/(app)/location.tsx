import { useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";

import { LocationMapCard } from "../../components/location/LocationMapCard";

import {
  safeTrackColors as colors,
  safeTrackSpacing as spacing,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";


function getSourceLabel(source?: string){

  if(source==="mobile"){
    return "Mobile Device";
  }

  if(source==="both"){
    return "Smartwatch + Mobile";
  }

  return "Smartwatch";
}



function getSourceIcon(source?: string){

  if(source==="mobile"){
    return "phone-portrait-outline";
  }

  if(source==="both"){
    return "git-compare-outline";
  }

  return "watch-outline";
}



export default function LocationScreen(){

  const role =
    useAuthStore(
      state=>state.role
    );


  const child =
    useAuthStore(
      state=>state.child
    );


  const children =
    useAuthStore(
      state=>state.linkedChildren
    );


  const primaryChild =
    role==="child"
      ? child
      : children?.[0] ?? null;



  const location =
    useLocationStore(
      state=>state.latest
    );


  const loading =
    useLocationStore(
      state=>state.isLoading
    );


  const load =
    useLocationStore(
      state=>state.loadForChild
    );



  const trackingSource =
    primaryChild?.trackingSource ?? "mobile";



  useEffect(()=>{

    if(primaryChild?.id){

      void load(
        primaryChild.id
      );

    }

  },[
    primaryChild?.id
  ]);




  return(

    <SafeAreaView
      style={styles.safe}
      edges={[
        "top",
        "left",
        "right"
      ]}
    >


      <ScrollView

        showsVerticalScrollIndicator={false}

        contentContainerStyle={
          styles.content
        }

      >



        <View style={styles.header}>


          <View>

            <Text style={styles.eyebrow}>
              LOCATION TRACKING
            </Text>


            <Text style={styles.heading}>

              {
                primaryChild?.fullName ??
                "Child"
              }
              's Location

            </Text>


            <Text style={styles.subtitle}>

              View the latest available location
              based on the registered tracking source.

            </Text>


          </View>



          <Pressable

            style={styles.refresh}

            onPress={()=>{

              if(primaryChild?.id){

                void load(
                  primaryChild.id
                );

              }

            }}

          >

            <Ionicons

              name={
                loading
                ?
                "sync-outline"
                :
                "refresh-outline"
              }

              size={21}

              color={
                colors.primaryDark
              }

            />

          </Pressable>


        </View>





        <View style={styles.sourceCard}>


          <Ionicons

            name={
              getSourceIcon(
                trackingSource
              )
            }

            size={25}

            color={
              colors.primary
            }

          />


          <View style={styles.sourceContent}>


            <Text style={styles.sourceTitle}>

              Tracking Source

            </Text>



            <Text style={styles.sourceValue}>

              {
                getSourceLabel(
                  trackingSource
                )
              }

            </Text>


          </View>


        </View>






        <LocationMapCard

          location={
            location
          }

          height={
            510
          }

          loading={
            loading
          }

          onRefresh={()=>{

            if(primaryChild?.id){

              void load(
                primaryChild.id
              );

            }

          }}

        />






        <View style={styles.note}>


          <View style={styles.info}>

            <Text style={styles.infoText}>
              i
            </Text>

          </View>



          <Text style={styles.noteText}>

            {
              location
              ?

              "The marker represents the latest successfully stored location record."

              :

              "A location marker appears after the registered child device sends a location update."

            }


          </Text>


        </View>



      </ScrollView>


    </SafeAreaView>

  );

}




const styles = StyleSheet.create({

  safe:{
    flex:1,
    backgroundColor:
      colors.background,
  },


  content:{
    paddingHorizontal:
      spacing.lg,

    paddingTop:
      35,

    paddingBottom:
      35,
  },


  header:{
    flexDirection:"row",
    justifyContent:"space-between",
    marginBottom:18,
  },


  eyebrow:{
    color:
      colors.primary,

    fontSize:10.5,

    fontWeight:"900",

    letterSpacing:1.4,
  },


  heading:{
    color:
      colors.ink,

    fontSize:27,

    fontWeight:"900",

    marginTop:6,
  },


  subtitle:{
    color:
      colors.muted,

    fontSize:12.5,

    lineHeight:18,

    marginTop:5,

    maxWidth:280,
  },


  refresh:{
    width:43,
    height:43,

    borderRadius:22,

    justifyContent:"center",

    alignItems:"center",

    backgroundColor:
      colors.softMint,
  },


  sourceCard:{
    flexDirection:"row",

    alignItems:"center",

    padding:16,

    borderRadius:
      radius.md,

    backgroundColor:
      colors.white,

    marginBottom:16,

    ...shadow.soft,
  },


  sourceContent:{
    marginLeft:12,
  },


  sourceTitle:{
    color:
      colors.muted,

    fontSize:11,

    fontWeight:"900",
  },


  sourceValue:{
    color:
      colors.ink,

    fontSize:16,

    fontWeight:"900",

    marginTop:3,
  },


  note:{
    flexDirection:"row",

    marginTop:16,

    alignItems:"flex-start",
  },


  info:{
    width:20,

    height:20,

    borderRadius:10,

    justifyContent:"center",

    alignItems:"center",

    backgroundColor:
      colors.softMint,
  },


  infoText:{
    color:
      colors.primaryDark,

    fontSize:12,

    fontWeight:"900",
  },


  noteText:{
    flex:1,

    color:
      colors.muted,

    fontSize:12.5,

    lineHeight:18,

    marginLeft:9,
  },

});