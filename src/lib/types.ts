/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestEvent } from '@sveltejs/kit';
import { type Input, type BaseSchema } from 'valibot';

export type StreamsCallbacks<C> = {
	onStart?: () => MaybePromise<void>;
	onChunk?: (onChunk: { chunk: C; first: boolean }) => MaybePromise<void>;
	onEnd?: (chunks: C[]) => MaybePromise<void>;
};
export type PreparedHandler = {
	call: Caller;
	parse: (data: any, raw?: boolean) => MaybePromise<any>;
};
export type Router = {
	[K: string]: PreparedHandler | Router;
};
export type API<R extends Router> = {
	[K in keyof R]: R[K] extends Router
		? APIRoute<R[K]>
		: R[K] extends PreparedHandler
			? PreparedHandlerType<R[K]>
			: never;
};
type Caller = (event: RequestEvent, input: any) => MaybePromise<any>;
type ReturnTypeOfCaller<C extends Caller> =
	Awaited<ReturnType<C>> extends ReadableStream<any> ? never : Promise<Awaited<ReturnType<C>>>;

export type StreamCallback<S = any> = ({ chunk, first }: { chunk: S; first: boolean }) => void;
type APICaller<C extends Caller, I> =
	Awaited<ReturnType<C>> extends ReadableStream<infer S>
		? I extends undefined
			? (callback: StreamCallback<S>) => never
			: (input: I, callback: StreamCallback<S>) => ReturnTypeOfCaller<C>
		: I extends undefined
			? () => ReturnTypeOfCaller<C>
			: (input: I) => ReturnTypeOfCaller<C>;

export type PreparedHandlerType<H extends PreparedHandler> = H['call'] extends (
	...args: infer U
) => MaybePromise<any>
	? APICaller<H['call'], U[1]>
	: never;

export type MaybePromise<T> = T | Promise<T>;
export type APIRoute<R extends Router> = {
	[K in keyof R]: R[K] extends Router
		? APIRoute<R[K]>
		: R[K] extends PreparedHandler
			? PreparedHandlerType<R[K]>
			: never;
};
export type Middleware<T = any> = (event: RequestEvent) => MaybePromise<T>;

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
	S extends BaseSchema | undefined,
	Use extends Middleware[] | undefined
> = (S extends BaseSchema ? { event: RequestEvent; input: Input<S> } : { event: RequestEvent }) & {
	ctx: ReturnOfMiddlewares<Use>;
};

export type HandleFunction<
	S extends BaseSchema | undefined,
	Use extends Middleware[] | undefined
> = (payload: HandlePayload<S, Use>) => MaybePromise<any>;

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
	Procedures<R, P> extends PreparedHandler
		? InferStreamReturnOrJsonReturn<Awaited<ReturnType<Procedures<R, P>['call']>>>
		: Procedures<R, P>;

export type InputOfProcedure<R extends Router, P extends RouterPaths<R>> =
	Procedures<R, P> extends PreparedHandler ? Parameters<Procedures<R, P>['call']>[1] : never;
