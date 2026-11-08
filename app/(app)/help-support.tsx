import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Linking,
} from "react-native";
import { useMemo, useState } from "react";
import { Text, TextInput } from "../../components/ui/NativeText";
import { useRouter } from "expo-router";

import { Button } from "../../components/ui/Button";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";



import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

/** Answers describe how the current app behaves; keep them in step with it. */
const FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "How do I link my child's smartwatch?",
    answer: "Open the child's tracking source, choose Watch or Both, enter the Watch ID shown on the watch, then tap Generate child device code and enter that code on the watch.",
  },
  {
    question: "How do I link my child's phone?",
    answer: "Choose Phone or Both as the tracking source and tap Generate child phone code. On the child's phone, tap I already have an account, then I'm a child: link this phone, and enter the code.",
  },
  {
    question: "How often is my child's location updated?",
    answer: "While you have the Home or Location map open, about every second while the child moves (every 5 seconds while still), so the map follows the child live without refreshing. Otherwise about every 10 seconds while the child is moving and every 3 minutes while still. After an SOS, the watch checks every 5 seconds for 10 minutes.",
  },
  {
    question: "What do the arrow, the footprints and the compass on the map mean?",
    answer: "The arrow and soft cone on your child's photo (and on yours) show which way that person is facing, from the compass when standing still and the direction of travel when moving. Footprints show where your child walked or ran in the last 10 minutes; running prints are spaced further apart. Turn the map with two fingers; the compass button appears and turns it back to north. The safe zone badge changes by itself when your child goes in or out.",
  },
  {
    question: "Why does the map say Updated some time ago?",
    answer: "The watch or phone has not sent a new location, usually because it is off, has no internet, or has no location signal. The map shows the last known location until a new one arrives.",
  },
  {
    question: "What happens when my child presses SOS?",
    answer: "You receive an SOS alert with the child's location, and SafeTrack keeps reminding you until you acknowledge it on the SOS Alerts screen.",
  },
  {
    question: "My child pressed SOS by mistake. What now?",
    answer: "On the watch, the child taps Sent by mistake, then Yes, I'm OK. The SOS is cancelled and you are told the child is safe.",
  },
  {
    question: "What is a Safe Zone?",
    answer: "A place such as Home or School with a center and a radius from 30 to 5000 meters. You are notified when your child enters or leaves it. Indoors the location can wander 20–70 m, so 100 m suits Home; a small zone may report short exits that did not happen.",
  },
  {
    question: "Why am I not getting notifications?",
    answer: "Check Notification Settings in your profile and allow SafeTrack notifications on your phone. SOS alerts are always sent and cannot be turned off.",
  },
  {
    question: "What does Possible unusual movement mean?",
    answer: "SafeTrack's AI review noticed movement that differs from your child's usual pattern. It is advice only; check the Location or History screen to see where your child is.",
  },
  {
    question: "How do I reset my password?",
    answer: "On the Login screen, tap Forgot password and enter your email address. Open the link in the email to set a new password.",
  },
  {
    question: "How do I remove a child from my account?",
    answer: "Open the child's details and tap Delete child profile. The linked watch or phone stops sending locations, and past records are kept.",
  },
];

