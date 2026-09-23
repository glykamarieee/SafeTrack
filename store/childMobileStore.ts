import { create } from "zustand";

import type {
  ChildMobileContext,
  ChildMobileSosAlert,
  ChildSafeZoneStatus,
  LocationLog,
} from "../types/safetrack";

import {
  linkChildMobileDevice,
  fetchChildMobileContext,
  fetchChildSafeZoneStatus,
  fetchChildMobileActiveSos,
  sendChildMobileLocation,
  createChildMobileSosAlert,
  recordChildMobileSosRealert,
  disconnectChildMobileDevice,
} from "../services/childMobileService";



interface ChildMobileState {

  context: ChildMobileContext | null;

  latestLocation: LocationLog | null;

  safeZoneStatus: ChildSafeZoneStatus | null;

  activeSos: ChildMobileSosAlert | null;


  loading: boolean;

  isLoading: boolean;

  isBootstrapped: boolean;


  error: string | null;



  bootstrap(): Promise<void>;


  linkDevice(
    code:string
  ): Promise<void>;



  sendLocation(): Promise<void>;



  refresh(): Promise<void>;



  disconnect(
    deviceId?:string
  ): Promise<void>;



  triggerSos(): Promise<void>;



  refreshActiveSos(): Promise<void>;



  recordRealert(
    sosId:string
  ): Promise<void>;



  clearError():void;

}





function normalizeLocation(
  location:any,
  childId:string
):LocationLog|null{


  if(
    !location ||
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number"
  ){

    return null;

  }


  return {

    id:
      location.id ??
      crypto.randomUUID(),


    childId,


    latitude:
      location.latitude,


    longitude:
      location.longitude,


    accuracyMeters:
      location.accuracy ??
      null,


    source:
      location.source ??
      "mobile",


    recordedAt:
      location.recordedAt ??
      new Date().toISOString(),

  };

}






function normalizeSos(
  sos:any
):ChildMobileSosAlert|null{


  if(!sos){

    return null;

  }


  return {

    id:
      sos.id,


    childId:
      sos.childId ??
      sos.child_id,


    status:
      sos.status,


    activationMethod:
      sos.activationMethod ??
      sos.activation_method ??
      "mobile",


    triggeredAt:
      sos.triggeredAt ??
      sos.triggered_at ??
      sos.createdAt ??
      new Date().toISOString(),


    acknowledgedAt:
      sos.acknowledgedAt ??
      sos.acknowledged_at ??
      null,


    realertCount:
      sos.realertCount ??
      sos.realert_count ??
      0,


  };

}






export const useChildMobileStore =
create<ChildMobileState>((set,get)=>(


{


context:null,


latestLocation:null,


safeZoneStatus:null,


activeSos:null,


loading:false,


isLoading:false,


isBootstrapped:false,


error:null,





bootstrap:async()=>{


try{


set({

loading:true,

isLoading:true,

error:null,

});



const context =
await fetchChildMobileContext();



const latestLocation =
normalizeLocation(
context.latestLocation,
context.childId
);



set({

context:{

...context,

mobileDeviceActive:
context.isLinked ?? false,

},


latestLocation,


isBootstrapped:true,

});



}
catch(error){


set({

error:
error instanceof Error
? error.message
:"Unable to initialize child account."

});


}
finally{


set({

loading:false,

isLoading:false,

});


}


},







linkDevice:async(code)=>{


try{


set({

loading:true,

isLoading:true,

error:null,

});



const result =
await linkChildMobileDevice(
code
);



const context =
await fetchChildMobileContext(
result.childId
);



set({

context:{

...context,

mobileDeviceActive:
context.isLinked ?? true,

},


isBootstrapped:true,

});


}
catch(error){


set({

error:
error instanceof Error
? error.message
:"Unable to link device."

});


}
finally{


set({

loading:false,

isLoading:false,

});


}


},







sendLocation:async()=>{


try{


const latest =
get().latestLocation;



if(!latest){

throw new Error(
"No location available."
);

}



await sendChildMobileLocation({

latitude:
latest.latitude,


longitude:
latest.longitude,


accuracy:
latest.accuracyMeters ?? undefined,


timestamp:
latest.recordedAt,

});



}
catch(error){


set({

error:
error instanceof Error
? error.message
:"Unable to send location."

});


throw error;


}


},







refresh:async()=>{


const context =
get().context;



if(!context){

return;

}



try{


const updatedContext =
await fetchChildMobileContext(
context.childId
);



const zone =
await fetchChildSafeZoneStatus(
context.childId
);



const sos =
await fetchChildMobileActiveSos(
context.childId
);



set({


context:{

...updatedContext,

mobileDeviceActive:
updatedContext.isLinked ?? false,

},


safeZoneStatus:
zone,


activeSos:
normalizeSos(sos),


});



}
catch(error){


set({

error:
error instanceof Error
? error.message
:"Unable to refresh."

});


}


},







disconnect:async(deviceId)=>{


if(!deviceId){

return;

}


try{


await disconnectChildMobileDevice(
deviceId
);



set({

context:null,

latestLocation:null,

activeSos:null,

isBootstrapped:false,

});


}
catch(error){


set({

error:
error instanceof Error
? error.message
:"Unable to disconnect."

});


}


},







triggerSos:async()=>{


const context =
get().context;



if(!context){

throw new Error(
"Child account unavailable."
);

}



try{


const sos =
await createChildMobileSosAlert(
context.childId
);



set({

activeSos:
normalizeSos(sos),

});


}
catch(error){


set({

error:
error instanceof Error
? error.message
:"SOS failed."

});


}


},







refreshActiveSos:async()=>{


const context =
get().context;



if(!context){

return;

}



const sos =
await fetchChildMobileActiveSos(
context.childId
);



set({

activeSos:
normalizeSos(sos),

});


},







recordRealert:async(sosId)=>{


const updated =
await recordChildMobileSosRealert(
sosId
);



set({

activeSos:
normalizeSos(updated),

});


},







clearError:()=>{


set({

error:null,

});


},



}

));