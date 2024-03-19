/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RequestEvent, type Handle as SvelteKitHandle, json, error } from '@sveltejs/kit';
import { type Input, type BaseSchema, parse, ValiError } from 'valibot';
import { formDataToObject, file } from './utils.js';

import type {
	API,
	HandleFunction,
	HandlePayload,
	Middleware,
	PreparedHandler,
	ReturnOfMiddlewares,
	Router
} from './types.js';
import { createRecursiveProxy } from './client.js';

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

const createCaller = <R extends Router>(router: R, event: RequestEvent) => {
	return createRecursiveProxy(async (opts) => {
		const {
			path,
			args: [data]
		} = opts;
		const handler = getHandler(router, path);
		const parsedData = await handler.parse(data, true);
		return handler.call(event, parsedData);
	}, []) as API<R>;
};

export const createRPCHandle = <R extends Router>({
	router,
	endpoint = '/api',
	localsApiKey = 'api'
}: {
	router: R;
	endpoint?: `/${string}` | false;
	localsApiKey?: string;
}): SvelteKitHandle => {
	return async ({ event, resolve }) => {
		Object.assign(event.locals, { [localsApiKey]: createCaller(router, event) });
		console.log({ endpoint });
		if (endpoint && event.url.pathname.startsWith(endpoint)) {
			const handler = getHandler(
				router,
				event.url.pathname.split('/').slice(endpoint.split('/').length)
			);
			const data = await handler.parse(await event.request.clone().formData());
			const result = await handler.call(event, data);
			return json(result);
		}

		return resolve(event);
	};
};

class Procedure<Use extends Middleware[]> {
	#middlewares: Use;
	#createHandler =
		<S extends BaseSchema | undefined>(schema: S) =>
		<H extends HandleFunction<S, Use>>(handler: H) => {
			return new Handler(handler, schema, this.#middlewares);
		};
	constructor(...middlewares: Use) {
		this.#middlewares = middlewares;
	}
	input = <S extends BaseSchema>(schema: S) => {
		return {
			handle: this.#createHandler(schema)
		};
	};
	handle = this.#createHandler(undefined);
}

export class Handler<
	S extends BaseSchema | undefined,
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
	parse = (data: any, raw?: boolean) => {
		if (!this.#schema) {
			return undefined;
		}
		try {
			return parse(this.#schema, raw ? data : formDataToObject(data));
		} catch (e) {
			if (e instanceof ValiError) {
				return error(
					400,
					`${e.issues.map((issue) => `${issue.message} at: ${issue.path?.map((p) => p.key).join('.')}`).join('\n')}`
				);
			}
		}
	};

	#useMiddlewares = async (event: RequestEvent): Promise<ReturnOfMiddlewares<Use>> => {
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
		input: S extends BaseSchema ? Input<S> : undefined
	): Promise<ReturnType<H>> => {
		const ctx = await this.#useMiddlewares(event);
		const payload = { event, input, ctx } as HandlePayload<any, any>;
		return this.#handler(payload as HandlePayload<S, Use>);
	};
}

export const procedure = <Use extends Middleware[]>(...middlewares: Use) => {
	return new Procedure(...middlewares);
};
export { file };
