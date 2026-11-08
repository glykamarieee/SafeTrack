import { AppState, type AppStateStatus } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "../lib/supabase";
import { testLog } from "../lib/testLog";
import { normalizeMode } from "../lib/travelMode";
import type { TravelMode } from "../types/safetrack";

/**
 * Near real-time position while a guardian has a map open (migration
 * 20261108_live_stream.sql).
 *
 * - The app tells SafeTrack it is watching (request_child_live) every
 *   RENEW_MS and wakes the watch or phone at once with a "wake" on the public
 *   topic live-wake:<child id> (no data in it; they used to notice only at
 *   their next 20-second check). They then send a fix about every second,
 *   which arrives here on the private Realtime topic child-live:<child id>.
 *   Nothing is saved per second; history rows keep their usual pace.
 * - One session per child, shared by every screen that shows the child.
 * - Runs as long as a map screen is in front (no tap needed); stops when the
 *   app goes to the background and when the last screen closes, and starts
 *   again on its own when the app returns. A still child sends a fix only
 *   every 5 s (watch and phone), which keeps free-plan Realtime use low.
 */

export type LiveFix = {
  childId: string;
  source: "smartwatch" | "mobile";
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
  sentAt: string | null;
  receivedAt: number;
  speedMps: number | null;
  headingDegrees: number | null;
  travelMode: TravelMode | null;
  modeConfidence: number | null;
  /** Watch only (migration 20261108b): its battery and network right now. */
  batteryPercent: number | null;
  networkType: string | null;
};

/** connecting: asked, nothing yet; live: fixes arriving; paused: app in the background; off: unavailable. */
export type LiveStatus = "connecting" | "live" | "paused" | "off";

const RENEW_MS = 15_000;
/** Wake again this often while no live fix has arrived, at most WAKE_TRIES times. */
const WAKE_RETRY_MS = 3_000;
const WAKE_TRIES = 4;
const RENEW_SECONDS = 30;
/** No fix for this long: back to "connecting" (device offline or no signal). */
const QUIET_MS = 20_000;

type Session = {
  listeners: Set<(fix: LiveFix) => void>;
  channel: RealtimeChannel | null;
  renew: ReturnType<typeof setInterval> | null;
  quiet: ReturnType<typeof setInterval> | null;
  wake: ReturnType<typeof setInterval> | null;
  startedAt: number;
  lastFixAt: number;
};

const sessions = new Map<string, Session>();

type LiveState = {
  status: Record<string, LiveStatus>;
  /** Delay from the device's fix to this screen, last few fixes (ms). */
  delays: Record<string, number[]>;
  /** The watch's battery and network from the newest live fix. */
  device: Record<string, { batteryPercent: number; networkType: string | null; at: number }>;
};

export const useLiveStore = create<LiveState>(() => ({ status: {}, delays: {}, device: {} }));

function recordDevice(fix: LiveFix) {
  if (fix.source !== "smartwatch" || fix.batteryPercent == null) return;
  const current = useLiveStore.getState().device[fix.childId];
  if (current?.batteryPercent === fix.batteryPercent && current.networkType === fix.networkType) return;
  useLiveStore.setState((state) => ({
    device: {
      ...state.device,
      [fix.childId]: { batteryPercent: fix.batteryPercent!, networkType: fix.networkType, at: fix.receivedAt },
    },
  }));
}

function setStatus(childId: string, status: LiveStatus) {
  if (useLiveStore.getState().status[childId] === status) return;
  useLiveStore.setState((state) => ({ status: { ...state.status, [childId]: status } }));
}

let delaysSinceSummary = 0;

function recordDelay(childId: string, ms: number) {
  useLiveStore.setState((state) => ({
    delays: { ...state.delays, [childId]: [...(state.delays[childId] ?? []).slice(-29), ms] },
  }));
  // Field test: average and 95th percentile of the last 30 fixes, every 30 fixes.
  if (++delaysSinceSummary < 30) return;
  delaysSinceSummary = 0;
  const sorted = [...(useLiveStore.getState().delays[childId] ?? [])].sort((a, b) => a - b);
  if (!sorted.length) return;
  testLog("latency", {
    n: sorted.length,
    avg: Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    max: sorted[sorted.length - 1],
  });
}

function toFix(childId: string, payload: Record<string, unknown>): LiveFix | null {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (payload.childId !== childId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    childId,
    source: payload.source === "mobile" ? "mobile" : "smartwatch",
    latitude,
    longitude,
    accuracyMeters: number(payload.accuracyMeters),
    recordedAt: typeof payload.recordedAt === "string" ? payload.recordedAt : new Date().toISOString(),
    sentAt: typeof payload.sentAt === "string" ? payload.sentAt : null,
    receivedAt: Date.now(),
    speedMps: number(payload.speedMps),
    headingDegrees: number(payload.headingDegrees),
    travelMode: normalizeMode(payload.travelMode),
    modeConfidence: number(payload.modeConfidence),
    batteryPercent: number(payload.batteryPercent),
    networkType: typeof payload.networkType === "string" ? payload.networkType : null,
  };
}

