import { supabase } from "../lib/supabase";


export type SmartwatchStatus = {

  id:string;

  watchId:string;

  childId:string|null;

  childName:string|null;

  isActive:boolean;

  pairedAt:string|null;

  lastSeenAt:string|null;

  lastLocationAt:string|null;

  deviceModel:string|null;

  batteryPercent:number|null;

  networkType:string|null;

  connectionStatus:
    | "connected"
    | "offline"
    | "inactive";

};





function calculateConnectionStatus(
  isActive:boolean,
  lastSeenAt:string|null
):
"connected"|"offline"|"inactive" {


  if(!isActive){
    return "inactive";
  }


  if(!lastSeenAt){
    return "offline";
  }


  const difference =
    Date.now()
    -
    new Date(lastSeenAt).getTime();



  if(
    difference <=
    5 * 60 * 1000
  ){

    return "connected";

  }


  return "offline";

}







async function getChildName(
  childId:string|null
){

  if(!childId){
    return null;
  }


  const {
    data
  } =
  await supabase

  .from("child_profiles")

  .select(
    "full_name"
  )

  .eq(
    "id",
    childId
  )

  .maybeSingle();



  return (
    data?.full_name
    ??
    null
  );

}








export async function fetchSmartwatchForChild(
  childId:string
):
Promise<SmartwatchStatus|null>{


  const {
    data,
    error
  }
  =
  await supabase

  .from("smartwatch_devices")

  .select(`

    id,

    watch_id,

    child_id,

    is_active,

    paired_at,

    last_seen_at,

    last_location_at,

    device_model,

    last_battery_percent,

    last_network_type

  `)


  .eq(
    "child_id",
    childId
  )


  .maybeSingle();



  if(error){
    throw error;
  }



  if(!data){
    return null;
  }



  const childName =
    await getChildName(
      data.child_id
    );



  return {

    id:
      data.id,


    watchId:
      data.watch_id,


    childId:
      data.child_id,


    childName,


    isActive:
      data.is_active,


    pairedAt:
      data.paired_at
      ??
      null,


    lastSeenAt:
      data.last_seen_at
      ??
      null,


    lastLocationAt:
      data.last_location_at
      ??
      null,


    deviceModel:
      data.device_model
      ??
      "Wear OS Smartwatch",


    batteryPercent:
      data.last_battery_percent
      ??
      null,


    networkType:
      data.last_network_type
      ??
      null,


    connectionStatus:
      calculateConnectionStatus(
        data.is_active,
        data.last_seen_at
      )

  };

}









export async function fetchAllSmartwatchDevices()
:
Promise<SmartwatchStatus[]>{


  const {
    data,
    error
  }
  =
  await supabase

  .from("smartwatch_devices")

  .select(`

    id,

    watch_id,

    child_id,

    is_active,

    paired_at,

    last_seen_at,

    last_location_at,

    device_model,

    last_battery_percent,

    last_network_type

  `)


  .order(
    "updated_at",
    {
      ascending:false
    }
  );



  if(error){
    throw error;
  }



  const devices =
    data ?? [];



  return Promise.all(

    devices.map(
      async(device:any)=>({

        id:
          device.id,


        watchId:
          device.watch_id,


        childId:
          device.child_id,


        childName:
          await getChildName(
            device.child_id
          ),


        isActive:
          device.is_active,


        pairedAt:
          device.paired_at
          ??
          null,


        lastSeenAt:
          device.last_seen_at
          ??
          null,


        lastLocationAt:
          device.last_location_at
          ??
          null,


        deviceModel:
          device.device_model
          ??
          "Wear OS Smartwatch",


        batteryPercent:
          device.last_battery_percent
          ??
          null,


        networkType:
          device.last_network_type
          ??
          null,


        connectionStatus:
          calculateConnectionStatus(
            device.is_active,
            device.last_seen_at
          )

      })
    )

  );


}









export function subscribeToSmartwatch(
  childId:string,
  callback:(device:SmartwatchStatus)=>void
){


 const channel =
 supabase

 .channel(
   `watch-${childId}`
 )


 .on(

 "postgres_changes",

 {

  event:"UPDATE",

  schema:"public",

  table:"smartwatch_devices",

  filter:
   `child_id=eq.${childId}`

 },


 async()=>{


   const updated =
     await fetchSmartwatchForChild(
       childId
     );


   if(updated){

     callback(updated);

   }


 }

 )


 .subscribe();



 return ()=>{

   supabase.removeChannel(
     channel
   );

 };


}