import { procedure } from '$lib/server.js';
import type { Router } from '$lib/types.js';

export const subRouter = {
	subRouter: procedure().handle(async ({ event }) => {
		await event.locals.api.test.test('test');
		return { data: true };
	})
} satisfies Router;
