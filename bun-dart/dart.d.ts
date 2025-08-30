declare module '*.dart' {
	const dartModule: Record<string, (...args: any[]) => any>;
	export default dartModule;
}
