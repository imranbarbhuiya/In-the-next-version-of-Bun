import { mkdir } from 'fs/promises';
import { join } from 'path';

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

await mkdir(newDir);

await Bun.write(join(newDir, 'tsconfig.json'), Bun.file(join(templateDir, 'tsconfig.json')));

await Bun.write(join(newDir, 'setup.ts'), '');
await Bun.write(join(newDir, 'readme.md'), `# ${packageName}\n`);
await Bun.write(join(newDir, 'index.ts'), `import './setup';\n`);

console.log(`Package ${packageName} created successfully.`);
