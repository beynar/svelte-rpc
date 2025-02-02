import type { RequestEvent } from '@sveltejs/kit';
import type { error } from './error.js';
import type { Handler, stream } from './server.js';
import type { StandardSchemaV1 } from './standardSchema.js';

export type StreamsCallbacks<C> = {
	onStart?: () => MaybePromise<void>;
	onChunk?: (onChunk: { chunk: C; first: boolean }) => MaybePromise<void>;
	onEnd?: (chunks: C[]) => MaybePromise<void>;
};

export type Router = {
	[K: string]: Handler<any, any, any> | Router;
};

export type AnyHandler = {
	call: (event: any, input: any) => MaybePromise<any>;
	parse: (data: any) => MaybePromise<any>;
};

type Streamed<T> = ReadableStream<T> | AsyncIterable<T>;
type ApiResult<T> = Promise<[Awaited<T>, null] | [null, object]>;

export type API<R extends Router = Router> = {
	[K in keyof R]: R[K] extends Router
		? API<R[K]>
		: R[K] extends Handler<infer M, infer S, infer H>
			? S extends StandardSchemaV1
				? ReturnType<H> extends Promise<Streamed<infer C>>
					? (payload: StandardSchemaV1.InferInput<S>, callback: StreamCallback<C>) => void
					: (payload: StandardSchemaV1.InferInput<S>) => Promise<ApiResult<ReturnType<H>>>
				: ReturnType<H> extends Promise<Streamed<infer C>>
					? (callback: StreamCallback<C>) => void
					: () => Promise<ApiResult<ReturnType<H>>>
			: never;
};

export type StreamCallback<S = any> = ({ chunk, first }: { chunk: S; first: boolean }) => void;

export type MaybePromise<T> = T | Promise<T>;

export type Middleware<T = any> = (event: RPCRequestEvent) => MaybePromise<T>;

export type ReturnOfMiddlewares<
	Use extends Middleware[] | undefined,
	PreviousData = unknown
> = Use extends Middleware[]
	? Use extends [infer Head, ...infer Tail]
		? Head extends Middleware<infer HeadData>
			? Tail extends Middleware[]
				? PreviousData & HeadData & ReturnOfMiddlewares<Tail, PreviousData & HeadData>
				: HeadData & PreviousData
			: PreviousData
		: unknown
	: unknown;

export type HandlePayload<
	S extends StandardSchemaV1 | undefined,
	M extends Middleware[] | undefined
> = (S extends StandardSchemaV1
	? { event: RPCRequestEvent; input: StandardSchemaV1.InferOutput<S> }
	: { event: RPCRequestEvent }) & {
	ctx: ReturnOfMiddlewares<M>;
};

export type HandleFunction<
	S extends StandardSchemaV1 | undefined,
	M extends Middleware[] | undefined
> = (payload: HandlePayload<S, M>) => MaybePromise<any>;

export type RouterPaths<R extends Router, P extends string = ''> = {
	[K in keyof R]: R[K] extends Router
		? P extends ''
			? RouterPaths<R[K], `${string & K}`>
			: RouterPaths<R[K], `${P}.${string & K}`>
		: P extends ''
			? `${string & K}`
			: `${P}.${string & K}`;
}[keyof R];

type Get<T, K extends string> = K extends `${infer P}.${infer Rest}`
	? P extends keyof T
		? Get<T[P], Rest>
		: never
	: K extends keyof T
		? T[K]
		: never;

type Procedures<R extends Router, P extends RouterPaths<R>> = Get<R, P>;

type InferStreamReturnOrJsonReturn<T> = T extends ReadableStream<infer U> ? U : T;

export type ReturnTypeOfProcedure<R extends Router, P extends RouterPaths<R>> =
	Procedures<R, P> extends AnyHandler
		? InferStreamReturnOrJsonReturn<Awaited<ReturnType<Procedures<R, P>['call']>>>
		: Procedures<R, P>;

export type InputOfProcedure<R extends Router, P extends RouterPaths<R>> =
	Procedures<R, P> extends AnyHandler ? Parameters<Procedures<R, P>['call']>[1] : never;

export type RPCRequestEvent = RequestEvent & { error: typeof error; stream: typeof stream };

export type InferInputAtPath<R extends Router, P extends RouterPaths<R>> =
	Get<R, P> extends Handler<any, infer S, any>
		? S extends StandardSchemaV1
			? StandardSchemaV1.InferInput<S>
			: never
		: never;

export type InferOutPutAtPath<R extends Router, P extends RouterPaths<R>> =
	Get<R, P> extends Handler<infer M, infer S, infer H>
		? H extends HandleFunction<S, infer M>
			? Awaited<ReturnType<H>>
			: never
		: never;

export type InferApiTypes<R> = R extends Router
	? {
			[K in RouterPaths<R>]: {
				input: InferInputAtPath<R, K>;
				output: InferOutPutAtPath<R, K>;
			};
		}
	: never;
