import 'package:daos_icons/daos_icons.dart';
import 'package:flutter/widgets.dart';

import 'icons/chibi_kai_cool_icon.dart';

void main() => runApp(const ExampleApp());

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) => const Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: ChibiKaiCoolIcon(size: 128, soundMode: DaosSoundMode.always)),
      );
}
