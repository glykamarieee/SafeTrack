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
    await supabase.rpc(
      "register_my_child",
      {

        p_full_name:
          fullName,

        p_age:
          input.age,

        p_relationship:
          input.relationship,

        p_tracking_source:
          input.trackingSource,

        p_watch_id:
          watchId || null,

      },
    );





  if (error) {


    throw new Error(
      error.message ||
      "Unable to complete child registration.",
    );

  }





  if (
    !data ||
    !data.ok ||
    !data.child ||
    !data.deviceSetup
  ) {


    throw new Error(
      "SafeTrack could not complete child setup.",
    );

  }





  return data as ChildRegistrationResult;

}