import 'package:audioplayers/audioplayers.dart';

/// Plays an icon's sound loop. Swap it with [DaosIcon.soundPlayerFactory] (tests, or another audio engine).
abstract class DaosSoundPlayer {
  /// From the start of the loop.
  Future<void> replay();
  Future<void> stop();
  Future<void> setVolume(double volume);
  Future<void> dispose();
}

/// Default player: audioplayers, reading the WAV from the app's assets at its project path (e.g. lib/icons/x.wav).
class AudioplayersSoundPlayer implements DaosSoundPlayer {
  AudioplayersSoundPlayer(this.assetPath) {
    // Our asset paths are project-relative, not under audioplayers' default "assets/" prefix.
    _player.audioCache = AudioCache(prefix: '');
    _player.setReleaseMode(ReleaseMode.stop);
  }

  final String assetPath;
  final AudioPlayer _player = AudioPlayer();
  double _volume = 1;

  @override
  Future<void> replay() async {
    await _player.stop();
    await _player.play(AssetSource(assetPath), volume: _volume);
  }

  @override
  Future<void> stop() => _player.stop();

  @override
  Future<void> setVolume(double volume) async {
    _volume = volume.clamp(0, 1).toDouble();
    await _player.setVolume(_volume);
  }

  @override
  Future<void> dispose() => _player.dispose();
}
