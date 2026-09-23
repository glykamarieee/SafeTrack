import {
  json,
  options,
} from "../_shared/response.ts";

import {
  serviceClient,
} from "../_shared/supabase.ts";

import {
  randomSixDigitCode,
  sha256,
} from "../_shared/crypto.ts";



Deno.serve(async (request) => {


  if (request.method === "OPTIONS") {
    return options();
  }



  try {


    /*
    ==========================================
    1. VERIFY GUARDIAN SESSION
    ==========================================
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
            "Guardian authentication required.",
        },
        401,
      );

    }



    const supabase =
      serviceClient();



    const {
      data: {
        user,
      },
      error: authError,

    } =
      await supabase.auth.getUser(
        accessToken,
      );



    if (authError || !user) {

      return json(
        {
          error:
            "Invalid guardian session.",
        },
        401,
      );

    }




    /*
    ==========================================
    2. READ REQUEST
    ==========================================
    */


    const body =
      await request.json();



    const fullName =
      String(body.fullName ?? "")
        .trim();



    const age =
      Number(body.age);



    const relationship =
      String(body.relationship ?? "Guardian")
        .trim();



    const trackingSource =
      String(
        body.trackingSource ?? "",
      )
      .trim();



    const watchId =
      String(
        body.watchId ?? "",
      )
      .trim()
      .toUpperCase();





    if (!fullName) {

      return json(
        {
          error:
            "Child name is required.",
        },
        400,
      );

    }



    if (
      !Number.isInteger(age) ||
      age < 6 ||
      age > 15
    ) {

      return json(
        {
          error:
            "Child age must be between 6 and 15.",
        },
        400,
      );

    }



    if (
      ![
        "smartwatch",
        "mobile",
        "both",
      ].includes(trackingSource)
    ) {

      return json(
        {
          error:
            "Invalid tracking source.",
        },
        400,
      );

    }



    if (
      (
        trackingSource === "smartwatch" ||
        trackingSource === "both"
      )
      &&
      !watchId
    ) {

      return json(
        {
          error:
            "Watch ID is required.",
        },
        400,
      );

    }




    /*
    ==========================================
    3. CREATE CHILD PROFILE
    ==========================================
    */


    const {
      data: child,
      error: childError,

    } =
      await supabase
        .from("child_profiles")
        .insert({

          guardian_id:
            user.id,

          full_name:
            fullName,

          age,

          relationship,

          tracking_source:
            trackingSource,

        })
        .select(
          `
          id,
          guardian_id,
          full_name,
          age,
          relationship,
          tracking_source
          `,
        )
        .single();



    if (childError) {

      throw childError;

    }





    let watchDevice = null;

    let mobileDevice = null;



    let watchCode = null;

    let mobileCode = null;




    /*
    ==========================================
    4. SMARTWATCH SETUP
    ==========================================
    */


    if (
      trackingSource === "smartwatch" ||
      trackingSource === "both"
    ) {



      const {
        data: watch,
        error: watchError,

      } =
        await supabase
          .from("smartwatch_devices")
          .select(
            `
            id,
            watch_id,
            child_id,
            is_active
            `,
          )
          .eq(
            "watch_id",
            watchId,
          )
          .maybeSingle();



      if (watchError) {

        throw watchError;

      }



      if (!watch) {

        return json(
          {
            error:
              "Registered smartwatch was not found.",
          },
          404,
        );

      }



      if (
        watch.child_id &&
        watch.child_id !== child.id
      ) {

        return json(
          {
            error:
              "This smartwatch is already linked.",
          },
          400,
        );

      }




      await supabase
        .from("smartwatch_devices")
        .update({

          child_id:
            child.id,

          is_active:
            true,

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "id",
          watch.id,
        );



      watchDevice =
        {
          ...watch,
          child_id:
            child.id,
        };




      const code =
        randomSixDigitCode();



      const hash =
        await sha256(code);



      const expires =
        new Date(
          Date.now()
          +
          10 * 60 * 1000,
        )
        .toISOString();



      await supabase
        .from("smartwatch_devices")
        .update({

          device_token_hash:
            `pair:v1:${Date.parse(expires)}:${hash}`,

        })
        .eq(
          "id",
          watch.id,
        );



      watchCode =
        {
          connectionCode:
            code,

          expiresAt:
            expires,

        };

    }






    /*
    ==========================================
    5. MOBILE DEVICE SETUP
    ==========================================
    */


    if (
      trackingSource === "mobile" ||
      trackingSource === "both"
    ) {



      const {
        data: mobile,

        error: mobileError,

      } =
        await supabase
          .from("child_mobile_devices")
          .insert({

            child_id:
              child.id,

            is_active:
              true,

          })
          .select()
          .single();



      if (mobileError) {

        throw mobileError;

      }



      mobileDevice =
        mobile;




      const code =
        randomSixDigitCode();



      const hash =
        await sha256(code);



      const expires =
        new Date(
          Date.now()
          +
          10 * 60 * 1000,
        )
        .toISOString();




      await supabase
        .from("child_mobile_devices")
        .update({

          pairing_code_hash:
            hash,

          pairing_code_expires_at:
            expires,

          pairing_code_created_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "id",
          mobile.id,
        );



      mobileCode =
        {
          connectionCode:
            code,

          expiresAt:
            expires,

        };

    }




    /*
    ==========================================
    6. RETURN RESULT
    ==========================================
    */


    return json({

      ok:true,


      child,



      deviceSetup:{


        requiresWatch:
          trackingSource === "smartwatch" ||
          trackingSource === "both",



        requiresMobile:
          trackingSource === "mobile" ||
          trackingSource === "both",



        watchId:
          watchId || null,



        connectionType:
          trackingSource,

      },



      watchDevice,

      mobileDevice,


      watchConnectionCode:
        watchCode,


      mobileConnectionCode:
        mobileCode,

    });


  }

  catch(error) {


    console.error(
      "[guardian-child-onboarding]",
      error,
    );



    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Child onboarding failed.",
      },
      500,
    );

  }


});