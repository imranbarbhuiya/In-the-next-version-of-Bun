import { $ } from 'bun';

declare module 'bun' {
	export let PHP: typeof runPHP;
}

class PHPError {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}

async function runPHP(codeOrStrings: string | TemplateStringsArray, ...values: unknown[]) {
	let code: string;
	if (Array.isArray(codeOrStrings) && 'raw' in codeOrStrings) {
		code = codeOrStrings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
	} else {
		code = codeOrStrings as string;
	}
	try {
		const hasPHP = Bun.which('php');

		if (!hasPHP) {
			throw new PHPError('PHP is not installed. Please install it');
		}

		code = code.trim();

		if (code.startsWith('<?php')) {
			code = code.replace(/^<\?php/, '');
		}
		if (code.endsWith('?>')) {
			code = code.replace(/\?>$/, '');
		}

		code = code.trim();

		return (await $`php -r ${code}`.text()).trim();
	} catch (e) {
		if (e instanceof $.ShellError) {
			const stderr = e.stderr.toString();
			if (stderr.includes('command not found:')) throw new PHPError('PHP is not installed. Please install it');
			throw new PHPError(stderr);
		}
		throw e;
	}
}

Bun.PHP = runPHP;
