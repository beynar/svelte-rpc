import { createApiClient } from '$lib/client.js';
import type { AppRouter } from '../hooks.server.js';

export const api = createApiClient<AppRouter>({
	onError: (error) => {
		console.log(error.message);
	}
});
