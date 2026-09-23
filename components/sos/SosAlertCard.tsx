import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Ionicons,
} from "@expo/vector-icons";

import type {
  SosAlert,
} from "../../types/safetrack";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";


const STATUS_COLOR: Record<
  SosAlert["status"],
  string
> = {

  active:
    colors.danger,

  acknowledged:
    "#B8863A",

  resolved:
    "#2F6D4F",

  canceled:
    colors.muted,

};




function statusLabel(
  status:SosAlert["status"]
){

  switch(status){

    case "active":
      return "ACTIVE";


    case "acknowledged":
      return "ACKNOWLEDGED";


    case "resolved":
      return "RESOLVED";


    case "canceled":
      return "CANCELED";


    default:
      return "UNKNOWN";

  }

}




export default function SosAlertCard({
  alert,
}:{
  alert:SosAlert;
}){


  return (

    <View style={styles.card}>


      <View style={styles.header}>


        <Ionicons
          name="warning-outline"
          size={24}
          color={
            STATUS_COLOR[alert.status]
          }
        />


        <Text
          style={[
            styles.status,
            {
              color:
                STATUS_COLOR[alert.status]
            }
          ]}
        >

          {
            statusLabel(
              alert.status
            )
          }

        </Text>


      </View>





      {
        alert.childName &&

        <Text style={styles.title}>
          {alert.childName}
        </Text>

      }






      <Text style={styles.detail}>
        Method: {alert.activationMethod}
      </Text>





      {
        alert.latitude !== null &&
        alert.latitude !== undefined &&
        alert.longitude !== null &&
        alert.longitude !== undefined &&

        <Text style={styles.detail}>

          Location:
          {" "}
          {alert.latitude.toFixed(5)},
          {" "}
          {alert.longitude.toFixed(5)}

        </Text>

      }






      <Text style={styles.detail}>

        Triggered:
        {" "}
        {
          new Date(
            alert.triggeredAt
          ).toLocaleString()
        }

      </Text>




    </View>

  );

}






const styles = StyleSheet.create({

card:{

  backgroundColor:colors.white,

  borderRadius:radius.md,

  padding:16,

  ...shadow.soft,

},


header:{

  flexDirection:"row",

  alignItems:"center",

},


status:{

  marginLeft:8,

  fontSize:12,

  fontWeight:"900",

},


title:{

  marginTop:12,

  color:colors.ink,

  fontSize:16,

  fontWeight:"900",

},


detail:{

  marginTop:8,

  color:colors.muted,

  fontSize:12,

},


});