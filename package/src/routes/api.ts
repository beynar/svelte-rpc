import { createRPCClient } from '$lib/client.js';
import type { InferApiTypes } from '$lib/types.js';
import type { AppRouter } from '../../../demo/src/hooks.server.js';

export const api = createRPCClient<AppRouter>({
	onError: (error) => {
		console.log(error);
	}
});

export type API = InferApiTypes<AppRouter>;
