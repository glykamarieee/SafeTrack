import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Button } from "../../components/ui/Button";
import { Entrance } from "../../components/ui/Entrance";
import { MapPattern } from "../../components/ui/MapPattern";
import { StatusScrim } from "../../components/ui/StatusScrim";
import { Segmented } from "../../components/ui/Segmented";
import { Text } from "../../components/ui/Text";
import { usePressFeedback } from "../../theme/motion";
import { radius, shadow, space } from "../../theme/tokens";

import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import { getProfileAvatarUrl } from "../../services/profileAvatarService";



import { makeStyles, useTheme, type AppearancePreference } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

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
  danger,
  last,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  title:string;
  detail:string;
  onPress:()=>void;
  danger?:boolean;
  last?:boolean;
}){
  const styles = useStyles();
  const { colors: c } = useTheme();
  const press = usePressFeedback();

  return(
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View style={[styles.row, !last && styles.rowRule, press.style]}>
        <View style={[styles.rowIcon, danger && { backgroundColor: c.dangerTint }]}>
          <Ionicons name={icon} size={20} color={danger ? c.danger : c.primary} />
        </View>
        <View style={styles.rowCopy}>
          <Text variant="label" weight="700" tone={danger ? "danger" : "ink"}>{title}</Text>
          <Text variant="caption">{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.muted} />
      </Animated.View>
    </Pressable>
  );
}




