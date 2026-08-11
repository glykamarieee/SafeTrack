import { create } from "zustand";
import {
  createGeofence,
  deleteGeofence,
  fetchGeofenceEvents,
  fetchGeofences,
  updateGeofence,
  type GeofenceInput,
} from "../services/geofenceService";
import type { Geofence, GeofenceEvent } from "../types/safetrack";

interface GeofenceState {
  zones: Geofence[];
  events: GeofenceEvent[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  load: (guardianId: string, childId: string) => Promise<void>;
  saveNew: (input: GeofenceInput) => Promise<void>;
  saveEdit: (
    id: string,
    input: Omit<GeofenceInput, "guardianId" | "childId">
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useGeofenceStore = create<GeofenceState>((set, get) => ({
  zones: [],
  events: [],
  isLoading: false,
  isSaving: false,
  error: null,

  load: async (guardianId, childId) => {
    set({ isLoading: true, error: null });
    try {
      const [zones, events] = await Promise.all([
        fetchGeofences(guardianId, childId),
        fetchGeofenceEvents(childId),
      ]);
      set({ zones, events });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Could not load Safe Zone information.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  saveNew: async (input) => {
    set({ isSaving: true, error: null });
    try {
      const zone = await createGeofence(input);
      set({ zones: [zone, ...get().zones] });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Could not create the Safe Zone.",
      });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  saveEdit: async (id, input) => {
    set({ isSaving: true, error: null });
    try {
      const zone = await updateGeofence(id, input);
      set({ zones: get().zones.map((item) => (item.id === id ? zone : item)) });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Could not update the Safe Zone.",
      });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  remove: async (id) => {
    const previous = get().zones;
    set({ zones: previous.filter((zone) => zone.id !== id), error: null });
    try {
      await deleteGeofence(id);
    } catch (error) {
      set({
        zones: previous,
        error:
          error instanceof Error
            ? error.message
            : "Could not delete the Safe Zone.",
      });
      throw error;
    }
  },
}));
