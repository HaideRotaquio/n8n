# daos_icons

Animated icons with synced sound for Flutter — the native player for Moodicons and SonicGlyphs icons.
Motion is the icon's Lottie export; sound is one pre-mixed loop (stereo panning included) started together with the
animation, so every sound lands on its frame.

## Install

```sh
flutter pub add daos_icons lottie audioplayers
```

Then add icons with the store's CLI from your Flutter project folder (it detects `pubspec.yaml`):

```sh
npx moodicons login YOUR-LICENSE-CODE
npx moodicons add chibi-kai-cool
# → lib/icons/chibi_kai_cool_icon.dart + chibi-kai-cool.lottie.json + chibi-kai-cool.wav
#   and "- lib/icons/" is added under flutter: assets: in pubspec.yaml
```

```dart
import 'icons/chibi_kai_cool_icon.dart';

const ChibiKaiCoolIcon(size: 96)                                  // loops silently; tap to replay with sound
const ChibiKaiCoolIcon(size: 96, soundMode: DaosSoundMode.always) // sound on every loop
```

## `DaosIcon`

| Parameter | Default | |
|---|---|---|
| `animation`, `sound`, `duration`, `stillFrame`, `label` | | Filled in by the generated widget |
| `size` | 64 | |
| `autoplay`, `loop` | `true` | |
| `soundMode` | `DaosSoundMode.press` | `press`: sound when tapped. `always`: every loop. `off`: silent (an image for screen readers) |
| `muted`, `volume` | `false`, `1` | |
| `onTap` | | Called after the built-in replay |

When the system asks to reduce motion (`MediaQuery.disableAnimations`), the icon shows its still frame and doesn't
autoplay; a tap still gives the sound. To use another audio engine, set `DaosIcon.soundPlayerFactory`.

## License

The player is free to use with icons you have licensed. Icons are licensed per purchase (see the store's
/help/licenses page).
