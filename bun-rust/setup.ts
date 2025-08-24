import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

type RustError = {
	stage: 'check' | 'compile' | 'run';
	message: string;
	code?: number;
	stderr?: string;
	stdout?: string;
};

export type Result<T, E extends RustError> =
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
		if (i < exprs.length) out += String(exprs[i]);
	}
	return out;
}

const START_OK = '__JS_RESULT__=OK<<<EOT';
const START_ERR = '__JS_RESULT__=ERR<<<EOT';
const END_MARKER = 'EOT';

const PROJECT_CACHE_DIR = join(process.cwd(), '.bun');
const RUSTC_CACHE_DIR = join(PROJECT_CACHE_DIR, 'rust');
const CARGO_CACHE_DIR = join(PROJECT_CACHE_DIR, 'rust-cargo');

function ensureDir(path: string) {
	mkdirSync(path, { recursive: true });
}

function sha256(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

function splitTopLevelCommaSeparated(input: string): string[] {
	const parts: string[] = [];
	let current = '';
	let depthCurly = 0;
	let depthSquare = 0;
	let depthParen = 0;
	let inString: false | '"' | "'" = false;
	let isEscaped = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		current += ch;
		if (isEscaped) {
			isEscaped = false;
			continue;
		}
		if (inString) {
			if (ch === '\\') {
				isEscaped = true;
			} else if (ch === inString) {
				inString = false;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			inString = ch as '"' | "'";
			continue;
		}
		if (ch === '{') depthCurly++;
		else if (ch === '}') depthCurly = Math.max(0, depthCurly - 1);
		else if (ch === '[') depthSquare++;
		else if (ch === ']') depthSquare = Math.max(0, depthSquare - 1);
		else if (ch === '(') depthParen++;
		else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
		else if (ch === ',' && depthCurly === 0 && depthSquare === 0 && depthParen === 0) {
			parts.push(current.slice(0, -1));
			current = '';
		}
	}
	if (current.trim()) parts.push(current);
	return parts.map((s) => s.trim()).filter(Boolean);
}

function prepareRustSource(userCode: string, useSerde: boolean): string {
	const header = '#![allow(unused)]\n';
	const hasMain = /\bfn\s+main\s*\(/.test(userCode);
	if (hasMain) return `${header}${userCode}`;
	return (
		header +
		[
			'use std::process::ExitCode;',
			useSerde ? 'use serde_json;' : '',
			'fn main() -> ExitCode {',
			'  let __res = (|| {',
			userCode,
			'  })();',
			'  match __res {',
			'    Ok(v) => {',
			`      println!("${START_OK}");`,
			useSerde
				? [
						'      match serde_json::to_string(&v) {',
						'        Ok(s) => println!("{}", s),',
						'        Err(_) => println!("{:?}", v),',
						'      }',
				  ].join('\n')
				: '      println!("{:?}", v);',
			`      println!("${END_MARKER}");`,
			'      ExitCode::from(0)',
			'    }',
			'    Err(e) => {',
			`      eprintln!("${START_ERR}");`,
			'      eprintln!("{:?}", e);',
			`      eprintln!("${END_MARKER}");`,
			'      ExitCode::from(1)',
			'    }',
			'  }',
			'}\n',
		].join('\n')
	);
}

function makeTmpDir(): string {
	const base = os.tmpdir();
	const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
	const dir = join(base, `bun-rust-${id}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function extractDelimited(text: string, startMarker: string, endMarker: string): string | null {
	const startIdx = text.indexOf(startMarker);
	if (startIdx === -1) return null;
	const afterStart = text.indexOf('\n', startIdx);
	const endIdx = text.indexOf(endMarker, afterStart === -1 ? startIdx : afterStart + 1);
	if (endIdx === -1) return null;
	const contentStart = afterStart === -1 ? startIdx + startMarker.length : afterStart + 1;
	return text.slice(contentStart, endIdx).trim();
}

async function rust<T = unknown, E extends RustError = RustError>(
	strings: TemplateStringsArray,
	...exprs: unknown[]
): Promise<Result<T, E>> {
	try {
		const rustcPath = Bun.which('rustc');
		if (!rustcPath) {
			return {
				ok: false,
				error: {
					stage: 'check',
					message: 'rustc not found in PATH. Please install Rust (rustup)',
				} as E,
				// eslint-disable-next-line @typescript-eslint/no-throw-literal
				unwrap: () => {
					throw new Error('rustc not found in PATH.');
				},
				unwrapOr: (defaultValue: T) => defaultValue,
				isOk: () => false as const,
				isErr: () => true as const,
			} as const;
		}

		const userCode = interleaveTemplate(strings, exprs);
		const cargoDepsLine = /\/\/\s*cargo-deps\s*:\s*(.*)/i.exec(userCode);
		const isCargoMode = Boolean(cargoDepsLine);

		ensureDir(PROJECT_CACHE_DIR);

		let runCmd: string[] | null = null;
		let stdout = '';
		let stderr = '';

		if (isCargoMode) {
			const cargoPath = Bun.which('cargo');
			if (!cargoPath) {
				return {
					ok: false,
					error: { stage: 'check', message: 'cargo not found in PATH' } as E,
					// eslint-disable-next-line @typescript-eslint/no-throw-literal
					unwrap: () => {
						throw new Error('cargo not found in PATH');
					},
					unwrapOr: (defaultValue: T) => defaultValue,
					isOk: () => false as const,
					isErr: () => true as const,
				} as const;
			}

			const depsStr = cargoDepsLine?.[1] ?? '';
			const hasMain = /\bfn\s+main\s*\(/.test(userCode);
			const sourceCode = hasMain ? userCode : prepareRustSource(userCode, true);
			const hashKey = sha256(JSON.stringify({ mode: 'cargo', depsStr, sourceCode }));

			const projDir = join(CARGO_CACHE_DIR, hashKey);
			const srcDir = join(projDir, 'src');
			const cargoToml = join(projDir, 'Cargo.toml');
			const mainRs = join(srcDir, 'main.rs');
			const targetDir = join(projDir, 'target');
			const binName = 'snippet';
			const binPath = join(targetDir, 'release', binName);

			if (!existsSync(binPath)) {
				ensureDir(CARGO_CACHE_DIR);
				ensureDir(projDir);
				ensureDir(srcDir);

				const deps: string[] = splitTopLevelCommaSeparated(depsStr);
				const depNames = new Set(
					deps.map((d) => {
						const eq = d.indexOf('=');
						return (eq === -1 ? d : d.slice(0, eq)).trim();
					}),
				);
				if (!depNames.has('serde')) {
					deps.push('serde = { version = "1", features = ["derive"] }');
				}
				if (!depNames.has('serde_json')) {
					deps.push('serde_json = "1"');
				}
				const depsToml = deps
					.map((d) => {
						// pass through entries that already look like TOML tables or arrays or bare names
						if (/[{\[]/.test(d)) return d;
						const eq = d.indexOf('=');
						if (eq === -1) return `${d} = "*"`;
						const name = d.slice(0, eq).trim();
						const value = d.slice(eq + 1).trim();
						return `${name} = ${value || '"*"'}`;
					})
					.join('\n');

				const toml = [
					'[package]',
					`name = "${binName}"`,
					'version = "0.1.0"',
					'edition = "2021"',
					'',
					'[dependencies]',
					depsToml,
					'',
				].join('\n');

				await Bun.write(cargoToml, toml);
				await Bun.write(mainRs, sourceCode);

				const build = Bun.spawnSync({
					cmd: [cargoPath, 'build', '--release', '--manifest-path', cargoToml, '--target-dir', targetDir, '--quiet'],
					stdout: 'pipe',
					stderr: 'pipe',
				});
				if (!build.success) {
					const cstderr = decode(build.stderr);
					return {
						ok: false,
						error: {
							stage: 'compile',
							code: build.exitCode,
							stderr: cstderr,
						} as E,
						// eslint-disable-next-line @typescript-eslint/no-throw-literal
						unwrap: () => {
							throw new Error(cstderr);
						},
						unwrapOr: (defaultValue: T) => defaultValue,
						isOk: () => false as const,
						isErr: () => true as const,
					} as const;
				}
			}

			runCmd = [join(binPath)];
		} else {
			const sourceCode = prepareRustSource(userCode, false);
			const hashKey = sha256(JSON.stringify({ mode: 'rustc', sourceCode }));
			const outDir = join(RUSTC_CACHE_DIR, hashKey);
			ensureDir(RUSTC_CACHE_DIR);
			ensureDir(outDir);
			const srcPath = join(outDir, 'main.rs');
			const binPath = join(outDir, 'main_bin');

			if (!existsSync(binPath)) {
				await Bun.write(srcPath, sourceCode);
				const compile = Bun.spawnSync({
					cmd: [rustcPath, srcPath, '-o', binPath, '--edition', '2021'],
					stdout: 'pipe',
					stderr: 'pipe',
				});
				if (!compile.success) {
					const cstderr = decode(compile.stderr);
					return {
						ok: false,
						error: {
							stage: 'compile',
							code: compile.exitCode,
							stderr: cstderr,
						} as E,
						// eslint-disable-next-line @typescript-eslint/no-throw-literal
						unwrap: () => {
							throw new Error(cstderr);
						},
						unwrapOr: (defaultValue: T) => defaultValue,
						isOk: () => false as const,
						isErr: () => true as const,
					} as const;
				}
			}

			runCmd = [join(outDir, 'main_bin')];
		}

		if (!runCmd) {
			return {
				ok: false,
				error: { stage: 'run', message: 'No binary to run' } as E,
				// eslint-disable-next-line @typescript-eslint/no-throw-literal
				unwrap: () => {
					throw new Error('No binary to run');
				},
				unwrapOr: (defaultValue: T) => defaultValue,
				isOk: () => false as const,
				isErr: () => true as const,
			} as const;
		}

		const run = Bun.spawnSync({
			cmd: runCmd,
			stdout: 'pipe',
			stderr: 'pipe',
		});

		stdout = decode(run.stdout).trim();
		stderr = decode(run.stderr).trim();

		const okPayload = extractDelimited(stdout, START_OK, END_MARKER);
		const errPayload = extractDelimited(stderr, START_ERR, END_MARKER);
		if (okPayload !== null) {
			let value: unknown = okPayload;
			try {
				value = JSON.parse(okPayload);
			} catch {}
			if (typeof value === 'string') {
				const s = (value as string).trim();
				if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
					try {
						value = JSON.parse(s);
					} catch {}
				}
			}
			return {
				ok: true,
				value: value as T,
				unwrap: <U = T>() => value as unknown as U,
				unwrapOr: () => value as T,
				isOk: () => true as const,
				isErr: () => false as const,
			} as const;
		}
		if (errPayload !== null) {
			let errorVal: unknown = errPayload;
			try {
				errorVal = JSON.parse(errPayload);
			} catch {}
			return {
				ok: false,
				error: {
					stage: 'run',
					code: run.exitCode,
					error: errorVal,
					stderr,
					stdout,
				} as unknown as E,
				// eslint-disable-next-line @typescript-eslint/no-throw-literal
				unwrap: () => {
					throw errorVal as unknown as Error;
				},
				unwrapOr: (defaultValue: T) => defaultValue,
				isOk: () => false as const,
				isErr: () => true as const,
			} as const;
		}

		if (!run.success) {
			return {
				ok: false,
				error: { stage: 'run', code: run.exitCode, stderr, stdout } as E,
				// eslint-disable-next-line @typescript-eslint/no-throw-literal
				unwrap: () => {
					throw new Error(String(stderr || stdout));
				},
				unwrapOr: (defaultValue: T) => defaultValue,
				isOk: () => false as const,
				isErr: () => true as const,
			} as const;
		}

		// Fallback: old behavior
		let value: unknown = stdout;
		if (stdout) {
			try {
				value = JSON.parse(stdout);
			} catch {
				value = stdout;
			}
			if (typeof value === 'string') {
				const s = (value as string).trim();
				if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
					try {
						value = JSON.parse(s);
					} catch {}
				}
			}
		}
		return {
			ok: true,
			value: value as T,
			unwrap: <U = T>() => value as unknown as U,
			unwrapOr: () => value as T,
			isOk: () => true as const,
			isErr: () => false as const,
		} as const;
	} catch (error) {
		return {
			ok: false,
			error: error as E,
			// eslint-disable-next-line @typescript-eslint/no-throw-literal
			unwrap: () => {
				throw error as unknown as Error;
			},
			unwrapOr: (defaultValue: T) => defaultValue,
			isOk: () => false as const,
			isErr: () => true as const,
		} as const;
	}
}

declare module 'bun' {
	export let Rust: typeof rust;
}

Bun.Rust = rust;
