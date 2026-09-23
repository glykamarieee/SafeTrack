import { supabase } from "../lib/supabase";


/*
=====================================================
CHILD MOBILE TYPES
=====================================================
*/

export type ChildMobileContext = {
  childId: string;

  childName: string;

  guardianName?: string | null;

  guardianEmail?: string | null;

  trackingSource:
    | "mobile"
    | "smartwatch"
    | "both"
    | string;

  mobileDeviceActive: boolean;

  deviceId?: string | null;

  deviceToken?: string | null;

  isLinked?: boolean;

  latestLocation?: {
    id: string;
    childId: string;

    latitude: number;
    longitude: number;

    accuracyMeters?: number | null;

    source: string;

    recordedAt: string;
  } | null;
};



export type ChildMobileLocation = {

  latitude:number;

  longitude:number;

  accuracy?:number;

  speed?:number;

  heading?:number;

  timestamp?:string;

};



export type ChildMobileSosAlert = {

  id:string;

  childId:string;

  status:
  | "active"
  | "acknowledged"
  | "resolved"
  | "canceled";


  activationMethod:string;


  triggeredAt:string;


  acknowledgedAt?:string|null;


  realertCount:number;


  latitude?:number|null;


  longitude?:number|null;


  locationSource?:string|null;


  createdAt?:string|null;

};



export type ChildSafeZoneStatus = {

  status:
  | "inside"
  | "outside"
  | "no_safe_zone"
  | "unavailable";


  zoneName?:string|null;


  message:string;


  latestLocationAt?:string|null;

};




/*
=====================================================
AUTH
=====================================================
*/


async function getCurrentUserId(){

  const {
    data,
    error
  } =
  await supabase.auth.getUser();


  if(error)
    throw error;


  if(!data.user){

    throw new Error(
      "Child account session expired."
    );

  }


  return data.user.id;

}




async function parseFunctionError(error:any){

  return (
    error?.message ??
    "Request failed."
  );

}





/*
=====================================================
LINK CHILD MOBILE DEVICE
=====================================================
*/


export async function linkChildMobileDevice(
  connectionCode:string
){

  const {
    data,
    error
  } =
  await supabase.functions.invoke(
    "mobile-pair",
    {
      body:{
        connectionCode:
          connectionCode.trim(),
      },
    }
  );


  if(error){

    throw new Error(
      await parseFunctionError(error)
    );

  }


  if(!data?.ok){

    throw new Error(
      data?.error ??
      "Unable to link mobile device."
    );

  }


  return data;

}




/*
=====================================================
FETCH CHILD CONTEXT
=====================================================
*/


export async function fetchChildMobileContext(
  childId?:string
):Promise<ChildMobileContext>{


  const id =
    childId ??
    await getCurrentUserId();



  const {
    data:child,
    error
  } =
  await supabase
    .from("child_profiles")
    .select(
      `
      id,
      full_name,
      guardian_id,
      tracking_source
      `
    )
    .eq(
      "id",
      id
    )
    .maybeSingle();



  if(error)
    throw error;



  if(!child){

    throw new Error(
      "Child profile not found."
    );

  }



  const {
    data:guardian
  } =
  await supabase
    .from("persons")
    .select(
      `
      full_name,
      email
      `
    )
    .eq(
      "id",
      child.guardian_id
    )
    .maybeSingle();



  const {
    data:device
  } =
  await supabase
    .from("child_mobile_devices")
    .select(
      `
      id,
      device_token
      `
    )
    .eq(
      "child_id",
      child.id
    )
    .maybeSingle();



  const {
    data:location
  } =
  await supabase
    .from("location_logs")
    .select(
      `
      id,
      child_id,
      latitude,
      longitude,
      accuracy_meters,
      source,
      recorded_at
      `
    )
    .eq(
      "child_id",
      child.id
    )
    .order(
      "recorded_at",
      {
        ascending:false
      }
    )
    .limit(1)
    .maybeSingle();



  return {

    childId:
      child.id,


    childName:
      child.full_name,


    guardianName:
      guardian?.full_name ??
      null,


    guardianEmail:
      guardian?.email ??
      null,


    trackingSource:
      child.tracking_source ??
      "smartwatch",


    mobileDeviceActive:
      !!device,


    deviceId:
      device?.id ??
      null,


    deviceToken:
      device?.device_token ??
      null,


    isLinked:
      !!device,


    latestLocation:
      location
      ?
      {
        id:
          location.id,

        childId:
          location.child_id,

        latitude:
          location.latitude,

        longitude:
          location.longitude,

        accuracyMeters:
          location.accuracy_meters,

        source:
          location.source,

        recordedAt:
          location.recorded_at,

      }
      :
      null,

  };

}





