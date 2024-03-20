<script lang="ts">
  import { api } from './api.js';
  const test = async () => {
    type ReturnType = InferRPCReturnType<'route'>;
    type Payload = InferRPCInput<'test.test2'>;
    const res = await api.test.test('').then((res) => {
      console.log(res.data);
      return res;
    });
  };

  const testError = async () => {
    await api.ai('tell me a joke', ({ chunk, first }) => {
      console.log(chunk.choices[0].delta.content, first);
    });
    console.log('done');
  };
</script>

<button on:click={test}> test </button>
<button on:click={testError}> testError </button>
<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
