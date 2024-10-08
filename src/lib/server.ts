/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RequestEvent, type Handle as SvelteKitHandle, json } from '@sveltejs/kit';
import { tryParse } from './utils.js';
import { deform, form } from './deform.js';
import type { CookieSerializeOptions } from 'cookie';
import type {
	API,
	HandleFunction,
	Middleware,
	ReturnOfMiddlewares,
	Router,
	Schema,
	SchemaInput,
	StreamsCallbacks
} from './types.js';
import { createRecursiveProxy } from './client.js';
import { error, handleError } from './error.js';

// const getHandler = (router: Router, path: string[]) => {
// 	type H = Router | Handler<any, any, any> | undefined;
// 	let handler: H = router;
// 	path.forEach((segment) => {
// 		handler = handler?.[segment as keyof typeof handler]
// 			? (handler?.[segment as keyof typeof handler] as H)
// 			: undefined;
// 	});
// 	return (handler ? handler : null) as any | null;
// };

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
		const handler = getHandler(router, path);
		const parsedData = parse(handler.schema, args[0]);
		return handler.call(event, parsedData);
	}, []) as API<R>;
};

export const stream = <C>(
	result: ReadableStream<C>,
	callbacks?: StreamsCallbacks<C>
): ReadableStream<C> => {
	const streamReader = result.getReader();

	const chunks: C[] = [];
	let first = true;
	const decoder = new TextDecoder();
	const stream = new ReadableStream({
		async start(controller) {
			await callbacks?.onStart?.();
			const push = async () => {
				const { done, value } = await streamReader.read();
				console.log({ value });
				if (done) {
					await callbacks?.onEnd?.(chunks);
					controller.close();
					return;
				} else if (value) {
					const chunk =
						typeof value === 'string' ? tryParse<C>(decoder.decode(value as any)) : value;
					console.log({ chunk });
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
		Object.assign(event, { error: error, stream: stream });
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
				? deform(await event.request.formData())
				: await event.request.json();
			try {
				const data = parse(handler.schema, payload);
				const result = await handler.call(event, data);
				if (result?.constructor.name === 'ReadableStream') {
					console.log('is stream');
					return new Response(result, {
						headers: { 'Content-Type': 'text/event-stream' }
					});
				} else {
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
			} catch (err) {
				return handleError(err);
			}
		}
		return resolve(event);
	};
};

export const parse = <S extends Schema | undefined>(schema: S, data: any) => {
	if (schema === undefined) {
		return undefined;
	} else {
		const parseResult =
			// @ts-ignore
			schema.safeParse?.(data) ||
			// @ts-ignore
			schema._parse?.(data) ||
			// @ts-ignore
			schema._run?.({ value: data }, { abortEarly: true, abortPipeEarly: true });
		const errors = parseResult?.error?.issues || parseResult.issues || parseResult.summary;
		if (errors) {
			throw error('BAD_REQUEST', errors);
		}
		if ('_run' in schema) {
			return parseResult.value;
		} else if ('safeParse' in schema) {
			return parseResult.data;
		} else if ('_parse' in schema) {
			return parseResult.output;
		}
	}
};

export const procedure = <M extends Middleware[]>(...middlewares: M) => {
	return {
		handle: <H extends HandleFunction<undefined, M>>(handleFunction: H) => {
			return new Handler(middlewares, undefined, handleFunction) as Handler<M, undefined, H>;
		},
		input: <S extends Schema>(schema: S) => {
			return {
				handle: <H extends HandleFunction<S, M>>(handleFunction: H) =>
					new Handler(middlewares, schema, handleFunction) as Handler<M, S, H>
			};
		}
	};
};

export class Handler<
	M extends Middleware[],
	S extends Schema | undefined,
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

	call = async (event: RequestEvent, input: S extends Schema ? SchemaInput<S> : undefined) => {
		return this.handleFunction({
			event,
			input,
			ctx: await this.useMiddlewares(this.middlewares, event)
		} as any);
	};
}
