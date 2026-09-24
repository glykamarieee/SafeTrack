import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
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
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";



export default function AnomalyDetailsScreen(){

  const router = useRouter();


  return (

    <SafeAreaView style={styles.safe}>


      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >


        <Pressable
          style={styles.back}
          onPress={()=>router.back()}
        >

          <Ionicons
            name="chevron-back"
            size={20}
            color={colors.ink}
          />

          <Text style={styles.backText}>
            Back
          </Text>

        </Pressable>



        <Text style={styles.eyebrow}>
          AI SAFETY MONITORING
        </Text>


        <Text style={styles.title}>
          Anomaly Details
        </Text>


        <Text style={styles.subtitle}>
          Review unusual child movement records
          detected by SafeTrack monitoring.
        </Text>




        <View style={styles.card}>


          <View style={styles.iconBox}>

            <Ionicons
              name="analytics-outline"
              size={28}
              color={colors.primary}
            />

          </View>


          <Text style={styles.cardTitle}>
            No anomaly selected
          </Text>


          <Text style={styles.description}>
            Select an anomaly record from the
            safety history page to view the
            detected movement pattern,
            location details, and explainable
            notification reason.
          </Text>


        </View>




        <Text style={styles.sectionTitle}>
          Detection Information
        </Text>


        <View style={styles.infoCard}>


          <Info
            icon="location-outline"
            label="Location Pattern"
            value="Waiting for anomaly record"
          />


          <Divider />


          <Info
            icon="time-outline"
            label="Time Pattern"
            value="No available data"
          />


          <Divider />


          <Info
            icon="shield-checkmark-outline"
            label="AI Explanation"
            value="No explanation available"
          />


        </View>




      </ScrollView>


    </SafeAreaView>

  );

}





function Info({
  icon,
  label,
  value,
}:{
  icon:keyof typeof Ionicons.glyphMap;
  label:string;
  value:string;
}){


return (

<View style={styles.info}>


<Ionicons
name={icon}
size={20}
color={colors.primary}
/>


<View style={styles.infoText}>

<Text style={styles.label}>
{label}
</Text>


<Text style={styles.value}>
{value}
</Text>

</View>


</View>

);

}





function Divider(){

return (

<View style={styles.divider}/>

);

}




const styles = StyleSheet.create({

safe:{
flex:1,
backgroundColor:colors.background,
},


container:{
width:"100%",
maxWidth:900,
alignSelf:"center",
padding:spacing.lg,
paddingBottom:80,
},


back:{
flexDirection:"row",
alignItems:"center",
marginBottom:25,
},


backText:{
marginLeft:5,
fontWeight:"800",
color:colors.ink,
},


eyebrow:{
fontSize:10,
fontWeight:"900",
letterSpacing:1.3,
color:colors.primary,
},


title:{
marginTop:5,
fontSize:30,
fontWeight:"900",
color:colors.ink,
},


subtitle:{
marginTop:8,
color:colors.muted,
lineHeight:20,
},


card:{
marginTop:25,
padding:22,
borderRadius:radius.lg,
backgroundColor:colors.white,
...shadow.card,
alignItems:"center",
},


iconBox:{
width:70,
height:70,
borderRadius:35,
backgroundColor:colors.softMint,
alignItems:"center",
justifyContent:"center",
},


cardTitle:{
marginTop:15,
fontSize:18,
fontWeight:"900",
color:colors.ink,
},


description:{
marginTop:10,
textAlign:"center",
fontSize:12,
lineHeight:18,
color:colors.muted,
},


sectionTitle:{
marginTop:25,
marginBottom:10,
fontSize:10,
fontWeight:"900",
letterSpacing:1.2,
color:colors.muted,
},


infoCard:{
padding:16,
borderRadius:radius.md,
backgroundColor:colors.white,
...shadow.soft,
},


info:{
flexDirection:"row",
alignItems:"center",
},


infoText:{
marginLeft:10,
flex:1,
},


label:{
fontSize:10,
fontWeight:"800",
color:colors.muted,
},


value:{
marginTop:3,
fontSize:13,
fontWeight:"800",
color:colors.ink,
},


divider:{
height:1,
backgroundColor:colors.border,
marginVertical:14,
},


});