/// Animated icons with synced sound for Flutter — the native player for Moodicons and SonicGlyphs icons.
///
/// Motion is the icon's Lottie export; sound is one pre-mixed loop (stereo panning included), started together
/// with the animation so every sound lands on its frame. Add icons with the store's CLI (`npx moodicons add …`),
/// which writes a ready-made widget per icon.
library;

export 'src/daos_icon.dart';
export 'src/icon_logic.dart';
export 'src/sound.dart';
