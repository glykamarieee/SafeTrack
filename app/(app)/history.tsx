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
  useWindowDimensions,
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
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";





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

  const { width } = useWindowDimensions();
  const wide = width >= 1040;


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


  const eventIcon = (type: HistoryEvent["type"]): keyof typeof Ionicons.glyphMap => {
    if (type === "sos") return "warning-outline";
    if (type === "anomaly") return "analytics-outline";
    if (type === "watch_disconnected") return "watch-outline";
    if (type === "prolonged_inactivity") return "hourglass-outline";
    return "shield-checkmark-outline";
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DAILY ACTIVITY HISTORY</Text>
        <Text style={styles.heading}>A day, retraced with context.</Text>
        <Text style={styles.subtitle}>
          Review recorded route points and safety events for {child?.fullName ?? "your child"}.
        </Text>

        <View style={styles.dateDeck}>
          <Pressable
            accessibilityLabel="Previous date"
            onPress={() => setSelectedDate((value) => moveDate(value, -1))}
            style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primaryDeep} />
          </Pressable>

          <View style={styles.dateCenter}>
            <Text style={styles.dateEyebrow}>SELECTED DATE</Text>
            <Text style={styles.dateTitle}>{selectedLabel}</Text>
          </View>

          <Pressable
            accessibilityLabel="Next date"
            disabled={selectedDate >= today}
            onPress={() => setSelectedDate((value) => moveDate(value, 1))}
            style={({ pressed }) => [
              styles.dateArrow,
              selectedDate >= today && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primaryDeep} />
          </Pressable>
        </View>

        <View style={styles.mapTopline}>
          <View>
            <Text style={styles.mapTitle}>Route canvas</Text>
            <Text style={styles.mapSubtitle}>Start, latest point, and recorded path for the day.</Text>
          </View>
          <Pressable
            onPress={() => setRecenterSignal((value) => value + 1)}
            style={({ pressed }) => [styles.fitButton, pressed && styles.pressed]}
          >
            <Ionicons name="scan-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.fitText}>Fit</Text>
          </Pressable>
        </View>

        <View style={styles.mapContainer}>
          <SafeTrackInteractiveMap
            markers={mapMarkers}
            path={mapPath}
            height={wide ? 520 : 370}
            recenterSignal={recenterSignal}
            mapStyleControlTop={16}
            mapStyleControlLeft={16}
          />

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading history</Text>
            </View>
          )}

          {!loading && points.length === 0 && (
            <View style={styles.emptyMap}>
              <View style={styles.emptyMapIcon}>
                <Ionicons name="map-outline" size={26} color={colors.primaryDark} />
              </View>
              <Text style={styles.emptyTitle}>No route recorded</Text>
              <Text style={styles.emptyText}>
                {message || "No stored location data is available for this date."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metricsRail}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{points.length}</Text>
            <Text style={styles.metricLabel}>Records</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{distanceLabel(routeDistance)}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{recordedSpan} min</Text>
            <Text style={styles.metricLabel}>Recorded span</Text>
          </View>
        </View>

        <View style={styles.timelineHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>SAFETY TIMELINE</Text>
            <Text style={styles.sectionTitle}>Events in chronological context</Text>
          </View>
          <View style={styles.eventCountChip}>
            <Text style={styles.eventCountText}>{events.length} event{events.length === 1 ? "" : "s"}</Text>
          </View>
        </View>

        {events.length > 0 ? (
          <View style={styles.timeline}>
            {events.map((event, index) => {
              const isDanger = event.type === "sos";
              const isWarning = event.type === "anomaly";
              return (
                <View key={`${event.type}-${event.id}`} style={styles.timelineItem}>
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        isDanger && styles.timelineDotDanger,
                        isWarning && styles.timelineDotWarning,
                      ]}
                    >
                      <Ionicons
                        name={eventIcon(event.type)}
                        size={15}
                        color={isDanger ? colors.danger : isWarning ? colors.warning : colors.primaryDark}
                      />
                    </View>
                    {index < events.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  <View style={styles.eventBody}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventTime}>{timeLabel(event.occurredAt)}</Text>
                    </View>
                    <Text style={styles.eventText}>{event.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.noEvents}>
            <View style={styles.noEventsIcon}>
              <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.noEventsCopy}>
              <Text style={styles.noEventsTitle}>Quiet day in the safety timeline</Text>
              <Text style={styles.noEventsText}>No safety events were recorded for this selected date.</Text>
            </View>
          </View>
        )}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.noteText}>
            History contains only successfully stored records from the child&apos;s selected tracking source: {trackingSource === "mobile" ? "mobile device." : trackingSource === "smartwatch" ? "smartwatch." : "smartwatch and mobile devices."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 30,
    paddingBottom: 120,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  heading: {
    maxWidth: 360,
    marginTop: 7,
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.85,
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 7,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  dateDeck: {
    minHeight: 74,
    marginTop: 22,
    paddingHorizontal: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  dateArrow: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateEyebrow: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1,
  },
  dateTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.3,
  },
  mapTopline: {
    marginTop: 24,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapTitle: {
    color: colors.ink,
    fontSize: 16.5,
    fontWeight: "900",
  },
  mapSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10.5,
  },
  fitButton: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.softMint,
  },
  fitText: {
    marginLeft: 5,
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
  },
  mapContainer: {
    height: 370,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadow.card,
  },
  loadingOverlay: {
    position: "absolute",
    left: 16,
    bottom: 16,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.glass,
    ...shadow.soft,
  },
  loadingText: {
    marginLeft: 7,
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "700",
  },
  emptyMap: {
    position: "absolute",
    left: 26,
    right: 26,
    top: 112,
    paddingVertical: 21,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.9)",
    ...shadow.floating,
  },
  emptyMapIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  emptyTitle: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  metricsRail: {
    minHeight: 88,
    marginTop: 14,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "700",
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  timelineHeader: {
    marginTop: 31,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 16.5,
    fontWeight: "900",
  },
  eventCountChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  eventCountText: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
  },
  timeline: {
    paddingLeft: 2,
  },
  timelineItem: {
    minHeight: 88,
    flexDirection: "row",
  },
  timelineRail: {
    width: 44,
    alignItems: "center",
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineDotDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#F4C5C9",
  },
  timelineDotWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: "#F3D7A0",
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    marginVertical: 5,
    backgroundColor: colors.border,
  },
  eventBody: {
    flex: 1,
    paddingLeft: 9,
    paddingBottom: 18,
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  eventTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },
  eventTime: {
    marginLeft: 10,
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "800",
  },
  eventText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  noEvents: {
    padding: 15,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.softMint,
  },
  noEventsIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  noEventsCopy: {
    flex: 1,
    marginLeft: 11,
  },
  noEventsTitle: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "900",
  },
  noEventsText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  note: {
    marginTop: 25,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noteText: {
    flex: 1,
    marginLeft: 8,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
