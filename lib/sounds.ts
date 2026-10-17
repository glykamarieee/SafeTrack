import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createVideoPlayer, type VideoPlayer } from "expo-video";

/**
 * Short in-app sound effects. The files in assets/sounds are made by SafeTrack
 * (no licensing). expo-video plays them, so no extra native audio library is
 * needed; a player plays sound without a VideoView.
 *
 * Notification sounds (SOS siren, safe-zone chime) are separate: Android plays
 * them through the notification channels (see services/alertNotifier.ts).
 */
const SOURCES = {
  sosSent: require("../assets/sounds/sos_sent.wav"),
  success: require("../assets/sounds/success.wav"),
  tick: require("../assets/sounds/tick.wav"),
  cancel: require("../assets/sounds/cancel.wav"),
  error: require("../assets/sounds/error.wav"),
  alarm: require("../assets/sounds/sos_alarm.wav"),
  chime: require("../assets/sounds/zone_chime.wav"),
} as const;

export type SoundName = keyof typeof SOURCES;

const SOUNDS_KEY = "safetrack:sounds-enabled";

let enabled = true;
let loaded = false;
const players = new Map<SoundName, VideoPlayer>();

/** Reads the saved on/off setting once; sounds are on by default. */
export async function loadSoundSetting(): Promise<boolean> {
  if (!loaded) {
    loaded = true;
    try {
      enabled = (await AsyncStorage.getItem(SOUNDS_KEY)) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export async function setSoundsEnabled(value: boolean): Promise<void> {
  enabled = value;
  loaded = true;
  try {
    await AsyncStorage.setItem(SOUNDS_KEY, value ? "on" : "off");
  } catch {
    // The setting still applies until the app restarts.
  }
}

function playerFor(name: SoundName) {
  let player = players.get(name);
  if (!player) {
    player = createVideoPlayer(SOURCES[name]);
    // Lower other apps' audio briefly instead of stopping their music.
    player.audioMixingMode = "duckOthers";
    player.loop = false;
    players.set(name, player);
  }
  return player;
}

/** Plays a sound effect. Never throws: a missing sound must not break a screen. */
export function playSound(name: SoundName) {
  if (Platform.OS === "web") return;

  void loadSoundSetting().then((on) => {
    if (!on) return;
    try {
      const player = playerFor(name);
      player.currentTime = 0;
      player.play();
    } catch (error) {
      console.warn("[SafeTrack sound]", name, error);
    }
  });
}
