import {
  StyleSheet,
  Text,
  View,
} from "react-native";


import type {
  SosAlertStatus,
} from "../../types/safetrack";



import {
  safeTrackColors as colors,
} from "../../constants/safeTrackDesign";







const STATUS_META: Record<
  SosAlertStatus,
  {
    label:string;
    bg:string;
    text:string;
  }

> = {


  active:{

    label:"ACTIVE",

    bg:"#FBE7E3",

    text:"#C0442E",

  },



  acknowledged:{

    label:"ACKNOWLEDGED",

    bg:"#FBF2E1",

    text:"#B8863A",

  },



  resolved:{

    label:"RESOLVED",

    bg:"#E6F0E9",

    text:"#2F6D4F",

  },



  canceled:{

    label:"CANCELED",

    bg:"#EEF1EF",

    text:colors.muted,

  },


};







export default function SosStatusPill({

  status,

}:{

  status:SosAlertStatus;

}){


  const meta =
    STATUS_META[status];



  return (

    <View

      style={[
        styles.container,
        {
          backgroundColor:
            meta.bg,
        }
      ]}

    >


      <Text

        style={[
          styles.text,
          {
            color:
              meta.text,
          }
        ]}

      >

        {meta.label}

      </Text>


    </View>

  );

}







const styles = StyleSheet.create({

container:{

  paddingHorizontal:12,

  paddingVertical:6,

  borderRadius:20,

  alignSelf:"flex-start",

},



text:{

  fontSize:10,

  fontWeight:"900",

  letterSpacing:.5,

},


});