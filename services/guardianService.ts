import { supabase } from "../lib/supabase";


export type GuardianProfile = {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
};



export type GuardianChild = {
  id: string;
  fullName: string;
  age: number;
  relationship: string;
  trackingSource: string;
};



export async function fetchGuardianProfile(
  guardianId:string
):Promise<GuardianProfile|null>{


  const {data,error}=await supabase
    .from("guardian_profiles")
    .select(`
      id,
      full_name,
      email,
      is_active
    `)
    .eq(
      "id",
      guardianId
    )
    .maybeSingle();



  if(error){
    throw error;
  }


  if(!data){
    return null;
  }



  return {

    id:data.id,

    fullName:
      data.full_name ?? "Guardian",

    email:
      data.email ?? null,

    isActive:
      data.is_active !== false

  };

}





export async function fetchGuardianChildren(
 guardianId:string
):Promise<GuardianChild[]>{


const {data,error}=await supabase
.from("child_profiles")
.select(`
 id,
 full_name,
 age,
 relationship,
 tracking_source
`)
.eq(
 "guardian_id",
 guardianId
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



return (data??[]).map(
(child:any)=>({

id:child.id,

fullName:
child.full_name,

age:
child.age,

relationship:
child.relationship,

trackingSource:
child.tracking_source

})
);


}







export async function fetchGuardianDashboardSummary(
 guardianId:string
){


const children =
await fetchGuardianChildren(
 guardianId
);



const childIds =
children.map(
 child=>child.id
);



let locationRecords = 0;
let sosRecords = 0;
let geofenceEvents = 0;



if(childIds.length){


const location =
await supabase
.from("location_logs")
.select(
"id",
{
count:"exact",
head:true
}
)
.in(
"child_id",
childIds
);



locationRecords =
location.count ?? 0;



const sos =
await supabase
.from("sos_alerts")
.select(
"id",
{
count:"exact",
head:true
}
)
.in(
"child_id",
childIds
);



sosRecords =
sos.count ?? 0;



const geofence =
await supabase
.from("geofence_events")
.select(
"id",
{
count:"exact",
head:true
}
)
.in(
"child_id",
childIds
);



geofenceEvents =
geofence.count ?? 0;


}



return {

children:
children.length,

locationRecords,

sosRecords,

geofenceEvents

};


}