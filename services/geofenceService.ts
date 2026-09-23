import { supabase } from "../lib/supabase";
import type { Geofence, GeofenceEvent } from "../types/safetrack";

export type GeofenceInput = {
  guardianId: string;
  childId: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled?: boolean;
};


function mapGeofence(row: any): Geofence {
  return {
    id: String(row.id),

    guardianId: String(row.guardian_id),
    childId: String(row.child_id),

    name: String(row.name ?? ""),

    address:
      row.address === null || row.address === undefined
        ? undefined
        : String(row.address),

    latitude: Number(row.latitude),
    longitude: Number(row.longitude),

    centerLatitude: Number(row.latitude),
    centerLongitude: Number(row.longitude),

    radiusMeters: Number(row.radius_meters ?? 200),

    isEnabled: Boolean(row.is_enabled),
    isActive: Boolean(row.is_enabled),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}



function mapGeofenceEvent(row: any): GeofenceEvent {
  return {
    id: String(row.id),

    childId: String(row.child_id ?? ""),

    geofenceId:
      row.geofence_id
        ? String(row.geofence_id)
        : null,

    locationLogId:
      row.location_log_id
        ? String(row.location_log_id)
        : null,


    eventType:
      String(
        row.event_type ?? "unknown"
      ),


    title:
      String(
        row.title ??
        "Safe-zone activity"
      ),


    details:
      row.details
        ? String(row.details)
        : null,


    anomalyScore:
      row.anomaly_score === null ||
      row.anomaly_score === undefined
        ? null
        : Number(row.anomaly_score),


    latitude:
      row.latitude === null ||
      row.latitude === undefined
        ? null
        : Number(row.latitude),


    longitude:
      row.longitude === null ||
      row.longitude === undefined
        ? null
        : Number(row.longitude),


    occurredAt:
      String(
        row.occurred_at
      ),
  };
}




export async function fetchGeofences(
  guardianId:string,
  childId:string
):Promise<Geofence[]> {


  const {data,error} =
    await supabase
      .from("geofences")
      .select(`
        id,
        guardian_id,
        child_id,
        name,
        address,
        latitude,
        longitude,
        radius_meters,
        is_enabled,
        created_at,
        updated_at
      `)
      .eq(
        "guardian_id",
        guardianId
      )
      .eq(
        "child_id",
        childId
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if(error){
    throw error;
  }


  return (data ?? [])
    .map(mapGeofence);

}






export async function fetchGeofenceEvents(
  childId:string,
  limit:number = 30
):Promise<GeofenceEvent[]> {


  const {data,error} =
    await supabase
      .from("geofence_events")
      .select("*")
      .eq(
        "child_id",
        childId
      )
      .order(
        "occurred_at",
        {
          ascending:false
        }
      )
      .limit(limit);



  if(error){
    throw error;
  }


  return (data ?? [])
    .map(mapGeofenceEvent);

}








export async function createGeofence(
  input:GeofenceInput
):Promise<Geofence>{


  const radius =
    Math.max(
      20,
      Math.min(
        Number(input.radiusMeters),
        5000
      )
    );



  const {data,error} =
    await supabase
      .from("geofences")
      .insert({

        guardian_id:
          input.guardianId,

        child_id:
          input.childId,


        name:
          input.name.trim(),


        address:
          input.address?.trim() ||
          null,


        latitude:
          Number(input.latitude),


        longitude:
          Number(input.longitude),


        radius_meters:
          Math.round(radius),


        is_enabled:
          input.isEnabled ?? true,


      })
      .select()
      .single();



  if(error){
    throw error;
  }



  return mapGeofence(data);

}








export async function updateGeofence(
  id:string,
  input:Omit<
    GeofenceInput,
    "guardianId" |
    "childId"
  >
):Promise<Geofence>{


  const radius =
    Math.max(
      20,
      Math.min(
        Number(input.radiusMeters),
        5000
      )
    );



  const {data,error} =
    await supabase
      .from("geofences")
      .update({

        name:
          input.name.trim(),


        address:
          input.address?.trim() ||
          null,


        latitude:
          Number(input.latitude),


        longitude:
          Number(input.longitude),


        radius_meters:
          Math.round(radius),


        is_enabled:
          input.isEnabled ?? true,


        updated_at:
          new Date()
            .toISOString(),

      })
      .eq(
        "id",
        id
      )
      .select()
      .single();



  if(error){
    throw error;
  }



  return mapGeofence(data);

}








export async function toggleGeofence(
  id:string,
  enabled:boolean
):Promise<void>{


  const {error} =
    await supabase
      .from("geofences")
      .update({

        is_enabled:
          enabled,


        updated_at:
          new Date()
            .toISOString(),

      })
      .eq(
        "id",
        id
      );



  if(error){
    throw error;
  }

}








export async function deleteGeofence(
  id:string
):Promise<void>{


  const {error} =
    await supabase
      .from("geofences")
      .delete()
      .eq(
        "id",
        id
      );



  if(error){
    throw error;
  }

}