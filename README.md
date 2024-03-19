# svelte-rpc

Simple end-to-end type safety for SvelteKit.
Lightweight and simpler alternative to TRPC.

## Why ?

I needed to stay inside the SvelteKit realm to use cookies.set and other shenanigans inside my procedures and I also needed to handle file uploads. I also wanted the same DX and type safety as TRPC. So I created svelte-rpc.

## Benefits

- Same type safety as TRPC
- Familiar syntax to define procedures
- Simpler api (no .mutate, .query) just call the procedure itself
- Ability to handle file uploads
- Very tiny
- You stay in the SvelteKit realm, so you can use cookies, error and other server side stuff of SvelteKit
- Simple to implement: a hook, a router and a client that infer its type from the router
- Infinite and simple nesting of procedures
- Can be called from server side thanks to the caller function placed inside your locals object
- Middleware support that populate the ctx object received by the handle function

## Drawbacks

- Only use FormData and Post request
- No subscriptions
- Only works with Valibot (for now ?)

## Install

```bash
npm install svelte-rpc valibot
```

```bash
yarn add svelte-rpc valibot
```

```bash
pnpm add svelte-rpc valibot
```

```bash
bun install svelte-rpc valibot
```

## Usage

### Define the router and create the hook

```ts
// src/hooks.server.ts
import { type Router, createApiHandle, procedure } from 'svelte-rpc';
import { object, string } from 'valibot';
import { string } from 'valibot';

const router = {
	test: procedure((event) => {
		// This is a middleware it will be called before the handle function
		// Middlewares can be async or sync and are called in the order they are defined in the procedure,
		// You can add as many middlewares as you want in the parameters of the procedure function
		if (!event.locals.user) {
			error(401, 'You must be logged in to use this procedure');
		}
		// The return of the middleware will be available in the ctx object of the handle function
		return { user: event.locals.user };
	})
		.input(
			object({
				name: string()
			})
		)
		.handle(async ({ event, input, ctx }) => {
			// event is the request event of SvleteKit
			// ctx.user contains the user object
			// input is of type { name: string }
			return {
				hello: input.name
			};
		})
} satisfies Router;

export type AppRouter = typeof router;

export const handle = createApiHandle({
	router,
	// The endoint where all of the procedures will be available
	// Pass false to make it server only
	endpoint: '/api',
	// The key to put the server side api caller inside the event.locals object
	localsApiKey: 'api'
});
```

### Create the api client

```ts
// src/lib/api.ts
import { createApiClient } from 'svelte-rpc/client';
import type { AppRouter } from '../hooks.server';

export const api = createApiClient<AppRouter>({
	// The endpoint to make the request to, must be the same as the server
	endpoint: '/api',
	// The headers to send with the request
	headers: {},
	// Called when the request fails
	onError: (error) => {
		console.error(error);
	}
});
```

### Call the api

```svelte
<script lang="ts">
	// src/routes/+page.svelte
	import { api } from '$lib/api';
	import { onMount } from 'svelte';

	onMount(async () => {
		const result = await api.test({ name: 'world' });
		console.log(result);
		// result is of type { hello: string }
	});
</script>
```

### Helpers

#### Type inference

Svelte-rpc exports two inference helpers to help you infer the type of the input and output of a procedure.
I usually prefer to let them globally available in my project using the app.d.ts file.

```ts
// app.d.ts
declare global {
	namespace App {
		interface Locals {
			// This is the server side caller
			api: import('svelte-rpc').API<import('./hooks.server').AppRouter>;
			//... other stuff of yours
		}
		//... Name it like you want
		type InferRPCReturnType<
			P extends import('svelte-rpc').RouterPaths<import('./hooks.server.js').AppRouter>
		> = import('svelte-rpc').ReturnTypeOfProcedure<import('./hooks.server.js').AppRouter, P>;

		//... Name it like you want
		type InferRPCInput<
			P extends import('svelte-rpc').RouterPaths<import('./hooks.server.js').AppRouter>
		> = import('svelte-rpc').InputOfProcedure<import('./hooks.server.js').AppRouter, P>;
	}
	//... other stuff of yours
}
export {};
```

```svelte
<script lang="ts">
	export let result: App.InferRPCReturnType<'test'>;
	// let { result }: { result: App.InferRPCReturnType<'test'> } = $props(); // If you are using svelte 5
	// result is of type { hello: string }
</script>
```

#### File schema

Svelte-rpc exports a file schema to handle file uploads. It is a simple wrapper around valibot

```ts
import { file } from 'svelte-rpc';

const imageSchema = file({
	mimeType: ['image/png', 'image/jpeg'],
	maxSize: 1024 * 1024 * 5
});
```
