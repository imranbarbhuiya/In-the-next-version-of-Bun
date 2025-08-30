import { plugin, spawnSync } from 'bun';
import { join } from 'path';

await plugin({
	name: 'dart interop loader',
	async setup(build) {
		build.onLoad({ filter: /\.dart$/ }, async ({ path }) => {
			const out = join(process.cwd(), '..', '.bun', 'dart', 'dart.js');
			const { exitCode } = spawnSync(['dart', 'compile', 'js', path, '-o', out]);

			if (exitCode !== null && exitCode !== 0) throw new Error('Dart compile failed for ' + path);

			const contents = await Bun.file(out).text();
			return {
				contents: `${contents}\nconst dartExports = globalThis.dartExports; export default dartExports;`,
				loader: 'js',
			};
		});
	},
});
