import { createRPCHandle, procedure, stream } from '$lib/server.js';
import type { Router } from '$lib/types.js';
import { sequence } from '@sveltejs/kit/hooks';
import { date, object, string } from 'valibot';
import OpenAI from 'openai';
import { PRIVATE_OPEN_API_KEY } from '$env/static/private';
import { z } from 'zod';
const openai = new OpenAI({
	apiKey: PRIVATE_OPEN_API_KEY
});

const router = {
	route: procedure().handle(async ({ event }) => {
		event.cookies.set('test', new Date().toISOString(), {
			path: '/',
			maxAge: 60 * 60 * 24 * 7,
			sameSite: 'lax',
			domain: 'localhost',
			secure: false,
			httpOnly: false
		});
		return { data: true };
	}),
	complex: procedure()
		.input(
			z.object({
				title: z.string(),
				description: z.string(),
				folderId: z.string().optional(),
				tags: z.array(
					z.object({
						id: z.string(),
						label: z.string()
					})
				),
				type: z.enum(['PDF', 'AUDIO', 'CHAT'])
			})
		)
		.handle(async ({ input }) => {
			return input;
		}),
	ai: procedure()
		.input(z.string())
		.handle(async ({ input }) => {
			const completion = await openai.chat.completions.create({
				model: 'gpt-3.5-turbo',
				max_tokens: 4,
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: input }
				],
				stream: true
			});
			return stream<OpenAI.ChatCompletionChunk>(completion.toReadableStream(), {
				onChunk: ({ chunk, first }) => {
					console.log('AI chunk received', chunk.choices[0].delta.content, first);
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
	createRPCHandle({ router })
	// createRPCHandle({ router, endpoint: false, localsApiKey: 'admin' })
);
