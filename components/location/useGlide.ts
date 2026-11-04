import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

type Point = { latitude: number; longitude: number };

const STEPS = 12;
const DURATION_MS = 900;
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
 * The marker position, moved in small steps from the previous point to the
 * new one so the child appears to travel instead of jumping. Respects Reduce
 * Motion. Few steps on purpose: each one re-renders the map marker.
 */
export function useGlide(point: Point | null): Point | null {
  const [shown, setShown] = useState<Point | null>(point);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      reduce.current = value;
    });
  }, []);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!point) {
      setShown(null);
      return;
    }
    const from = shown;
    if (!from || reduce.current || meters(from, point) > MAX_GLIDE_M || meters(from, point) < 1) {
      setShown(point);
      return;
    }
    let step = 0;
    timer.current = setInterval(() => {
      step += 1;
      const t = step / STEPS;
      const ease = 1 - (1 - t) * (1 - t);
      setShown({
        latitude: from.latitude + (point.latitude - from.latitude) * ease,
        longitude: from.longitude + (point.longitude - from.longitude) * ease,
      });
      if (step >= STEPS && timer.current) clearInterval(timer.current);
    }, DURATION_MS / STEPS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // Only a new target restarts the glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.latitude, point?.longitude]);

  return shown;
}
