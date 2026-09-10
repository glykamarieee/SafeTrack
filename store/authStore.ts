import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

import {
  getCurrentSafeTrackAccount,
  signInWithPassword,
  signOut as signOutRequest,
  signUpGuardian,
  type SafeTrackPerson,
} from "../services/supabaseAuthService";

import {
  ensureGuardianProfile,
  fetchLinkedChildren,
  resolveProfileForUser,
} from "../services/profileService";

import type {
  Administrator,
  Child,
  Guardian,
  UserRole,
} from "../types/safetrack";

interface AuthState {
  isBootstrapped: boolean;
  isLoading: boolean;
  error: string | null;

  session: Session | null;
  role: UserRole | null;

  guardian: Guardian | null;
  child: Child | null;
  administrator: Administrator | null;
  linkedChildren: Child[];

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;

  /*
   * Child state helpers.
   */
  refreshLinkedChildren: () => Promise<void>;
  removeLinkedChild: (childId: string) => void;
  addLinkedChild: (child: Child) => void;
  updateLinkedChild: (child: Child) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const possibleError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message =
      typeof possibleError.message === "string"
        ? possibleError.message
        : "";

    const details =
      typeof possibleError.details === "string"
        ? possibleError.details
        : "";

    const hint =
      typeof possibleError.hint === "string"
        ? possibleError.hint
        : "";

    const combined = [message, details, hint]
      .filter(Boolean)
      .join(" ");

    if (combined) {
      return combined;
    }
  }

  return fallback;
}

function isMissingGuardianProfileError(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();

  return (
    message.includes("guardian profile was not found") ||
    message.includes("no profile found") ||
    message.includes("no guardian profile")
  );
}

function getGuardianNameFromSession(
  session: Session,
  fallbackEmail: string
) {
  const metadata = session.user?.user_metadata as {
    full_name?: unknown;
  };

  if (
    typeof metadata?.full_name === "string" &&
    metadata.full_name.trim().length >= 2
  ) {
    return metadata.full_name.trim();
  }

  const emailName = fallbackEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  return emailName || "Guardian";
}

function clearProfileState() {
  return {
    role: null,
    guardian: null,
    child: null,
    administrator: null,
    linkedChildren: [],
  };
}

function createAdministrator(
  person: SafeTrackPerson,
  authUserId: string,
  createdAt: string
): Administrator {
  return {
    id: person.id,
    userId: authUserId,
    fullName: person.fullName,
    email: person.email,
    createdAt,
  };
}

async function loadGuardianState(
  userId: string,
  set: (partial: Partial<AuthState>) => void
) {
  const profile = await resolveProfileForUser(userId);

  if (!profile.guardian) {
    throw new Error("Guardian profile was not found.");
  }

  const linkedChildren = await fetchLinkedChildren(
    profile.guardian.id
  );

  set({
    role: "guardian",
    guardian: profile.guardian,
    child: null,
    administrator: null,
    linkedChildren,
  });
}

async function loadOrProvisionGuardianState(
  session: Session,
  email: string,
  set: (partial: Partial<AuthState>) => void
) {
  try {
    await loadGuardianState(session.user.id, set);
  } catch (error) {
    if (!isMissingGuardianProfileError(error)) {
      throw error;
    }

    await ensureGuardianProfile(
      getGuardianNameFromSession(session, email),
      email.trim().toLowerCase()
    );

    await loadGuardianState(session.user.id, set);
  }
}

