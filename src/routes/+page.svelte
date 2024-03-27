<script lang="ts">
	import { api } from './api.js';
	let st = $state('ee');
	let object = $state({
		image: new Date(),
		test: 'st'
	});
	let array = $state([
		{
			image: new Date(),
			test: 'st'
		}
	]);
	const test = async () => {
		type ReturnType = InferRPCReturnType<'route'>;
		type Payload = InferRPCInput<'test.test2'>;

		const res = await api.test.test2(object).then((res) => {
			console.log(res);
			return res;
		});
	};

	const testError = async () => {
		type Chunk = InferRPCReturnType<'ai'>;
		const chunks: Chunk[] = [];
		await api.ai('tell me a joke', ({ chunk, first }) => {
			console.log(chunk.choices[0].delta.content, first);
		});
		console.log('done');
	};
</script>

{object.test}
<button
	on:click={async () => {
		const res = await api.test.object(object);
		console.log(res);
	}}
>
	object
</button>
<button
	on:click={async () => {
		const res = await api.test.array(array);
		console.log(res);
	}}
>
	array
</button>
<button on:click={testError}> testError </button>
<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
