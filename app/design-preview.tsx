import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button, Contour, Entrance, Rule, Screen, Segmented, StateRing, Surface, Text } from "../components/ui";
import { useTheme, type AppearancePreference } from "../theme/ThemeProvider";
import { space } from "../theme/tokens";

/**
 * Development-only gallery of the design system, used for the redesign's
 * before/after screenshots. Production builds redirect to the start screen.
 */
export default function DesignPreview() {
  const { preference, setPreference, colors } = useTheme();
  const [tab, setTab] = useState<"today" | "week" | "month">("today");

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ marginHorizontal: -space.gutter, paddingHorizontal: space.gutter, paddingVertical: space.xl, gap: space.md }}>
        <Contour />
        <Text variant="legend">Design system · preview</Text>
        <Text variant="display">Calm cartography</Text>
        <Text>Warm paper, ink-thin rules, forest green. Red only for SOS.</Text>
      </View>

      <Segmented<AppearancePreference>
        accessibilityLabel="Appearance"
        value={preference}
        onChange={setPreference}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "Match phone" },
        ]}
      />

      <Entrance index={0}>
        <Surface>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <StateRing name="Mika Reyes" state="inside" size={64} live />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">Mika</Text>
              <Text variant="legend" tone="safe">Inside · Home · 2 min ago</Text>
            </View>
          </View>
        </Surface>
      </Entrance>

      <Entrance index={1}>
        <Surface padded={false}>
          <View style={{ flexDirection: "row" }}>
            {[
              ["SOS", "0"],
              ["Zones", "3"],
              ["AI", "1"],
            ].map(([label, value], index) => (
              <View key={label} style={{ flex: 1, flexDirection: "row" }}>
                {index > 0 ? <Rule vertical inset={space.md} /> : null}
                <View style={{ flex: 1, padding: space.lg, gap: 2 }}>
                  <Text variant="legend">{label}</Text>
                  <Text variant="title" tabular>{value}</Text>
                </View>
              </View>
            ))}
          </View>
        </Surface>
      </Entrance>

      <Entrance index={2} style={{ flexDirection: "row", gap: space.md, justifyContent: "space-between" }}>
        {(["inside", "outside", "offline", "sos", "unknown"] as const).map((state) => (
          <View key={state} style={{ alignItems: "center", gap: space.xs }}>
            <StateRing name="Ana Cruz" state={state} size={48} />
            <Text variant="legend">{state}</Text>
          </View>
        ))}
      </Entrance>

      <Segmented
        accessibilityLabel="Range"
        value={tab}
        onChange={setTab}
        options={[
          { value: "today", label: "Today" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />

      <View style={{ gap: space.md }}>
        <Button label="Register your child" icon="person-add-outline" block />
        <Button label="View history" variant="secondary" block />
        <Button label="Acknowledge SOS" variant="danger" icon="alert-circle" block />
        <Button label="Skip" variant="ghost" />
        <Button label="Saving" loading block />
      </View>

      <Surface tone="sunken">
        <Text variant="title">Title 26</Text>
        <Text variant="heading">Heading 19</Text>
        <Text>Body 15: the quick brown fox.</Text>
        <Text variant="label">Label 13</Text>
        <Text variant="legend">Legend 11</Text>
        <Text tone="danger">Danger text</Text>
        <Text tone="warning">Warning text</Text>
        <Text tone="info">Info text</Text>
        <Text tone="muted" tabular>12.4 km · 08:14 – 17:52 · 6 stops</Text>
      </Surface>

      <View style={{ height: 24, borderRadius: 4, backgroundColor: colors.warningFill }} />
    </Screen>
  );
}
