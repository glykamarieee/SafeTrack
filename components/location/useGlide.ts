import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

type Point = { latitude: number; longitude: number };

/** One map update this often while gliding (~60 per second). */
const FRAME_MS = 16;
/**
 * Each new point is reached this fast (ease-out). Short on purpose: the old
 * glide lasted as long as the gap between fixes (up to 1.1 s), so the marker
 * was always about a second behind the child (panel feedback 2026-11-08).
 */
const GLIDE_MS = 180;
// Further than this is a jump (new trip, first fix after a gap): no glide.
const MAX_GLIDE_M = 2_000;

function meters(a: Point, b: Point) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * The marker position, moved from where it is drawn now to each new point in
 * [GLIDE_MS], so it is at the child's newest real position almost as soon as
 * that arrives. It never goes past (or guesses beyond) the newest real point.
 * Respects Reduce Motion.
 */
export function useGlide(point: Point | null): Point | null {
  const [shown, setShown] = useState<Point | null>(point);
  const shownRef = useRef<Point | null>(point);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      reduce.current = value;
    });
  }, []);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    const show = (next: Point | null) => {
      shownRef.current = next;
      setShown(next);
    };
    if (!point) {
      show(null);
      return;
    }
    const from = shownRef.current;
    if (!from || reduce.current || meters(from, point) > MAX_GLIDE_M || meters(from, point) < 0.3) {
      show(point);
      return;
    }
    const started = Date.now();
    timer.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / GLIDE_MS);
      const eased = 1 - (1 - t) ** 3;
      show({
        latitude: from.latitude + (point.latitude - from.latitude) * eased,
        longitude: from.longitude + (point.longitude - from.longitude) * eased,
      });
      if (t >= 1 && timer.current) clearInterval(timer.current);
    }, FRAME_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // Only a new target restarts the glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.latitude, point?.longitude]);

  return shown;
}
