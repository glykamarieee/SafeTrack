import {
  json,
  options,
} from "../_shared/response.ts";

import {
  randomSixDigitCode,
  sha256,
} from "../_shared/crypto.ts";

import {
  serviceClient,
} from "../_shared/supabase.ts";


Deno.serve(async (request: Request) => {

  if (request.method === "OPTIONS") {
    return options();
  }


  try {

    /*
    =========================================
    1. VERIFY GUARDIAN SESSION
    =========================================
    */

    const authHeader =
      request.headers.get("Authorization") ?? "";


    const accessToken =
      authHeader
        .replace(/^Bearer\s+/i, "")
        .trim();


    if (!accessToken) {

      return json(
        {
          error:
            "Guardian authentication is required.",
        },
        401,
      );

    }



    const supabase = serviceClient();



    const {
      data: {
        user,
      },

      error: userError,

    } = await supabase.auth.getUser(
      accessToken,
    );



    if (userError || !user) {

      return json(
        {
          error:
            "Invalid Guardian session.",
        },
        401,
      );

    }



    /*
    =========================================
    2. GET WATCH INFORMATION
    =========================================
    */


    const body =
      await request.json();



    const smartwatchDeviceId =
      String(
        body.smartwatchDeviceId ?? "",
      ).trim();



    const watchId =
      String(
        body.watchId ?? "",
      )
      .trim()
      .toUpperCase();



    if (
      !smartwatchDeviceId &&
      !watchId
    ) {

      return json(
        {
          error:
            "smartwatchDeviceId or watchId is required.",
        },
        400,
      );

    }



    /*
    =========================================
    3. FIND SMARTWATCH
    =========================================
    */


    let query =
      supabase
        .from("smartwatch_devices")
        .select(
          `
          id,
          watch_id,
          child_id,
          is_active
          `,
        );



    if (smartwatchDeviceId) {

      query =
        query.eq(
          "id",
          smartwatchDeviceId,
        );

    } else {

      query =
        query.eq(
          "watch_id",
          watchId,
        );

    }



    const {
      data: device,
      error: deviceError,

    } = await query
      .maybeSingle();



    if (deviceError) {

      throw deviceError;

    }



    if (!device) {

      return json(
        {
          error:
            "Smartwatch connection ID was not found.",
        },
        404,
      );

    }



    if (!device.is_active) {

      return json(
        {
          error:
            "This smartwatch is inactive.",
        },
        400,
      );

    }



    if (!device.child_id) {

      return json(
        {
          error:
            "Smartwatch is not linked to a child.",
        },
        400,
      );

    }



    /*
    =========================================
    4. VERIFY CHILD OWNERSHIP
    =========================================
    */


    const {
      data: child,
      error: childError,

    } = await supabase
      .from("child_profiles")
      .select(
        `
        id,
        guardian_id,
        full_name
        `,
      )
      .eq(
        "id",
        device.child_id,
      )
      .maybeSingle();



    if (childError) {

      throw childError;

    }



    if (!child) {

      return json(
        {
          error:
            "Child profile not found.",
        },
        404,
      );

    }



    if (child.guardian_id !== user.id) {

      return json(
        {
          error:
            "Unauthorized smartwatch access.",
        },
        403,
      );

    }



    /*
    =========================================
    5. CREATE CONNECTION CODE
    =========================================
    */


    const connectionCode =
      randomSixDigitCode();



    const expiresAt =
      Date.now() +
      10 * 60 * 1000;



    const codeHash =
      await sha256(
        connectionCode,
      );



    const now =
      new Date().toISOString();



    /*
    Store only hashed code.
    Never store the plain code.
    */


    const {
      error: updateError,

    } = await supabase
      .from("smartwatch_devices")
      .update({

        pairing_code_hash:
          codeHash,


        pairing_code_expires_at:
          new Date(
            expiresAt,
          ).toISOString(),


        pairing_code_created_at:
          now,


        updated_at:
          now,

      })
      .eq(
        "id",
        device.id,
      );



    if (updateError) {

      throw updateError;

    }



    /*
    =========================================
    6. RETURN CODE
    =========================================
    */


    return json({

      ok:true,


      connectionCode,


      expiresAt:
        new Date(
          expiresAt,
        ).toISOString(),


      watchId:
        device.watch_id,


      childId:
        child.id,


      childName:
        child.full_name,

    });



  } catch(error) {


    console.error(
      "[watch-pairing-code]",
      error,
    );



    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate connection code.",
      },
      500,
    );

  }

});