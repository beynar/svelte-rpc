import { createApiHandle, procedure } from '$lib/server.js';
import type { Router } from '$lib/types.js';
import { object, string } from 'valibot';

const router = {
	route: procedure().handle(async () => {
		return { data: true };
	}),
	test: {
		test: procedure().handle(async () => {
			return { data: true };
		}),
		test2: procedure()
			.input(object({ test: string(), image: string() }))
			.handle(async () => {
				return { data: true };
			})
	}
} satisfies Router;

export type AppRouter = typeof router;
export const handle = createApiHandle({ router, path: '/api' });
