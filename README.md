# svelte-prc

Simple end-to-end type safety for SvelteKit.
Lightweight and simpler alternative to TRPC.

## Benefits

- Same type safety as TRPC
- Familiar syntax to define procedures
- Simpler api (no .mutate, .query) just call the procedure itself
- Only use FormData and Post request
- Ability to handle file uploads
- Very tiny
- You stay in the SvelteKit real, so you can use cookies, error and other server side stuff of SvelteKit
- Simple to implement: a hook, a router and a client that infer its type from the router type
- Infinite nested procedures
- Can be called from the server side thanks to the caller function
- Middleware support that populate the ctx object received by the handle function

## Drawbacks

- Only use FormData and Post request ?
- No subscriptions
- Only works with Valibot (for now ?)

## Install

```bash
npm install svelte-prc valibot
```

```bash
yarn add svelte-prc valibot
```

```bash
pnpm add svelte-prc valibot
```

```bash
bun install svelte-prc valibot
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
		// This is a middleware, it will be called before the handle function
		if (!event.locals.user) {
			error('You must be logged in to use this procedure');
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
