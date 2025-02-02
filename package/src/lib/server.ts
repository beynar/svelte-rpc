/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RequestEvent, type Handle as SvelteKitHandle, json } from '@sveltejs/kit';
import { tryParse } from './utils.js';
import { deform, form } from './deform.js';
import type { SerializeOptions } from 'cookie';
import type {
	API,
	HandleFunction,
	Middleware,
	ReturnOfMiddlewares,
	Router,
	StreamsCallbacks
} from './types.js';
import { createRecursiveProxy } from './client.js';
import { error, handleError } from './error.js';
import type { StandardSchemaV1 } from './standardSchema.js';

const getHandler = (router: Router, path: string[]) => {
	type H = Router | Handler<any, any, any> | undefined;
	let handler: H = router;
	for (const segment of path) {
		handler = handler?.[segment as keyof typeof handler] as H;
	}
	if (!handler) {
		throw error('NOT_FOUND', 'Route not found');
	}
	return handler as Handler<any, any, any>;
};

const createCaller = <R extends Router>(router: R, event: RequestEvent) => {
	return createRecursiveProxy(async ({ path, args }) => {
		try {
			const handler = getHandler(router, path);

			const parsedData = await parse(handler.schema, args[0]);
			const result = await handler.call(event, parsedData);
			return [result, null];
		} catch (err) {
			console.error(err);
			return [null, err];
		}
	}, []) as API<R>;
};

const isAsyncIterable = (value: any): boolean => {
	return value && typeof value[Symbol.asyncIterator] === 'function';
};

const STREAMED = Symbol.for('STREAMED');

type Streamed<T> = ReadableStream<T> | AsyncIterable<T>;

export const stream = <T>(
	stream: Streamed<T>,
	callbacks?: StreamsCallbacks<T>
): ReadableStream<T> => {
	let chunks: T[] = [];
	let first = true;
	const decoder = new TextDecoder();
	let isObject = false;

	const readableStream = new ReadableStream({
		async start(controller) {
			try {
				await callbacks?.onStart?.();
				// @ts-expect-error we can async iterate over a ReadableStream, it will just be a Uint8Array
				for await (const chunk of stream) {
					await callbacks?.onChunk?.({ chunk, first });
					if (first) {
						isObject = typeof chunk === 'object' && !(chunk instanceof Uint8Array);
						if (isObject) {
							// We send this to indicate that the stream is an object and must be parsed as json on the client;
							controller.enqueue('%#%OBJECT%#%');
						}
					}
					if (isObject) {
						if (typeof chunk === 'object') {
							chunks.push(chunk);
							controller.enqueue(JSON.stringify(chunk));
						}
					} else if (chunk instanceof Uint8Array) {
						const value = decoder.decode(chunk);
						chunks.push(value as any);
						controller.enqueue(value);
					} else {
						chunks.push(chunk);
						controller.enqueue(chunk);
					}
					// this in order to make sure the client won't receive two chunks at once
					await new Promise((resolve) => setTimeout(resolve));
					first = false;
				}
				await callbacks?.onEnd?.(chunks);
				controller.close();
			} catch (err) {
				console.error('Error in stream start:', err);
				controller.error(err);
			}
		}
	});

	Object.assign({ readableStream, [STREAMED]: true });
	return readableStream;
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
		if (typeof localsApiKey === 'string') {
			Object.assign(event.locals, { [localsApiKey]: createCaller(router, event) });
		}
		if (endpoint && event.url.pathname.startsWith(endpoint)) {
			const isClientRequest = event.request.headers.get('x-svelte-rpc-client') === 'true';
			Object.assign({}, event, { error: error, stream: stream });
			const handler = getHandler(
				router,
				event.url.pathname.split('/').slice(endpoint.split('/').length)
			);
			const cookies: {
				name: string;
				value: string;
				opts: SerializeOptions & {
					path: string;
				};
			}[] = [];
			event.cookies.set = (
				name: string,
				value: string,
				opts: SerializeOptions & {
					path: string;
				}
			) => {
				cookies.push({ name, value, opts });
			};

			event.cookies.delete = (name: string) => {
				cookies.push({ name, value: '', opts: { path: '/', maxAge: -1 } });
			};

			const payload = isClientRequest
				? deform(await event.request.formData())
				: await event.request.json();
			try {
				const data = await parse(handler.schema, payload);
				const result = await handler.call(event, data);
				const headers = new Headers();
				cookies.forEach(({ name, value, opts }) => {
					headers.append('Set-Cookie', event.cookies.serialize(name, value, opts));
				});
				if (result && result instanceof Response) {
					return result;
				}
				if (isAsyncIterable(result)) {
					if (result[STREAMED]) {
						return new Response(result, {
							headers: { 'Content-Type': 'text/event-stream', ...headers }
						});
					}
					return new Response(stream(result), {
						headers: { 'Content-Type': 'text/event-stream', ...headers }
					});
				} else {
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
			} catch (err) {
				return handleError(err);
			}
		}
		return resolve(event);
	};
};

export const parse = async <S extends StandardSchemaV1 | undefined>(schema: S, input: any) => {
	if (schema === undefined) {
		return undefined;
	} else {
		let result = schema['~standard'].validate(input);
		if (result instanceof Promise) result = await result;

		if (result.issues) {
			throw new Error(JSON.stringify(result.issues, null, 2));
		}
		return result.value;
	}
};

export const procedure = <M extends Middleware[]>(...middlewares: M) => {
	return {
		handle: <H extends HandleFunction<undefined, M>>(handleFunction: H) => {
			return new Handler(middlewares, undefined, handleFunction) as Handler<M, undefined, H>;
		},
		input: <S extends StandardSchemaV1>(schema: S) => {
			return {
				handle: <H extends HandleFunction<S, M>>(handleFunction: H) =>
					new Handler(middlewares, schema, handleFunction) as Handler<M, S, H>
			};
		}
	};
};

export class Handler<
	M extends Middleware[],
	S extends StandardSchemaV1 | undefined,
	const H extends HandleFunction<S, M>
> {
	middlewares: M;
	schema: S;
	handleFunction: H;

	constructor(middlewares: M, schema: S, handleFunction: H) {
		this.middlewares = middlewares;
		this.schema = schema;
		this.handleFunction = handleFunction;
	}

	private useMiddlewares = async (
		middlewares: M,
		event: RequestEvent
	): Promise<ReturnOfMiddlewares<M>> => {
		const data = {};
		for (const middleware of middlewares) {
			Object.assign(data, await middleware(event as any));
		}
		return data as ReturnOfMiddlewares<M>;
	};

	call = async (
		event: RequestEvent,
		input: S extends StandardSchemaV1 ? StandardSchemaV1.InferInput<S> : undefined
	) => {
		return this.handleFunction({
			event,
			input,
			ctx: await this.useMiddlewares(this.middlewares, event)
		} as any);
	};
}
