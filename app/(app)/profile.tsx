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
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";


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
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >

      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={colors.primaryDark}
        />
      </View>


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

        .from("persons")

        .select(
          "id,full_name,email,avatar_path"
        )

        .eq(
          "id",
          auth.user.id
        )

        .maybeSingle(),





        supabase

        .from("children")

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
            ascending:true
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



        <Text style={styles.pageEyebrow}>PROFILE & SUPPORT</Text>
        <Text style={styles.pageTitle}>Your SafeTrack space.</Text>
        <Text style={styles.pageSubtitle}>
          Keep guardian details, child setup, and support close without crowding the monitoring experience.
        </Text>

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
          ACCOUNT
        </Text>

        <View style={styles.openGroup}>
          <Row
            icon="create-outline"
            title="Guardian profile"
            detail="Edit your stored account details and profile picture"
            onPress={() => router.push("/(app)/edit-guardian-profile")}
          />
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

              { pathname:"/edit-child-profile", params:{ childId:child.id, section:"details" } }

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

              { pathname:"/edit-child-profile", params:{ childId:child.id, section:"tracking" } }

              :

              "/(auth)/child-registration"
            );

          }}

        />








        <Text style={styles.section}>
          PRIVACY AND SUPPORT
        </Text>

        <Row
          icon="help-circle-outline"
          title="Help & support"
          detail="Open SafeTrack guidance and support information"
          onPress={() => router.push("/(app)/help-support")}
        />





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
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 118,
  },
  pageEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  pageTitle: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    maxWidth: 430,
    marginTop: 7,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 19,
  },
  profileTop: {
    marginTop: 22,
    minHeight: 112,
    padding: 18,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryDeep,
    overflow: "hidden",
    ...shadow.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.softMint,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.22)",
  },
  avatarText: {
    color: colors.primaryDeep,
    fontSize: 24,
    fontWeight: "900",
  },
  profileText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  label: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(255,255,255,.62)",
    letterSpacing: 1.1,
  },
  name: {
    marginTop: 4,
    fontSize: 21,
    fontWeight: "900",
    color: colors.white,
  },
  email: {
    marginTop: 4,
    color: "rgba(255,255,255,.72)",
    fontSize: 12,
  },
  section: {
    marginTop: 26,
    marginBottom: 4,
    fontSize: 9.5,
    fontWeight: "900",
    color: colors.muted,
    letterSpacing: 1.35,
  },
  openGroup: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    minHeight: 76,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    color: colors.ink,
  },
  rowDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 3,
  },
  signOut: {
    marginTop: 28,
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  signOutText: {
    marginLeft: 8,
    fontWeight: "900",
    color: colors.primaryDark,
  },
});
