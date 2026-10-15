import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Linking,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
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

export default function HelpSupportScreen() {
  const styles = useStyles();
  const router = useRouter();
  const colors = guardianPalette(useTheme().colors);




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