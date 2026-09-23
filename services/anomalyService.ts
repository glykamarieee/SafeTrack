import { supabase } from "../lib/supabase";

import type { SafetyTimelineItem } from "./safetyEventsService";



export async function fetchAnomaliesForChild(
  childId:string
):Promise<SafetyTimelineItem[]> {


  const {
    data,
    error
  }

  =
  await supabase


  .from("safety_events")


  .select("*")


  .eq(
    "child_id",
    childId
  )


  .eq(
    "event_type",
    "possible_anomaly"
  )


  .order(
    "occurred_at",
    {
      ascending:false
    }
  );



  if(error){

    throw error;

  }




  return (
    data ?? []
  )
  .map(
    row=>({

      id:
      row.id,


      kind:
      "possible_anomaly",


      title:
      row.title ??
      "Possible unusual activity",


      details:
      row.details ??
      null,


      occurredAt:
      row.occurred_at,


      latitude:
      row.latitude
      ?
      Number(row.latitude)
      :
      null,


      longitude:
      row.longitude
      ?
      Number(row.longitude)
      :
      null,


      anomalyScore:
      row.anomaly_score
      ?
      Number(row.anomaly_score)
      :
      null,


      status:
      row.status

    })
  );


}






export async function acknowledgeAnomaly(
  anomalyId:string
){


  const {
    error
  }

  =
  await supabase


  .from("safety_events")


  .update({

    status:
    "acknowledged"


  })


  .eq(
    "id",
    anomalyId
  );



  if(error){

    throw error;

  }


}