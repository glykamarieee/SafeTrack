import {
json,
options
} from "../_shared/response.ts";

import {
serviceClient
} from "../_shared/supabase.ts";

import {
sha256,
safeEqual
} from "../_shared/crypto.ts";



Deno.serve(async(request)=>{


if(request.method==="OPTIONS")
return options();



try{


const childId =
request.headers.get(
"x-child-id"
);


const token =
request.headers.get(
"x-device-token"
);



if(!childId || !token)
return json(
{
error:
"Missing mobile authentication."
},
401);



const supabase =
serviceClient();



const {
data:device
}=await supabase
.from("child_mobile_devices")
.select("*")
.eq("child_id",childId)
.maybeSingle();



if(!device)
return json(
{
error:
"Mobile device not registered."
},
403);



const hash =
await sha256(token);



if(
!safeEqual(
hash,
device.device_token_hash
)
)
return json(
{
error:
"Invalid mobile token."
},
403);



const body =
await request.json();



const latitude =
Number(body.latitude);


const longitude =
Number(body.longitude);



if(
!Number.isFinite(latitude) ||
!Number.isFinite(longitude)
)
return json(
{
error:
"Invalid coordinates."
},
400);



const now =
new Date().toISOString();



const {data:location,error}
=
await supabase
.from("location_logs")
.insert({

child_id:
childId,

source:
"mobile",

latitude,

longitude,

accuracy_meters:
body.accuracyMeters ?? null,

recorded_at:
now,

})
.select("id")
.single();



if(error)
throw error;



await supabase
.from("child_mobile_devices")
.update({

last_seen_at:
now,

})
.eq(
"child_id",
childId
);



return json({

ok:true,

locationLogId:
location.id,

});


}
catch(error){

return json(
{
error:
error instanceof Error
?error.message
:"Mobile ingest failed."
},
500
);

}


});