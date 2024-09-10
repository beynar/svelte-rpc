import { tryParse } from './utils.js';
import type { API, MaybePromise, Router, StreamCallback } from './types.js';
import { deform, form } from './deform.js';

export const createRecursiveProxy = (
	callback: (opts: { path: string[]; args: unknown[] }) => unknown,
	path: string[]
) => {
	const proxy: unknown = new Proxy(
		() => {
			//
		},
		{
			get(_obj, key) {
				if (typeof key !== 'string') return undefined;
				return createRecursiveProxy(callback, [...path, key]);
			},
			apply(_1, _2, args) {
				return callback({
					path,
					args
				});
			}
		}
	);
	return proxy;
};

export const createRPCClient = <R extends Router>(
	{
		endpoint = '/api',
		headers,
		throwOnError = false,
		onError
	}: {
		endpoint?: `/${string}`;
		throwOnError?: boolean;
		headers?:
			| HeadersInit
			| (<I = unknown>({ path, input }: { path: string; input: I }) => MaybePromise<HeadersInit>);
		onError?: (payload: {
			error: {
				error: string;
				message: string;
				status: number;
				statusText: string;
			};
			response: Response;
		}) => void;
	} = {
		endpoint: '/api'
	}
) => {
	return createRecursiveProxy(async ({ path, args }) => {
		return fetch(`${endpoint}/${path.join('/')}`, {
			method: 'POST',
			body: form(args[0]),
			headers: Object.assign(
				{
					'x-svelte-rpc-client': 'true'
				},
				typeof headers === 'function'
					? await headers({
							path: path.join('/'),
							input: args[0]
						})
					: headers
			)
		}).then(async (res) => {
			if (!res.ok) {
				const error = {
					// @ts-ignore
					...(await res.clone().json()),
					status: res.status,
					statusText: res.statusText
				};
				onError?.({ error, response: res.clone() });
				if (throwOnError) {
					throw new Error(res.statusText);
				} else {
					return [null, error];
				}
			} else {
				if (res.headers.get('content-type') === 'text/event-stream') {
					const reader = res.body!.getReader();
					const decoder = new TextDecoder();
					let buffer = '';
					let first = true;
					const callback = (chunk: string, done: boolean) => {
						if (done) {
							return;
						}
						const lines = (buffer + chunk).split('\n');
						buffer = lines.pop()!;
						lines.forEach((line, i) => {
							if (first && i === 0 && line === '') {
								return;
							}
							(args[1] as StreamCallback)({
								chunk: tryParse(line),
								first
							});
							first = false;
						});
					};
					// eslint-disable-next-line no-constant-condition
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							break;
						}
						callback(decoder.decode(value), done);
					}
				} else if (res.headers.get('content-type')?.includes('multipart/form-data')) {
					return [deform((await res.formData()) as FormData), null];
				}
			}
		});
	}, []) as API<R>;
};
