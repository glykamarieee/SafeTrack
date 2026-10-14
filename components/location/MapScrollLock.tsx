import { createContext, forwardRef, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

type ScrollLock = { setLocked(locked: boolean): void };

const ScrollLockContext = createContext<ScrollLock | null>(null);

/**
 * A ScrollView that stops scrolling while a finger is on a map inside it, so
 * vertical drags and pinches move the map instead of the page.
 */
export const MapAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function MapAwareScrollView(
  { scrollEnabled = true, children, ...props },
  ref,
) {
  const [locked, setLockedState] = useState(false);
  const lockedRef = useRef(false);

  const setLocked = useCallback((value: boolean) => {
    if (lockedRef.current === value) return;
    lockedRef.current = value;
    setLockedState(value);
  }, []);

  const lock = useMemo(() => ({ setLocked }), [setLocked]);

  return (
    <ScrollLockContext.Provider value={lock}>
      {/* `children` keeps its identity, so only the ScrollView re-renders. */}
      <ScrollView ref={ref} {...props} scrollEnabled={scrollEnabled && !locked}>
        {children}
      </ScrollView>
    </ScrollLockContext.Provider>
  );
});

/** Touch handlers for the map's wrapper view. */
export function useMapScrollLock() {
  const lock = useContext(ScrollLockContext);

  return useMemo(
    () => ({
      onTouchStart: () => lock?.setLocked(true),
      onTouchEnd: (event: { nativeEvent: { touches?: ArrayLike<unknown> } }) => {
        // Pinch: stay locked until the last finger lifts.
        if (!event.nativeEvent.touches || event.nativeEvent.touches.length === 0) lock?.setLocked(false);
      },
      onTouchCancel: () => lock?.setLocked(false),
    }),
    [lock],
  );
}
