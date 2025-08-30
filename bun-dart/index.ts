import dartExports from './main.dart';
const sum = dartExports.addNumbers(2, 3);
const diff = dartExports.subtractNumbers(5, 2);
const prod = dartExports.multiplyNumbers(4, 6);
const greeting = dartExports.greet('Imran');
console.log(`addNumbers(2,3) = ${sum}`);
console.log(`subtractNumbers(5,2) = ${diff}`);
console.log(`multiplyNumbers(4,6) = ${prod}`);
console.log(`greet('Imran') = ${greeting}`);
