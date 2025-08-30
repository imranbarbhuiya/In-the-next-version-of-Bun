import 'dart:js_interop';
import 'dart:js_interop_unsafe';

@JS('globalThis.dartExports')
external JSAny? get _dartExports;
@JS('globalThis.dartExports')
external set _dartExports(JSAny? value);

@JS()
extension type DartExports(JSObject o) implements JSObject {
  external set addNumbers(JSFunction f);
  external set subtractNumbers(JSFunction f);
  external set multiplyNumbers(JSFunction f);
  external set greet(JSFunction f);
}

int addNumbersImpl(int a, int b) => a + b;
int subtractNumbersImpl(int a, int b) => a - b;
int multiplyNumbersImpl(int a, int b) => a * b;
String greetImpl(String name) => 'Hello, ' + name + '!';

void main() {
 var ns = _dartExports as JSObject?;
  if (ns == null) {
    ns = JSObject();
    _dartExports = ns;
  }

  final exports = DartExports(ns);
  exports.addNumbers = addNumbersImpl.toJS;
  exports.subtractNumbers = subtractNumbersImpl.toJS;
  exports.multiplyNumbers = multiplyNumbersImpl.toJS;
  exports.greet = greetImpl.toJS;
}
