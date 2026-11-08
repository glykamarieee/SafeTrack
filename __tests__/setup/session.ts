import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { selectChild } from "../../hooks/useSelectedChild";
import { useAuthStore } from "../../store/authStore";

type Login = { email: string; password: string };

/** Signs in through the real auth store, as the Login screen does. */
export async function signInAs(login: Login, childId?: string) {
  await signOutLocally();
  await useAuthStore.getState().login(login.email, login.password);
  if (childId) selectChild(childId);
}

export async function signOutLocally() {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null, role: null, guardian: null, linkedChildren: [], error: null, isLoading: false });
}

/**
 * A second, separate connection signed in as `login`, for reading results
 * back while the app itself is signed out (a child phone has no account).
 */
export async function readerAs(login: Login) {
  const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword(login);
  if (error) throw error;
  return client;
}
