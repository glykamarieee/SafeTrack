import { create } from "zustand";

import {
  createGeofence,
  deleteGeofence,
  fetchGeofenceEvents,
  fetchGeofences,
  updateGeofence,
  type GeofenceInput,
} from "../services/geofenceService";

import type {
  Geofence,
  GeofenceEvent,
} from "../types/safetrack";



interface GeofenceState {

  zones: Geofence[];

  events: GeofenceEvent[];

  isLoading: boolean;

  isSaving: boolean;

  error: string | null;



  load:
    (
      guardianId: string,
      childId: string
    ) => Promise<void>;



  saveNew:
    (
      input: GeofenceInput
    ) => Promise<void>;



  saveEdit:
    (
      id: string,
      input: Omit<
        GeofenceInput,
        "guardianId" | "childId"
      >
    ) => Promise<void>;



  remove:
    (
      id: string
    ) => Promise<void>;



  clear:
    () => void;

}





export const useGeofenceStore =
create<GeofenceState>((set, get) => ({



  zones: [],

  events: [],

  isLoading: false,

  isSaving: false,

  error: null,





  load:
  async(
    guardianId,
    childId
  ) => {


    if(
      !guardianId ||
      !childId
    ){

      set({

        zones: [],

        events: [],

        error:
          "Child information is unavailable."

      });


      return;

    }



    set({

      isLoading:true,

      error:null

    });




    try{


      const [
        zones,
        events
      ] = await Promise.all([

        fetchGeofences(
          guardianId,
          childId
        ),


        fetchGeofenceEvents(
          childId
        )

      ]);




      set({

        zones,

        events,

        isLoading:false

      });



    }

    catch(error){


      set({

        error:
          error instanceof Error
            ? error.message
            : "Unable to load Safe Zone data.",


        isLoading:false

      });


    }


  },









  saveNew:
  async(
    input
  ) => {


    set({

      isSaving:true,

      error:null

    });



    try{


      const created =
        await createGeofence(
          input
        );



      set({

        zones:[
          created,
          ...get().zones
        ]

      });



    }

    catch(error){


      set({

        error:
          error instanceof Error
            ? error.message
            : "Unable to create Safe Zone."

      });


      throw error;


    }

    finally{


      set({

        isSaving:false

      });


    }


  },









  saveEdit:
  async(
    id,
    input
  ) => {


    set({

      isSaving:true,

      error:null

    });



    try{


      const updated =
        await updateGeofence(
          id,
          input
        );



      set({

        zones:

          get()
          .zones
          .map(
            zone =>
              zone.id === id
              ? updated
              : zone
          )

      });



    }

    catch(error){


      set({

        error:
          error instanceof Error
            ? error.message
            : "Unable to update Safe Zone."

      });



      throw error;


    }

    finally{


      set({

        isSaving:false

      });


    }


  },









  remove:
  async(
    id
  ) => {


    const previous =
      get().zones;



    set({

      zones:

        previous.filter(
          zone =>
            zone.id !== id
        ),

      error:null

    });




    try{


      await deleteGeofence(
        id
      );



    }

    catch(error){


      set({

        zones:previous,


        error:
          error instanceof Error
            ? error.message
            : "Unable to delete Safe Zone."

      });



      throw error;


    }


  },








  clear:
  () => {


    set({

      zones: [],

      events: [],

      error:null

    });


  }



}));