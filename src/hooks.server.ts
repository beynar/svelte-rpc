import { createRPCHandle, procedure } from '$lib/server.js';
import type { Router } from '$lib/types.js';
import { sequence } from '@sveltejs/kit/hooks';
import { date, object, string } from 'valibot';

const router = {
	route: procedure().handle(async () => {
		return { data: true };
	}),
	test: {
		test: procedure().handle(async () => {
			return { data: true };
		}),
		test2: procedure()
			.input(object({ test: string(), image: date() }))
			.handle(async ({ event }) => {
				console.log((await event.request.formData()).get('image'));
				return { data: true };
			})
	}
} satisfies Router;

export type AppRouter = typeof router;
export const handle = sequence(
	createRPCHandle({ router }),
	createRPCHandle({ router, endpoint: false, localsApiKey: 'admin' })
);
