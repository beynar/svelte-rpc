# svelte-rpc

Simple end-to-end type safety for SvelteKit.
Lightweight and simpler alternative to [TRPC](https://github.com/trpc/trpc).

## Why ?

I needed to stay inside the SvelteKit realm to use cookies.set and other shenanigans inside my procedures, to handle file uploads and a typesafe way to receive streamed response from AI models. But I wanted the same DX and type safety as TRPC. So I created svelte-rpc.

## Benefits

- Same type safety as TRPC
- Familiar syntax to define procedures
- Simpler api (no .mutate, .query) just call the procedure itself
- Ability to handle file uploads
- Type safe streamed response
- Very tiny
- You stay in the SvelteKit realm, so you can use cookies, error and other server side stuff of SvelteKit
- Simple to implement: a hook, a router and a client that infer its type from the router
- Infinite and simple nesting of procedures
- Can be called from server side thanks to the caller function placed inside your locals object
- Middleware support that populate the ctx object received by the handle function

## Caveats

- Only POST request and FormData (don't worry, you still use plain javascript object, svelte-rpc will handle the conversion under the hood)
- No subscriptions
- Only works with [Valibot](https://github.com/fabian-hiller/valibot) to handle schema validation (for now ?)

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
import { type Router, createRPCHandle, procedure } from 'svelte-rpc';
import { object, string } from 'valibot';
import { string } from 'valibot';

const router = {
  test: procedure((event) => {
    // This is a middleware it will be called before the handle function
    // Middlewares can be async or sync and are called in parallel,
    // You can add as many middlewares as you want as arguments of the procedure function
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
      // event is the request event of SvelteKit
      // ctx.user contains the user object
      // input is of type { name: string }
      return {
        hello: input.name
      };
    })
} satisfies Router;

export type AppRouter = typeof router;

export const handle = createRPCHandle({
  router,
  // The endoint where all of the procedures will be available
  // Pass false to make it server only
  endpoint: '/api',
  // The key to put the server side api caller inside the event.locals object
  // Pass false to disable the server side caller
  localsApiKey: 'api'
});
```

### Create the api client

```ts
// src/lib/api.ts
import { createRPCClient } from 'svelte-rpc/client';
import type { AppRouter } from '../hooks.server';

export const api = createRPCClient<AppRouter>({
  // The endpoint to make the request to, must be the same as defined in the createRPCHandle function
  endpoint: '/api',
  // The headers to send with the request
  // You can also pass a function that will be called before the fetch request, the can be async and receive the input and the path of the procedure
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

### Streamed response

Svelte-rpc can handle streamed response from the server. This is useful when you want to stream the response of an AI model for example. The only difference is that you need to pass a callback to the api function that will be called each time a chunk of the response is received.

On the server, when defining your procedure you can either return a ReadableStream or use the stream helper.

The stream helper is useful when you want to handle the stream response lifecycle by adding callbacks to the onChunk, onEnd and onStart events.

```ts
// src/routers/ai.ts
import { type Router, procedure, stream } from 'svelte-rpc';
import { createRPCClient } from 'svelte-rpc/client';
import { string } from 'valibot';
import OpenAI from 'openai';
import { PRIVATE_OPEN_API_KEY } from '$env/static/private';
const openai = new OpenAI({
  apiKey: PRIVATE_OPEN_API_KEY
});

export const aiRouter = {
  chat: procedure()
    .input(string())
    .handle(async ({ input }) => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          { role: 'user', content: input }
        ],
        stream: true
      });
      return completion.toReadableStream() as ReadableStream<OpenAI.ChatCompletionChunk>;
    }),
  chatWithStreamHelper: procedure()
    .input(string())
    .handle(async ({ input }) => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          { role: 'user', content: input }
        ],
        stream: true
      });
      return stream<OpenAI.ChatCompletionChunk>(completion.toReadableStream(), {
        onStart: () => {
          console.log('AI stream started');
        },
        onChunk: ({ chunk, first }) => {
          console.log('AI chunk received', chunk, first);
        },
        onEnd: (chunks) => {
          console.log('AI stream ended', chunks);
        }
      });
    })
} satisfies Router;
```

```svelte
<script lang="ts">
  // src/routes/+page.svelte
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  const callAi = async () => {
    await api.chat('Tell me a joke', ({ chunk, first }) => {
      console.log(chunk.choices[0].delta.content, first);
      // Chunk is type safe
      // chunk.choices[0].delta.content is of type string | undefined
    });
    console.log('Done');
  };
</script>
```

### Helpers

#### Type inference

Svelte-rpc exports two inference helpers to help you infer the type of the input and output of a procedure.
I usually prefer to let them globally available in my project using the app.d.ts file.

It is a bit cumbersome, just copy paste it and change the path of the file where the AppRouter is defined if needed.

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
