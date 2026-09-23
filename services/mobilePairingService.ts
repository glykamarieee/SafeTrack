import { supabase } from "../lib/supabase";


export type MobilePairingCode = {
  ok: true;
  connectionCode: string;
  expiresAt: string;
  childId: string;
  childName: string;
};



/**
 * Generate the temporary code the child's phone uses to link
 * (Child Mobile Access).
 */
export async function generateMobilePairingCode(
  input:{
    childId:string;
  }
):Promise<MobilePairingCode>{


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
  await supabase.rpc(
    "generate_child_phone_code",
    {
      p_child_id:childId,
    }
  );



  if(error){

    throw new Error(
      error.message ||
      "Unable to generate mobile connection code."
    );

  }



  if(!data?.connectionCode){

    throw new Error(
      "Unable to create mobile pairing code."
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
