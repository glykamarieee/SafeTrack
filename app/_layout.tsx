import { Stack } from "expo-router";

// Registers the child phone's background location task at startup: Android
// can start the app's JS without any screen to deliver a location.
import "../services/childBackgroundLocation";
import { StatusBar } from "expo-status-bar";

import { FontsReadyContext, useLoadAppFonts } from "../theme/fonts";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

function ThemedStack() {
  const { scheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" />

        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="(app)"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="(child)"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Headings fall back to the platform serif until Fraunces is ready, so the
  // app never waits on the font.
  const { ready } = useLoadAppFonts();

  return (
    <ThemeProvider>
      <FontsReadyContext.Provider value={ready}>
        <ThemedStack />
      </FontsReadyContext.Provider>
    </ThemeProvider>
  );
}