function loadAdministratorState(
  person: SafeTrackPerson,
  session: Session,
  set: (partial: Partial<AuthState>) => void
) {
  set({
    role: "admin",
    guardian: null,
    child: null,
    linkedChildren: [],
    administrator: createAdministrator(
      person,
      session.user.id,
      session.user.created_at
    ),
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isBootstrapped: false,
  isLoading: false,
  error: null,

  session: null,
  role: null,

  guardian: null,
  child: null,
  administrator: null,
  linkedChildren: [],

  /*
   * BOOTSTRAP
   */
  bootstrap: async () => {
    set({
      isLoading: true,
      error: null,
    });

    try {
      const account = await getCurrentSafeTrackAccount();

      if (!account?.session?.user) {
        set({
          session: null,
          ...clearProfileState(),
        });

        return;
      }

      set({
        session: account.session,
      });

      if (account.role === "admin" && account.person) {
        loadAdministratorState(
          account.person,
          account.session,
          set
        );

        return;
      }

      if (account.role === "guardian") {
        await loadOrProvisionGuardianState(
          account.session,
          account.session.user.email ?? "",
          set
        );

        return;
      }

      set({
        ...clearProfileState(),
      });
    } catch (error) {
      console.error("[authStore.bootstrap]", error);

      set({
        error: getErrorMessage(
          error,
          "Could not restore your SafeTrack session."
        ),
      });
    } finally {
      set({
        isLoading: false,
        isBootstrapped: true,
      });
    }
  },

  /*
   * LOGIN
   */
  login: async (email, password) => {
    set({
      isLoading: true,
      error: null,
    });

    try {
      const signInResult = await signInWithPassword(
        email,
        password
      );

      const session = signInResult.session;

      if (!session?.user) {
        throw new Error(
          "SafeTrack could not confirm your login session."
        );
      }

      set({
        session,
      });

      /*
       * ADMIN LOGIN
       */
      if (
        signInResult.role === "admin" &&
        signInResult.person
      ) {
        loadAdministratorState(
          signInResult.person,
          session,
          set
        );

        return;
      }

      /*
       * GUARDIAN LOGIN
       */
      if (signInResult.role === "guardian") {
        await loadOrProvisionGuardianState(
          session,
          signInResult.person?.email ??
            session.user.email ??
            email.trim().toLowerCase(),
          set
        );

        return;
      }

      /*
       * Newly registered Guardian accounts may not yet
       * have a persons/role row.
       */
      if (!signInResult.person) {
        await loadOrProvisionGuardianState(
          session,
          session.user.email ??
            email.trim().toLowerCase(),
          set
        );

        return;
      }

      throw new Error(
        "This SafeTrack account has no valid Guardian or Administrator role."
      );
    } catch (error) {
      console.error("[authStore.login]", error);

      set({
        error: getErrorMessage(
          error,
          "Unable to sign in."
        ),
      });

      throw error;
    } finally {
      set({
        isLoading: false,
      });
    }
  },

  /*
   * REGISTER
   */
  register: async (
    fullName,
    email,
    password
  ) => {
    set({
      isLoading: true,
      error: null,
    });

    try {
      await signUpGuardian(
        fullName,
        email,
        password
      );

      try {
        await signOutRequest();
      } catch {
        /*
         * Supabase may not create an active session
         * until email confirmation.
         */
      }

      set({
        session: null,
        ...clearProfileState(),
      });
    } catch (error) {
      console.error(
        "[authStore.register]",
        error
      );

      set({
        error: getErrorMessage(
          error,
          "Unable to create account."
        ),
      });

      throw error;
    } finally {
      set({
        isLoading: false,
      });
    }
  },

  /*
   * REFRESH CHILDREN
   *
   * This reloads the actual child_profiles records
   * from Supabase.
   */
  refreshLinkedChildren: async () => {
    const guardian = get().guardian;

    if (!guardian?.id) {
      set({
        linkedChildren: [],
      });

      return;
    }

    try {
      const children = await fetchLinkedChildren(
        guardian.id
      );

      set({
        linkedChildren: children,
      });
    } catch (error) {
      console.error(
        "[authStore.refreshLinkedChildren]",
        error
      );

      set({
        error: getErrorMessage(
          error,
          "Unable to refresh the registered children."
        ),
      });

      throw error;
    }
  },

  /*
   * REMOVE CHILD FROM LOCAL STATE
   *
   * THIS IS THE IMPORTANT FIX.
   *
   * Once Supabase confirms deletion, the dashboard
   * immediately removes the same child from Zustand.
   */
  removeLinkedChild: (childId: string) => {
    if (!childId) {
      return;
    }

    set((state) => {
      const remainingChildren =
        state.linkedChildren.filter(
          (child) => child.id !== childId
        );

      /*
       * If the currently selected child was deleted,
       * automatically select the first remaining child.
       *
       * If there are no children left, child becomes null.
       */
      const currentChildWasDeleted =
        state.child?.id === childId;

      return {
        linkedChildren: remainingChildren,
        child: currentChildWasDeleted
          ? remainingChildren[0] ?? null
          : state.child,
      };
    });
  },

  /*
   * ADD CHILD TO LOCAL STATE
   *
   * Useful after registering a new child.
   */
  addLinkedChild: (child: Child) => {
    set((state) => {
      const alreadyExists =
        state.linkedChildren.some(
          (existingChild) =>
            existingChild.id === child.id
        );

      if (alreadyExists) {
        return {
          linkedChildren: state.linkedChildren.map(
            (existingChild) =>
              existingChild.id === child.id
                ? child
                : existingChild
          ),
        };
      }

      return {
        linkedChildren: [
          ...state.linkedChildren,
          child,
        ],
      };
    });
  },

  /*
   * UPDATE CHILD IN LOCAL STATE
   */
  updateLinkedChild: (child: Child) => {
    set((state) => ({
      linkedChildren: state.linkedChildren.map(
        (existingChild) =>
          existingChild.id === child.id
            ? child
            : existingChild
      ),

      child:
        state.child?.id === child.id
          ? child
          : state.child,
    }));
  },

  /*
   * LOGOUT
   */
  logout: async () => {
    set({
      isLoading: true,
      error: null,
    });

    try {
      await signOutRequest();
    } catch {
      /*
       * Local SafeTrack state must still clear
       * if Supabase is offline.
       */
    } finally {
      set({
        session: null,
        ...clearProfileState(),
        isLoading: false,
      });
    }
  },

  /*
   * CLEAR ERROR
   */
  clearError: () => {
    set({
      error: null,
    });
  },
}));