export default function HelpSupportScreen() {
  const styles = useStyles();
  const router = useRouter();
  const colors = guardianPalette(useTheme().colors);
  const [query, setQuery] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const searching = query.trim().length > 0;
  const faqs = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return FAQS;
    return FAQS.filter((faq) => {
      const text = `${faq.question} ${faq.answer}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [query]);


  const openEmail = () => {

    Linking.openURL(
      "mailto:support@safetrack.com"
    );

  };



  return (

    <SafeAreaView style={styles.safe}>


      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >


        <Text style={styles.eyebrow}>
          SUPPORT CENTER
        </Text>


        <Text style={styles.title}>
          Help & Support
        </Text>


        <Text style={styles.subtitle}>
          Find assistance for SafeTrack
          account, device connection, and
          safety monitoring concerns.
        </Text>




        <View style={styles.card}>


          <SupportItem
            icon="phone-portrait-outline"
            title="Device Connection"
            description="Check smartwatch or child mobile linking status and reconnect devices using a valid connection code."
          />


          <Divider />


          <SupportItem
            icon="location-outline"
            title="Location Tracking"
            description="Ensure the registered device has location permission and an active internet connection."
          />


          <Divider />


          <SupportItem
            icon="shield-checkmark-outline"
            title="Safety Alerts"
            description="Review SOS, safe-zone notifications, and anomaly-related alerts from the dashboard."
          />


        </View>


        <Text style={styles.faqHeading}>
          Frequently asked questions
        </Text>

        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search help (for example: SOS, watch, zone)"
            placeholderTextColor={colors.mutedLight}
            style={styles.searchInput}
            autoCorrect={false}
            accessibilityLabel="Search help"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          {faqs.length === 0 ? (
            <Text style={styles.noMatch}>
              No help matches &quot;{query.trim()}&quot;. Try another word or contact support.
            </Text>
          ) : (
            faqs.map((faq, index) => (
              <View key={faq.question}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => setOpenQuestion(openQuestion === faq.question ? null : faq.question)}
                  accessibilityRole="button"
                  style={styles.faqRow}
                >
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons
                    name={openQuestion === faq.question || searching ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
                {openQuestion === faq.question || searching ? (
                  <Text style={styles.itemDescription}>{faq.answer}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>


        <View style={styles.contact}>


          <Ionicons
            name="chatbubble-ellipses-outline"
            size={25}
            color={colors.primary}
          />


          <View style={styles.contactText}>

            <Text style={styles.contactTitle}>
              Need more help?
            </Text>


            <Text style={styles.contactDescription}>
              Contact the SafeTrack support
              team for assistance.
            </Text>


          </View>


        </View>




        <Pressable
          style={({pressed})=>[
            styles.button,
            pressed && styles.pressed
          ]}
          onPress={openEmail}
        >


          <Ionicons
            name="mail-outline"
            size={20}
            color={colors.white}
          />


          <Text style={styles.buttonText}>
            Contact Support
          </Text>


        </Pressable>

        <Button
          label="Replay the tour"
          variant="secondary"
          icon="play-circle-outline"
          onPress={() => router.push({ pathname: "/onboarding", params: { audience: "guardian", next: "/(app)/help-support", replay: "1" } })}
          style={styles.replay}
        />

        {/* Required by the free OpenStreetMap address service (lib/places.ts). */}
        <Text style={styles.credits}>
          Maps © Mapbox. Map data and addresses © OpenStreetMap contributors.
        </Text>



      </ScrollView>


    </SafeAreaView>

  );

}




function SupportItem({
  icon,
  title,
  description,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  title:string;
  description:string;
}){
  const styles = useStyles();
  const colors = guardianPalette(useTheme().colors);



return (

<View style={styles.item}>


<Ionicons
name={icon}
size={22}
color={colors.primary}
/>


<View style={styles.itemText}>


<Text style={styles.itemTitle}>
{title}
</Text>


<Text style={styles.itemDescription}>
{description}
</Text>


</View>


</View>

);


}




function Divider(){
  const styles = useStyles();


return (

<View style={styles.divider}/>

);

}





const useStyles = makeStyles((__c) => {
  const colors = guardianPalette(__c);
  return StyleSheet.create({
  replay: { marginTop: 12 },
  faqHeading: { marginTop: 26, fontSize: 17, fontWeight: "900", color: colors.ink },
  searchShell: {
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 10, outlineStyle: "none" } as any,
  faqRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.ink },
  noMatch: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: "center" },
  credits: { marginTop: 18, fontSize: 10.5, textAlign: "center", color: colors.muted },

safe:{
flex:1,
backgroundColor:colors.background,
},


container:{
width:"100%",
maxWidth:900,
alignSelf:"center",
padding:spacing.lg,
paddingBottom:100,
},


eyebrow:{
fontSize:10,
fontWeight:"900",
letterSpacing:1.3,
color:colors.primary,
},


title:{
fontSize:30,
fontWeight:"900",
color:colors.ink,
marginTop:5,
},


subtitle:{
marginTop:8,
color:colors.muted,
lineHeight:20,
},


card:{
marginTop:25,
backgroundColor:colors.white,
borderRadius:radius.lg,
padding:18,
...shadow.card,
},


item:{
flexDirection:"row",
alignItems:"flex-start",
},


itemText:{
flex:1,
marginLeft:12,
},


itemTitle:{
fontSize:15,
fontWeight:"900",
color:colors.ink,
},


itemDescription:{
marginTop:5,
fontSize:12,
lineHeight:18,
color:colors.muted,
},


divider:{
height:1,
backgroundColor:colors.border,
marginVertical:16,
},


contact:{
marginTop:20,
padding:16,
borderRadius:radius.md,
backgroundColor:colors.softMint,
flexDirection:"row",
},


contactText:{
flex:1,
marginLeft:10,
},


contactTitle:{
fontWeight:"900",
color:colors.primaryDark,
},


contactDescription:{
marginTop:4,
fontSize:12,
color:colors.primaryDark,
},


button:{
height:52,
marginTop:20,
borderRadius:radius.pill,
backgroundColor:colors.primary,
alignItems:"center",
justifyContent:"center",
flexDirection:"row",
},


buttonText:{
color:colors.white,
fontWeight:"900",
marginLeft:8,
},


pressed:{
opacity:0.8,
},


});
});