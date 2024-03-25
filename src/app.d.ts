// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			test: boolean;
			api: import('$lib/types.js').API<import('./hooks.server.js').AppRouter>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	type InferRPCReturnType<
		P extends import('$lib/types.js').RouterPaths<import('./hooks.server.js').AppRouter>
	> = import('$lib/types.js').ReturnTypeOfProcedure<import('./hooks.server.js').AppRouter, P>;
	type InferRPCInput<
		P extends import('$lib/types.js').RouterPaths<import('./hooks.server.js').AppRouter>
	> = import('$lib/types.js').InputOfProcedure<import('./hooks.server.js').AppRouter, P>;
}

export {};
