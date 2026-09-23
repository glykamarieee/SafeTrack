// SafeTrack Shared Response Helper
// Used by Supabase Edge Functions
// Handles CORS + JSON responses


export const corsHeaders = {

  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-watch-id",
      "x-device-token",
      "x-cron-secret",
    ].join(", "),


  "Access-Control-Allow-Methods":
    [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ].join(", "),


  "Access-Control-Max-Age":
    "86400",

};



/**
 * Standard JSON response helper
 */
export function json(
  data: unknown,
  status = 200,
) {

  return new Response(

    JSON.stringify(data),

    {

      status,

      headers: {

        ...corsHeaders,

        "Content-Type":
          "application/json; charset=utf-8",

      },

    },

  );

}



/**
 * CORS preflight response
 */
export function options() {

  return new Response(

    "ok",

    {

      status: 200,

      headers: corsHeaders,

    },

  );

}



/**
 * Standard success response
 */
export function success(
  data: unknown = {},
  status = 200,
) {

  return json(

    {
      success: true,

      data,

    },

    status,

  );

}



/**
 * Standard error response
 */
export function errorResponse(
  message: string,
  status = 400,
  details?: unknown,
) {

  return json(

    {

      success: false,

      error: message,

      ...(details
        ? { details }
        : {}),

    },

    status,

  );

}