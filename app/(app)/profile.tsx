import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import { getProfileAvatarUrl } from "../../services/profileAvatarService";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";


type Profile = {
  id:string;
  full_name:string;
  email:string;
  avatar_path:string|null;
};


type ChildInfo = {
  id:string;
  full_name:string;
  age:number;
  relationship:string;

  // FIXED: camelCase
  trackingSource:
    | "mobile"
    | "smartwatch"
    | "both";

  avatar_path:string|null;
};



function initial(value?:string){

  return (
    value
    ?.trim()
    .charAt(0)
    .toUpperCase()
    ||
    "S"
  );

}



function trackingLabel(
  source?:ChildInfo["trackingSource"]
){

  if(source==="mobile")
    return "Mobile";

  if(source==="both")
    return "Smartwatch and mobile";

  return "Smartwatch";

}



function Row({
  icon,
  title,
  detail,
  onPress,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  title:string;
  detail:string;
  onPress:()=>void;
}){

  return(

    <Pressable
      style={styles.row}
      onPress={onPress}
    >

      <Ionicons
        name={icon}
        size={22}
        color={colors.primary}
      />


      <View style={styles.rowCopy}>

        <Text style={styles.rowTitle}>
          {title}
        </Text>


        <Text style={styles.rowDetail}>
          {detail}
        </Text>

      </View>


      <Ionicons
        name="chevron-forward"
        size={22}
        color={colors.muted}
      />

    </Pressable>

  );

}




export default function ProfileScreen(){

  const router = useRouter();


  const logout =
    useAuthStore(
      s=>s.logout
    );



  const [
    guardian,
    setGuardian
  ] =
  useState<Profile|null>(null);



  const [
    child,
    setChild
  ] =
  useState<ChildInfo|null>(null);



  const [
    guardianAvatar,
    setGuardianAvatar
  ] =
  useState<string|null>(null);



  const [
    watchConnected,
    setWatchConnected
  ] =
  useState(false);



  const [
    loading,
    setLoading
  ] =
  useState(true);





  const load =
  useCallback(async()=>{


    try{


      setLoading(true);



      const {
        data:auth,
        error
      } =
      await supabase.auth.getUser();



      if(error || !auth.user){

        throw new Error(
          "Session expired."
        );

      }




      const [
        guardianResult,
        childResult
      ] =
      await Promise.all([



        supabase

        .from("guardian_profiles")

        .select(
          "id,full_name,email,avatar_path"
        )

        .eq(
          "id",
          auth.user.id
        )

        .maybeSingle(),





        supabase

        .from("child_profiles")

        .select(
          "id,full_name,age,relationship,tracking_source,avatar_path"
        )

        .eq(
          "guardian_id",
          auth.user.id
        )

        .order(
          "created_at",
          {
            ascending:false
          }
        )

        .limit(1)

        .maybeSingle()


      ]);





      if(guardianResult.error)
        throw guardianResult.error;



      if(childResult.error)
        throw childResult.error;





      const guardianData =
  guardianResult.data as Profile | null;





      const rawChild =
        childResult.data;





      const childData:ChildInfo|null =
      rawChild
      ?

      {

        id:
        rawChild.id,


        full_name:
        rawChild.full_name,


        age:
        rawChild.age,


        relationship:
        rawChild.relationship,



        // FIX DATABASE -> APP FORMAT
        trackingSource:
        rawChild.tracking_source,



        avatar_path:
        rawChild.avatar_path

      }

      :

      null;





      setGuardian(
        guardianData
      );


      setChild(
        childData
      );






      if(

        childData

        &&

        (

          childData.trackingSource==="smartwatch"

          ||

          childData.trackingSource==="both"

        )

      ){



        const {
          data
        } =

        await supabase

        .from(
          "smartwatch_devices"
        )

        .select(
          "id"
        )

        .eq(
          "child_id",
          childData.id
        )

        .eq(
          "is_active",
          true
        )

        .limit(1)

        .maybeSingle();



        setWatchConnected(
          Boolean(data)
        );



      }

      else{


        setWatchConnected(false);


      }






      setGuardianAvatar(

        await getProfileAvatarUrl(

          guardianData?.avatar_path
          ??
          null

        )

      );





    }


    catch(error){


      Alert.alert(

        "Unable to load profile",

        error instanceof Error

        ?

        error.message

        :

        "Try again."

      );


    }


    finally{


      setLoading(false);


    }


  },[]);






  useEffect(()=>{

    void load();

  },[load]);







  if(loading){


    return(

      <SafeAreaView
        style={styles.loading}
      >

        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

      </SafeAreaView>

    );

  }







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

        contentContainerStyle={
          styles.content
        }

        showsVerticalScrollIndicator={false}

      >



        <View style={styles.profileTop}>


          {
            guardianAvatar

            ?

            <Image

              source={{
                uri:guardianAvatar
              }}

              style={styles.avatar}

            />


            :


            <View style={styles.avatar}>

              <Text style={styles.avatarText}>

                {
                  initial(
                    guardian?.full_name
                  )
                }

              </Text>

            </View>

          }




          <View style={styles.profileText}>


            <Text style={styles.label}>
              YOUR ACCOUNT
            </Text>


            <Text style={styles.name}>
              {
                guardian?.full_name
                ??
                "Guardian"
              }
            </Text>


            <Text style={styles.email}>
              {
                guardian?.email
                ??
                ""
              }
            </Text>


          </View>


        </View>






        <Text style={styles.section}>
          CHILD PROFILE
        </Text>





        <Row

          icon="person-outline"

          title={
            child?.full_name
            ??
            "No child registered"
          }


          detail={

            child

            ?

            `${child.age} years old • ${child.relationship}`

            :

            "Register child profile"

          }


          onPress={()=>{

            router.push(

              child

              ?

              "/edit-child-profile"

              :

              "/(auth)/child-registration"

            );

          }}

        />








        <Row

          icon={

            child?.trackingSource==="mobile"

            ?

            "phone-portrait-outline"

            :

            "watch-outline"

          }


          title="Tracking source"


          detail={

            child

            ?

            `${trackingLabel(child.trackingSource)}${
              
              child.trackingSource==="mobile"

              ?

              ""

              :

              watchConnected

              ?

              " • Connected"

              :

              " • Not linked"

            }`

            :

            "No tracking source selected."

          }



          onPress={()=>{

            router.push(
              child
              ?

              "/edit-child-profile"

              :

              "/(auth)/child-registration"
            );

          }}

        />








        <Text style={styles.section}>
          PRIVACY AND SUPPORT
        </Text>





        <Row

          icon="lock-closed-outline"

          title="Data and privacy"

          detail="Guardian access and child safety-data protection"

          onPress={()=>{}}

        />






        <Pressable

          style={styles.signOut}

          onPress={async()=>{

            await logout();

            router.replace(
              "/(auth)/welcome"
            );

          }}

        >

          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.primary}
          />


          <Text style={styles.signOutText}>
            Sign out
          </Text>


        </Pressable>




      </ScrollView>



    </SafeAreaView>

  );

}





