# daos-icons-react-native

Animated icons with synced sound for React Native and Expo — the native player for Moodicons and SonicGlyphs icons.
Motion is the icon's Lottie export; sound is one pre-mixed loop (stereo panning included) started together with the
animation, so every sound lands on its frame.

## Install

```sh
npm install daos-icons-react-native lottie-react-native expo-audio
# Expo:
npx expo install lottie-react-native expo-audio && npm install daos-icons-react-native
```

Then add icons with the store's CLI (it detects React Native / Expo projects):

```sh
npx moodicons login YOUR-LICENSE-CODE
npx moodicons add chibi-kai-cool        # → src/components/icons/ChibiKaiCool.tsx + .lottie.json + .wav
```

```tsx
import { ChibiKaiCool } from "./src/components/icons/ChibiKaiCool";

<ChibiKaiCool size={96} />                    // loops silently; tap to replay with sound
<ChibiKaiCool size={96} soundMode="always" /> // sound on every loop
```

## Props (`DaosIcon` and every generated icon)

| Prop | Default | |
|---|---|---|
| `size` | 64 | Width and height |
| `autoplay` | `true` | Start looping when shown |
| `loop` | `true` | |
| `soundMode` | `"press"` | `"press"`: sound when tapped. `"always"`: every loop. `"off"`: silent (renders as an image) |
| `muted` / `volume` | `false` / `1` | |
| `speed` | 1 | |
| `onPress` | | Called after the built-in replay |

Reduce Motion (iOS and Android) shows the icon's still frame and never autoplays; a tap still gives the sound.
Sound follows the phone's silent switch (expo-audio's default audio mode).

## License

The player is free to use with icons you have licensed. Icons are licensed per purchase (see the store's
/help/licenses page).
