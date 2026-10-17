import { existsSync } from "node:fs";
import { join } from "node:path";

import type { ConfigContext, ExpoConfig } from "expo/config";

// Static settings stay in app.json; this file adds native configuration that
// depends on files and environment:
//
// - Mapbox SDK (@rnmapbox/maps). The map needs EXPO_PUBLIC_MAPBOX_TOKEN (a
//   public `pk.` token) in .env, read at bundle time by
//   components/location/mapSupport.ts.
// - Push notifications (expo-notifications). The Android channel ids must stay
//   `safetrack-sos`, `safetrack-zones` and `safetrack-alerts`: the database's
//   send_guardian_push() uses them.
// - Firebase (google-services.json): Android needs it for push tokens. It is
//   added only when the file exists in the project root, so builds without it
//   still work (push registration is then skipped).
//
// Native changes need a rebuild (`npm run build:android`); Expo Go ignores them.
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServices = "./google-services.json";
  const hasGoogleServices = existsSync(join(__dirname, googleServices));

  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: googleServices } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      "@rnmapbox/maps",
      [
        "expo-notifications",
        {
          color: "#137A50",
          defaultChannel: "safetrack-alerts",
          // Notification sounds (copied to res/raw). The channels that use
          // them are created in services/alertNotifier.ts.
          sounds: ["./assets/sounds/sos_alarm.wav", "./assets/sounds/zone_chime.wav"],
        },
      ],
    ],
  };
};
