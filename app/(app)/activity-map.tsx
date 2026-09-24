import { StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";


export default function ActivityMapScreen() {

  const router = useRouter();


  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.container}>


        <Text style={styles.eyebrow}>
          LOCATION MONITORING
        </Text>


        <Text style={styles.title}>
          Activity Map
        </Text>


        <Text style={styles.subtitle}>
          View the child's latest available location,
          movement history, and safety activity.
        </Text>



        <View style={styles.mapCard}>

          <Ionicons
            name="map-outline"
            size={55}
            color={colors.primary}
          />


          <Text style={styles.mapTitle}>
            Interactive Map
          </Text>


          <Text style={styles.mapText}>
            Map tracking will display smartwatch
            and mobile location records here.
          </Text>


        </View>



        <Pressable
          style={styles.button}
          onPress={() =>
            router.push("/(app)/history" as never)
          }
        >

          <Ionicons
            name="time-outline"
            size={20}
            color={colors.white}
          />


          <Text style={styles.buttonText}>
            View Location History
          </Text>


        </Pressable>



      </View>


    </SafeAreaView>
  );
}




const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:colors.background,
},


container:{
  flex:1,
  width:"100%",
  maxWidth:1160,
  alignSelf:"center",
  padding:spacing.lg,
},


eyebrow:{
  color:colors.primary,
  fontSize:10,
  fontWeight:"900",
  letterSpacing:1.4,
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


mapCard:{
  flex:1,
  marginTop:25,
  borderRadius:radius.lg,
  backgroundColor:colors.white,
  justifyContent:"center",
  alignItems:"center",
  ...shadow.card,
},


mapTitle:{
  marginTop:15,
  fontSize:20,
  fontWeight:"900",
  color:colors.ink,
},


mapText:{
  marginTop:8,
  paddingHorizontal:30,
  textAlign:"center",
  color:colors.muted,
},


button:{
  height:52,
  marginTop:20,
  borderRadius:radius.pill,
  backgroundColor:colors.primary,
  flexDirection:"row",
  justifyContent:"center",
  alignItems:"center",
},


buttonText:{
  color:colors.white,
  fontWeight:"900",
  marginLeft:8,
},


});