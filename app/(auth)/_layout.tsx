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
      <Stack.Screen
        name="login"
        options={{
          animation: "fade",
        }}
      />

      <Stack.Screen name="register" />

      <Stack.Screen name="forgot-password" />

      <Stack.Screen name="child-registration" />

      <Stack.Screen name="child-device-link" />
    </Stack>
  );
}