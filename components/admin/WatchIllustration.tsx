import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

import { nativeDriver } from "../../theme/motion";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * A SafeTrack smartwatch showing its SOS screen, drawn in code. Floats gently
 * (still with Reduce Motion). Decorative: describe the device in text nearby.
 */
export function WatchIllustration({ size = 170 }: { size?: number }) {
  const { reduceMotion } = useTheme();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(float, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, reduceMotion]);

  const height = size * 1.2;

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        transform: [
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
          { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "-3deg"] }) },
        ],
      }}
    >
      <Svg width={size} height={height} viewBox="0 0 360 430">
        <Path d="M120 20 Q180 6 240 20 L250 110 L110 110 Z" fill="#1B2620" />
        <Path d="M128 50 Q180 40 232 50 M130 72 Q180 62 230 72" stroke="#26332C" strokeWidth={2} fill="none" />
        <Path d="M110 320 L250 320 L240 410 Q180 424 120 410 Z" fill="#1B2620" />
        <Path d="M132 358 Q180 368 228 358 M134 380 Q180 390 226 380" stroke="#26332C" strokeWidth={2} fill="none" />
        <Rect x={292} y={168} width={14} height={34} rx={5} fill="#8FA197" />
        <Rect x={292} y={232} width={14} height={34} rx={5} fill="#8FA197" />
        <Circle cx={180} cy={215} r={122} fill="#C9D3CD" />
        <Circle cx={180} cy={215} r={114} fill="#E9EDEB" />
        <Circle cx={180} cy={215} r={108} fill="#7E8C84" />
        <Circle cx={180} cy={215} r={102} fill="#000000" />
        <Circle cx={180} cy={215} r={95} stroke="#0E1A14" strokeWidth={6} fill="none" />
        <Circle
          cx={180}
          cy={215}
          r={95}
          stroke="#3DDC84"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="597 597"
          strokeDashoffset={110}
          transform="rotate(-90 180 215)"
        />
        <SvgText x={180} y={160} textAnchor="middle" fontSize={18} fontWeight="800" fill="#F2F4EF">
          9:41
        </SvgText>
        <Circle cx={180} cy={215} r={38} stroke="#3A1512" strokeWidth={6} fill="none" />
        <Circle cx={180} cy={215} r={30} fill="#FF6B5C" />
        <SvgText x={180} y={222} textAnchor="middle" fontSize={17} fontWeight="800" fill="#000000">
          SOS
        </SvgText>
        <Rect x={138} y={262} width={84} height={20} rx={10} fill="#0E1A14" />
        <Circle cx={151} cy={272} r={3.5} fill="#3DDC84" />
        <SvgText x={186} y={276} textAnchor="middle" fontSize={10} fontWeight="700" fill="#F2F4EF">
          Safe zone
        </SvgText>
        <Path d="M100 150 A110 110 0 0 1 150 112" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={6} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
