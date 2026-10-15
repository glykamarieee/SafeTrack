import { useState } from "react";

import { StyleSheet, View } from "react-native";

import { AuthShell } from "../../components/auth/AuthShell";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { ChoiceCard } from "../../components/ui/ChoiceCard";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Notice";
import { Text } from "../../components/ui/Text";
import { space } from "../../theme/tokens";

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
  <AuthShell
    compact
    step={{ current: 2, total: 2 }}
    eyebrow="Guardian setup"
    title="Register your child"
    subtitle="Add your child's details and choose how SafeTrack follows their location."
  >
    <View style={styles.section}>
      <Text variant="legend">Child information</Text>
      <View style={styles.fieldRow}>
        <View style={styles.nameField}>
          <Field label="Full name" icon="person-outline" value={fullName} onChangeText={setFullName} placeholder="Child's full name" autoCapitalize="words" />
        </View>
        <View style={styles.ageField}>
          <Field label="Age" icon="calendar-outline" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="6–15" maxLength={2} />
        </View>
      </View>
      <Text variant="caption">SafeTrack is for children aged 6 to 15.</Text>
    </View>

    <View style={styles.section}>
      <Text variant="label">Your relationship</Text>
      <View style={styles.wrap}>
        {relationships.map((item) => (
          <Chip key={item} label={item} selected={relationship === item} onPress={() => setRelationship(item)} />
        ))}
      </View>
    </View>

    <View style={styles.section} accessibilityRole="radiogroup">
      <Text variant="legend">Tracking source</Text>
      {trackingOptions.map((item) => (
        <ChoiceCard
          key={item.value}
          title={item.title}
          description={item.description}
          icon={item.icon}
          selected={trackingSource === item.value}
          onPress={() => setTrackingSource(item.value)}
        />
      ))}
    </View>

    {trackingSource !== "mobile" ? (
      <Field
        label="Registered watch ID"
        icon="watch-outline"
        value={watchId}
        onChangeText={setWatchId}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ST-WATCH-XXXXXXXX"
        hint={`Shown as "Watch ID" on the watch's SafeTrack connect screen.`}
      />
    ) : null}

    {error ? <Notice tone="error">{error}</Notice> : null}

    <Button label={loading ? "Registering…" : "Register child"} iconRight="arrow-forward" size="lg" loading={loading} onPress={() => void registerChild()} />
  </AuthShell>
);
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  nameField: { flex: 1, minWidth: 200 },
  ageField: { width: 110 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
