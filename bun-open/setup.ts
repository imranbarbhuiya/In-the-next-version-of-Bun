import { $ } from 'bun';
import os from 'node:os';

declare module 'bun' {
	export let Open: typeof runOpen;
}

class OpenError {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}

async function runOpen(schema: string, path?: string, options?: Record<string, string>) {
	let uri = `${schema}://`;

	if (path) {
		if (path.startsWith('/')) {
			uri += path.slice(1);
		} else {
			uri += path;
		}
	}

	if (options) {
		const params = new URLSearchParams(options);
		uri += `?${params.toString()}`;
	}

	const platform = os.platform();
	let cmd: string[];

	if (platform === 'darwin') {
		cmd = ['open', uri];
	} else if (platform === 'win32') {
		cmd = ['cmd', '/c', 'start', '', uri];
	} else {
		cmd = ['xdg-open', uri];
	}

	const { exitCode, stdout, stderr } = Bun.spawn(cmd, {
		stdout: 'pipe',
		stderr: 'pipe',
	});

	if (exitCode !== null) {
		throw new OpenError(`Failed to open URL. Make sure app is installed and the schema is correct.`);
	}

	return true;
}

Bun.Open = runOpen;
