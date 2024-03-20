import { createRPCHandle, procedure, stream } from '$lib/server.js';
import type { Router } from '$lib/types.js';
import { sequence } from '@sveltejs/kit/hooks';
import { date, object, string } from 'valibot';
import OpenAI from 'openai';
import { PRIVATE_OPEN_API_KEY } from '$env/static/private';
const openai = new OpenAI({
	apiKey: PRIVATE_OPEN_API_KEY
});

const router = {
	route: procedure().handle(async () => {
		return { data: true };
	}),
	ai: procedure()
		.input(string())
		.handle(async ({ input }) => {
			const completion = await openai.chat.completions.create({
				model: 'gpt-4-turbo-preview',
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: input }
				],
				stream: true
			});
			return stream<OpenAI.ChatCompletionChunk>(completion.toReadableStream(), {
				onChunk: ({ chunk, first }) => {
					console.log('AI chunk received', chunk, first);
				},
				onEnd: (chunks) => {
					console.log('AI stream ended', chunks);
				},
				onStart: () => {
					console.log('AI stream started');
				}
			});
		}),
	test: {
		test: procedure()
			.input(string())
			.handle(async () => {
				return { data: true };
			}),
		test2: procedure()
			.input(object({ test: string(), image: date() }))
			.handle(async () => {
				return { data: true };
			})
	}
} satisfies Router;

export type AppRouter = typeof router;
export const handle = sequence(
	createRPCHandle({ router }),
	createRPCHandle({ router, endpoint: false, localsApiKey: 'admin' })
);
