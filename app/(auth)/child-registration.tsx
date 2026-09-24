import { useState } from "react";

import {
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
  useRouter,
} from "expo-router";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  completeChildRegistration,
  type TrackingSource,
} from "../../services/childOnboardingService";

import {
  guardianColors as C,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";



const relationships = [
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Other",
];





const trackingOptions:
Array<{
  value:TrackingSource;
  title:string;
  description:string;
  icon:keyof typeof Ionicons.glyphMap;
}>
=
[
  {
    value:"smartwatch",
    title:"Smartwatch Only",
    description:
      "Uses the child's registered SafeTrack smartwatch for location tracking.",
    icon:"watch-outline",
  },


  {
    value:"mobile",
    title:"Mobile Only",
    description:
      "Uses the child's registered mobile device for location tracking.",
    icon:"phone-portrait-outline",
  },


  {
    value:"both",
    title:"Smartwatch + Mobile",
    description:
      "Smartwatch remains the primary device with mobile as additional source.",
    icon:"git-compare-outline",
  },

];








export default function ChildRegistrationScreen(){


const router = useRouter();



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



const [error,setError] =
useState<string|null>(null);







async function registerChild(){


setError(null);



const childAge =
Number(age);




if(fullName.trim().length < 2){

setError(
"Enter child's full name."
);

return;

}




if(
!Number.isInteger(childAge)
||
childAge < 6
||
childAge > 15
){

setError(
"Child age must be between 6 and 15 years old."
);

return;

}





if(
trackingSource !== "mobile"
&&
watchId.trim().length === 0
){

setError(
"Smartwatch ID is required for smartwatch tracking."
);

return;

}






try{


setLoading(true);



const result =
await completeChildRegistration({

fullName:
fullName.trim(),


age:
childAge,


relationship,


trackingSource,


watchId:
trackingSource === "mobile"
?
undefined
:
watchId.trim().toUpperCase(),

});





router.push({

pathname:
"/(app)/connection-code",


params:{

childId:
result.child.id,


// A phone-only child gets a child phone code, not a watch code.
device:
trackingSource === "mobile"
?
"phone"
:
"watch",


watchId:
trackingSource === "mobile"
?
""
:
watchId.trim().toUpperCase(),

},


});



}
catch(err){


setError(

err instanceof Error
?
err.message
:
"Unable to register child."

);


}
finally{


setLoading(false);


}



}









return (
  <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Ionicons name="shield-checkmark" size={22} color={C.white} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>GUARDIAN SETUP</Text>
          <Text style={styles.title}>Register child profile</Text>
          <Text style={styles.subtitle}>
            Add the child details and select the tracking source already supported by SafeTrack.
          </Text>
        </View>
      </View>

      <View style={styles.progressLine}>
        <View style={styles.progressActive} />
        <View style={styles.progressInactive} />
        <Text style={styles.progressText}>Profile details</Text>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>PERSON</Text>
        <Text style={styles.section}>Child information</Text>

        <View style={styles.fieldRow}>
          <View style={styles.fieldGrow}>
            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={18} color={C.primaryDark} />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Child full name"
                placeholderTextColor={C.mutedLight}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.ageField}>
            <Text style={styles.label}>Age</Text>
            <View style={styles.inputShell}>
              <Ionicons name="calendar-outline" size={18} color={C.primaryDark} />
              <TextInput
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="6–15"
                placeholderTextColor={C.mutedLight}
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <Text style={styles.helper}>SafeTrack is scoped for children aged 6 to 15 years old.</Text>

        <Text style={styles.label}>Relationship</Text>
        <View style={styles.wrap}>
          {relationships.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRelationship(item)}
              style={({ pressed }) => [
                styles.chip,
                relationship === item && styles.activeChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, relationship === item && styles.activeChipText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>TRACKING</Text>
        <Text style={styles.section}>Choose a tracking source</Text>
        <Text style={styles.sectionNote}>The selection below uses the existing SafeTrack registration workflow and device requirements.</Text>

        <View style={styles.optionList}>
          {trackingOptions.map((item) => {
            const selected = trackingSource === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setTrackingSource(item.value)}
                style={({ pressed }) => [styles.option, selected && styles.activeOption, pressed && styles.pressed]}
              >
                <View style={[styles.optionIcon, selected && styles.optionIconActive]}>
                  <Ionicons name={item.icon} size={20} color={selected ? C.white : C.primaryDark} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{item.title}</Text>
                  <Text style={styles.optionDesc}>{item.description}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioActive]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            );
          })}
        </View>

        {trackingSource !== "mobile" ? (
          <View style={styles.watchField}>
            <View style={styles.watchFieldHeader}>
              <View>
                <Text style={styles.labelCompact}>REGISTERED WATCH ID</Text>
                <Text style={styles.watchFieldTitle}>Smartwatch identifier</Text>
              </View>
              <Ionicons name="watch-outline" size={20} color={C.primaryDark} />
            </View>
            <View style={styles.inputShell}>
              <Ionicons name="key-outline" size={18} color={C.primaryDark} />
              <TextInput
                value={watchId}
                onChangeText={setWatchId}
                autoCapitalize="characters"
                placeholder="ST-WATCH-XXXXXXXX"
                placeholderTextColor={C.mutedLight}
                style={styles.input}
              />
            </View>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={20} color={C.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        disabled={loading}
        onPress={registerChild}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}
      >
        <Text style={styles.buttonText}>{loading ? "Registering..." : "Register child"}</Text>
        <Ionicons name="arrow-forward" size={18} color={C.white} />
      </Pressable>
    </ScrollView>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  container: { width: "100%", maxWidth: 860, alignSelf: "center", padding: spacing.lg, paddingTop: 28, paddingBottom: 80 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  brandMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.primaryDeep, alignItems: "center", justifyContent: "center", ...shadow.soft },
  headerCopy: { flex: 1, maxWidth: 660 },
  eyebrow: { color: C.primary, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.25 },
  title: { color: C.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, marginTop: 4 },
  subtitle: { color: C.muted, fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  progressLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24 },
  progressActive: { width: 76, height: 4, borderRadius: 2, backgroundColor: C.primary },
  progressInactive: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderStrong },
  progressText: { color: C.muted, fontSize: 9.5, fontWeight: "800", marginLeft: 5 },
  sectionBlock: { marginTop: 28 },
  sectionEyebrow: { color: C.primaryDark, fontSize: 8.5, fontWeight: "900", letterSpacing: 1.05 },
  section: { fontSize: 18, fontWeight: "900", color: C.ink, marginTop: 3 },
  sectionNote: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4, maxWidth: 620 },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 17 },
  fieldGrow: { flex: 1, minWidth: 230 },
  ageField: { width: 170, minWidth: 140 },
  label: { marginTop: 14, marginBottom: 7, color: C.text, fontSize: 11.5, fontWeight: "800" },
  labelCompact: { color: C.muted, fontSize: 8.5, fontWeight: "900", letterSpacing: 1 },
  inputShell: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1.5, borderBottomColor: C.borderStrong, backgroundColor: C.surface, paddingHorizontal: 12, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  input: { flex: 1, minHeight: 48, color: C.ink, fontSize: 13, paddingVertical: 0 },
  helper: { color: C.muted, fontSize: 10.5, marginTop: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 38, justifyContent: "center", paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.background },
  activeChip: { backgroundColor: C.primaryDark, borderColor: C.primaryDark },
  chipText: { color: C.text, fontSize: 11.5, fontWeight: "700" },
  activeChipText: { color: C.white, fontWeight: "900" },
  divider: { height: 1, backgroundColor: C.border, marginTop: 30 },
  optionList: { marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  option: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  activeOption: { backgroundColor: "rgba(220,244,230,0.48)", paddingHorizontal: 10 },
  optionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.softMint, alignItems: "center", justifyContent: "center" },
  optionIconActive: { backgroundColor: C.primaryDark },
  optionCopy: { flex: 1 },
  optionTitle: { color: C.ink, fontSize: 13, fontWeight: "900" },
  optionDesc: { color: C.muted, fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: C.primaryDark },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primaryDark },
  watchField: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  watchFieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  watchFieldTitle: { color: C.ink, fontSize: 13, fontWeight: "900", marginTop: 2 },
  errorBox: { marginTop: 18, padding: 13, borderRadius: radius.md, backgroundColor: C.dangerSoft, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  errorText: { flex: 1, color: C.dangerDark, fontSize: 11.5, lineHeight: 17 },
  button: { alignSelf: "flex-start", minHeight: 52, minWidth: 190, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, borderRadius: radius.md, backgroundColor: C.primaryDeep, paddingHorizontal: 20, ...shadow.soft },
  buttonText: { color: C.white, fontWeight: "900", fontSize: 12.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
