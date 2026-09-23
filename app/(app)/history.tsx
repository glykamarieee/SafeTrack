import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";


import {
  useAuthStore,
} from "../../store/authStore";


import {
  supabase,
} from "../../lib/supabase";


import {
  SafeTrackInteractiveMap,
  type SafeTrackMapMarker,
} from "../../components/location/SafeTrackInteractiveMap";


import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";





type LocationPoint = {

  id:string;

  latitude:number;

  longitude:number;

  source:string;

  label:string|null;

  accuracy:number|null;

  recordedAt:string;

};





type HistoryEvent = {

  id:string;

  type:
    | "geofence"
    | "sos"
    | "anomaly"
    | "watch_disconnected"
    | "prolonged_inactivity";

  title:string;

  detail:string;

  occurredAt:string;

  latitude?:number|null;

  longitude?:number|null;

};









function getDateKey(
  date=new Date()
){

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:"Asia/Manila",
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
      }
    )
    .formatToParts(date);



  const year =
    parts.find(
      item=>item.type==="year"
    )
    ?.value
    ??
    "2026";



  const month =
    parts.find(
      item=>item.type==="month"
    )
    ?.value
    ??
    "01";



  const day =
    parts.find(
      item=>item.type==="day"
    )
    ?.value
    ??
    "01";



  return `${year}-${month}-${day}`;

}







