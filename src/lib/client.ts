import { objectToFormData } from './utils.js';
import type { API, MaybePromise, Router } from './types.js';

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
		onError = () => {}
	}: {
		endpoint?: `/${string}`;
		headers?: HeadersInit | ((path: string) => MaybePromise<HeadersInit>);
		onError?: (error: App.Error) => void;
	} = {
		endpoint: '/api',
		onError: () => {}
	}
) => {
	return createRecursiveProxy(async (opts) => {
		return fetch(`${endpoint}/${opts.path.join('/')}`, {
			method: 'POST',
			body: objectToFormData(opts.args[0]),
			headers: typeof headers === 'function' ? await headers(opts.path.join('/')) : headers
		}).then(async (res) => {
			const result = await res.json();
			if (res.ok) {
				return result;
			} else {
				onError(result as App.Error);
			}
		});
	}, []) as API<R>;
};
