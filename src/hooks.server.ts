import { createRPCHandle, procedure, stream } from '$lib/server.js';
import type { Router } from '$lib/types.js';
import { sequence } from '@sveltejs/kit/hooks';
import { date, object, string, array, set, map } from 'valibot';
import OpenAI from 'openai';
import { PRIVATE_OPEN_API_KEY } from '$env/static/private';
import { z } from 'zod';
import { subRouter } from './test.js';

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
	subRouter,
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
		partial: procedure()
			.input(
				z.object({
					optional: z.string().optional()
				})
			)
			.handle(async ({ input }) => {
				return input;
			}),
		errorTest: procedure()
			.input(
				z.object({
					optional: z.string().optional()
				})
			)
			.handle(async ({ input }) => {
				return input;
			}),
		optional: procedure()
			.input(z.string().optional())
			.handle(async ({ input }) => {
				return input;
			}),
		noPayload: p.handle(async () => {
			return { data: true };
		}),
		test: procedure()
			.input(string())
			.handle(async ({ event }) => {
				event.cookies.set('test-1', 'test-1', {
					path: '/'
				});
				event.cookies.set('test-2', 'test-2', {
					path: '/'
				});

				return { result: undefined, event: event.locals.test };
			}),
		object: procedure()
			.input(object({ test: string(), date: date() }))
			.handle(async () => {
				return { data: true };
			}),
		mapAndSet: procedure()
			.input(
				object({
					set: set(string()),
					map: map(
						string(),
						object({
							name: string(),
							date: date()
						})
					)
				})
			)
			.handle(async ({ input }) => {
				return { input };
			}),
		array: procedure()
			.input(array(object({ test: string(), date: date() })))
			.handle(async ({ event }) => {
				return { data: true, test: event.locals.test };
			})
	}
} satisfies Router;

export type AppRouter = typeof router;

export const handle = sequence(
	createRPCHandle({ router })
	// createRPCHandle({ router, endpoint: false, localsApiKey: 'admin' })
);
