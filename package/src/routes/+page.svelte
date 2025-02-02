<script lang="ts">
	import { api } from './api.js';
	let object = $state({
		date: new Date(),
		test: 'st'
	});
	let { data } = $props();
	console.log(data.result);

	let stringState = $state('');
	let array = $state([
		{
			date: new Date(),
			test: 'st'
		}
	]);
	const test = async () => {
		type ReturnType = InferRPCReturnType<'route'>;
		type Payload = InferRPCInput<'test.test'>;

		const [res, error] = await api.test.test('object');
		if (!error) {
			console.log(res.event);
		}
	};

	const testError = async () => {
		type Chunk = InferRPCReturnType<'ai'>;
		const chunks: Chunk[] = [];
		await api.objectStreaming('tell me a joke', ({ chunk, first }) => {
			console.log(chunk);
		});
		console.log('done');
	};

	const optionnalTest = async () => {
		const res = await api.test.optional(stringState);
		console.log({ res });
	};
	const noPayloadTest = async () => {
		await api.test.noPayload();
	};
	const errorTest = async () => {
		const res = await api.test.errorTest({
			optional: stringState
		});
		console.log(res);
	};
	const platform = async () => {
		const res = await api.test.platform({
			optional: stringState
		});
		console.log(res);
	};
</script>

<button on:click={platform}> platform </button>
<button on:click={optionnalTest}> optionnal test </button>
<button on:click={errorTest}> error test </button>
<button
	on:click={async () => {
		const res = await api.test.object(object);
		const res2 = await api.test.mapAndSet({
			map: new Map([
				[
					'test',
					{
						date: new Date(),
						name: 'test'
					}
				]
			]),
			set: new Set(['test'])
		});
		console.log({ res, res2 });
	}}
>
	object
</button>

<button
	on:click={async () => {
		const res = await api.test.partial({ optional: 'string' });

		console.log({ res });
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
<button on:click={testError}> ai </button>
<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
