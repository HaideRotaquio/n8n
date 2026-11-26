import 'package:daos_icons/daos_icons.dart';
import 'package:daos_icons_example/main.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

class SilentSound implements DaosSoundPlayer {
  SilentSound(this.path);
  final String path;
  static final played = <String>[];
  @override
  Future<void> replay() async => played.add(path);
  @override
  Future<void> stop() async {}
  @override
  Future<void> setVolume(double v) async {}
  @override
  Future<void> dispose() async {}
}

void main() {
  testWidgets('the CLI-generated widget loads its real assets and plays its sound loop', (tester) async {
    DaosIcon.soundPlayerFactory = SilentSound.new;
    await tester.pumpWidget(const ExampleApp());
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
    await tester.pump();
    expect(find.byType(DaosIcon), findsOneWidget);
    expect(SilentSound.played, ['lib/icons/chibi-kai-cool.wav']);
    final asset = await tester.runAsync(() => DefaultAssetBundle.of(tester.element(find.byType(DaosIcon))).load('lib/icons/chibi-kai-cool.wav'));
    expect(asset!.lengthInBytes, greaterThan(1000));
  });
}