/*
=====================================================
SEND LOCATION
=====================================================
*/


export async function sendChildMobileLocation(
  location:ChildMobileLocation
){

  const {
    data,
    error
  } =
  await supabase.functions.invoke(
    "mobile-ingest",
    {
      body:{
        latitude:
          location.latitude,

        longitude:
          location.longitude,

        accuracy:
          location.accuracy,

        speed:
          location.speed,

        heading:
          location.heading,

        timestamp:
          location.timestamp ??
          new Date().toISOString(),
      }
    }
  );


  if(error){

    throw new Error(
      await parseFunctionError(error)
    );

  }


  return data;

}




/*
=====================================================
SAFE ZONE STATUS
=====================================================
*/


export async function fetchChildSafeZoneStatus(
  childId:string
):Promise<ChildSafeZoneStatus>{


  const {
    data:zone
  } =
  await supabase
    .from("safe_zones")
    .select(
      `
      name
      `
    )
    .eq(
      "child_id",
      childId
    )
    .eq(
      "is_enabled",
      true
    )
    .limit(1)
    .maybeSingle();



  if(!zone){

    return {

      status:
        "no_safe_zone",

      zoneName:
        null,

      message:
        "No safe zone assigned.",

    };

  }



  return {

    status:
      "inside",

    zoneName:
      zone.name,

    message:
      `Child is inside ${zone.name}.`,

  };

}





/*
=====================================================
ACTIVE SOS
=====================================================
*/


export async function fetchChildMobileActiveSos(
  childId:string
):Promise<ChildMobileSosAlert|null>{


  const {
    data,
    error
  } =
  await supabase
    .from("sos_alerts")
    .select("*")
    .eq(
      "child_id",
      childId
    )
    .in(
      "status",
      [
        "active",
        "acknowledged"
      ]
    )
    .order(
      "created_at",
      {
        ascending:false
      }
    )
    .limit(1)
    .maybeSingle();



  if(error)
    throw error;



  if(!data)
    return null;



  return {

    id:
      data.id,


    childId:
      data.child_id,


    status:
      data.status,


    activationMethod:
      data.activation_method ??
      "manual_button",


    triggeredAt:
      data.created_at,


    acknowledgedAt:
      data.acknowledged_at ??
      null,


    realertCount:
      data.realert_count ??
      0,


    latitude:
      data.latitude,


    longitude:
      data.longitude,


    locationSource:
      data.location_source,


    createdAt:
      data.created_at,

  };

}





/*
=====================================================
CREATE SOS
=====================================================
*/


export async function createChildMobileSosAlert(
  childId:string
){


  const {
    data,
    error
  } =
  await supabase
    .from("sos_alerts")
    .insert({

      child_id:
        childId,

      status:
        "active",

      activation_method:
        "mobile",

      realert_count:
        0,

    })
    .select()
    .single();



  if(error)
    throw error;


  return data;

}





/*
=====================================================
RE ALERT
=====================================================
*/


export async function recordChildMobileSosRealert(
  sosId:string
):Promise<ChildMobileSosAlert>{


  const {
    data,
    error
  } =
  await supabase
    .from("sos_alerts")
    .update({

      realert_count:
        1,

      updated_at:
        new Date().toISOString(),

    })
    .eq(
      "id",
      sosId
    )
    .select()
    .single();



  if(error)
    throw error;



  return {

    id:data.id,

    childId:data.child_id,

    status:data.status,

    activationMethod:
      data.activation_method ??
      "mobile",

    triggeredAt:
      data.created_at,

    acknowledgedAt:
      data.acknowledged_at ??
      null,

    realertCount:
      data.realert_count ??
      1,


    latitude:
      data.latitude,


    longitude:
      data.longitude,


    locationSource:
      data.location_source,


    createdAt:
      data.created_at,

  };

}





/*
=====================================================
DISCONNECT DEVICE
=====================================================
*/


export async function disconnectChildMobileDevice(
  deviceId:string
){

  const {
    error
  } =
  await supabase
    .from("child_mobile_devices")
    .delete()
    .eq(
      "id",
      deviceId
    );


  if(error)
    throw error;

}