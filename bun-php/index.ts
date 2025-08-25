import './setup';

// const out = await Bun.PHP(`
//   for ($i = 1; $i <= 3; $i++) {
//     echo "tick $i " . date('h:i A') . "\n";
//   }
// `);

// const out = await Bun.PHP(`
//   echo "hello from php ✨\n";
// `);

// const out = await Bun.PHP(`
//   $sum = 0;
//   for ($i = 1; $i <= 5; $i++) {
//     $sum += $i;
//   }
//   echo "sum of 1..5 = $sum\n";
// `);

// const out = await Bun.PHP(`
//   $s = "parbez";
//   echo "upper: " . strtoupper($s) . "\n";
//   echo "repeated: " . str_repeat($s, 3) . "\n";
// `);

// const out = await Bun.PHP`echo strtoupper("hello");`;

const out = await Bun.PHP`
<?php
echo "Hello from PHP!";
?>
`;

console.log(out);
