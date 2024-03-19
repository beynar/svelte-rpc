<script lang="ts">
	import { api } from './api.js';
	export let data;
	const test = async () => {
		type ReturnType = InferRPCReturnType<'test.test'>;
		type Payload = InferRPCInput<'test.test2'>;
		const res = await api.test.test();
		console.log(res);
	};

	const testError = async () => {
		type ReturnType = InferRPCReturnType<'test.test'>;
		type Payload = InferRPCInput<'test.test2'>;
		const res = await api.test.test2({
			test: 'true',
			image: 'true'
		});
	};
</script>

<button on:click={test}> test </button>
<button on:click={testError}> testError </button>
<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
