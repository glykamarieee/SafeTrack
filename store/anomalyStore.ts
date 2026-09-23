import { create } from "zustand";

import {
  fetchAnomaliesForChild,
  acknowledgeAnomaly,
} from "../services/anomalyService";

import type { SafetyTimelineItem } from "../services/safetyEventsService";


interface AnomalyState {

  anomalies: SafetyTimelineItem[];

  latestAnomaly:
    SafetyTimelineItem | null;


  isLoading:boolean;

  error:string|null;


  loadForChild:
    (
      childId:string
    )=>Promise<void>;


  acknowledge:
    (
      anomalyId:string
    )=>Promise<void>;


  clear:
    ()=>void;

}



export const useAnomalyStore =
create<AnomalyState>((set,get)=>({



  anomalies:[],


  latestAnomaly:null,


  isLoading:false,


  error:null,





  loadForChild:
  async(
    childId
  )=>{


    if(!childId){

      set({
        anomalies:[],
        latestAnomaly:null
      });

      return;

    }



    set({

      isLoading:true,

      error:null

    });



    try{


      const data =
      await fetchAnomaliesForChild(
        childId
      );



      const sorted =
      [...data].sort(
        (
          a,
          b
        )=>

        new Date(
          b.occurredAt
        ).getTime()

        -

        new Date(
          a.occurredAt
        ).getTime()

      );




      set({

        anomalies:
          sorted,


        latestAnomaly:
          sorted[0] ?? null,


        isLoading:false

      });



    }

    catch(error){


      set({

        error:
          error instanceof Error
          ?
          error.message
          :
          "Unable to load AI safety data.",


        isLoading:false

      });


    }


  },








  acknowledge:
  async(
    anomalyId
  )=>{


    const previous =
    get().anomalies;



    set({

      anomalies:

      previous.map(
        item=>

        item.id===anomalyId

        ?

        {

          ...item,

          status:"acknowledged"

        }

        :

        item

      )

    });




    try{


      await acknowledgeAnomaly(
        anomalyId
      );



    }

    catch(error){


      set({

        anomalies:
          previous,


        error:
        error instanceof Error
        ?
        error.message
        :
        "Unable to acknowledge anomaly."

      });



      throw error;


    }


  },








  clear:()=>{


    set({

      anomalies:[],


      latestAnomaly:null,


      error:null

    });


  }





}));