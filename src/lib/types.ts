/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestEvent } from '@sveltejs/kit';
import type { BaseSchema as VSchema } from 'valibot';
import type { Schema as ZSchema, infer as ZOutput, input as ZInput } from 'zod';
import type { error } from './error.js';
import type { Handler, stream } from './server.js';

export type Schema = ZSchema | VSchema<any, any, any>;

export type SchemaInput<S extends Schema> = S extends ZSchema
	? ZInput<S>
	: S extends VSchema<infer I, infer O, infer E>
		? I
		: never;

export type SchemaOutput<S extends Schema> = S extends ZSchema
	? ZOutput<S>
	: S extends VSchema<infer I, infer O, infer E>
		? O
		: never;

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

export type API<R extends Router = Router> = {
	[K in keyof R]: R[K] extends Router
		? API<R[K]>
		: R[K] extends Handler<infer M, infer S, infer H>
			? S extends Schema
				? ReturnType<H> extends Promise<ReadableStream<infer C>>
					? (payload: SchemaInput<S>, callback: StreamCallback<C>) => void
					: (payload: SchemaInput<S>) => ReturnType<H>
				: ReturnType<H> extends Promise<ReadableStream<infer C>>
					? (callback: StreamCallback<C>) => void
					: () => ReturnType<H>
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
	S extends Schema | undefined,
	M extends Middleware[] | undefined
> = (S extends Schema
	? { event: RPCRequestEvent; input: SchemaOutput<S> }
	: { event: RPCRequestEvent }) & {
	ctx: ReturnOfMiddlewares<M>;
};

export type HandleFunction<S extends Schema | undefined, M extends Middleware[] | undefined> = (
	payload: HandlePayload<S, M>
) => MaybePromise<any>;

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
