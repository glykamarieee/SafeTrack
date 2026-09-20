import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import SafeZoneMap, {
  type SafeZoneMapHandle,
  type SafeZoneMapRegion,
  type SafeZoneMapZone,
} from "../../components/safe-zones/SafeZoneMap";

import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";


type SafeZone = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
};


type ZoneForm = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
};


const DEFAULT_REGION: SafeZoneMapRegion = {
  latitude: 10.3103,
  longitude: 123.9490,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};


function createForm(
  latitude: number,
  longitude: number
): ZoneForm {
  return {
    name: "",
    address: "",
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    radiusMeters: "200",
  };
}


function mapZone(row: any): SafeZone {
  return {
    id: String(row.id),
    name: row.name ?? "",
    address: row.address ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters ?? 200),
    isEnabled: row.is_enabled !== false,
  };
}


function formatRadius(
  meters: number
) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}


function makeRegion(
  latitude: number,
  longitude: number
): SafeZoneMapRegion {
  return {
    latitude,
    longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };
}



export default function SafeZones() {

  const router = useRouter();

  const mapRef = useRef<SafeZoneMapHandle | null>(null);


  const guardian = useAuthStore(
    (state) => state.guardian
  );


  const linkedChildren = useAuthStore(
    (state) => state.linkedChildren
  );


  const child = linkedChildren[0] ?? null;



  const [zones,setZones] =
    useState<SafeZone[]>([]);


  const [loading,setLoading] =
    useState(true);


  const [refreshing,setRefreshing] =
    useState(false);


  const [region,setRegion] =
    useState(DEFAULT_REGION);


  const [mapPoint,setMapPoint] =
    useState({
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
    });


  const [modalVisible,setModalVisible] =
    useState(false);


  const [saving,setSaving] =
    useState(false);


  const [editing,setEditing] =
    useState<SafeZone | null>(null);


  const [form,setForm] =
    useState(
      createForm(
        DEFAULT_REGION.latitude,
        DEFAULT_REGION.longitude
      )
    );


  const activeZones =
    zones.filter(
      (zone)=>zone.isEnabled
    ).length;
      const loadZones = async () => {
    if (!guardian?.id || !child?.id) {
      setZones([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } =
      await supabase
        .from("geofences")
        .select(
          `
          id,
          name,
          address,
          latitude,
          longitude,
          radius_meters,
          is_enabled
          `
        )
        .eq(
          "guardian_id",
          guardian.id
        )
        .eq(
          "child_id",
          child.id
        )
        .order(
          "created_at",
          {
            ascending:false,
          }
        );


    if (error) {

      Alert.alert(
        "Safe zones error",
        error.message
      );

      setZones([]);

    } else {

      const mapped =
        (data ?? []).map(
          mapZone
        );


      setZones(mapped);


      if(mapped.length > 0){

        const first =
          mapped[0];

        const next =
          makeRegion(
            first.latitude,
            first.longitude
          );


        setRegion(next);

        setMapPoint({
          latitude:first.latitude,
          longitude:first.longitude,
        });

      }

    }


    setLoading(false);
  };



  useEffect(()=>{

    loadZones();

  },[
    guardian?.id,
    child?.id
  ]);



  const updateForm = (
    key:keyof ZoneForm,
    value:string
  )=>{

    setForm(
      current=>({
        ...current,
        [key]:value
      })
    );

  };



  const centerMap = (
    latitude = mapPoint.latitude,
    longitude = mapPoint.longitude
  )=>{

    const next =
      makeRegion(
        latitude,
        longitude
      );


    setRegion(next);

    setMapPoint({
      latitude,
      longitude,
    });


    mapRef.current?.animateToRegion(
      next,
      400
    );

  };




  const openAdd = ()=>{

    if(!child){

      Alert.alert(
        "Child required",
        "Register a child first."
      );

      return;
    }


    setEditing(null);


    setForm(
      createForm(
        mapPoint.latitude,
        mapPoint.longitude
      )
    );


    setModalVisible(true);

  };





  const openEdit = (
    zone:SafeZone
  )=>{

    setEditing(zone);


    setForm({

      name:zone.name,

      address:
        zone.address ?? "",

      latitude:
        zone.latitude.toFixed(6),

      longitude:
        zone.longitude.toFixed(6),

      radiusMeters:
        String(
          zone.radiusMeters
        ),

    });


    centerMap(
      zone.latitude,
      zone.longitude
    );


    setModalVisible(true);

  };





  const saveZone = async()=>{

    if(!guardian?.id || !child?.id)
      return;


    const latitude =
      Number(form.latitude);

    const longitude =
      Number(form.longitude);

    const radiusMeters =
      Number(form.radiusMeters);


    if(!form.name.trim()){

      Alert.alert(
        "Missing name",
        "Enter a safe zone name."
      );

      return;

    }



    if(
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ){

      Alert.alert(
        "Invalid location",
        "Enter valid coordinates."
      );

      return;

    }



    setSaving(true);



    const payload = {

      name:
        form.name.trim(),

      address:
        form.address.trim() ||
        null,

      latitude,

      longitude,

      radius_meters:
        radiusMeters,

      updated_at:
        new Date().toISOString(),

    };



    let error;



    if(editing){

      const result =
        await supabase
          .from("geofences")
          .update(payload)
          .eq(
            "id",
            editing.id
          );

      error =
        result.error;


    }else{


      const result =
        await supabase
          .from("geofences")
          .insert({

            guardian_id:
              guardian.id,

            child_id:
              child.id,

            ...payload,

            is_enabled:true,

          });


      error =
        result.error;

    }



    setSaving(false);



    if(error){

      Alert.alert(
        "Save failed",
        error.message
      );

      return;

    }



    setModalVisible(false);

    setEditing(null);


    await loadZones();



    Alert.alert(
      "Success",
      "Safe zone saved."
    );

  };





  const toggleZone =
    async(zone:SafeZone)=>{

      const next =
        !zone.isEnabled;


      await supabase
        .from("geofences")
        .update({
          is_enabled:next
        })
        .eq(
          "id",
          zone.id
        );


      loadZones();

    };





  const deleteZone =
    (zone:SafeZone)=>{


      Alert.alert(
        "Delete safe zone?",
        zone.name,
        [
          {
            text:"Cancel",
            style:"cancel"
          },

          {
            text:"Delete",
            style:"destructive",

            onPress:
              async()=>{


                await supabase
                  .from("geofences")
                  .delete()
                  .eq(
                    "id",
                    zone.id
                  );


                setModalVisible(false);

                loadZones();

              }

          }

        ]
      );

    };





  const refresh = async()=>{

    setRefreshing(true);

    await loadZones();

    setRefreshing(false);

  };
    return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >

      <View style={styles.mapContainer}>

        <SafeZoneMap
          ref={mapRef}

          style={styles.map}

          initialRegion={
            DEFAULT_REGION
          }

          region={
            region
          }

          zones={
            zones as SafeZoneMapZone[]
          }

          primaryColor={
            colors.primary
          }

          formatRadius={
            formatRadius
          }


          onRegionChangeComplete={
            (next)=>{

              setRegion(next);

              setMapPoint({

                latitude:
                  next.latitude,

                longitude:
                  next.longitude,

              });

            }
          }


          onPressCoordinate={
            (
              latitude,
              longitude
            )=>{

              setMapPoint({

                latitude,

                longitude,

              });

            }
          }


          onZonePress={
            (zone)=>{

              const selected =
                zones.find(
                  item =>
                    item.id === zone.id
                );

              if(selected){

                openEdit(selected);

              }

            }
          }

        />



        <View
          style={styles.header}
        >

          <Pressable
            onPress={()=>router.back()}
            style={styles.circleButton}
          >

            <Ionicons
              name="chevron-back"
              size={26}
              color={colors.ink}
            />

          </Pressable>



          <View
            style={styles.headerText}
          >

            <Text
              style={styles.title}
            >
              Safe Zones
            </Text>

            <Text
              style={styles.subtitle}
            >
              Guardian defined locations
            </Text>


          </View>



          <Pressable
            onPress={() =>
              centerMap()
            }

            style={styles.circleButton}
          >

            <Ionicons
              name="locate-outline"
              size={22}
              color={
                colors.primaryDark
              }
            />

          </Pressable>


        </View>



        <View
          style={styles.summary}
        >

          <Ionicons
            name="shield-checkmark-outline"
            size={25}
            color={
              colors.primary
            }
          />


          <View
            style={{
              flex:1,
              marginLeft:12
            }}
          >

            <Text
              style={styles.summaryTitle}
            >

              {activeZones}
              {" "}
              Active Zone
              {activeZones !== 1
                ? "s"
                : ""}

            </Text>


            <Text
              style={styles.summaryText}
            >

              Tap a zone marker to edit
              safe-zone settings.

            </Text>


          </View>


        </View>


      </View>




      <ScrollView

        style={
          styles.scroll
        }

        contentContainerStyle={
          styles.content
        }

        refreshControl={

          <RefreshControl

            refreshing={
              refreshing
            }

            onRefresh={
              refresh
            }

          />

        }

      >


        <Text
          style={styles.section}
        >
          SAVED SAFE ZONES
        </Text>



        {
          loading ? (

            <ActivityIndicator
              size="large"
              color={
                colors.primary
              }
            />

          ) : zones.length === 0 ? (

            <View
              style={styles.empty}
            >

              <Ionicons
                name="location-outline"
                size={48}
                color={
                  colors.primary
                }
              />


              <Text
                style={styles.emptyTitle}
              >
                No safe zones yet
              </Text>


              <Text
                style={styles.emptyText}
              >
                Add Home, School, or other
                trusted locations.
              </Text>

            </View>


          ) : (


            zones.map(zone=>(


              <View
                key={zone.id}
                style={styles.card}
              >


                <Pressable

                  onPress={() =>
                    openEdit(zone)
                  }

                  style={styles.cardMain}

                >


                  <View
                    style={styles.iconBox}
                  >

                    <Ionicons
                      name="shield-outline"
                      size={24}
                      color={
                        colors.primary
                      }
                    />

                  </View>



                  <View
                    style={styles.cardInfo}
                  >

                    <Text
                      style={styles.zoneName}
                    >
                      {zone.name}
                    </Text>


                    <Text
                      style={styles.zoneAddress}
                    >
                      {
                        zone.address ??
                        `${zone.latitude},
${zone.longitude}`
                      }
                    </Text>


                    <Text
                      style={styles.radius}
                    >
                      {formatRadius(
                        zone.radiusMeters
                      )}
                      {" "}
                      radius
                    </Text>


                  </View>


                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={
                      colors.muted
                    }
                  />


                </Pressable>



                <View
                  style={styles.cardFooter}
                >

                  <Text
                    style={styles.enabledText}
                  >
                    {
                      zone.isEnabled
                      ? "Monitoring enabled"
                      : "Paused"
                    }
                  </Text>


                  <Switch

                    value={
                      zone.isEnabled
                    }

                    onValueChange={() =>
                      toggleZone(zone)
                    }

                  />


                </View>


              </View>


            ))

          )
        }



      </ScrollView>




      <View
        style={styles.bottom}
      >

        <Pressable
          onPress={
            openAdd
          }

          style={styles.addButton}

        >

          <Ionicons
            name="add"
            size={28}
            color={
              colors.white
            }
          />

          <Text
            style={styles.addText}
          >
            Add Safe Zone
          </Text>


        </Pressable>


      </View>
            <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModalVisible(false)
        }
      >

        <View
          style={styles.modalOverlay}
        >

          <Pressable
            style={styles.dismiss}
            onPress={() =>
              setModalVisible(false)
            }
          />

          <KeyboardAvoidingView
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }

            style={styles.sheetWrapper}
          >

            <View
              style={styles.sheet}
            >

              <View
                style={styles.handle}
              />



              <View
                style={styles.sheetHeader}
              >

                <Text
                  style={styles.sheetTitle}
                >
                  {
                    editing
                    ? "Edit Safe Zone"
                    : "Add Safe Zone"
                  }
                </Text>


                <Pressable
                  onPress={() =>
                    setModalVisible(false)
                  }
                >

                  <Ionicons
                    name="close"
                    size={28}
                    color={colors.ink}
                  />

                </Pressable>

              </View>



              <ScrollView

                contentContainerStyle={
                  styles.form
                }

                keyboardShouldPersistTaps="handled"

                showsVerticalScrollIndicator={false}

              >


                <Text
                  style={styles.label}
                >
                  Zone Name
                </Text>


                <TextInput

                  value={
                    form.name
                  }

                  onChangeText={
                    value =>
                      updateForm(
                        "name",
                        value
                      )
                  }

                  placeholder="Example: Home"

                  style={
                    styles.input
                  }

                />



                <Text
                  style={styles.label}
                >
                  Address
                </Text>


                <TextInput

                  value={
                    form.address
                  }

                  onChangeText={
                    value =>
                      updateForm(
                        "address",
                        value
                      )
                  }

                  placeholder="Example: Babag II"

                  style={
                    styles.input
                  }

                />



                <View
                  style={styles.row}
                >

                  <TextInput

                    value={
                      form.latitude
                    }

                    onChangeText={
                      value =>
                        updateForm(
                          "latitude",
                          value
                        )
                    }

                    keyboardType="decimal-pad"

                    placeholder="Latitude"

                    style={[
                      styles.input,
                      styles.half
                    ]}

                  />


                  <TextInput

                    value={
                      form.longitude
                    }

                    onChangeText={
                      value =>
                        updateForm(
                          "longitude",
                          value
                        )
                    }

                    keyboardType="decimal-pad"

                    placeholder="Longitude"

                    style={[
                      styles.input,
                      styles.half
                    ]}

                  />

                </View>




                <Text
                  style={styles.label}
                >
                  Radius (meters)
                </Text>


                <TextInput

                  value={
                    form.radiusMeters
                  }

                  onChangeText={
                    value =>
                      updateForm(
                        "radiusMeters",
                        value
                      )
                  }

                  keyboardType="number-pad"

                  style={
                    styles.input
                  }

                />



                <Pressable

                  onPress={
                    saveZone
                  }

                  disabled={
                    saving
                  }

                  style={
                    styles.saveButton
                  }

                >

                  {
                    saving ? (

                      <ActivityIndicator
                        color={
                          colors.white
                        }
                      />

                    ) : (

                      <Ionicons
                        name="checkmark"
                        size={25}
                        color={
                          colors.white
                        }
                      />

                    )
                  }


                  <Text
                    style={styles.saveText}
                  >
                    {
                      editing
                      ? "Save Changes"
                      : "Save Safe Zone"
                    }
                  </Text>


                </Pressable>



                {
                  editing && (

                    <Pressable

                      onPress={() =>
                        deleteZone(
                          editing
                        )
                      }

                      style={styles.deleteButton}

                    >

                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={
                          colors.danger
                        }
                      />

                      <Text
                        style={styles.deleteText}
                      >
                        Delete Safe Zone
                      </Text>


                    </Pressable>

                  )
                }


              </ScrollView>


            </View>


          </KeyboardAvoidingView>


        </View>


      </Modal>


    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:
      colors.background,
  },


  mapContainer:{
    height:300,
    width:"100%",
    overflow:"hidden",
  },


  map:{
    width:"100%",
    height:"100%",
  },


  header:{
    position:"absolute",
    top:18,
    left:18,
    right:18,
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center",
  },


  circleButton:{
    width:50,
    height:50,
    borderRadius:25,
    backgroundColor:
      colors.white,
    justifyContent:"center",
    alignItems:"center",
    ...shadow.card,
  },


  headerText:{
    flex:1,
    marginHorizontal:12,
  },


  title:{
    fontSize:24,
    fontWeight:"900",
    color:colors.ink,
  },


  subtitle:{
    fontSize:12,
    color:colors.muted,
  },


  summary:{
    position:"absolute",
    bottom:12,
    left:16,
    right:16,
    flexDirection:"row",
    padding:15,
    borderRadius:22,
    backgroundColor:
      colors.white,
    ...shadow.card,
  },


  summaryTitle:{
    fontWeight:"900",
    color:colors.ink,
  },


  summaryText:{
    color:colors.muted,
    fontSize:12,
    marginTop:3,
  },


  scroll:{
    flex:1,
  },


  content:{
    padding:spacing.lg,
    paddingBottom:100,
  },


  section:{
    fontWeight:"900",
    color:colors.muted,
    fontSize:11,
    marginBottom:15,
  },


  empty:{
    alignItems:"center",
    padding:30,
  },


  emptyTitle:{
    fontSize:20,
    fontWeight:"900",
    marginTop:10,
    color:colors.ink,
  },


  emptyText:{
    textAlign:"center",
    color:colors.muted,
    marginTop:5,
  },


  card:{
    backgroundColor:
      colors.white,
    borderRadius:20,
    marginBottom:12,
    ...shadow.soft,
  },


  cardMain:{
    flexDirection:"row",
    alignItems:"center",
    padding:15,
  },


  iconBox:{
    width:48,
    height:48,
    borderRadius:15,
    backgroundColor:
      colors.softMint,
    justifyContent:"center",
    alignItems:"center",
  },


  cardInfo:{
    flex:1,
    marginLeft:12,
  },


  zoneName:{
    fontWeight:"900",
    color:colors.ink,
  },


  zoneAddress:{
    fontSize:12,
    color:colors.muted,
    marginTop:3,
  },


  radius:{
    color:colors.primaryDark,
    fontSize:12,
    marginTop:3,
  },


  cardFooter:{
    borderTopWidth:1,
    borderTopColor:colors.border,
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center",
    padding:12,
  },


  enabledText:{
    color:colors.muted,
    fontSize:12,
  },


  bottom:{
    padding:16,
    backgroundColor:
      colors.background,
  },


  addButton:{
    height:60,
    borderRadius:30,
    backgroundColor:
      colors.primary,
    flexDirection:"row",
    justifyContent:"center",
    alignItems:"center",
  },


  addText:{
    color:colors.white,
    fontWeight:"900",
    fontSize:17,
    marginLeft:8,
  },


  modalOverlay:{
    flex:1,
    justifyContent:"flex-end",
    backgroundColor:
      "rgba(0,0,0,0.45)",
  },


  dismiss:{
    flex:1,
  },


  sheetWrapper:{
    width:"100%",
  },


  sheet:{
    maxHeight:"85%",
    backgroundColor:
      colors.white,
    borderTopLeftRadius:30,
    borderTopRightRadius:30,
    overflow:"hidden",
  },


  handle:{
    width:45,
    height:5,
    borderRadius:5,
    backgroundColor:"#D5DDD8",
    alignSelf:"center",
    marginTop:12,
  },


  sheetHeader:{
    flexDirection:"row",
    justifyContent:"space-between",
    padding:20,
  },


  sheetTitle:{
    fontSize:24,
    fontWeight:"900",
    color:colors.ink,
  },


  form:{
    paddingHorizontal:20,
    paddingBottom:40,
  },


  label:{
    fontWeight:"800",
    color:colors.ink,
    marginBottom:6,
    marginTop:12,
  },


  input:{
    height:55,
    borderRadius:16,
    backgroundColor:"#F5F8F6",
    paddingHorizontal:15,
    color:colors.ink,
  },


  row:{
    flexDirection:"row",
    gap:10,
  },


  half:{
    flex:1,
  },


  saveButton:{
    height:60,
    borderRadius:30,
    marginTop:25,
    backgroundColor:
      colors.primary,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
  },


  saveText:{
    color:colors.white,
    fontWeight:"900",
    marginLeft:8,
    fontSize:16,
  },


  deleteButton:{
    height:50,
    justifyContent:"center",
    alignItems:"center",
    flexDirection:"row",
  },


  deleteText:{
    color:colors.danger,
    fontWeight:"900",
    marginLeft:8,
  },


});
