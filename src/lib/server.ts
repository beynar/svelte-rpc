/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RequestEvent, type Handle as SvelteKitHandle, json, error } from '@sveltejs/kit';
import type { BaseSchema as VSchema } from 'valibot';
import { formDataToObject, tryParse } from './utils.js';
import type { CookieSerializeOptions } from 'cookie';
import type {
	API,
	HandleFunction,
	HandlePayload,
	Middleware,
	PreparedHandler,
	ReturnOfMiddlewares,
	Router,
	SafeRequestEvent,
	Schema,
	SchemaInput,
	StreamsCallbacks
} from './types.js';
import { createRecursiveProxy } from './client.js';
import type { Schema as Zschema } from 'zod';

const getHandler = (router: Router, path: string[]) => {
	let handler: Router | PreparedHandler | undefined = router;
	path.forEach((segment) => {
		handler = handler
			? (handler[segment as keyof typeof handler] as Router | PreparedHandler | undefined)
			: undefined;
	});
	if (handler instanceof Handler) {
		return handler as PreparedHandler;
	} else {
		error(404, "API route doesn't exist");
	}
};

const isZod = (schema: Schema): schema is Zschema => {
	return (schema as Zschema).safeParse !== undefined;
};
const isVali = (schema: Schema): schema is VSchema => {
	return (schema as VSchema)._parse !== undefined;
};

const createCaller = <R extends Router>(router: R, event: RequestEvent) => {
	return createRecursiveProxy(async (opts) => {
		const {
			path,
			args: [data]
		} = opts;
		const handler = getHandler(router, path);
		const parsedData = await handler.parse(data);
		return handler.call(event, parsedData);
	}, []) as API<R>;
};

export const stream = <C>(result: ReadableStream<C>, callbacks?: StreamsCallbacks<C>) => {
	const streamReader = result.getReader();
	const chunks: C[] = [];
	let first = true;
	const decoder = new TextDecoder();
	const stream = new ReadableStream({
		start(controller) {
			callbacks?.onStart?.();
			const push = async () => {
				const { done, value } = await streamReader.read();

				if (done) {
					controller.close();
					callbacks?.onEnd?.(chunks);
					return;
				} else if (value) {
					const chunk = tryParse<C>(decoder.decode(value as any));
					chunks.push(chunk);
					callbacks?.onChunk?.({ chunk, first });
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
			const isFormData = event.request.headers.get('content-type')?.includes('multipart/form-data');
			const payload = isFormData
				? await event.request.clone().formData()
				: await event.request.clone().json();
			const data = await handler.parse(payload);
			const result = await handler.call(event, data);
			if (result?.constructor.name === 'ReadableStream') {
				return new Response(result, {
					headers: { 'Content-Type': 'text/event-stream' }
				});
			} else if (result && result instanceof File) {
				return new Response(result, {
					headers: {
						'Content-Type': result.type,
						'Content-Disposition': 'attachment; filename=' + result.name
					}
				});
			} else {
				return json(
					{ result },
					{
						headers: {
							'Set-Cookie': cookies
								.map(({ name, value, opts }) => event.cookies.serialize(name, value, opts))
								.join('; ')
						}
					}
				);
			}
		}

		return resolve(event);
	};
};

class Procedure<Use extends Middleware[]> {
	#middlewares: Use;
	#createHandler =
		<S extends Schema | undefined>(schema: S) =>
		<H extends HandleFunction<S, Use>>(handler: H) => {
			return new Handler(handler, schema, this.#middlewares);
		};
	constructor(...middlewares: Use) {
		this.#middlewares = middlewares;
	}
	input = <S extends Schema>(schema: S) => {
		return {
			handle: this.#createHandler(schema)
		};
	};
	handle = this.#createHandler(undefined);
}

export class Handler<
	S extends Schema | undefined,
	H extends HandleFunction<S, Use>,
	Use extends Middleware[] | undefined
> {
	#middlewares?: Use;
	#schema: S | undefined;
	#handler: H;

	constructor(handler: H, schema?: S, middlewares?: Use) {
		this.#schema = schema || undefined;
		this.#handler = handler;
		this.#middlewares = middlewares;
	}
	parse = async (data: any) => {
		if (this.#schema === undefined) {
			return undefined;
		} else {
			if (isZod(this.#schema)) {
				const parseResult = this.#schema.safeParse(formDataToObject(data));
				if (parseResult.success) {
					return parseResult.data;
				} else {
					error(
						400,
						parseResult.error.issues
							.map((issue) => `${issue.message} at: ${issue.path?.map((p) => p).join('.')}`)
							.join('\n')
					);
				}
			} else if (isVali(this.#schema)) {
				console.log(formDataToObject(data));
				const { output, issues } = this.#schema._parse(formDataToObject(data));
				if (issues) {
					error(
						400,
						issues
							.map((issue) => `${issue.message} at: ${issue.path?.map((p) => p.key).join('.')}`)
							.join('\n')
					);
				} else {
					return output;
				}
			}
		}
	};

	#useMiddlewares = async (event: SafeRequestEvent): Promise<ReturnOfMiddlewares<Use>> => {
		if (!this.#middlewares) {
			return undefined as ReturnOfMiddlewares<Use>;
		}
		const data = {};
		await Promise.all(
			this.#middlewares.map(async (middleware) => {
				Object.assign(data, await middleware(event));
			})
		);
		return data as ReturnOfMiddlewares<Use>;
	};
	call = async (
		event: RequestEvent,
		input: S extends Schema ? SchemaInput<S> : undefined
	): Promise<ReturnType<H>> => {
		const ctx = await this.#useMiddlewares(event);
		const payload = { event, input, ctx } as HandlePayload<any, any>;
		return this.#handler(payload as HandlePayload<S, Use>);
	};
}

export const procedure = <Use extends Middleware[]>(...middlewares: Use) => {
	return new Procedure(...middlewares);
};
