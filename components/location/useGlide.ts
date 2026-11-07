import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

type Point = { latitude: number; longitude: number };

/** One map update this often while gliding (~30 per second). */
const FRAME_MS = 33;
/** The glide takes as long as the gap between fixes, within these limits. */
const MIN_GLIDE_MS = 250;
const MAX_GLIDE_MS = 1_100;
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
 * The marker position, moved from where it is drawn now to each new point at
 * an even pace that lasts about as long as the gap between fixes. With live
 * fixes every second the marker therefore keeps moving like the child does,
 * instead of dashing to each point and waiting (the old 0.9 s ease-out looked
 * like a delay when the child ran). It never goes past the newest real point.
 * Respects Reduce Motion.
 */
export function useGlide(point: Point | null): Point | null {
  const [shown, setShown] = useState<Point | null>(point);
  const shownRef = useRef<Point | null>(point);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTargetAt = useRef(0);
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
    const now = Date.now();
    const gap = lastTargetAt.current ? now - lastTargetAt.current : MAX_GLIDE_MS;
    lastTargetAt.current = now;

    const from = shownRef.current;
    if (!from || reduce.current || meters(from, point) > MAX_GLIDE_M || meters(from, point) < 0.3) {
      show(point);
      return;
    }
    const duration = Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, gap));
    const started = now;
    timer.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / duration);
      show({
        latitude: from.latitude + (point.latitude - from.latitude) * t,
        longitude: from.longitude + (point.longitude - from.longitude) * t,
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
