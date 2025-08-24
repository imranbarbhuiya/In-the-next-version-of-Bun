import "./setup";

const out = await Bun.Rust`
fn main() {
    println!("Hello from Rust!");
}
`;

console.log(out.unwrap());
