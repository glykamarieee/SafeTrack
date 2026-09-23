import { supabase } from "../lib/supabase";


export type TrackingSource =
  | "smartwatch"
  | "mobile"
  | "both";



export interface CompleteChildRegistrationInput {

  fullName: string;

  age: number;

  relationship: string;

  trackingSource: TrackingSource;

  watchId?: string;

}



export interface DeviceSetup {

  requiresWatch: boolean;

  requiresMobile: boolean;

  watchId: string | null;

  connectionType:
    | "smartwatch"
    | "mobile"
    | "both";

}



export interface ConnectionCode {

  connectionCode: string;

  expiresAt: string;

}



export interface ChildRegistrationResult {

  ok: true;


  child: {

    id: string;

    guardian_id: string;

    full_name: string;

    age: number;

    relationship: string;

    tracking_source: TrackingSource;

  };


  deviceSetup: DeviceSetup;


  watchDevice?: {

    id: string;

    watch_id: string;

    child_id: string;

    is_active: boolean;

  } | null;



  mobileDevice?: {

    id: string;

    child_id: string;

    is_active: boolean;

  } | null;



  watchConnectionCode?:
    ConnectionCode | null;



  mobileConnectionCode?:
    ConnectionCode | null;

}



type FunctionErrorPayload = {

  error?: string;

  message?: string;

};



async function extractFunctionError(
  error: unknown,
  fallback: string,
): Promise<string> {


  if (
    error &&
    typeof error === "object" &&
    "context" in error
  ) {


    const context =
      (error as {
        context?: unknown;
      }).context;



    if (
      context instanceof Response
    ) {


      try {


        const payload =
          (await context.json()) as FunctionErrorPayload;



        if (
          payload.error &&
          payload.error.trim()
        ) {

          return payload.error.trim();

        }



        if (
          payload.message &&
          payload.message.trim()
        ) {

          return payload.message.trim();

        }


      } catch {

      }

    }

  }



  if (
    error instanceof Error &&
    error.message.trim()
  ) {

    return error.message;

  }



  return fallback;

}




export async function completeChildRegistration(
  input: CompleteChildRegistrationInput,
): Promise<ChildRegistrationResult> {



  const fullName =
    input.fullName.trim();



  const watchId =
    input.watchId
      ?.trim()
      .toUpperCase() ?? "";



  if (!fullName) {

    throw new Error(
      "Child name is required.",
    );

  }



  if (
    !Number.isInteger(input.age) ||
    input.age < 6 ||
    input.age > 15
  ) {

    throw new Error(
      "Child age must be between 6 and 15 years old.",
    );

  }




  if (
    (
      input.trackingSource === "smartwatch" ||
      input.trackingSource === "both"
    )
    &&
    !watchId
  ) {

    throw new Error(
      "Watch ID is required for smartwatch tracking.",
    );

  }





  const {
    data,
    error,

  } =
    await supabase.functions.invoke(
      "guardian-child-onboarding",
      {

        body: {

          fullName,

          age:
            input.age,

          relationship:
            input.relationship,


          trackingSource:
            input.trackingSource,


          watchId:
            watchId || null,

        },

      },
    );





  if (error) {


    throw new Error(

      await extractFunctionError(
        error,
        "Unable to complete child registration.",
      ),

    );

  }





  if (
    !data ||
    !data.ok ||
    !data.child ||
    !data.deviceSetup
  ) {


    throw new Error(
      data?.error ??
      "SafeTrack could not complete child setup.",
    );

  }





  return data as ChildRegistrationResult;

}