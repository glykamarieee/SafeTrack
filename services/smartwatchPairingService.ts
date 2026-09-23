import { supabase } from "../lib/supabase";


export type SmartwatchPairingCode = {
  ok: true;
  connectionCode: string;
  expiresAt: string;
  watchId: string;
  childId: string;
  childName: string;
};


type PairingCodeRow = {
  connection_code: string;
  expires_at: string;
  watch_id: string;
  child_id: string;
  child_name: string | null;
};





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
  await supabase.rpc(
    "generate_watch_pairing_code",
    {
      p_child_id:childId,
    }
  );



  if(error){

    throw new Error(
      error.message ||
      "Unable to generate smartwatch connection code."
    );

  }



  const row =
    (data as PairingCodeRow[] | null)?.[0];



  if(!row?.connection_code){

    throw new Error(
      "Unable to generate smartwatch connection code."
    );

  }



  return {

    ok:true,

    connectionCode:
      row.connection_code,

    expiresAt:
      row.expires_at,

    watchId:
      row.watch_id,

    childId:
      row.child_id,

    childName:
      row.child_name ?? "",

  };

}
