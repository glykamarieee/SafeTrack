import {
  json,
  options,
} from "../_shared/response.ts";

import {
  randomToken,
  safeEqual,
  sha256,
} from "../_shared/crypto.ts";

import {
  serviceClient,
} from "../_shared/supabase.ts";


Deno.serve(async(request)=>{


if(request.method==="OPTIONS")
return options();



try{


const body =
await request.json();


const childId =
String(body.childId ?? "").trim();


const code =
String(body.connectionCode ?? "")
.replace(/\D/g,"")
.trim();



if(!childId || code.length!==6){

return json(
{
error:
"Child ID and 6 digit code required."
},
400);

}



const supabase =
serviceClient();



const {
data:device,
error
}=await supabase
.from("child_mobile_devices")
.select("*")
.eq("child_id",childId)
.maybeSingle();



if(error)
throw error;



if(!device){

return json(
{
error:
"Mobile device registration not found."
},
404);

}



if(
!device.pairing_code_hash ||
!device.pairing_code_expires_at
){

return json(
{
error:
"No active pairing code."
},
400);

}



if(
Date.now() >
new Date(
device.pairing_code_expires_at
).getTime()
){

return json(
{
error:
"Pairing code expired."
},
400);

}



const hash =
await sha256(code);



if(
!safeEqual(
hash,
device.pairing_code_hash
)
){

return json(
{
error:
"Invalid pairing code."
},
403);

}



const token =
randomToken(32);



const tokenHash =
await sha256(token);



const now =
new Date().toISOString();



await supabase
.from("child_mobile_devices")
.update({

device_token_hash:
tokenHash,

pairing_code_hash:
null,

pairing_code_expires_at:
null,

paired_at:
now,

last_seen_at:
now,

is_active:true,

updated_at:
now,


})
.eq(
"child_id",
childId
);



return json({

ok:true,

childId,

deviceToken:
token,


});


}
catch(error){


return json(
{
error:
error instanceof Error
? error.message
:"Mobile pairing failed."
},
500
);


}


});