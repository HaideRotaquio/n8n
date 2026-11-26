import { useAudioPlayer, type AudioSource } from "expo-audio";
import LottieView, { type LottieViewProps } from "lottie-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { createIconController, type DaosSoundMode, type IconState } from "./controller";

export interface DaosIconProps {
  /** The icon's Lottie JSON: require("./icons/face-happy.lottie.json"). */
  animation: LottieViewProps["source"];
  /** One loop of the icon's sound: require("./icons/face-happy.wav"). Omit for silent icons. */
  sound?: AudioSource;
  /** Loop length in milliseconds (the generated wrapper fills this in). */
  durationMs: number;
  /** Frame shown when the system asks for reduced motion. */
  stillFrameMs?: number;
  /** Accessible description, e.g. "Happy face, smiling and bouncing". */
  label?: string;
  size?: number;
  autoplay?: boolean;
  loop?: boolean;
  /** "press" (default): sound when tapped. "always": sound on every loop. "off": silent. */
  soundMode?: DaosSoundMode;
  muted?: boolean;
  /** 0–1. */
  volume?: number;
  speed?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

/** The system's Reduce Motion setting (iOS and Android); null until it has been read. */
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * An animated icon with synced sound. Motion is the icon's Lottie export; sound is its pre-mixed loop (stereo
 * panning included), started together with the animation so every cue lands on its frame. Respects Reduce Motion
 * (still frame, no autoplay) and the phone's silent switch (expo-audio's default audio mode).
 */
export function DaosIcon({
  animation,
  sound,
  durationMs,
  stillFrameMs = 0,
  label,
  size = 64,
  autoplay = true,
  loop = true,
  soundMode = "press",
  muted = false,
  volume = 1,
  speed = 1,
  style,
  onPress,
}: DaosIconProps) {
  const lottie = useRef<LottieView>(null);
  const known = useReducedMotion();
  // Until the setting is read, behave as reduced: nothing moves or sounds before we know it's allowed.
  const reducedMotion = known !== false;
  const player = useAudioPlayer(sound ?? null);
  const state = useRef<IconState>({ soundMode, muted, reducedMotion, autoplay, hasSound: sound != null });
  state.current = { soundMode, muted, reducedMotion, autoplay, hasSound: sound != null };

  useEffect(() => {
    player.volume = Math.max(0, Math.min(1, volume));
  }, [player, volume]);

  const controller = useMemo(
    () =>
      createIconController(() => state.current, {
        sound: {
          replay: () => {
            void player.seekTo(0);
            player.play();
          },
          stop: () => player.pause(),
        },
        motion: {
          restart: () => {
            lottie.current?.reset();
            lottie.current?.play();
          },
        },
      }),
    [player],
  );

  useEffect(() => {
    if (known !== null) controller.start();
  }, [controller, known, autoplay]);
  useEffect(() => () => controller.unmount(), [controller]);
  useEffect(() => {
    if (muted || soundMode === "off") player.pause();
  }, [player, muted, soundMode]);

  const still = known === true && durationMs > 0 ? Math.min(1, Math.max(0, stillFrameMs / durationMs)) : undefined;
  const view = (
    <LottieView
      ref={lottie}
      source={animation}
      autoPlay={false}
      loop={loop && !reducedMotion}
      progress={still}
      speed={speed}
      onAnimationLoop={controller.loop}
      style={{ width: size, height: size }}
    />
  );
  if (soundMode === "off" && !onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={style}>
        {view}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={soundMode === "off" ? undefined : "Plays the icon with its sound"}
      onPress={() => {
        controller.press();
        onPress?.();
      }}
      style={style}
    >
      {view}
    </Pressable>
  );
}
