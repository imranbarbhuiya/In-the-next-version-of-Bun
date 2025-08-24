import { $ } from 'bun';

declare module 'bun' {
  export let Go: typeof runYaegi;
}

export async function runYaegi(code: string) {
  const wrapped = `package main
import "time"
func main() {
${code}
}
`;

  // Fallback when go bin is not in PATH
  const pathToYaegi = Bun.which('yaegi') ? 'yaegi' : '~/go/bin/yaegi';

  return (await $`${pathToYaegi} -e ${wrapped}`.text())
    .split('\n')
    .filter((line) => !/^0x[\dA-Fa-f]+$/.test(line.trim()))
    .join('\n')
    .trim();
}

Bun.Go = runYaegi;
