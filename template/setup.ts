declare module 'bun' {
	export let Placeholder: typeof runPlaceholder;
}

class PlaceholderError {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}

async function runPlaceholder(codeOrStrings: string | TemplateStringsArray, ...values: unknown[]) {
	let code: string;
	if (Array.isArray(codeOrStrings) && 'raw' in codeOrStrings) {
		code = codeOrStrings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
	} else {
		code = codeOrStrings as string;
	}
}

Bun.Placeholder = runPlaceholder;
