import { createApiHandle, procedure } from '$lib/server.js';
import type { Router } from '$lib/types.js';
import { sequence } from '@sveltejs/kit/hooks';
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
export const handle = sequence(
	createApiHandle({ router }),
	createApiHandle({ router, endpoint: false, localsApiKey: 'admin' })
);