function moveDate(
  value:string,
  days:number
){


  const [
    year,
    month,
    day
  ] =
  value
  .split("-")
  .map(Number);



  const date =
    new Date(
      Date.UTC(
        year,
        month-1,
        day,
        12
      )
    );



  date.setUTCDate(
    date.getUTCDate()+days
  );



  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth()+1
  ).padStart(2,"0")}-${String(
    date.getUTCDate()
  ).padStart(2,"0")}`;

}







function getDateRange(
  value:string
){

  const start =
    new Date(
      `${value}T00:00:00+08:00`
    );



  return {

    start:
      start.toISOString(),


    end:
      new Date(
        start.getTime()
        +
        86400000
      )
      .toISOString(),

  };

}







function dateLabel(
  value:string,
  today:string
){


  if(value===today){

    return "Today";

  }



  if(
    value===moveDate(
      today,
      -1
    )
  ){

    return "Yesterday";

  }



  return new Date(
    `${value}T12:00:00+08:00`
  )
  .toLocaleDateString(
    "en-PH",
    {
      month:"short",
      day:"numeric",
      year:"numeric",
    }
  );

}







function timeLabel(
  value:string
){

  return new Date(value)
    .toLocaleTimeString(
      "en-PH",
      {
        timeZone:"Asia/Manila",
        hour:"numeric",
        minute:"2-digit",
      }
    );

}







function validCoordinate(
  latitude:number,
  longitude:number
){

  return (

    Number.isFinite(latitude)

    &&

    Number.isFinite(longitude)

    &&

    latitude>=-90

    &&

    latitude<=90

    &&

    longitude>=-180

    &&

    longitude<=180

  );

}







function calculateDistance(
  first:LocationPoint,
  second:LocationPoint
){


  const radians =
    (value:number)=>
      value*Math.PI/180;



  const earthRadius =
    6371000;



  const latitudeDifference =
    radians(
      second.latitude-first.latitude
    );



  const longitudeDifference =
    radians(
      second.longitude-first.longitude
    );



  const calculation =

    Math.sin(
      latitudeDifference/2
    ) ** 2

    +

    Math.cos(
      radians(first.latitude)
    )

    *

    Math.cos(
      radians(second.latitude)
    )

    *

    Math.sin(
      longitudeDifference/2
    ) ** 2;



  return (
    earthRadius
    *
    2
    *
    Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(
        1-calculation
      )
    )
  );

}







function totalDistance(
  points:LocationPoint[]
){

  return points.reduce(
    (
      total,
      point,
      index
    )=>{

      if(index===0){

        return total;

      }


      return (
        total
        +
        calculateDistance(
          points[index-1],
          point
        )
      );


    },
    0
  );

}







function distanceLabel(
  meters:number
){

  if(!meters){

    return "No route";

  }



  if(meters<1000){

    return `${Math.round(meters)} m`;

  }



  return `${(
    meters/1000
  ).toFixed(1)} km`;

}







export default function HistoryScreen(){


  const child =
  useAuthStore(
    state=>state.linkedChildren?.[0] ?? null
  );

  const trackingSource =
child?.trackingSource ??
"mobile";



  const today =
    useMemo(
      ()=>getDateKey(),
      []
    );



  const [
    selectedDate,
    setSelectedDate
  ] =
  useState(today);



  const [
    points,
    setPoints
  ] =
  useState<LocationPoint[]>([]);



  const [
    events,
    setEvents
  ] =
  useState<HistoryEvent[]>([]);



  const [
    loading,
    setLoading
  ] =
  useState(true);



  const [
    message,
    setMessage
  ] =
  useState("");



  const [
    recenterSignal,
    setRecenterSignal
  ] =
  useState(0);

  const loadHistory =
  useCallback(
    async()=>{

      if(!child?.id){

        setPoints([]);

        setEvents([]);

        setLoading(false);

        setMessage(
          "No child profile is available."
        );

        return;

      }



      setLoading(true);

      setMessage("");



      try{


        const {
          start,
          end
        } =
        getDateRange(
          selectedDate
        );



        const [

          locationsResult,

          safetyEventsResult,

          sosResult,

        ] = await Promise.all([


          supabase

          .from("location_logs")

          .select(
            `
            id,
            latitude,
            longitude,
            source,
            location_label,
            accuracy_meters,
            recorded_at
            `
          )

          .eq(
            "child_id",
            child.id
          )

          .gte(
            "recorded_at",
            start
          )

          .lt(
            "recorded_at",
            end
          )

          .in(
            "source",
            trackingSource === "mobile"
              ? ["mobile", "child_mobile"]
              : trackingSource === "smartwatch"
              ? ["smartwatch", "watch"]
              : ["mobile", "child_mobile", "smartwatch", "watch"]
          )

          .order(
            "recorded_at",
            {
              ascending:true
            }
          ),






          supabase

          .from("safety_events")

          .select(
            `
            id,
            event_type,
            title,
            details,
            latitude,
            longitude,
            occurred_at
            `
          )

          .eq(
            "child_id",
            child.id
          )

          .gte(
            "occurred_at",
            start
          )

          .lt(
            "occurred_at",
            end
          )

          .order(
            "occurred_at",
            {
              ascending:false
            }
          ),






          supabase

          .from("sos_alerts")

          .select(
            `
            id,
            activation_method,
            triggered_at,
            latitude,
            longitude
            `
          )

          .eq(
            "child_id",
            child.id
          )

          .gte(
            "triggered_at",
            start
          )

          .lt(
            "triggered_at",
            end
          )

          .order(
            "triggered_at",
            {
              ascending:false
            }
          ),

        ]);





        if(locationsResult.error){

          throw locationsResult.error;

        }



        if(safetyEventsResult.error){

          throw safetyEventsResult.error;

        }



        if(sosResult.error){

          throw sosResult.error;

        }







        const locationPoints:LocationPoint[] =

          (locationsResult.data ?? [])

          .map(
            row=>({

              id:String(row.id),

              latitude:Number(
                row.latitude
              ),

              longitude:Number(
                row.longitude
              ),

              source:
                String(
                  row.source ??
                  "smartwatch"
                ),


              label:
                row.location_label
                ?
                String(
                  row.location_label
                )
                :
                null,


              accuracy:
                row.accuracy_meters===null
                ?
                null
                :
                Number(
                  row.accuracy_meters
                ),


              recordedAt:
                String(
                  row.recorded_at
                ),

            })
          )

          .filter(
            point=>
              validCoordinate(
                point.latitude,
                point.longitude
              )
          );









        const safetyEvents:HistoryEvent[] =


          (safetyEventsResult.data ?? [])

          .map(
            row=>{


              const eventType =
                String(
                  row.event_type
                );



              let type:
              HistoryEvent["type"] =
                "geofence";



              if(
                eventType==="possible_anomaly"
              ){

                type="anomaly";

              }

              else if(
                eventType==="watch_disconnected"
              ){

                type="watch_disconnected";

              }

              else if(
                eventType==="prolonged_inactivity"
              ){

                type="prolonged_inactivity";

              }



              return {

                id:String(
                  row.id
                ),


                type,


                title:
                  String(
                    row.title ??
                    "Safety event"
                  ),


                detail:
                  String(
                    row.details ??
                    eventType.replaceAll(
                      "_",
                      " "
                    )
                  ),


                occurredAt:
                  String(
                    row.occurred_at
                  ),


                latitude:
                  row.latitude===null
                  ?
                  null
                  :
                  Number(
                    row.latitude
                  ),


                longitude:
                  row.longitude===null
                  ?
                  null
                  :
                  Number(
                    row.longitude
                  ),

              };

            }

          );









        const sosEvents:HistoryEvent[] =


          (sosResult.data ?? [])

          .map(
            row=>({

              id:
                String(
                  row.id
                ),


              type:
                "sos" as const,


              title:
                "SOS Alert",


              detail:
                `Activation method: ${
                  String(
                    row.activation_method ??
                    "unknown"
                  )
                  .replaceAll(
                    "_",
                    " "
                  )
                }`,


              occurredAt:
                String(
                  row.triggered_at
                ),


              latitude:
                row.latitude===null
                ?
                null
                :
                Number(
                  row.latitude
                ),


              longitude:
                row.longitude===null
                ?
                null
                :
                Number(
                  row.longitude
                ),

            })

          );








        setPoints(
          locationPoints
        );



        setEvents(

          [

            ...safetyEvents,

            ...sosEvents,

          ]

          .sort(
            (
              first,
              second
            )=>

              new Date(
                second.occurredAt
              )
              .getTime()

              -

              new Date(
                first.occurredAt
              )
              .getTime()

          )

        );



      }

      catch(reason){


        setPoints([]);

        setEvents([]);



        setMessage(

          reason instanceof Error

          ?

          reason.message

          :

          "Unable to load daily activity history."

        );


      }


      finally{


        setLoading(false);


      }


    },

    [
      child?.id,
      selectedDate,
      trackingSource,
    ]

  );






useEffect(
  ()=>{

    void loadHistory();

  },

  [
    loadHistory
  ]

);









const mapPath =

  useMemo(

    ()=>


      points.map(
        point=>({

          latitude:
            point.latitude,


          longitude:
            point.longitude,

        })

      ),


    [
      points
    ]

  );









const mapMarkers =

  useMemo<SafeTrackMapMarker[]>(

    ()=>{


      if(!points.length){

        return [];

      }



      const first =
        points[0];



      const latest =
        points[
          points.length-1
        ];




      return [

        {

          id:
            `${first.id}-start`,


          latitude:
            first.latitude,


          longitude:
            first.longitude,


          title:
            "Starting location",


          detail:
            `Recorded ${timeLabel(first.recordedAt)}`,


          kind:
            "start",

        },



        {

          id:
            `${latest.id}-latest`,


          latitude:
            latest.latitude,


          longitude:
            latest.longitude,


          title:
            latest.label ??
            "Latest location",


          detail:
            `Recorded ${timeLabel(latest.recordedAt)}`,


          kind:
            "end",

        },


      ];


    },

    [
      points
    ]

  );









const routeDistance =
  totalDistance(
    points
  );




const firstPoint =
  points[0];



const latestPoint =
  points[
    points.length-1
  ];




const recordedSpan =

  firstPoint && latestPoint

  ?

  Math.max(

    0,

    Math.floor(

      (

        new Date(
          latestPoint.recordedAt
        )
        .getTime()

        -

        new Date(
          firstPoint.recordedAt
        )
        .getTime()

      )

      /

      60000

    )

  )

  :

  0;






const selectedLabel =
  dateLabel(
    selectedDate,
    today
  );

  return (

  <SafeAreaView
    style={styles.safe}
    edges={[
      "top",
      "left",
      "right"
    ]}
  >

    <ScrollView

      style={styles.flex}

      contentContainerStyle={
        styles.content
      }

      showsVerticalScrollIndicator={false}

    >


      <Text style={styles.eyebrow}>
        DAILY ACTIVITY HISTORY
      </Text>



      <Text style={styles.heading}>
        Activity, in one view.
      </Text>



      <Text style={styles.subtitle}>

        Review available route records and
        safety events for{" "}

        {child?.fullName ?? "your child"}.

      </Text>





      <View style={styles.dateNav}>


        <Pressable

          style={({pressed})=>[
            styles.dateButton,
            pressed &&
            styles.pressed
          ]}

          onPress={()=>setSelectedDate(
            value=>moveDate(value,-1)
          )}

        >

          <Ionicons

            name="chevron-back"

            size={20}

            color={colors.primaryDark}

          />

        </Pressable>





        <View style={styles.dateCenter}>


          <Text style={styles.dateTitle}>
            {selectedLabel}
          </Text>


          <Text style={styles.dateSubtitle}>
            Selected activity date
          </Text>


        </View>





        <Pressable

          disabled={
            selectedDate>=today
          }

          style={({pressed})=>[

            styles.dateButton,

            selectedDate>=today &&
            styles.disabled,

            pressed &&
            styles.pressed

          ]}

          onPress={()=>setSelectedDate(
            value=>moveDate(value,1)
          )}

        >

          <Ionicons

            name="chevron-forward"

            size={20}

            color={colors.primaryDark}

          />

        </Pressable>


      </View>






      <View style={styles.mapContainer}>


        <SafeTrackInteractiveMap

          markers={mapMarkers}

          path={mapPath}

          height={320}

          recenterSignal={
            recenterSignal
          }

          mapStyleControlTop={14}

          mapStyleControlLeft={14}

        />



        {
          loading && (

            <View style={styles.loadingOverlay}>

              <ActivityIndicator

                size="small"

                color={colors.primary}

              />

              <Text style={styles.loadingText}>
                Loading history...
              </Text>


            </View>

          )
        }



        {
          !loading &&
          points.length===0 && (

            <View style={styles.emptyMap}>


              <Ionicons

                name="map-outline"

                size={30}

                color={colors.primary}

              />


              <Text style={styles.emptyTitle}>
                No location records
              </Text>


              <Text style={styles.emptyText}>

                {message ||
                "No stored location data is available for this date."}

              </Text>


            </View>

          )
        }


      </View>







      <View style={styles.mapActions}>


        <Text style={styles.mapHint}>

          Drag and zoom the map to inspect
          available route records.

        </Text>



        <Pressable

          style={({pressed})=>[

            styles.fitButton,

            pressed &&
            styles.pressed

          ]}

          onPress={()=>setRecenterSignal(
            value=>value+1
          )}

        >

          <Ionicons

            name="scan-outline"

            size={16}

            color={colors.primaryDark}

          />

          <Text style={styles.fitText}>
            Fit route
          </Text>


        </Pressable>


      </View>









      <View style={styles.metrics}>


        <View style={styles.metric}>

          <Text style={styles.metricValue}>
            {points.length}
          </Text>


          <Text style={styles.metricLabel}>
            Records
          </Text>


        </View>




        <View style={styles.divider}/>




        <View style={styles.metric}>

          <Text style={styles.metricValue}>
            {distanceLabel(routeDistance)}
          </Text>


          <Text style={styles.metricLabel}>
            Distance
          </Text>


        </View>





        <View style={styles.divider}/>



        <View style={styles.metric}>

          <Text style={styles.metricValue}>
            {recordedSpan} min
          </Text>


          <Text style={styles.metricLabel}>
            Duration
          </Text>


        </View>


      </View>









      <Text style={styles.sectionTitle}>
        Safety Timeline
      </Text>






      {
        events.length > 0

        ?

        events.map(event=>(


          <View

            key={`${event.type}-${event.id}`}

            style={styles.eventCard}

          >



            <View

              style={[
                styles.eventIcon,

                event.type==="sos" &&
                styles.eventDanger,

                event.type==="anomaly" &&
                styles.eventWarning,

              ]}

            >

              <Ionicons

                name={

                  event.type==="sos"

                  ?

                  "warning-outline"

                  :

                  event.type==="anomaly"

                  ?

                  "analytics-outline"

                  :

                  "shield-checkmark-outline"

                }

                size={20}

                color={

                  event.type==="sos"

                  ?

                  colors.danger

                  :

                  colors.primary

                }

              />

            </View>




            <View style={styles.eventBody}>


              <Text style={styles.eventTitle}>
                {event.title}
              </Text>



              <Text style={styles.eventText}>

                {event.detail}

              </Text>



              <Text style={styles.eventTime}>

                {timeLabel(event.occurredAt)}

              </Text>


            </View>


          </View>


        ))



        :


        <View style={styles.noEvents}>


          <Ionicons

            name="checkmark-circle-outline"

            size={24}

            color={colors.primary}

          />


          <Text style={styles.noEventsText}>

            No safety events recorded for this date.

          </Text>


        </View>


      }






      <View style={styles.note}>


        <Ionicons

          name="information-circle-outline"

          size={18}

          color={colors.primary}

        />


        <Text style={styles.noteText}>

          History displays records from the child's selected tracking source:
          {trackingSource === "mobile"
            ? " mobile device."
            : trackingSource === "smartwatch"
            ? " smartwatch."
            : " smartwatch and mobile devices."}

        </Text>


      </View>



    </ScrollView>


  </SafeAreaView>

);

}








const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:colors.background,
},


flex:{
  flex:1,
},


content:{
  paddingHorizontal:spacing.lg,
  paddingTop:35,
  paddingBottom:40,
},


eyebrow:{
  color:colors.primary,
  fontSize:10,
  fontWeight:"900",
  letterSpacing:1.2,
},


heading:{
  marginTop:5,
  color:colors.ink,
  fontSize:29,
  fontWeight:"900",
},


subtitle:{
  marginTop:7,
  color:colors.muted,
  fontSize:13,
  lineHeight:19,
},


dateNav:{
  marginTop:20,
  height:64,
  flexDirection:"row",
  alignItems:"center",
  justifyContent:"space-between",
},


dateButton:{
  width:40,
  height:40,
  borderRadius:20,
  alignItems:"center",
  justifyContent:"center",
  backgroundColor:colors.softMint,
},


dateCenter:{
  alignItems:"center",
},


dateTitle:{
  color:colors.ink,
  fontSize:15,
  fontWeight:"900",
},


dateSubtitle:{
  color:colors.muted,
  fontSize:11,
},


mapContainer:{
  height:320,
  marginTop:10,
  borderRadius:radius.lg,
  overflow:"hidden",
  ...shadow.card,
},


loadingOverlay:{
  position:"absolute",
  right:15,
  top:15,
  flexDirection:"row",
  alignItems:"center",
  padding:10,
  borderRadius:radius.pill,
  backgroundColor:"#fff",
},


loadingText:{
  marginLeft:7,
  fontSize:11,
  color:colors.muted,
},


emptyMap:{
  position:"absolute",
  left:25,
  right:25,
  top:90,
  padding:20,
  alignItems:"center",
  backgroundColor:"#fff",
  borderRadius:radius.md,
},


emptyTitle:{
  marginTop:8,
  fontWeight:"900",
  color:colors.ink,
},


emptyText:{
  marginTop:5,
  textAlign:"center",
  color:colors.muted,
  fontSize:12,
},


mapActions:{
  flexDirection:"row",
  alignItems:"center",
  justifyContent:"space-between",
  marginVertical:10,
},


mapHint:{
  flex:1,
  fontSize:11,
  color:colors.muted,
},


fitButton:{
  flexDirection:"row",
  alignItems:"center",
  paddingHorizontal:12,
  paddingVertical:7,
  borderRadius:radius.pill,
  backgroundColor:colors.softMint,
},


fitText:{
  marginLeft:5,
  fontSize:11,
  fontWeight:"900",
  color:colors.primaryDark,
},


metrics:{
  flexDirection:"row",
  backgroundColor:colors.white,
  paddingVertical:16,
  borderRadius:radius.md,
  ...shadow.soft,
},


metric:{
  flex:1,
  alignItems:"center",
},


metricValue:{
  fontWeight:"900",
  fontSize:16,
  color:colors.ink,
},


metricLabel:{
  marginTop:3,
  fontSize:10,
  color:colors.muted,
},


divider:{
  width:1,
  backgroundColor:colors.border,
},


sectionTitle:{
  marginTop:24,
  marginBottom:10,
  fontSize:17,
  fontWeight:"900",
  color:colors.ink,
},


eventCard:{
  flexDirection:"row",
  padding:14,
  marginBottom:10,
  borderRadius:radius.md,
  backgroundColor:colors.white,
  ...shadow.soft,
},


eventIcon:{
  width:42,
  height:42,
  borderRadius:14,
  alignItems:"center",
  justifyContent:"center",
  backgroundColor:colors.softMint,
},


eventDanger:{
  backgroundColor:colors.dangerSoft,
},


eventWarning:{
  backgroundColor:colors.warningSoft,
},


eventBody:{
  flex:1,
  marginLeft:10,
},


eventTitle:{
  fontWeight:"900",
  color:colors.ink,
},


eventText:{
  marginTop:3,
  color:colors.muted,
  fontSize:12,
},


eventTime:{
  marginTop:4,
  color:colors.primaryDark,
  fontSize:11,
  fontWeight:"800",
},


noEvents:{
  flexDirection:"row",
  alignItems:"center",
  padding:14,
  borderRadius:radius.md,
  backgroundColor:colors.softMint,
},


noEventsText:{
  marginLeft:8,
  color:colors.primaryDark,
  fontSize:12,
},


note:{
  marginTop:20,
  padding:14,
  flexDirection:"row",
  backgroundColor:colors.softMint,
  borderRadius:radius.md,
},


noteText:{
  flex:1,
  marginLeft:8,
  color:"#547067",
  fontSize:11.5,
  lineHeight:17,
},


disabled:{
  opacity:.4,
},


pressed:{
  opacity:.75,
  transform:[
    {
      scale:.97
    }
  ],
},

});