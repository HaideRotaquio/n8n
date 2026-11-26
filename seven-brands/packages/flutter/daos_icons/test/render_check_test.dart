import 'dart:io';
import 'dart:ui' as ui;

import 'package:daos_icons/daos_icons.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

class FixtureBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async => ByteData.view(Uint8List.fromList(File('test/fixtures/${key.split('/').last}').readAsBytesSync()).buffer);
}

void main() {
  testWidgets('render check: the still frame of a real icon (written to build/render_check.png)', (tester) async {
    final key = GlobalKey();
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(disableAnimations: true),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: RepaintBoundary(
            key: key,
            child: Container(
              color: const Color(0xFFFFF6E8),
              child: DaosIcon(animation: 'kai-cool.lottie.json', duration: const Duration(milliseconds: 1800), stillFrame: const Duration(milliseconds: 600), size: 256, soundMode: DaosSoundMode.off, bundle: FixtureBundle()),
            ),
          ),
        ),
      ),
    ));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
    await tester.pump();
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage();
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      Directory('build').createSync(recursive: true);
      File('build/render_check.png').writeAsBytesSync(png!.buffer.asUint8List());
      // Not blank: many distinct colors were painted.
      final raw = (await image.toByteData())!.buffer.asUint32List();
      expect(raw.toSet().length, greaterThan(20));
    });
  });
}
