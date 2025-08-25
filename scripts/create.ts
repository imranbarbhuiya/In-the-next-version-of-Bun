import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [, , packageName] = process.argv;
if (!packageName) {
	console.error('Usage: bun run scripts/create.ts <package-name>');
	process.exit(1);
}

const root = process.cwd();
const templateDir = join(root, 'template');
const newDir = join(root, packageName);

const dirExists = await Bun.file(newDir).exists();
if (dirExists) {
	console.error(`Directory ${packageName} already exists.`);
	process.exit(1);
}

await mkdir(newDir, { recursive: true });

await Bun.write(join(newDir, 'tsconfig.json'), Bun.file(join(templateDir, 'tsconfig.json')));

const setupContent = await Bun.file(join(templateDir, 'setup.ts')).text();

await Bun.write(
	join(newDir, 'setup.ts'),
	setupContent.replace(/Placeholder/g, packageName.split('-')[1]!.toUpperCase()),
);

await Bun.write(join(newDir, 'readme.md'), `# ${packageName}\n`);
await Bun.write(join(newDir, 'index.ts'), `import './setup';\n`);

console.log(`Package ${packageName} created successfully.`);
