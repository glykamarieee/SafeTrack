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


Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {
    return options();
  }


  try {

    const body = await req.json();


    const childId =
      String(body.childId ?? "").trim();


    if (!childId) {

      return json(
        {
          error:"Child ID required."
        },
       400
      );

    }


    const supabase = serviceClient();



    const {
      data: child,
      error: childError
    } =
    await supabase
      .from("child_profiles")
      .select(
        `
        id,
        full_name,
        guardian_id
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
      `ST-${Math.floor(
        100000 +
        Math.random() * 900000
      )}`;



    const codeHash =
      await sha256(code);



    const expires =
      new Date(
        Date.now() + 10 * 60 * 1000
      )
      .toISOString();




    const {
      error: insertError
    } =
    await supabase
      .from("device_connection_codes")
      .insert({

        guardian_id:
          child.guardian_id,

        child_id:
          child.id,

        code_hash:
          codeHash,

        expires_at:
          expires,

        is_used:
          false,

      });



    if(insertError){

      throw insertError;

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
          "Unable to generate smartwatch connection code."
      },
      500
    );


  }


});