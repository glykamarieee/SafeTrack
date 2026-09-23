import {
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
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";



export default function AdminDashboardScreen(){

  const router = useRouter();


  const cards = [

    {
      title:"Guardian Accounts",
      value:"Manage",
      icon:"people-outline" as const,
      route:"/(app)/admin-guardians",
    },


    {
      title:"Registered Devices",
      value:"Monitor",
      icon:"watch-outline" as const,
      route:"/(app)/admin-devices",
    },


    {
      title:"Safety Reports",
      value:"Generate",
      icon:"document-text-outline" as const,
      route:"/(app)/admin-reports",
    },


    {
      title:"System Activity",
      value:"Review",
      icon:"analytics-outline" as const,
      route:"/(app)/activity-map",
    },

  ];



  return (

    <SafeAreaView style={styles.safe}>


      <View style={styles.container}>


        <Text style={styles.eyebrow}>
          ADMIN CONTROL CENTER
        </Text>


        <Text style={styles.title}>
          Dashboard
        </Text>


        <Text style={styles.subtitle}>
          Manage SafeTrack accounts,
          devices, monitoring records,
          and generated reports.
        </Text>



        <View style={styles.grid}>


          {
            cards.map((card)=>(

              <Pressable
                key={card.title}
                style={({pressed})=>[
                  styles.card,
                  pressed && styles.pressed
                ]}
                onPress={()=>
                  router.push(card.route as never)
                }
              >


                <Ionicons
                  name={card.icon}
                  size={28}
                  color={colors.primary}
                />


                <Text style={styles.cardTitle}>
                  {card.title}
                </Text>


                <Text style={styles.cardValue}>
                  {card.value}
                </Text>


              </Pressable>

            ))
          }


        </View>



        <View style={styles.notice}>


          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={colors.primary}
          />


          <Text style={styles.noticeText}>
            Administrator access is limited to
            account management, device monitoring,
            and report generation.
          </Text>


        </View>



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


grid:{
  marginTop:25,
  flexDirection:"row",
  flexWrap:"wrap",
  justifyContent:"space-between",
},


card:{
  width:"48%",
  minHeight:150,
  marginBottom:15,
  padding:18,
  borderRadius:radius.lg,
  backgroundColor:colors.white,
  ...shadow.card,
},


cardTitle:{
  marginTop:15,
  fontSize:14,
  fontWeight:"900",
  color:colors.ink,
},


cardValue:{
  marginTop:8,
  color:colors.primary,
  fontWeight:"900",
},


notice:{
  marginTop:15,
  padding:15,
  borderRadius:radius.md,
  backgroundColor:colors.softMint,
  flexDirection:"row",
},


noticeText:{
  flex:1,
  marginLeft:10,
  color:colors.primaryDark,
  fontSize:12,
  lineHeight:18,
},


pressed:{
  opacity:0.8,
  transform:[
    {
      scale:0.98
    }
  ],
},


});