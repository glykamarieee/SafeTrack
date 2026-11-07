// The real network (see environment.js).
Object.assign(globalThis, globalThis.__nodeNetwork);

// Only what a laptop cannot do is replaced: phone storage (kept in memory),
// screen navigation (recorded instead of performed) and the safe-area insets.
// The screens, the auth store, the auth service and the Supabase server are
// the real ones.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

jest.mock("expo-router", () => {
  const React = require("react");
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  let params = {};
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => params,
    useFocusEffect: (effect) => React.useEffect(effect, []),
    // Links render their content; Redirect records where it would go.
    Link: ({ children }) => children,
    Redirect: jest.fn(() => null),
    __setParams: (next) => {
      params = next;
    },
  };
});

// Email links return to the installed app's scheme (app.json "scheme"), as on a phone.
jest.mock("expo-linking", () => {
  let url = null;
  return {
    createURL: (path) => `safetrack://${String(path).replace(/^\//, "")}`,
    useURL: () => url,
    parse: (value) => ({ path: value }),
    addEventListener: () => ({ remove: () => undefined }),
    getInitialURL: async () => url,
    __setURL: (next) => {
      url = next;
    },
  };
});

// The welcome video and push registration need a phone.
jest.mock("expo-video", () => ({ useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn() }), VideoView: () => null }));
jest.mock("../../services/pushRegistrationService", () => ({
  registerGuardianPushToken: jest.fn(async () => "granted"),
  unregisterGuardianPushToken: jest.fn(async () => undefined),
}));

beforeEach(async () => {
  const router = require("expo-router");
  router.router.replace.mockClear();
  router.router.push.mockClear();
  router.Redirect.mockClear();
  router.__setParams({});
});

afterAll(async () => {
  // Leave no session behind between test files.
  const { supabase } = require("../../lib/supabase");
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
});
