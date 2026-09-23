import { supabase } from "../lib/supabase";


export type SmartwatchPairingCode = {
  ok: true;
  connectionCode: string;
  expiresAt: string;
  childId: string;
  childName: string;
};


type FunctionErrorResponse = {
  error?: string;
  message?: string;
};



async function extractFunctionError(
  error: unknown
): Promise<string> {

  if (
    error &&
    typeof error === "object" &&
    "context" in error
  ) {

    const context =
      (
        error as {
          context?: unknown;
        }
      ).context;


    if (
      context &&
      typeof context === "object" &&
      "json" in context &&
      typeof (
        context as {
          json?: unknown;
        }
      ).json === "function"
    ) {

      try {

        const response =
          context as Response;


        const body =
          await response.json();


        const parsed =
          body as FunctionErrorResponse;


        return (
          parsed.error ??
          parsed.message ??
          "Request failed."
        );


      } catch {

        return "Request failed.";

      }

    }

  }


  if(error instanceof Error){

    return error.message;

  }


  return "Unable to generate smartwatch connection code.";

}





export async function generateSmartwatchPairingCode(
  input:{
    childId:string;
  }
):Promise<SmartwatchPairingCode>{


  const childId =
    input.childId.trim();



  if(!childId){

    throw new Error(
      "Child ID is required."
    );

  }



  const {
    data,
    error
  } =
  await supabase.functions.invoke(
    "smartwatch-pair-code",
    {
      body:{
        childId,
      },
    }
  );



  if(error){

    throw new Error(
      await extractFunctionError(error)
    );

  }



  if(
    !data ||
    !data.ok ||
    !data.connectionCode
  ){

    throw new Error(
      data?.error ??
      "Unable to create smartwatch connection code."
    );

  }



  return {

    ok:true,

    connectionCode:
      data.connectionCode,

    expiresAt:
      data.expiresAt,

    childId:
      data.childId,

    childName:
      data.childName ?? "",

  };

}