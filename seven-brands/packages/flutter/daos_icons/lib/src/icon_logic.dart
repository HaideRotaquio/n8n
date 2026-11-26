/// When sound plays. Mirrors the React Native player's rules.
enum DaosSoundMode {
  /// Silent until tapped, then plays once (default: icons that make noise on their own get annoying).
  press,

  /// Plays with every animation loop.
  always,

  /// Never plays.
  off,
}

/// The icon's state, read whenever something happens.
class IconState {
  const IconState({required this.soundMode, required this.muted, required this.reducedMotion, required this.autoplay, required this.hasSound});

  final DaosSoundMode soundMode;
  final bool muted;
  final bool reducedMotion;
  final bool autoplay;
  final bool hasSound;

  bool get audible => hasSound && !muted && soundMode != DaosSoundMode.off;
}

/// Timing rules, free of Flutter so they can be tested alone. The sound file is exactly one animation loop long, so
/// starting both together keeps every cue on its frame.
class IconLogic {
  IconLogic({required this.state, required this.replaySound, required this.stopSound, required this.restartMotion, required this.showStill});

  final IconState Function() state;
  final void Function() replaySound;
  final void Function() stopSound;
  final void Function() restartMotion;
  final void Function() showStill;

  /// Once the reduce-motion setting is known, and whenever it or autoplay changes.
  void start() {
    final s = state();
    if (s.reducedMotion || !s.autoplay) {
      stopSound();
      if (s.reducedMotion) showStill();
      return;
    }
    restartMotion();
    if (s.audible && s.soundMode == DaosSoundMode.always) replaySound();
  }

  /// The animation wrapped around to its first frame.
  void loop() {
    final s = state();
    if (!s.reducedMotion && s.audible && s.soundMode == DaosSoundMode.always) replaySound();
  }

  /// The user tapped the icon. Reduced motion keeps the still frame; the tap still gives its sound.
  void press() {
    final s = state();
    if (!s.reducedMotion) restartMotion();
    if (s.audible) replaySound();
  }
}