/** Tells the child's watch or phone to start live fixes now. Never throws. */
function wakeDevice(childId: string) {
  const channel = supabase.channel(`live-wake:${childId}`);
  void channel
    .httpSend("wake", { at: new Date().toISOString() })
    .catch((reason: unknown) => console.log("[live location] wake", (reason as { message?: string })?.message ?? reason))
    .finally(() => void supabase.removeChannel(channel));
}

async function request(childId: string, seconds: number) {
  const { error } = await supabase.rpc("request_child_live", { p_child_id: childId, p_seconds: seconds });
  if (error) throw error;
}

function stopTimers(session: Session) {
  if (session.renew) clearInterval(session.renew);
  if (session.quiet) clearInterval(session.quiet);
  if (session.wake) clearInterval(session.wake);
  session.renew = null;
  session.quiet = null;
  session.wake = null;
}

function closeChannel(session: Session) {
  if (session.channel) void supabase.removeChannel(session.channel);
  session.channel = null;
}

/** (Re)starts asking for live fixes. */
function start(childId: string, session: Session) {
  stopTimers(session);
  session.startedAt = Date.now();
  session.lastFixAt = 0;
  setStatus(childId, "connecting");

  if (!session.channel) {
    const channel = supabase
      .channel(`child-live:${childId}`, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "live" }, ({ payload }) => {
        const fix = toFix(childId, (payload ?? {}) as Record<string, unknown>);
        if (!fix) return;
        if (!session.lastFixAt) testLog("live-start", { afterMs: fix.receivedAt - session.startedAt });
        session.lastFixAt = Date.now();
        setStatus(childId, "live");
        const fixTime = Date.parse(fix.recordedAt);
        if (Number.isFinite(fixTime)) recordDelay(childId, fix.receivedAt - fixTime);
        recordDevice(fix);
        session.listeners.forEach((listener) => listener(fix));
      });
    session.channel = channel;
    // Private channels need the signed-in user's token on the socket.
    void supabase.realtime.setAuth().finally(() => channel.subscribe());
  }

  const renew = () => {
    request(childId, RENEW_SECONDS).catch((reason) => {
      // Offline for a moment, or no permission: the map keeps its normal
      // updates (saved records through realtime and the 15 s check), and the
      // next renewal tries again.
      console.log("[live location]", (reason as { message?: string })?.message ?? reason);
      if (!session.lastFixAt || Date.now() - session.lastFixAt > QUIET_MS) setStatus(childId, "off");
    });
  };
  // Ask first, then wake: the device checks in right after the wake and
  // must find the request already there.
  void request(childId, RENEW_SECONDS)
    .catch(() => undefined)
    .finally(() => wakeDevice(childId));
  let tries = 1;
  session.wake = setInterval(() => {
    if (session.lastFixAt || tries >= WAKE_TRIES) {
      if (session.wake) clearInterval(session.wake);
      session.wake = null;
      return;
    }
    tries += 1;
    wakeDevice(childId);
  }, WAKE_RETRY_MS);
  session.renew = setInterval(renew, RENEW_MS);
  session.quiet = setInterval(() => {
    if (session.lastFixAt && Date.now() - session.lastFixAt > QUIET_MS) setStatus(childId, "connecting");
  }, 5_000);
}

function stop(childId: string, session: Session, closing: boolean) {
  stopTimers(session);
  void request(childId, 0).catch(() => undefined);
  if (closing) {
    closeChannel(session);
    sessions.delete(childId);
    setStatus(childId, "off");
  }
}

let appState: AppStateStatus = AppState.currentState;
AppState.addEventListener("change", (next) => {
  const wasActive = appState === "active";
  appState = next;
  sessions.forEach((session, childId) => {
    if (next === "active" && !wasActive) start(childId, session);
    else if (next !== "active" && wasActive) {
      stop(childId, session, false);
      setStatus(childId, "paused");
    }
  });
});

/**
 * Receive live fixes for a child while the returned function is not called.
 * Several screens can watch the same child; the session ends with the last.
 */
export function watchChildLive(childId: string, listener: (fix: LiveFix) => void): () => void {
  let session = sessions.get(childId);
  if (!session) {
    session = { listeners: new Set(), channel: null, renew: null, quiet: null, wake: null, startedAt: 0, lastFixAt: 0 };
    sessions.set(childId, session);
  }
  session.listeners.add(listener);
  if (!session.renew && useLiveStore.getState().status[childId] !== "paused") start(childId, session);

  return () => {
    const current = sessions.get(childId);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) stop(childId, current, true);
  };
}

/** Watch live again (after an error or a pause). */
export function resumeChildLive(childId: string) {
  const session = sessions.get(childId);
  if (session) start(childId, session);
}
