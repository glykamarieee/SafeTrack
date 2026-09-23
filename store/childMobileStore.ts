import { create } from "zustand";

import type {
  ChildMobileContext,
  ChildMobileSosAlert,
  ChildSafeZoneStatus,
  LocationLog,
} from "../types/safetrack";

import {
  ChildPhoneUnlinkedError,
  fetchChildPhoneState,
  hasChildPhoneCredentials,
  linkChildPhone,
  realertChildPhoneSos,
  sendCurrentChildPhoneLocation,
  triggerChildPhoneSos,
  unlinkChildPhone,
} from "../services/childMobileService";


interface ChildMobileState {
  context: ChildMobileContext | null;
  latestLocation: LocationLog | null;
  safeZoneStatus: ChildSafeZoneStatus | null;
  activeSos: ChildMobileSosAlert | null;

  loading: boolean;
  isLoading: boolean;
  isBootstrapped: boolean;
  error: string | null;

  bootstrap(): Promise<void>;
  linkDevice(code: string): Promise<void>;
  sendLocation(): Promise<void>;
  refresh(): Promise<void>;
  disconnect(deviceId?: string): Promise<void>;
  triggerSos(): Promise<void>;
  refreshActiveSos(): Promise<void>;
  recordRealert(sosId: string): Promise<void>;
  clearError(): void;
}


const signedOutState = {
  context: null,
  latestLocation: null,
  safeZoneStatus: null,
  activeSos: null,
};

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}


export const useChildMobileStore = create<ChildMobileState>((set, get) => {
  /**
   * Run a request; if the server says this phone is no longer linked,
   * drop the child state so the layout returns to the link screen.
   */
  async function run<T>(
    request: () => Promise<T>,
    fallbackMessage: string,
    options: { busy?: boolean } = {}
  ): Promise<T> {
    if (options.busy) {
      set({ loading: true, isLoading: true, error: null });
    }

    try {
      return await request();
    } catch (error) {
      if (error instanceof ChildPhoneUnlinkedError) {
        set(signedOutState);
      }

      set({ error: messageOf(error, fallbackMessage) });
      throw error;
    } finally {
      if (options.busy) {
        set({ loading: false, isLoading: false });
      }
    }
  }

  async function loadState() {
    const state = await fetchChildPhoneState();

    set({
      context: state.context,
      latestLocation: state.latestLocation,
      safeZoneStatus: state.safeZoneStatus,
      activeSos: state.activeSos,
    });
  }

  return {
    ...signedOutState,

    loading: false,
    isLoading: false,
    isBootstrapped: false,
    error: null,


    bootstrap: async () => {
      try {
        if (await hasChildPhoneCredentials()) {
          await run(loadState, "Unable to load the child dashboard.", { busy: true });
        } else {
          set(signedOutState);
        }
      } catch {
        // Error is in state; an unlinked phone lands on the link screen.
      } finally {
        set({ isBootstrapped: true });
      }
    },


    linkDevice: async (code) => {
      await run(
        async () => {
          await linkChildPhone(code);
          await loadState();
        },
        "Unable to link this child phone.",
        { busy: true }
      );

      set({ isBootstrapped: true });
    },


    sendLocation: async () => {
      const result = await run(
        sendCurrentChildPhoneLocation,
        "Unable to send location.",
        { busy: true }
      );

      set({
        latestLocation: result.location,
        safeZoneStatus: result.safeZoneStatus,
      });
    },


    refresh: async () => {
      if (!get().context) return;

      try {
        await run(loadState, "Unable to refresh.");
      } catch {
        // Error is in state.
      }
    },


    disconnect: async () => {
      await run(unlinkChildPhone, "Unable to disconnect this phone.", { busy: true });
      set(signedOutState);
    },


    triggerSos: async () => {
      const sos = await run(triggerChildPhoneSos, "SOS failed.", { busy: true });
      set({ activeSos: sos });
    },


    refreshActiveSos: async () => {
      await get().refresh();
    },


    recordRealert: async (sosId) => {
      try {
        const sos = await run(
          () => realertChildPhoneSos(sosId),
          "Unable to repeat the SOS alert."
        );

        set({ activeSos: sos?.status === "active" ? sos : null });
      } catch {
        // Error is in state; the next interval retries.
      }
    },


    clearError: () => {
      set({ error: null });
    },
  };
});
