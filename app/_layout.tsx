import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
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