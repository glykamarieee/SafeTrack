import { AppState, type AppStateStatus } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "../lib/supabase";
import type { TravelMode } from "../types/safetrack";

/**
 * Near real-time position while a guardian has a map open (migration
 * 20261108_live_stream.sql).
 *
 * - The app tells SafeTrack it is watching (request_child_live) every
 *   RENEW_MS; the watch or phone then sends a fix about every second, which
 *   arrives here on the private Realtime topic child-live:<child id>. Nothing
 *   is saved per second; history rows keep their usual pace.
 * - One session per child, shared by every screen that shows the child.
 * - Stops on its own after SESSION_MS (free-plan Realtime messages), when the
 *   app goes to the background, and when the last screen closes.
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
};

/** connecting: asked, nothing yet; live: fixes arriving; paused: stopped after SESSION_MS; off: unavailable. */
export type LiveStatus = "connecting" | "live" | "paused" | "off";

const RENEW_MS = 15_000;
const RENEW_SECONDS = 30;
const SESSION_MS = 10 * 60_000;
/** No fix for this long: back to "connecting" (device offline or no signal). */
const QUIET_MS = 20_000;

type Session = {
  listeners: Set<(fix: LiveFix) => void>;
  channel: RealtimeChannel | null;
  renew: ReturnType<typeof setInterval> | null;
  quiet: ReturnType<typeof setInterval> | null;
  startedAt: number;
  lastFixAt: number;
};

const sessions = new Map<string, Session>();

type LiveState = {
  status: Record<string, LiveStatus>;
  /** Delay from the device's fix to this screen, last few fixes (ms). */
  delays: Record<string, number[]>;
};

export const useLiveStore = create<LiveState>(() => ({ status: {}, delays: {} }));

function setStatus(childId: string, status: LiveStatus) {
  if (useLiveStore.getState().status[childId] === status) return;
  useLiveStore.setState((state) => ({ status: { ...state.status, [childId]: status } }));
}

function recordDelay(childId: string, ms: number) {
  useLiveStore.setState((state) => ({
    delays: { ...state.delays, [childId]: [...(state.delays[childId] ?? []).slice(-29), ms] },
  }));
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
    travelMode: (typeof payload.travelMode === "string" ? payload.travelMode : null) as TravelMode | null,
    modeConfidence: number(payload.modeConfidence),
  };
}

async function request(childId: string, seconds: number) {
  const { error } = await supabase.rpc("request_child_live", { p_child_id: childId, p_seconds: seconds });
  if (error) throw error;
}

function stopTimers(session: Session) {
  if (session.renew) clearInterval(session.renew);
  if (session.quiet) clearInterval(session.quiet);
  session.renew = null;
  session.quiet = null;
}

function closeChannel(session: Session) {
  if (session.channel) void supabase.removeChannel(session.channel);
  session.channel = null;
}

/** (Re)starts asking for live fixes for SESSION_MS. */
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
        session.lastFixAt = Date.now();
        setStatus(childId, "live");
        const fixTime = Date.parse(fix.recordedAt);
        if (Number.isFinite(fixTime)) recordDelay(childId, fix.receivedAt - fixTime);
        session.listeners.forEach((listener) => listener(fix));
      });
    session.channel = channel;
    // Private channels need the signed-in user's token on the socket.
    void supabase.realtime.setAuth().finally(() => channel.subscribe());
  }

  const renew = () => {
    if (Date.now() - session.startedAt >= SESSION_MS) {
      stopTimers(session);
      void request(childId, 0).catch(() => undefined);
      setStatus(childId, "paused");
      return;
    }
    request(childId, RENEW_SECONDS).catch((reason) => {
      // Before the migration runs, or no permission: the map keeps its normal
      // updates (saved records through realtime and the 15 s check).
      console.log("[live location]", (reason as { message?: string })?.message ?? reason);
      stopTimers(session);
      setStatus(childId, "off");
    });
  };
  renew();
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
    session = { listeners: new Set(), channel: null, renew: null, quiet: null, startedAt: 0, lastFixAt: 0 };
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

/** After the 10-minute pause: watch live again. */
export function resumeChildLive(childId: string) {
  const session = sessions.get(childId);
  if (session) start(childId, session);
}
