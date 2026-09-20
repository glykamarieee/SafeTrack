import { create } from "zustand";

import {
  fetchAllLocationRecords,
  fetchLatestLocationForChild,
  fetchLocationHistory,
  fetchLocationHistoryForDate,
} from "../services/locationService";

import { readCache, writeCache } from "../lib/offlineCache";

import { supabase } from "../lib/supabase";

import type { LocationLog } from "../types/safetrack";


interface ChildLocationCache {
  latest: LocationLog | null;
  history: LocationLog[];
}


interface LocationState {

  latest: LocationLog | null;

  history: LocationLog[];

  dailyHistory: LocationLog[];

  dailyDate: string | null;

  allRecords: LocationLog[];

  isLoading: boolean;

  isDailyLoading: boolean;

  error: string | null;

  isOffline: boolean;

  cachedAt: string | null;


  loadForChild:
    (
      childId:string,
      childName?:string
    )=>Promise<void>;


  loadDayForChild:
    (
      childId:string,
      dateKey:string,
      childName?:string
    )=>Promise<void>;


  loadAllRecords:
    ()=>Promise<void>;


  subscribeToChildLocation:
    (
      childId:string,
      childName?:string
    )=>()=>void;

}




export const useLocationStore =
create<LocationState>((set)=>({


latest:null,

history:[],

dailyHistory:[],

dailyDate:null,

allRecords:[],

isLoading:false,

isDailyLoading:false,

error:null,

isOffline:false,

cachedAt:null,





loadForChild:
async(
 childId,
 childName="Child"
)=>{


set({
 isLoading:true,
 error:null
});


const cacheKey =
`location:child:${childId}`;



try{


const [
 latest,
 history
]
=
await Promise.all([


fetchLatestLocationForChild(
 childId,
 childName
),


fetchLocationHistory(
 childId,
 80,
 childName
)


]);



const cachedAt =
new Date()
.toISOString();



set({

latest,

history,

isOffline:false,

cachedAt

});



void writeCache<ChildLocationCache>(
 cacheKey,
 {
  latest,
  history
 }
);



}

catch(error){


const cached =
await readCache<ChildLocationCache>(
 cacheKey
);



if(cached){


set({

latest:
cached.data.latest,


history:
cached.data.history,


isOffline:true,


cachedAt:
cached.cachedAt

});


}

else{


set({

error:
error instanceof Error
?
error.message
:
"Could not load location data."

});


}


}

finally{


set({
isLoading:false
});


}


},






loadDayForChild:
async(
 childId,
 dateKey,
 childName="Child"
)=>{


set({

isDailyLoading:true,

error:null

});



const cacheKey =
`location:day:${childId}:${dateKey}`;



try{


const dailyHistory =
await fetchLocationHistoryForDate(
 childId,
 dateKey,
 childName
);



set({

dailyHistory,

dailyDate:dateKey,

isOffline:false,

cachedAt:
new Date()
.toISOString()

});



void writeCache<LocationLog[]>(
 cacheKey,
 dailyHistory
);



}

catch(error){


const cached =
await readCache<LocationLog[]>(
 cacheKey
);



if(cached){


set({

dailyHistory:
cached.data,


dailyDate:
dateKey,


isOffline:true,


cachedAt:
cached.cachedAt


});


}

else{


set({

error:
error instanceof Error
?
error.message
:
"Could not load daily history."

});


}


}

finally{


set({
isDailyLoading:false
});


}



},








loadAllRecords:
async()=>{


set({

isLoading:true,

error:null

});



const cacheKey =
"location:all";



try{


const allRecords =
await fetchAllLocationRecords();



set({

allRecords,

isOffline:false,

cachedAt:
new Date()
.toISOString()

});



void writeCache<LocationLog[]>(
 cacheKey,
 allRecords
);



}

catch(error){


const cached =
await readCache<LocationLog[]>(
 cacheKey
);



if(cached){


set({

allRecords:
cached.data,


isOffline:true,


cachedAt:
cached.cachedAt


});


}

else{


set({

error:
error instanceof Error
?
error.message
:
"Could not load location records."

});


}


}

finally{


set({
isLoading:false
});


}



},







subscribeToChildLocation:
(
childId,
childName="Child"
)=>{


const channel =
supabase

.channel(
`child-location-${childId}`
)


.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"location_logs",

filter:
`child_id=eq.${childId}`

},


async()=>{


try{


const latest =
await fetchLatestLocationForChild(
 childId,
 childName
);



const history =
await fetchLocationHistory(
 childId,
 80,
 childName
);



set({

latest,

history,

isOffline:false,

cachedAt:
new Date()
.toISOString()

});


}

catch(error){


console.log(
"[location realtime]",
error
);


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



}));