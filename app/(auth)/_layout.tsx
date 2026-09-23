import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: {
          backgroundColor: "#F5FBF7",
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