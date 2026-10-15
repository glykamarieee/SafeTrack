import { Stack } from "expo-router";

import { useTheme } from "../../theme/ThemeProvider";

export default function AuthLayout() {
  const { scheme, colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: {
          // Matches the green header behind each sign-in screen.
          backgroundColor: scheme === "dark" ? colors.forest : "#15803D",
        },
      }}
    >
      {/* SafeTrack Introduction */}
      <Stack.Screen
        name="welcome"
        options={{
          animation: "fade",
        }}
      />

      {/* Authentication */}
      <Stack.Screen
        name="login"
        options={{
          animation: "fade",
        }}
      />

      <Stack.Screen
        name="register"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="reset-password"
        options={{
          animation: "fade",
        }}
      />

      <Stack.Screen
        name="forgot-password"
        options={{
          animation: "slide_from_right",
        }}
      />


      {/* Guardian Child Setup */}
      <Stack.Screen
        name="child-registration"
        options={{
          animation: "slide_from_right",
        }}
      />

    </Stack>
  );
}