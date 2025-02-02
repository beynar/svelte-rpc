// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			api: import('$lib/types.js').API<import('../../demo/src/hooks.server.ts').AppRouter>;
			srpc: import('$lib/types.js').API<import('../../demo/src/hooks.server.ts').AppRouter>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	type InferRPCReturnType<
		P extends import('$lib/types.js').RouterPaths<
			import('../../demo/src/hooks.server.ts').AppRouter
		>
	> = import('$lib/types.js').ReturnTypeOfProcedure<
		import('../../demo/src/hooks.server.ts').AppRouter,
		P
	>;
	type InferRPCInput<
		P extends import('$lib/types.js').RouterPaths<
			import('../../demo/src/hooks.server.ts').AppRouter
		>
	> = import('$lib/types.js').InputOfProcedure<
		import('../../demo/src/hooks.server.ts').AppRouter,
		P
	>;
}

export {};
