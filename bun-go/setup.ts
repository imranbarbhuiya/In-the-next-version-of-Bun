import { $ } from 'bun';

declare module 'bun' {
  export let Go: typeof runYaegi;
}

class GoError {
  message: string;
  constructor(message: string) {
    this.message = message;
  }
}

export async function runYaegi(code: string) {
  try {
    const wrapped = code.includes('func main()')
      ? code
      : `package main
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
  } catch (e) {
    if (e instanceof $.ShellError) {
      const stderr = e.stderr.toString();
      if (stderr.includes('command not found:'))
        throw new GoError(
          `Yaegi is not installed. Please install it by running:
  \`go install github.com/traefik/yaegi/cmd/yaegi@latest\``
        );
      throw new GoError(stderr);
    }
    throw e;
  }
}

Bun.Go = runYaegi;
