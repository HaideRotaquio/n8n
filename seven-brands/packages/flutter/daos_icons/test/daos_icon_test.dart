import 'dart:io';

import 'package:daos_icons/daos_icons.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// Serves test/fixtures files as assets (a real icon exported by our Lottie exporter).
class FixtureBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    final bytes = File('test/fixtures/${key.split('/').last}').readAsBytesSync();
    return ByteData.view(Uint8List.fromList(bytes).buffer);
  }
}

class FakeSound implements DaosSoundPlayer {
  FakeSound(this.path);
  final String path;
  static final log = <String>[];
  @override
  Future<void> replay() async => log.add('replay $path');
  @override
  Future<void> stop() async => log.add('stop');
  @override
  Future<void> setVolume(double v) async => log.add('volume $v');
  @override
  Future<void> dispose() async => log.add('dispose');
}

Widget app(Widget child, {bool reduced = false}) => MediaQuery(
      data: MediaQueryData(disableAnimations: reduced),
      child: Directionality(textDirection: TextDirection.ltr, child: Center(child: child)),
    );

DaosIcon icon({DaosSoundMode mode = DaosSoundMode.press, VoidCallback? onTap}) => DaosIcon(
      animation: 'lib/icons/kai-cool.lottie.json',
      sound: 'lib/icons/kai-cool.wav',
      duration: const Duration(milliseconds: 1800),
      stillFrame: const Duration(milliseconds: 600),
      label: 'Kai, cool',
      size: 96,
      soundMode: mode,
      onTap: onTap,
      bundle: FixtureBundle(),
    );

Future<void> load(WidgetTester tester) async {
  // Lottie parses the JSON asynchronously; let it finish in real time, then paint.
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
  await tester.pump();
}

void main() {
  setUp(() {
    FakeSound.log.clear();
    DaosIcon.soundPlayerFactory = FakeSound.new;
  });

  testWidgets('renders the real Lottie icon, loops silently and replays with sound on tap', (tester) async {
    await tester.pumpWidget(app(icon()));
    await load(tester);
    expect(tester.getSize(find.byType(DaosIcon)), const Size(96, 96));
    expect(FakeSound.log, ['volume 1.0']);
    await tester.pump(const Duration(milliseconds: 2000)); // past one loop
    expect(FakeSound.log.where((e) => e.startsWith('replay')), isEmpty);
    await tester.tap(find.byType(DaosIcon));
    expect(FakeSound.log.last, 'replay lib/icons/kai-cool.wav');
    expect(tester.getSemantics(find.byType(DaosIcon)), matchesSemantics(label: 'Kai, cool', hint: 'Plays the icon with its sound', isButton: true, hasTapAction: true));
  });

  testWidgets('always mode plays the sound at start and again on each loop', (tester) async {
    await tester.pumpWidget(app(icon(mode: DaosSoundMode.always)));
    await load(tester);
    final atStart = FakeSound.log.where((e) => e.startsWith('replay')).length;
    expect(atStart, 1);
    await tester.pump(const Duration(milliseconds: 1000));
    await tester.pump(const Duration(milliseconds: 1000)); // crosses the 1.8 s loop
    expect(FakeSound.log.where((e) => e.startsWith('replay')).length, 2);
  });

  testWidgets('reduce motion: no autoplay, no sound until tapped', (tester) async {
    await tester.pumpWidget(app(icon(mode: DaosSoundMode.always), reduced: true));
    await load(tester);
    await tester.pump(const Duration(milliseconds: 4000));
    expect(FakeSound.log.where((e) => e.startsWith('replay')), isEmpty);
    expect(tester.hasRunningAnimations, isFalse);
    await tester.tap(find.byType(DaosIcon));
    expect(FakeSound.log.last, 'replay lib/icons/kai-cool.wav');
  });

  testWidgets('sound off renders as an image and disposes the player on removal', (tester) async {
    await tester.pumpWidget(app(icon(mode: DaosSoundMode.off)));
    await load(tester);
    expect(tester.getSemantics(find.byType(DaosIcon)), matchesSemantics(label: 'Kai, cool', isImage: true));
    await tester.pumpWidget(app(const SizedBox()));
    expect(FakeSound.log, contains('dispose'));
  });
}