export default function ProfileScreen(){
  const styles = useStyles();
  const { colors: theme, scheme, preference, setPreference } = useTheme();
  const colors = guardianPalette(theme);


  const router = useRouter();


  const logout =
    useAuthStore(
      s=>s.logout
    );

  const [signingOut, setSigningOut] = useState(false);



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
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const trackingDetail = child
    ? `${trackingLabel(child.trackingSource)}${child.trackingSource === "mobile" ? "" : watchConnected ? " · Connected" : " · Not linked"}`
    : "No tracking source selected.";

  return(
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={["top"]} style={styles.header}>
          <MapPattern opacity={0.08} />
          <View style={styles.headerInner}>
            <Text variant="legend" style={styles.headerEyebrow}>Profile & support</Text>
            <View style={styles.profileTop}>
              {guardianAvatar ? (
                <Image source={{ uri: guardianAvatar }} style={styles.avatar} accessibilityLabel="Your profile picture" />
              ) : (
                <View style={styles.avatar}>
                  <Text variant="title" weight="800" style={styles.avatarText}>{initial(guardian?.full_name)}</Text>
                </View>
              )}
              <View style={styles.profileText}>
                <Text variant="title" weight="800" style={styles.name} numberOfLines={1}>{guardian?.full_name ?? "Guardian"}</Text>
                <Text variant="label" weight="500" style={styles.email} numberOfLines={1}>{guardian?.email ?? ""}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit guardian profile"
                onPress={() => router.push("/(app)/edit-guardian-profile")}
                style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="create-outline" size={19} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          <Entrance index={0} style={styles.group}>
            <Text variant="legend" style={styles.groupTitle}>Account</Text>
            <View style={styles.card}>
              <Row icon="create-outline" title="Guardian profile" detail="Edit your details and profile picture" onPress={() => router.push("/(app)/edit-guardian-profile")} />
              <Row icon="key-outline" title="Change password" detail="Update the password for this account" onPress={() => router.push("/(app)/change-password")} />
              <Row icon="notifications-outline" title="Notifications" detail="Choose which safety alerts you receive (SOS is always on)" onPress={() => router.push("/(app)/notification-settings")} last />
            </View>
          </Entrance>

          <Entrance index={1} style={styles.group}>
            <Text variant="legend" style={styles.groupTitle}>Appearance</Text>
            <View style={[styles.card, styles.cardPadded]}>
              <View style={styles.appearanceHead}>
                <View style={styles.rowIcon}>
                  <Ionicons name={scheme === "dark" ? "moon" : "sunny"} size={20} color={theme.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text variant="label" weight="700">Theme</Text>
                  <Text variant="caption">Light, dark, or follow your phone's setting.</Text>
                </View>
              </View>
              <Segmented<AppearancePreference>
                accessibilityLabel="Appearance"
                value={preference}
                onChange={setPreference}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "Match phone" },
                ]}
              />
            </View>
          </Entrance>

          <Entrance index={2} style={styles.group}>
            <Text variant="legend" style={styles.groupTitle}>Child profile</Text>
            <View style={styles.card}>
              <Row
                icon="person-outline"
                title={child?.full_name ?? "No child registered"}
                detail={child ? `${child.age} years old · ${child.relationship}` : "Register child profile"}
                onPress={() => {
                  router.push(
                    child
                      ? { pathname: "/edit-child-profile", params: { childId: child.id, section: "details" } }
                      : "/(auth)/child-registration",
                  );
                }}
              />
              <Row
                icon={child?.trackingSource === "mobile" ? "phone-portrait-outline" : "watch-outline"}
                title="Tracking source"
                detail={trackingDetail}
                onPress={() => {
                  router.push(
                    child
                      ? { pathname: "/edit-child-profile", params: { childId: child.id, section: "tracking" } }
                      : "/(auth)/child-registration",
                  );
                }}
                last
              />
            </View>
          </Entrance>

          <Entrance index={3} style={styles.group}>
            <Text variant="legend" style={styles.groupTitle}>Privacy and support</Text>
            <View style={styles.card}>
              <Row icon="help-circle-outline" title="Help & support" detail="SafeTrack guidance and support information" onPress={() => router.push("/(app)/help-support")} />
              <Row
                icon="play-circle-outline"
                title="Replay the tour"
                detail="See how SafeTrack works again"
                onPress={() => router.push({ pathname: "/onboarding", params: { audience: "guardian", next: "/(app)/profile", replay: "1" } })}
              />
              <Row icon="trash-outline" title="Delete account" detail="Close your guardian account and remove your personal details" onPress={() => router.push("/(app)/delete-account")} danger last />
            </View>
          </Entrance>

          <Button
            label={signingOut ? "Signing out…" : "Sign out"}
            variant="secondary"
            icon="log-out-outline"
            loading={signingOut}
            disabled={signingOut}
            onPress={async () => {
              setSigningOut(true);
              try {
                await logout();
              } finally {
                setSigningOut(false);
                // Drop the signed-in screens so Back cannot return to them.
                if (router.canDismiss()) router.dismissAll();
                router.replace("/(auth)/welcome");
              }
            }}
          />
        </View>
      </ScrollView>
      <StatusScrim color={scheme === "dark" ? theme.forest : "#15803D"} />
    </View>
  );
}

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.paper },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.paper },
    content: { flexGrow: 1, paddingBottom: 120 },
    header: {
      backgroundColor: scheme === "dark" ? c.forest : "#15803D",
      paddingHorizontal: space.gutter + 4,
      paddingBottom: space.xl,
      borderBottomLeftRadius: radius.lg + 2,
      borderBottomRightRadius: radius.lg + 2,
      overflow: "hidden",
    },
    headerInner: { width: "100%", maxWidth: 760, alignSelf: "center", paddingTop: space.lg, gap: space.lg },
    headerEyebrow: { color: "#D5F0DE" },
    profileTop: { flexDirection: "row", alignItems: "center", gap: space.lg },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "#FFFFFF",
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#15803D" },
    profileText: { flex: 1, minWidth: 0, gap: 2 },
    name: { color: "#FFFFFF" },
    email: { color: "#D5F0DE" },
    editButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    body: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: space.gutter, marginTop: space.lg, gap: space.xl },
    group: { gap: space.sm },
    groupTitle: { marginLeft: space.xs },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      overflow: "hidden",
      ...(scheme === "dark" ? { borderWidth: 1, borderColor: c.rule } : shadow(scheme)),
    },
    cardPadded: { padding: space.lg, gap: space.lg },
    appearanceHead: { flexDirection: "row", alignItems: "center", gap: space.md },
    row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md + 2, minHeight: 64 },
    rowRule: { borderBottomWidth: 1, borderBottomColor: c.rule },
    rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryTint },
    rowCopy: { flex: 1, gap: 2 },
  }),
);
