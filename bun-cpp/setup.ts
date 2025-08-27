import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type CppErrorState = {
	stage: 'check' | 'compile' | 'run';
	message: string;
	code?: number;
	stderr?: string;
	stdout?: string;
};

class CppError {
	message: string;

	constructor(message: string) {
		this.message = message;
	}
}

export type Result<T, E extends CppErrorState> =
	| {
			ok: true;
			value: T;
			unwrap<U = T>(): U;
			unwrapOr(defaultValue: T): T;
			isOk(): true;
			isErr(): false;
	  }
	| {
			ok: false;
			error: E;
			unwrap(): never;
			unwrapOr(defaultValue: T): T;
			isOk(): false;
			isErr(): true;
	  };

const textDecoder = new TextDecoder();

function decode(u8: Uint8Array): string {
	return textDecoder.decode(u8);
}

function interleaveTemplate(strings: TemplateStringsArray, exprs: unknown[]): string {
	let out = '';
	for (let i = 0; i < strings.length; i++) {
		out += strings[i];
		if (i < exprs.length)
			out += Array.isArray(exprs[i]) ? `{ ${(exprs[i] as any[]).map((v) => String(v)).join(', ')} }` : String(exprs[i]);
	}
	return out;
}

const PROJECT_CACHE_DIR = join(process.cwd(), '.bun');
const CPP_CACHE_DIR = join(PROJECT_CACHE_DIR, 'cpp');

function ensureDir(path: string) {
	return mkdir(path, { recursive: true });
}

function sha256(input: string): string {
	const hasher = new Bun.CryptoHasher('sha256');
	hasher.update(input);
	return hasher.digest('hex');
}

function prepareCppSource(userCode: string): string {
	const hasMain = /\bint\s+main\s*\(/.test(userCode);
	if (hasMain) return userCode;

	return [
		'#include <iostream>',
		'using namespace std;',
		'int main() {',
		'  try {',
		'    auto __res = [&]() {',
		userCode,
		'    }();',
		'    return 0;',
		'  } catch (const exception& e) {',
		'    cerr << e.what() << "\\n";',
		'    return 1;',
		'  }',
		'}\n',
	].join('\n');
}

async function runCpp<T = unknown, E extends CppErrorState = CppErrorState>(
	strings: TemplateStringsArray,
	...exprs: unknown[]
): Promise<Result<T, E>> {
	try {
		const gxxPath = Bun.which('g++') || Bun.which('clang++');
		if (!gxxPath) {
			return {
				ok: false,
				error: { stage: 'check', message: 'C++ compiler (g++/clang++) not found' } as E,
				unwrap: () => {
					throw new CppError('C++ compiler not found');
				},
				unwrapOr: (d: T) => d,
				isOk: () => false as const,
				isErr: () => true as const,
			} as const;
		}

		const userCode = interleaveTemplate(strings, exprs);
		const sourceCode = prepareCppSource(userCode);
		const hashKey = sha256(JSON.stringify({ mode: 'cpp', sourceCode }));

		const outDir = join(CPP_CACHE_DIR, hashKey);
		await ensureDir(outDir);
		const srcPath = join(outDir, 'main.cpp');
		const binPath = join(outDir, 'main_bin');

		if (!(await Bun.file(binPath).exists())) {
			await Bun.write(srcPath, sourceCode);
			const compile = Bun.spawnSync({
				cmd: [gxxPath, '-std=c++20', '-O2', srcPath, '-o', binPath],
				stdout: 'pipe',
				stderr: 'pipe',
			});
			if (!compile.success) {
				const cstderr = decode(compile.stderr);
				return {
					ok: false,
					error: { stage: 'compile', code: compile.exitCode, stderr: cstderr } as E,
					unwrap: () => {
						throw new CppError(cstderr);
					},
					unwrapOr: (d: T) => d,
					isOk: () => false as const,
					isErr: () => true as const,
				} as const;
			}
		}

		const run = Bun.spawnSync({
			cmd: [binPath],
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const stdout = decode(run.stdout).trim();
		const stderr = decode(run.stderr).trim();

		if (!run.success) {
			return {
				ok: false,
				error: { stage: 'run', code: run.exitCode, stderr, stdout } as E,
				unwrap: () => {
					throw new CppError(stderr || stdout);
				},
				unwrapOr: (d: T) => d,
				isOk: () => false as const,
				isErr: () => true as const,
			} as const;
		}

		console.log('C++ program output:', stdout);

		return {
			ok: true,
			value: stdout as unknown as T,
			unwrap: <U = T>() => stdout as unknown as U,
			unwrapOr: () => stdout as T,
			isOk: () => true as const,
			isErr: () => false as const,
		} as const;
	} catch (error) {
		return {
			ok: false,
			error: error as E,
			unwrap: () => {
				throw new CppError(String(error));
			},
			unwrapOr: (d: T) => d,
			isOk: () => false as const,
			isErr: () => true as const,
		} as const;
	}
}

declare module 'bun' {
	export let cpp: typeof runCpp;
}

Bun.cpp = runCpp;
