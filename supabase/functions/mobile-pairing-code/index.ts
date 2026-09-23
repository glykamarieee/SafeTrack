import {
 json,
 options,
} from "../_shared/response.ts";

import {
  sha256,
} from "../_shared/crypto.ts";

import {
 serviceClient,
} from "../_shared/supabase.ts";



Deno.serve(async(req)=>{


if(req.method==="OPTIONS"){

return options();

}



try{


const body =
await req.json();



const childId =
String(
body.childId ?? ""
).trim();



if(!childId){

return json(
{
error:"Child ID required."
},
400
);

}



const supabase =
serviceClient();



const {
data:child,
error:childError
}
=
await supabase
.from("child_profiles")
.select(
`
id,
full_name
`
)
.eq(
"id",
childId
)
.single();



if(childError){

throw childError;

}



const code =
Math.floor(
100000 +
Math.random()*900000
)
.toString();



const hash =
await sha256(code);



const expires =
new Date(
Date.now()+10*60*1000
)
.toISOString();



const {
error
}
=
await supabase
.from("child_mobile_devices")
.update({

pairing_code_hash:
hash,

pairing_code_expires_at:
expires,


})
.eq(
"child_id",
childId
);



if(error){

throw error;

}



return json({

ok:true,

connectionCode:
code,

expiresAt:
expires,

childId:
child.id,

childName:
child.full_name,

});


}
catch(error){


return json(
{
error:
error instanceof Error
?
error.message
:
"Unable to generate code."
},
500
);


}


});