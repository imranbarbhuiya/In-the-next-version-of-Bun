import './setup';
// ----------------------

// const out = await Bun.Go(`
//   for i := 1; i <= 3; i++ {
//     println("tick", i, time.Now().Format(time.Kitchen))
//   }
// `);

// const out = await Bun.Go(`
//   println("hello from go ✨")
// `);

// const out = await Bun.Go(`
//   sum := 0
//   for i := 1; i <= 5; i++ {
//     sum += i
//   }
//   println("sum of 1..5 =", sum)
// `);

const out = await Bun.Go(`
  s := "parbez"
  println("upper:", strings.ToUpper(s))
  println("repeated:", strings.Repeat(s, 3))
`);

console.log(out);
