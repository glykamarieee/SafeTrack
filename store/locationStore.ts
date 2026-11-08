import { create } from "zustand";

import {
  fetchAllLocationRecords,
  fetchLatestLocationForChild,
  fetchLocationHistory,
  fetchLocationHistoryForDate,
} from "../services/locationService";

import { readCache, writeCache } from "../lib/offlineCache";

import { supabase } from "../lib/supabase";

import { testLog } from "../lib/testLog";

import type { LiveFix } from "../services/liveLocationService";

import type { LocationLog, TravelMode } from "../types/safetrack";


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


  /** Live fixes from the last 10 minutes, oldest first (services/liveLocationService). */
  liveTrail: LiveTrailPoint[];

  applyLiveFix: (fix: LiveFix) => void;

}


export type LiveTrailPoint = {
  latitude: number;
  longitude: number;
  at: number;
  mode: TravelMode | null;
};

const LIVE_TRAIL_MS = 10 * 60_000;
const LIVE_TRAIL_MAX = 900;
/** A fix this coarse is used only when nothing better is recent. */
const POOR_ACCURACY_M = 50;
/** A fix much coarser than the one shown (this factor) waits while that one is recent. */
const WORSE_FACTOR = 3;
/** Still: moves within the accuracy (at least this much) are GPS drift. */
const STILL_DRIFT_M = 8;
/** A new activity is shown after this many readings in a row agree... */
const MODE_AGREE = 2;
/** ...or at once when the device is this sure (a child starting to run). */
const MODE_SURE = 0.7;
/** Faster than this between two fixes is a GPS jump, not the child (~90 km/h). */
const MAX_JUMP_MPS = 25;
/** ...unless this many fixes in a row agree on the new place. */
const JUMP_CONFIRM = 3;

let pendingMode: { mode: TravelMode | null; count: number } = { mode: null, count: 0 };
let jumpCandidate: { latitude: number; longitude: number; count: number } | null = null;

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const isLiveRow = (log: LocationLog | null) => Boolean(log?.id.startsWith("live:"));

/** A live fix that was not shown, for the field-test log. */
function skip(fix: LiveFix, reason: string) {
  testLog("live-skip", { why: reason, acc: fix.accuracyMeters, delay: fix.receivedAt - Date.parse(fix.recordedAt) });
}




const LIVE_POLL_MS = 15_000;

