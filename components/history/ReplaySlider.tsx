import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";

type Props = {
  /** 0 to 1. */
  value: number;
  onChange(value: number): void;
  onSlidingStart?: () => void;
  accessibilityLabel?: string;
};

/** A plain React Native slider (no native slider dependency). */
export function ReplaySlider({ value, onChange, onSlidingStart, accessibilityLabel }: Props) {
  const width = useRef(1);
  const left = useRef(0);
  const track = useRef<View>(null);
  const [dragging, setDragging] = useState(false);

  const handlers = useRef({ onChange, onSlidingStart });
  handlers.current = { onChange, onSlidingStart };

  const responder = useMemo(() => {
    const update = (pageX: number) => {
      handlers.current.onChange(Math.min(1, Math.max(0, (pageX - left.current) / width.current)));
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The page must not take the drag over while scrubbing.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event) => {
        setDragging(true);
        handlers.current.onSlidingStart?.();
        const pageX = event.nativeEvent.pageX;
        track.current?.measure((_x, _y, measuredWidth, _height, pageLeft) => {
          width.current = measuredWidth || width.current;
          left.current = pageLeft;
          update(pageX);
        });
      },
      onPanResponderMove: (event) => update(event.nativeEvent.pageX),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    });
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    width.current = event.nativeEvent.layout.width || 1;
  };

  const percent = `${Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10}%` as const;

  return (
    <View
      ref={track}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        onChange(Math.min(1, Math.max(0, value + (event.nativeEvent.actionName === "increment" ? 0.05 : -0.05))))
      }
      onLayout={onLayout}
      style={styles.hitArea}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { width: percent }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, dragging && styles.thumbActive, { left: percent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: { height: 36, justifyContent: "center", cursor: "pointer" },
  track: { height: 6, borderRadius: 3, backgroundColor: "#DCE5E0", overflow: "hidden" },
  fill: { height: 6, backgroundColor: "#137A50" },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#137A50",
    shadowColor: "#0F231C",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  thumbActive: { transform: [{ scale: 1.15 }] },
});
