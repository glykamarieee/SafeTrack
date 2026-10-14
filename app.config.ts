import type { ConfigContext, ExpoConfig } from "expo/config";

// Static settings stay in app.json; this file adds the Mapbox SDK.
//
// The map needs only EXPO_PUBLIC_MAPBOX_TOKEN (a public `pk.` token) in .env,
// read at bundle time by components/location/mapSupport.ts. Mapbox no longer
// requires a secret download token to build. Adding the native SDK needs a
// rebuild (`npm run build:android`); Expo Go cannot run it and previews the
// map with react-native-maps instead.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [...(config.plugins ?? []), "@rnmapbox/maps"],
});
