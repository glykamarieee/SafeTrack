import type { Ionicons } from "@expo/vector-icons";

import type { ActivityEvent } from "../../services/activityHistoryService";

export type EventFilter = "all" | "sos" | "zones" | "device" | "inactivity" | "ai";

export const EVENT_FILTERS: { id: EventFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sos", label: "SOS" },
  { id: "zones", label: "Safe Zones" },
  { id: "device", label: "Device" },
  { id: "inactivity", label: "Inactivity" },
  { id: "ai", label: "AI notices" },
];

export function eventCategory(event: ActivityEvent): Exclude<EventFilter, "all"> {
  switch (event.type) {
    case "sos":
      return "sos";
    case "anomaly":
      return "ai";
    case "watch_disconnected":
      return "device";
    case "prolonged_inactivity":
      return "inactivity";
    default:
      return "zones";
  }
}

export type EventLook = {
  tint: string;
  soft: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

/** Colour, icon and short label for an event, used for pins and the timeline. */
export function eventLook(event: ActivityEvent): EventLook {
  if (event.type === "sos") {
    return { tint: "#D93025", soft: "#FCE8E8", icon: "warning", label: event.sosStatus === "active" ? "Active SOS" : "SOS" };
  }
  if (event.type === "anomaly") return { tint: "#7C3AED", soft: "#F1EAFE", icon: "analytics-outline", label: "AI notice" };
  if (event.type === "watch_disconnected") return { tint: "#6B7670", soft: "#EEF0EF", icon: "watch-outline", label: "Watch offline" };
  if (event.type === "prolonged_inactivity") return { tint: "#1A73E8", soft: "#E8F0FE", icon: "hourglass-outline", label: "Inactivity" };
  if (event.rawType === "exit") return { tint: "#E8A317", soft: "#FFF3DC", icon: "exit-outline", label: "Left zone" };
  if (event.rawType === "entry") return { tint: "#1E8E5A", soft: "#E3F4EC", icon: "enter-outline", label: "Entered zone" };

  return { tint: "#137A50", soft: "#E3F4EC", icon: "shield-checkmark-outline", label: "Safe Zone" };
}
