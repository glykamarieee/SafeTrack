import { supabase } from "../lib/supabase";
import type { LocationLog } from "../types/safetrack";


const LOCATION_FIELDS = `
  id,
  child_id,
  latitude,
  longitude,
  accuracy_meters,
  source,
  location_label,
  recorded_at
`;

// Speed and travel mode come with migration 20261104. Until it runs, the
// first query that asks for them fails once and the plain columns are used.
const MOTION_FIELDS = `${LOCATION_FIELDS}, speed_mps, heading_degrees, travel_mode, mode_confidence`;
let motionColumns = true;

async function withMotionFallback<T extends { error: { code?: string; message?: string } | null }>(
  run: (fields: string) => PromiseLike<T>,
): Promise<T> {
  if (!motionColumns) return run(LOCATION_FIELDS);
  const result = await run(MOTION_FIELDS);
  const error = result.error;
  if (error && (error.code === "42703" || /speed_mps|travel_mode|heading_degrees|mode_confidence/.test(error.message ?? ""))) {
    motionColumns = false;
    return run(LOCATION_FIELDS);
  }
  return result;
}



function mapRow(
  row:any,
  childName="Child"
):LocationLog {


  return {

    id: row.id,

    childId:
      row.child_id,

    childName,


    latitude:
      Number(row.latitude),


    longitude:
      Number(row.longitude),


    accuracyMeters:
      row.accuracy_meters == null
      ? undefined
      : Number(row.accuracy_meters),


    source:
      row.source ?? "unknown",


    locationLabel:
      row.location_label ?? undefined,


    recordedAt:
      row.recorded_at,

  };

}





function getDayRange(
  dateKey:string
){

  const start =
    new Date(
      `${dateKey}T00:00:00`
    );


  const end =
    new Date(start);


  end.setDate(
    end.getDate()+1
  );


  return {

    start:
      start.toISOString(),


    end:
      end.toISOString(),

  };

}







export async function fetchLatestLocationForChild(
  childId:string,
  childName="Child"
):Promise<LocationLog|null>{


  const {
    data,
    error
  } = await withMotionFallback((fields) => supabase


  .from("location_logs")


  .select(fields)


  .eq(
    "child_id",
    childId
  )


  .order(
    "recorded_at",
    {
      ascending:false
    }
  )


  .limit(1)


  .maybeSingle());



  if(error)
    throw error;



  return data
    ? mapRow(
        data,
        childName
      )
    : null;

}









export async function fetchLocationHistory(
  childId:string,
  limit=80,
  childName="Child"
):Promise<LocationLog[]>{


  const {
    data,
    error
  } = await withMotionFallback((fields) => supabase


  .from("location_logs")


  .select(fields)


  .eq(
    "child_id",
    childId
  )


  .order(
    "recorded_at",
    {
      ascending:false
    }
  )


  .limit(limit));



  if(error)
    throw error;



  return (
    data ?? []
  )
  .map(
    row =>
      mapRow(
        row,
        childName
      )
  );

}









export async function fetchLocationHistoryForDate(
  childId:string,
  dateKey:string,
  childName="Child"
):Promise<LocationLog[]>{


  const {
    start,
    end
  } =
  getDayRange(dateKey);



  const {
    data,
    error
  } = await withMotionFallback((fields) => supabase


  .from("location_logs")


  .select(fields)


  .eq(
    "child_id",
    childId
  )


  .gte(
    "recorded_at",
    start
  )


  .lt(
    "recorded_at",
    end
  )


  .order(
    "recorded_at",
    {
      ascending:true
    }
  ));



  if(error)
    throw error;



  return (
    data ?? []
  )
  .map(
    row =>
      mapRow(
        row,
        childName
      )
  );

}









export async function fetchAllLocationRecords(
  limit=50
):Promise<LocationLog[]>{


  const {
    data,
    error
  } = await withMotionFallback((fields) => supabase


  .from("location_logs")


  .select(fields)


  .order(
    "recorded_at",
    {
      ascending:false
    }
  )


  .limit(limit));



  if(error)
    throw error;



  return (
    data ?? []
  )
  .map(
    row =>
      mapRow(row)
  );

}