import {
  StyleSheet,
  View,
  Text,
  Pressable,
} from "react-native";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
} from "./SafeTrackInteractiveMap";

import type {
  LocationLog,
} from "../../types/safetrack";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";


export type LocationMapCardProps = {

  location:
    | LocationLog
    | null
    | undefined;

  height?:
    number;

  loading?:
    boolean;

  trackingSource?:
    "mobile"
    |
    "smartwatch"
    |
    "both";

  onRefresh?:
    ()=>void;

};



export function LocationMapCard({

  location,

  height = 350,

  loading = false,

  trackingSource,

  onRefresh,

}:LocationMapCardProps){



  const validLocation =
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude);



  const markers: SafeTrackMapMarker[] =
validLocation
?
[
  {
    id:"latest-location",

    latitude:
      location.latitude,

    longitude:
      location.longitude,

    title:
      trackingSource==="smartwatch"
      ?
      "Smartwatch Location"
      :
      trackingSource==="both"
      ?
      "Smartwatch + Mobile"
      :
      "Mobile Location",
  },
]
:
[];




  return (

    <View
      style={[
        styles.container,
        {
          height
        }
      ]}
    >


      {
        validLocation

        ?

        <SafeTrackInteractiveMap

          markers={markers}

          height={height}

        />

        :

        <View style={styles.empty}>

          <Ionicons

            name="location-outline"

            size={38}

            color={colors.primary}

          />


          <Text style={styles.emptyTitle}>

            {
              loading
              ?
              "Getting location..."
              :
              "Waiting for location"
            }

          </Text>



          <Text style={styles.emptyText}>

            {
              trackingSource==="smartwatch"
              ?
              "Waiting for smartwatch location update."
              :
              trackingSource==="both"
              ?
              "Waiting for smartwatch or mobile update."
              :
              "Waiting for mobile location update."
            }

          </Text>


          {
            onRefresh &&
            <Pressable

              onPress={onRefresh}

              style={styles.refresh}

            >

              <Ionicons

                name="refresh-outline"

                size={18}

                color={colors.white}

              />


              <Text style={styles.refreshText}>
                Refresh
              </Text>


            </Pressable>
          }


        </View>

      }


    </View>

  );

}




const styles = StyleSheet.create({

  container:{

    overflow:"hidden",

    borderRadius:
      radius.lg,

    backgroundColor:
      colors.white,

    ...shadow.soft,

  },


  empty:{

    flex:1,

    justifyContent:"center",

    alignItems:"center",

    padding:25,

    backgroundColor:
      colors.white,

  },


  emptyTitle:{

    marginTop:12,

    fontSize:16,

    fontWeight:"900",

    color:
      colors.ink,

  },


  emptyText:{

    marginTop:6,

    textAlign:"center",

    fontSize:13,

    color:
      colors.muted,

  },


  refresh:{

    marginTop:15,

    flexDirection:"row",

    alignItems:"center",

    gap:8,

    paddingHorizontal:18,

    paddingVertical:10,

    borderRadius:30,

    backgroundColor:
      colors.primary,

  },


  refreshText:{

    color:
      colors.white,

    fontWeight:"900",

  },


});