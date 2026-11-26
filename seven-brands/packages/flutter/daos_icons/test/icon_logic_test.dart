import 'package:daos_icons/daos_icons.dart';
import 'package:flutter_test/flutter_test.dart';

({IconLogic logic, List<String> log, void Function(IconState) set}) rig(IconState initial) {
  final log = <String>[];
  var s = initial;
  final logic = IconLogic(
    state: () => s,
    replaySound: () => log.add('sound'),
    stopSound: () => log.add('stop'),
    restartMotion: () => log.add('motion'),
    showStill: () => log.add('still'),
  );
  return (logic: logic, log: log, set: (v) => s = v);
}

IconState st({DaosSoundMode mode = DaosSoundMode.press, bool muted = false, bool reduced = false, bool autoplay = true, bool hasSound = true}) =>
    IconState(soundMode: mode, muted: muted, reducedMotion: reduced, autoplay: autoplay, hasSound: hasSound);

void main() {
  test('press mode: loops silently, a tap replays motion and sound', () {
    final r = rig(st());
    r.logic.start();
    r.logic.loop();
    expect(r.log, ['motion']);
    r.logic.press();
    expect(r.log, ['motion', 'motion', 'sound']);
  });

  test('always mode: sound starts with the animation and on every loop', () {
    final r = rig(st(mode: DaosSoundMode.always));
    r.logic.start();
    r.logic.loop();
    expect(r.log, ['motion', 'sound', 'sound']);
  });

  test('muted, off and silent icons never play sound', () {
    for (final s in [st(mode: DaosSoundMode.always, muted: true), st(mode: DaosSoundMode.off), st(mode: DaosSoundMode.always, hasSound: false)]) {
      final r = rig(s);
      r.logic.start();
      r.logic.loop();
      r.logic.press();
      expect(r.log.where((x) => x == 'sound'), isEmpty);
    }
  });

  test('reduced motion shows the still frame; a tap only gives sound', () {
    final r = rig(st(mode: DaosSoundMode.always, reduced: true));
    r.logic.start();
    r.logic.loop();
    r.logic.press();
    expect(r.log, ['stop', 'still', 'sound']);
  });
}
