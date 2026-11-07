// The React Native test environment, plus Node's real network functions.
// jest-expo replaces `fetch` with a stub for Expo's native fetch module, so a
// request never reaches a server. SafeTrack's unit tests check the real
// Supabase answers (wrong password, existing email, deleted account), so the
// real `fetch` is kept here and put back in mocks.js.
const ReactNativeEnv = require("@react-native/jest-preset/jest/react-native-env.js");

module.exports = class SafeTrackTestEnv extends ReactNativeEnv {
  constructor(config, context) {
    super(config, context);
    this.global.__nodeNetwork = { fetch, Headers, Request, Response, FormData, AbortController };
  }
};
