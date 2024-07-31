import { createRPCClient } from '$lib/client.js';
import type { AppRouter } from '../hooks.server.js';

export const api = createRPCClient<AppRouter>({
	onError: (error) => {
		console.log(error);
	}
});