export const useLocationStore =
create<LocationState>((set, get)=>({


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
 error:null,
 // Another child's live trail does not belong on this map.
 ...(get().latest?.childId !== childId ? { liveTrail: [] } : {})
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

// A new point only needs the newest row; it is added to the front of the
// recent history instead of reloading 80 rows every few seconds.
let stopped = false;
const pull = async () => {
  try {
    const latest = await fetchLatestLocationForChild(childId, childName);
    if (stopped || !latest || latest.childId !== childId) return;
    const current = get().latest;
    if (current?.id === latest.id && current.travelMode === latest.travelMode) return;
    const history = [latest, ...get().history.filter((item) => item.id !== latest.id && item.childId === childId)]
      .sort((first, second) => Date.parse(second.recordedAt) - Date.parse(first.recordedAt))
      .slice(0, 80);
    // A live fix newer than the saved record stays on the map: the saved row
    // only joins the history, so the marker never jumps back.
    const keepLive =
      isLiveRow(current) && current!.childId === childId && Date.parse(current!.recordedAt) >= Date.parse(latest.recordedAt);
    set({ latest: keepLive ? current : latest, history, isOffline: false, cachedAt: new Date().toISOString() });
  } catch (error) {
    console.log("[location realtime]", error);
  }
};

const channel =
supabase
.channel(
// Unique per subscription: a fixed topic is reused by supabase.channel()
// and throws on remount.
`child-location-${childId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
)
.on(
"postgres_changes",
{ event:"INSERT", schema:"public", table:"location_logs", filter:`child_id=eq.${childId}` },
() => void pull(),
)
.subscribe();

// Safety net when realtime is not delivering (before migration 20261104
// published location_logs, or a dropped socket): one small read every 15 s
// while a screen is watching.
const poll = setInterval(() => void pull(), LIVE_POLL_MS);

return ()=>{
stopped = true;
clearInterval(poll);
supabase.removeChannel(
 channel
);
};

},



liveTrail: [],

applyLiveFix: (fix) => {
  const current = get().latest;
  // Only the child on screen; never older than what is shown.
  if (!current || current.childId !== fix.childId) return;
  const fixTime = Date.parse(fix.recordedAt);
  if (!Number.isFinite(fixTime) || fixTime <= Date.parse(current.recordedAt)) return;

  // A poor fix is skipped while a better one is recent: a Wi-Fi or cell
  // position can be 50-300 m off and would pull the child away from where
  // they really are (seen when the child and guardian stood together).
  const elapsedMs = fixTime - Date.parse(current.recordedAt);
  const recent = elapsedMs < 30_000;
  const shownAccuracy = current.accuracyMeters ?? Infinity;
  const fixAccuracy = fix.accuracyMeters ?? 0;
  if (recent && fixAccuracy > POOR_ACCURACY_M && shownAccuracy <= POOR_ACCURACY_M) return skip(fix, "coarse");
  if (elapsedMs < 15_000 && fixAccuracy > 20 && fixAccuracy > shownAccuracy * WORSE_FACTOR) return skip(fix, "worse");
  // A jump faster than any child can travel is a bad fix, not movement...
  const jump = metersBetween(current, fix);
  // Both accuracies count: a sharp fix far from a coarse one is a correction.
  const slack = fixAccuracy + (Number.isFinite(shownAccuracy) ? shownAccuracy : 1000) + 30;
  if (recent && elapsedMs > 0 && jump - slack > MAX_JUMP_MPS * (elapsedMs / 1000)) {
    // ...unless the next fixes agree on the new place: then the shown one was wrong.
    const agrees = jumpCandidate && metersBetween(jumpCandidate, fix) <= Math.max(25, fixAccuracy * 2);
    jumpCandidate = { latitude: fix.latitude, longitude: fix.longitude, count: agrees ? jumpCandidate!.count + 1 : 1 };
    if (jumpCandidate.count < JUMP_CONFIRM) return skip(fix, "jump");
  }
  jumpCandidate = null;

  // The activity changes when MODE_AGREE readings in a row agree, so one odd
  // reading never flips it; a confident reading switches at once (no lag when
  // the child starts running).
  const reported = fix.travelMode && fix.travelMode !== "unknown" ? fix.travelMode : null;
  let mode = (current.travelMode ?? null) as TravelMode | null;
  if (reported && reported !== mode) {
    pendingMode = pendingMode.mode === reported ? { mode: reported, count: pendingMode.count + 1 } : { mode: reported, count: 1 };
    if (pendingMode.count >= MODE_AGREE || (fix.modeConfidence ?? 0) >= MODE_SURE || !mode || mode === "unknown") {
      mode = reported;
      pendingMode = { mode: null, count: 0 };
    }
  } else {
    pendingMode = { mode: null, count: 0 };
  }

  // Standing still: GPS drift within the accuracy does not move the marker,
  // unless the new fix is clearly more accurate (then it is the better spot).
  const still = mode === "still" || (fix.speedMps != null && fix.speedMps < 0.6);
  const drift = jump <= Math.max(fixAccuracy, STILL_DRIFT_M);
  const sharper = fix.accuracyMeters != null && fix.accuracyMeters < shownAccuracy * 0.6;
  const hold = still && drift && !sharper;

  const latest: LocationLog = {
    ...current,
    id: `live:${fix.childId}`,
    latitude: hold ? current.latitude : fix.latitude,
    longitude: hold ? current.longitude : fix.longitude,
    accuracyMeters: fix.accuracyMeters,
    source: fix.source,
    recordedAt: fix.recordedAt,
    speedMps: fix.speedMps,
    headingDegrees: fix.headingDegrees ?? current.headingDegrees ?? null,
    travelMode: mode,
    modeConfidence: fix.modeConfidence,
    // The saved record's address is for its own spot.
    locationLabel: hold ? current.locationLabel : null,
  };

  const since = Date.now() - LIVE_TRAIL_MS;
  const trail = get().liveTrail.filter((point) => point.at >= since);
  const last = trail[trail.length - 1];
  if (!hold && (!last || metersBetween(last, latest) >= 1)) {
    trail.push({ latitude: latest.latitude, longitude: latest.longitude, at: fixTime, mode });
  }

  set({ latest, liveTrail: trail.slice(-LIVE_TRAIL_MAX) });
  testLog("live", {
    src: fix.source === "smartwatch" ? "watch" : "phone",
    delay: fix.receivedAt - fixTime,
    // Per hop: device fix -> server, server -> this phone (clocks are NTP-synced).
    toSrv: fix.sentAt ? Date.parse(fix.sentAt) - fixTime : null,
    fromSrv: fix.sentAt ? fix.receivedAt - Date.parse(fix.sentAt) : null,
    acc: fix.accuracyMeters,
    spd: fix.speedMps,
    hd: fix.headingDegrees,
    mode: fix.travelMode,
    conf: fix.modeConfidence,
    shown: mode,
    hold: hold ? 1 : 0,
    lat: Math.round(fix.latitude * 1e6) / 1e6,
    lng: Math.round(fix.longitude * 1e6) / 1e6,
  });
},

}));