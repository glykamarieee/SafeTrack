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
  generateSmartwatchPairingCode,
} from "../../services/smartwatchPairingService";

import {
  generateMobilePairingCode,
} from "../../services/mobilePairingService";


type PairingCode = {
  connectionCode: string;
  expiresAt: string;
};



import {
  guardianColors as C,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";




export default function ConnectionCodeScreen(){

  const router = useRouter();


  const params =
    useLocalSearchParams<{
      childId?:string;
      device?:string;
    }>();


  const childId =
    String(
      params.childId ?? ""
    ).trim();


  // "phone" for Child Mobile Access; the smartwatch otherwise.
  const isPhone =
    params.device === "phone";



  const [
    result,
    setResult
  ] =
  useState<PairingCode|null>(null);



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




  // Each new code replaces the previous one on the server, so a
  // second overlapping request would leave a stale code on screen.
  const generating =
    useRef(false);



  async function generate(){

    if(!childId){

      setError(
        "Child profile is missing."
      );

      return;

    }


    if(generating.current){
      return;
    }


    try{

      generating.current = true;

      setLoading(true);

      setError(null);

      // This screen stays mounted between visits; never show a
      // previous (e.g. smartwatch) code next to a new error.
      setResult(null);


      const response =
        isPhone
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

    if(childId){

      void generate();

    }

  },[childId, isPhone]);





  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={19} color={C.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name={isPhone ? "phone-portrait-outline" : "watch-outline"} size={24} color={C.white} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CHILD DEVICE CONNECTION</Text>
              <Text style={styles.title}>{isPhone ? "Connect child phone" : "Connect child smartwatch"}</Text>
              <Text style={styles.subtitle}>
                {isPhone
                  ? "Use this temporary code in the child-device access flow on the registered phone."
                  : "Use this temporary code in the SafeTrack smartwatch application to complete pairing."}
              </Text>
            </View>
          </View>

          <View style={styles.codeSection}>
            <View style={styles.codeMetaRow}>
              <View>
                <Text style={styles.codeLabel}>CONNECTION CODE</Text>
                <Text style={styles.codeHint}>{loading ? "Generating a new code" : result ? "Ready to enter on the child device" : "Code unavailable"}</Text>
              </View>
              <Ionicons name="key-outline" size={19} color={C.primaryDark} />
            </View>

            <View style={styles.codePanel}>
              <Text selectable style={styles.code}>
                {result?.connectionCode ?? (loading ? "••••••" : "------")}
              </Text>
              {result?.expiresAt ? (
                <View style={styles.expiryRow}>
                  <Ionicons name="time-outline" size={15} color={C.muted} />
                  <Text style={styles.expiry}>
                    Expires {new Date(result.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>Complete the connection</Text>
            <Instruction number="1" text={isPhone ? "Open SafeTrack on the child's phone and choose the child-device link option." : "Open the SafeTrack application on the registered smartwatch."} />
            <Instruction number="2" text="Enter the temporary connection code shown above." />
            <Instruction number="3" text="Wait for SafeTrack to validate the code using the existing pairing process." last />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={loading}
            onPress={generate}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, loading && styles.disabled]}
          >
            <Ionicons name="refresh-outline" size={18} color={C.white} />
            <Text style={styles.primaryText}>{loading ? "Generating..." : "Generate new code"}</Text>
          </Pressable>

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={17} color={C.primaryDark} />
            <Text style={styles.note}>
              The code is temporary and uses the existing SafeTrack pairing workflow. Generating another code replaces the previous one.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Instruction({ number, text, last = false }: { number: string; text: string; last?: boolean }) {
  return (
    <View style={styles.instructionRow}>
      <View style={styles.stepRail}>
        <View style={styles.stepCircle}><Text style={styles.stepNumber}>{number}</Text></View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <Text style={styles.instructionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, width: "100%", maxWidth: 900, alignSelf: "center", padding: spacing.lg, paddingTop: 22, paddingBottom: 70 },
  back: { alignSelf: "flex-start", minHeight: 40, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 2, borderRadius: radius.sm },
  backText: { color: C.ink, fontSize: 11.5, fontWeight: "800" },
  shell: { width: "100%", maxWidth: 720, alignSelf: "center", marginTop: 18 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  iconCircle: { width: 48, height: 48, borderRadius: 17, backgroundColor: C.primaryDeep, alignItems: "center", justifyContent: "center", ...shadow.soft },
  headerCopy: { flex: 1 },
  eyebrow: { color: C.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: C.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginTop: 4 },
  subtitle: { color: C.muted, fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  codeSection: { marginTop: 28 },
  codeMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeLabel: { color: C.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  codeHint: { color: C.muted, fontSize: 10.5, marginTop: 3 },
  codePanel: { marginTop: 11, paddingVertical: 26, paddingHorizontal: 16, alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface },
  code: { color: C.primaryDeep, fontSize: 38, fontWeight: "900", letterSpacing: 7, textAlign: "center" },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  expiry: { color: C.muted, fontSize: 10.5, fontWeight: "700" },
  instructions: { marginTop: 27 },
  instructionsTitle: { color: C.ink, fontSize: 15, fontWeight: "900", marginBottom: 10 },
  instructionRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 54 },
  stepRail: { width: 34, alignItems: "center" },
  stepCircle: { width: 25, height: 25, borderRadius: 13, backgroundColor: C.softMint, alignItems: "center", justifyContent: "center" },
  stepNumber: { color: C.primaryDark, fontSize: 10.5, fontWeight: "900" },
  stepLine: { flex: 1, width: 1, backgroundColor: C.borderStrong, marginVertical: 4 },
  instructionText: { flex: 1, color: C.text, fontSize: 11.5, lineHeight: 17, paddingTop: 4, paddingLeft: 5 },
  errorBox: { marginTop: 16, padding: 13, borderRadius: radius.md, backgroundColor: C.dangerSoft, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  errorText: { flex: 1, color: C.dangerDark, fontSize: 11.5, lineHeight: 17 },
  primary: { alignSelf: "flex-start", minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, paddingHorizontal: 17, borderRadius: radius.md, backgroundColor: C.primaryDeep, ...shadow.soft },
  primaryText: { color: C.white, fontWeight: "900", fontSize: 11.5 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 17 },
  note: { flex: 1, color: C.muted, fontSize: 10.5, lineHeight: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
