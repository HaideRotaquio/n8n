import 'package:flutter/widgets.dart';
import 'package:lottie/lottie.dart';

import 'icon_logic.dart';
import 'sound.dart';

/// An animated icon with synced sound.
///
/// Respects the system's reduce-motion setting (still frame, no autoplay); a tap replays motion and sound.
class DaosIcon extends StatefulWidget {
  const DaosIcon({
    super.key,
    required this.animation,
    required this.duration,
    this.sound,
    this.stillFrame = Duration.zero,
    this.label,
    this.size = 64,
    this.autoplay = true,
    this.loop = true,
    this.soundMode = DaosSoundMode.press,
    this.muted = false,
    this.volume = 1,
    this.onTap,
    this.bundle,
  });

  /// Asset path of the icon's Lottie JSON, e.g. 'lib/icons/face-happy.lottie.json'.
  final String animation;

  /// Asset path of the icon's sound loop (WAV), or null for silent icons.
  final String? sound;

  /// One loop (the generated widget fills this in).
  final Duration duration;

  /// Frame shown when reduce motion is on.
  final Duration stillFrame;

  /// Accessible description, e.g. "Happy face, smiling and bouncing".
  final String? label;
  final double size;
  final bool autoplay;
  final bool loop;
  final DaosSoundMode soundMode;
  final bool muted;

  /// 0–1.
  final double volume;
  final VoidCallback? onTap;

  /// Where assets come from (defaults to the app's bundle).
  final AssetBundle? bundle;

  /// Creates the sound player for an asset path. Replace it to use another audio engine or in tests.
  static DaosSoundPlayer Function(String assetPath) soundPlayerFactory = AudioplayersSoundPlayer.new;

  @override
  State<DaosIcon> createState() => _DaosIconState();
}

class _DaosIconState extends State<DaosIcon> with SingleTickerProviderStateMixin {
  late final AnimationController _motion = AnimationController(vsync: this, duration: widget.duration);
  DaosSoundPlayer? _sound;
  late final IconLogic _logic;
  bool? _reduced;
  double _lastValue = 0;

  @override
  void initState() {
    super.initState();
    if (widget.sound != null) _sound = DaosIcon.soundPlayerFactory(widget.sound!)..setVolume(widget.volume);
    _logic = IconLogic(
      state: () => IconState(
        soundMode: widget.soundMode,
        muted: widget.muted,
        reducedMotion: _reduced ?? true,
        autoplay: widget.autoplay,
        hasSound: _sound != null,
      ),
      replaySound: () => _sound?.replay(),
      stopSound: () => _sound?.stop(),
      restartMotion: () {
        _motion.value = 0;
        _lastValue = 0;
        widget.loop ? _motion.repeat() : _motion.forward(from: 0);
      },
      showStill: () {
        _motion.stop();
        final ms = widget.duration.inMilliseconds;
        _motion.value = ms > 0 ? (widget.stillFrame.inMilliseconds / ms).clamp(0.0, 1.0) : 0;
      },
    );
    // A repeating controller jumps from ~1 back to ~0: that's a new loop.
    _motion.addListener(() {
      if (_motion.value < _lastValue) _logic.loop();
      _lastValue = _motion.value;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced != _reduced) {
      _reduced = reduced;
      _logic.start();
    }
  }

  @override
  void didUpdateWidget(DaosIcon old) {
    super.didUpdateWidget(old);
    if (old.volume != widget.volume) _sound?.setVolume(widget.volume);
    if (widget.muted || widget.soundMode == DaosSoundMode.off) _sound?.stop();
    if (old.autoplay != widget.autoplay) _logic.start();
  }

  @override
  void dispose() {
    _motion.dispose();
    _sound?.stop();
    _sound?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final picture = Lottie.asset(
      widget.animation,
      controller: _motion,
      bundle: widget.bundle,
      width: widget.size,
      height: widget.size,
      fit: BoxFit.contain,
    );
    if (widget.soundMode == DaosSoundMode.off && widget.onTap == null) {
      return Semantics(image: true, label: widget.label, child: picture);
    }
    return Semantics(
      button: true,
      label: widget.label,
      hint: widget.soundMode == DaosSoundMode.off ? null : 'Plays the icon with its sound',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          _logic.press();
          widget.onTap?.call();
        },
        child: picture,
      ),
    );
  }
}