const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:colors.background
},

loading:{
  flex:1,
  justifyContent:"center",
  alignItems:"center"
},

content:{
  padding:spacing.lg,
  paddingBottom:40
},

profileTop:{
  flexDirection:"row",
  alignItems:"center"
},

avatar:{
  width:58,
  height:58,
  borderRadius:20,
  backgroundColor:colors.primary,
  justifyContent:"center",
  alignItems:"center"
},

avatarText:{
  color:colors.white,
  fontSize:24,
  fontWeight:"900"
},

profileText:{
  marginLeft:13
},

label:{
  fontSize:10,
  fontWeight:"900",
  color:colors.primary
},

name:{
  fontSize:22,
  fontWeight:"900",
  color:colors.ink
},

email:{
  color:colors.muted
},

section:{
  marginTop:25,
  marginBottom:10,
  fontSize:10,
  fontWeight:"900",
  color:colors.muted,
  letterSpacing:1.5
},

row:{
  minHeight:76,
  backgroundColor:colors.white,
  borderRadius:radius.md,
  padding:15,
  flexDirection:"row",
  alignItems:"center",
  marginBottom:8,
  ...shadow.soft
},

rowCopy:{
  flex:1,
  marginLeft:12
},

rowTitle:{
  fontSize:15,
  fontWeight:"900",
  color:colors.ink
},

rowDetail:{
  fontSize:12.5,
  color:colors.muted,
  marginTop:3
},

signOut:{
  marginTop:20,
  height:54,
  borderRadius:radius.pill,
  borderWidth:1,
  borderColor:colors.primary,
  backgroundColor:colors.white,
  alignItems:"center",
  justifyContent:"center",
  flexDirection:"row"
},

signOutText:{
  marginLeft:8,
  fontWeight:"900",
  color:colors.primaryDark
}

});