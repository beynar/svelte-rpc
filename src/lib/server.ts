/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RequestEvent, type Handle as SvelteKitHandle, json } from '@sveltejs/kit';
import { tryParse } from './utils.js';
import { deform, form } from 'ampliform';
import type { CookieSerializeOptions } from 'cookie';
import type {
	API,
	HandleFunction,
	Middleware,
	PreparedHandler,
	ReturnOfMiddlewares,
	Router,
	Schema,
	SchemaInput,
	StreamsCallbacks
} from './types.js';
import { createRecursiveProxy } from './client.js';

const getHandler = (router: Router, path: string[]) => {
	type H = Router | PreparedHandler<any, any, any> | undefined;
	let handler: H = router;
	path.forEach((segment) => {
		handler = handler?.[segment as keyof typeof handler]
			? (handler?.[segment as keyof typeof handler] as H)
			: undefined;
	});
	return (handler ? handler : null) as any | null;
};

const createCaller = <R extends Router>(router: R, event: RequestEvent) => {
	return createRecursiveProxy(async ({ path, args }) => {
		const handler = getHandler(router, path);
		const parsedData = await handler.parse(args[0]);
		return handler.call(event, parsedData);
	}, []) as API<R>;
};

export const stream = <C>(result: ReadableStream<C>, callbacks?: StreamsCallbacks<C>) => {
	const streamReader = result.getReader();
	const chunks: C[] = [];
	let first = true;
	const decoder = new TextDecoder();
	const stream = new ReadableStream({
		async start(controller) {
			await callbacks?.onStart?.();
			const push = async () => {
				const { done, value } = await streamReader.read();

				if (done) {
					await callbacks?.onEnd?.(chunks);
					controller.close();
					return;
				} else if (value) {
					const chunk = tryParse<C>(decoder.decode(value as any));
					await callbacks?.onChunk?.({ chunk, first });
					chunks.push(chunk);
					first = false;
				}
				controller.enqueue(value);
				push();
			};
			push();
		}
	});

	return stream as ReadableStream<C>;
};

export const createRPCHandle = <R extends Router>({
	router,
	endpoint = '/api',
	localsApiKey = 'api'
}: {
	router: R;
	endpoint?: `/${string}` | false;
	localsApiKey?: string | false;
}): SvelteKitHandle => {
	return async ({ event, resolve }) => {
		const isClientRequest = event.request.headers.get('x-svelte-rpc-client') === 'true';
		if (typeof localsApiKey === 'string') {
			Object.assign(event.locals, { [localsApiKey]: createCaller(router, event) });
		}
		if (endpoint && event.url.pathname.startsWith(endpoint)) {
			const handler = getHandler(
				router,
				event.url.pathname.split('/').slice(endpoint.split('/').length)
			);
			const cookies: {
				name: string;
				value: string;
				opts: CookieSerializeOptions & {
					path: string;
				};
			}[] = [];
			event.cookies.set = (
				name: string,
				value: string,
				opts: CookieSerializeOptions & {
					path: string;
				}
			) => {
				cookies.push({ name, value, opts });
			};
			event.cookies.delete = (name: string) => {
				cookies.push({ name, value: '', opts: { path: '/', maxAge: -1 } });
			};

			const payload = isClientRequest
				? deform(await event.request.clone().formData())
				: await event.request.clone().json();
			try {
				const data = await handler.parse(payload);
				const result = await handler.call(event, data);
				if (result?.constructor.name === 'ReadableStream') {
					return new Response(result, {
						headers: { 'Content-Type': 'text/event-stream' }
					});
				} else {
					console.log(
						cookies
							.map(({ name, value, opts }) => event.cookies.serialize(name, value, opts))
							.join('; ')
					);
					const headers = new Headers();
					cookies.forEach(({ name, value, opts }) => {
						headers.append('Set-Cookie', event.cookies.serialize(name, value, opts));
					});

					if (isClientRequest) {
						return new Response(form(result), { headers });
					} else {
						return json(
							{ result },
							{
								headers
							}
						);
					}
				}
			} catch (error) {
				return json(
					{ error: JSON.parse((error as { message?: string }).message || 'Server error') },
					{
						status: 400
					}
				);
			}
		}
		return resolve(event);
	};
};

export const procedure = <M extends Middleware[]>(...middlewares: M) => {
	const useMiddlewares = async (event: RequestEvent): Promise<ReturnOfMiddlewares<M>> => {
		const data = {};
		if (middlewares) {
			for (const middleware of middlewares) {
				Object.assign(data, await middleware(event));
			}
		}
		return data as ReturnOfMiddlewares<M>;
	};
	const handler =
		<S extends Schema | undefined>(schema?: S) =>
		<H extends HandleFunction<S, M>>(handler: H): PreparedHandler<S, M, H> => {
			return {
				parse: (data: any) => {
					if (schema === undefined) {
						return undefined;
					} else {
						// @ts-expect-error we are on the edge here
						const parseResult = schema.safeParse?.(data) || schema._parse?.(data);
						const errors = parseResult?.error?.issues || parseResult.issues;
						if (errors) {
							throw new Error(JSON.stringify(errors));
						}
						return parseResult.data || parseResult.output;
					}
				},
				call: async (
					event: RequestEvent,
					input: S extends Schema ? SchemaInput<S> : undefined
				): Promise<ReturnType<H>> => {
					return handler({ event, input, ctx: await useMiddlewares(event) } as any);
				}
			};
		};
	return {
		input: <S extends Schema>(schema: S) => ({
			handle: handler(schema)
		}),
		handle: handler(undefined)
	};
};
