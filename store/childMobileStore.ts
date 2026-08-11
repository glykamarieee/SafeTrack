import { create } from "zustand";

import type {
  ChildMobileContext,
  ChildMobileLocation,
  ChildMobileSosAlert,
  ChildSafeZoneStatus,
} from "../types/childMobile";

import {
  createChildMobileSosAlert,
  disconnectChildMobileDevice,
  fetchChildMobileActiveSos,
  fetchChildMobileContext,
  fetchChildSafeZoneStatus,
  linkChildMobileDevice,
  recordChildMobileSosRealert,
  sendChildMobileLocation,
} from "../services/childMobileService";

interface ChildMobileState {
  isBootstrapped: boolean;
  isLoading: boolean;
  error: string | null;

  context: ChildMobileContext | null;
  latestLocation: ChildMobileLocation | null;
  safeZoneStatus: ChildSafeZoneStatus | null;
  activeSos: ChildMobileSosAlert | null;

  bootstrap: () => Promise<void>;
  linkDevice: (code: string) => Promise<void>;

  refreshDashboard: () => Promise<void>;
  refresh: () => Promise<void>;

  publishLocation: () => Promise<void>;
  sendLocation: () => Promise<void>;

  triggerSos: () => Promise<void>;
  refreshActiveSos: () => Promise<void>;

  recordSosRealert: () => Promise<void>;
  recordRealert: () => Promise<void>;

  disconnectDevice: () => Promise<void>;
  disconnect: () => Promise<void>;

  clearError: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}

export const useChildMobileStore = create<ChildMobileState>(
  (set, get) => ({
    isBootstrapped: false,
    isLoading: false,
    error: null,

    context: null,
    latestLocation: null,
    safeZoneStatus: null,
    activeSos: null,

    bootstrap: async () => {
      set({
        isLoading: true,
        error: null,
      });

      try {
        const context = await fetchChildMobileContext();

        if (!context) {
          set({
            context: null,
            latestLocation: null,
            safeZoneStatus: null,
            activeSos: null,
          });

          return;
        }

        const [safeZoneStatus, activeSos] = await Promise.all([
          fetchChildSafeZoneStatus(),
          fetchChildMobileActiveSos(),
        ]);

        set({
          context,
          latestLocation: context.latestLocation,
          safeZoneStatus,
          activeSos,
        });
      } catch (error) {
        set({
          error: getErrorMessage(
            error,
            "SafeTrack could not restore the child-device connection."
          ),
        });
      } finally {
        set({
          isLoading: false,
          isBootstrapped: true,
        });
      }
    },

    linkDevice: async (code: string) => {
      set({
        isLoading: true,
        error: null,
      });

      try {
        const context = await linkChildMobileDevice(code);

        const [safeZoneStatus, activeSos] = await Promise.all([
          fetchChildSafeZoneStatus(),
          fetchChildMobileActiveSos(),
        ]);

        set({
          context,
          latestLocation: context.latestLocation,
          safeZoneStatus,
          activeSos,
          isBootstrapped: true,
        });
      } catch (error) {
        const message = getErrorMessage(
          error,
          "SafeTrack could not link this child phone."
        );

        set({
          error: message,
        });

        throw new Error(message);
      } finally {
        set({
          isLoading: false,
        });
      }
    },

    refreshDashboard: async () => {
      if (!get().context) {
        return;
      }

      set({
        isLoading: true,
        error: null,
      });

      try {
        const [context, safeZoneStatus, activeSos] =
          await Promise.all([
            fetchChildMobileContext(),
            fetchChildSafeZoneStatus(),
            fetchChildMobileActiveSos(),
          ]);

        if (!context) {
          set({
            context: null,
            latestLocation: null,
            safeZoneStatus: null,
            activeSos: null,
          });

          return;
        }

        set({
          context,
          latestLocation: context.latestLocation,
          safeZoneStatus,
          activeSos,
        });
      } catch (error) {
        set({
          error: getErrorMessage(
            error,
            "SafeTrack could not refresh the Child Dashboard."
          ),
        });
      } finally {
        set({
          isLoading: false,
        });
      }
    },

    refresh: async () => {
      await get().refreshDashboard();
    },

    publishLocation: async () => {
      set({
        isLoading: true,
        error: null,
      });

      try {
        const latestLocation = await sendChildMobileLocation();
        const safeZoneStatus = await fetchChildSafeZoneStatus();

        set((state) => ({
          latestLocation,
          safeZoneStatus,
          context: state.context
            ? {
                ...state.context,
                latestLocation,
              }
            : null,
        }));
      } catch (error) {
        const message = getErrorMessage(
          error,
          "SafeTrack could not send the latest location."
        );

        set({
          error: message,
        });

        throw new Error(message);
      } finally {
        set({
          isLoading: false,
        });
      }
    },

    sendLocation: async () => {
      await get().publishLocation();
    },

    triggerSos: async () => {
      set({
        isLoading: true,
        error: null,
      });

      try {
        /*
          A fresh location is attempted first.
          SOS can still continue using the latest stored location
          if current location is temporarily unavailable.
        */
        try {
          const latestLocation = await sendChildMobileLocation();

          set((state) => ({
            latestLocation,
            context: state.context
              ? {
                  ...state.context,
                  latestLocation,
                }
              : null,
          }));
        } catch {
          // Keep SOS available even without a fresh location.
        }

        const activeSos = await createChildMobileSosAlert();

        set({
          activeSos,
        });
      } catch (error) {
        const message = getErrorMessage(
          error,
          "SafeTrack could not send the SOS alert."
        );

        set({
          error: message,
        });

        throw new Error(message);
      } finally {
        set({
          isLoading: false,
        });
      }
    },

    refreshActiveSos: async () => {
      try {
        const activeSos = await fetchChildMobileActiveSos();

        set({
          activeSos,
        });
      } catch (error) {
        set({
          error: getErrorMessage(
            error,
            "SafeTrack could not check SOS acknowledgement status."
          ),
        });
      }
    },

    recordSosRealert: async () => {
      const currentAlert = get().activeSos;

      if (!currentAlert || currentAlert.status !== "active") {
        return;
      }

      try {
        const updatedAlert = await recordChildMobileSosRealert(
          currentAlert.id
        );

        set({
          activeSos: updatedAlert,
        });
      } catch (error) {
        set({
          error: getErrorMessage(
            error,
            "SafeTrack could not update SOS re-alert information."
          ),
        });
      }
    },

    recordRealert: async () => {
      await get().recordSosRealert();
    },

    disconnectDevice: async () => {
      set({
        isLoading: true,
        error: null,
      });

      try {
        await disconnectChildMobileDevice();

        set({
          context: null,
          latestLocation: null,
          safeZoneStatus: null,
          activeSos: null,
          isBootstrapped: true,
        });
      } catch (error) {
        const message = getErrorMessage(
          error,
          "SafeTrack could not disconnect this child phone."
        );

        set({
          error: message,
        });

        throw new Error(message);
      } finally {
        set({
          isLoading: false,
        });
      }
    },

    disconnect: async () => {
      await get().disconnectDevice();
    },

    clearError: () => {
      set({
        error: null,
      });
    },
  })
);