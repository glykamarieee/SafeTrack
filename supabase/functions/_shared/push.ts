import type { SupabaseClient } from "npm:@supabase/supabase-js@2";


function isValidExpoPushToken(
  token: string,
) {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token);
}



export async function sendGuardianPush(
  supabase: SupabaseClient,

  guardianId: string,

  title: string,

  body: string,

  data: Record<string, unknown>,
) {


  const {
    data: tokens,

    error,
  } = await supabase
    .from("guardian_push_tokens")
    .select(
      "expo_push_token",
    )
    .eq(
      "guardian_id",
      guardianId,
    )
    .eq(
      "is_active",
      true,
    );



  if (error) {

    console.error(
      "push-token lookup failed:",
      error,
    );

    return;

  }



  const messages =
    (tokens ?? [])

      .map(
        (row) =>
          row.expo_push_token,
      )

      .filter(
        (
          token,
        ): token is string =>
          Boolean(token) &&
          isValidExpoPushToken(token),
      )

      .map(
        (to) => ({
          to,

          sound: "default",

          title,

          body,

          priority: "high",

          data,

        }),
      );



  if (messages.length === 0) {

    console.log(
      "No active guardian push tokens found.",
    );

    return;

  }



  const response =
    await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(messages),
      },
    );



  const result =
    await response.json();



  if (!response.ok) {

    console.error(
      "Expo push request failed:",
      result,
    );

    return;

  }



  const tickets =
    Array.isArray(result.data)
      ? result.data
      : [];



  const failed =
    tickets.filter(
      (ticket: any) =>
        ticket.status === "error",
    );



  if (failed.length > 0) {

    console.error(
      "Some push notifications failed:",
      failed,
    );

  }

}