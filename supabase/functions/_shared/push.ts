import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function sendGuardianPush(
  supabase: SupabaseClient,
  guardianId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  const { data: tokens, error } = await supabase
    .from("guardian_push_tokens")
    .select("push_token")
    .eq("guardian_id", guardianId)
    .eq("is_active", true);

  if (error) {
    console.error("push-token lookup failed", error);
    return;
  }

  const messages = (tokens ?? [])
    .map((row) => row.push_token)
    .filter(Boolean)
    .map((to) => ({
      to,
      sound: "default",
      title,
      body,
      priority: "high",
      data,
    }));

  if (messages.length === 0) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    console.error("Expo push failed", await response.text());
  }
}
