<script lang="ts">
  import { api } from "./api.js";
  let object = $state({
    date: new Date(),
    test: "st"
  });
  let { data } = $props();
  console.log(data.result);

  let stringState = $state({
    string: "hello"
  });
  let array = $state([
    {
      date: new Date(),
      test: "st"
    }
  ]);

  const objectStreaming = async () => {
    await api.objectStreaming("tell me a joke", ({ chunk }) => {
      console.log({ chunk });
    });
    console.log("done");
  };
  const textStreaming = async () => {
    await api.textStreaming("tell me a joke", ({ chunk }) => {
      console.log({ chunk });
    });
    console.log("done");
  };

  const optionnalTest = async () => {
    const [res, error] = await api.test.optional(stringState);
    if (!error) {
      console.log({ res });
    } else {
      console.log({ res, error });
    }
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
  const arktype = async () => {
    const res = await api.arktype({
      test: "hello"
    });
    console.log(res);
  };
</script>

<button onclick={arktype}> arktype </button>
<button onclick={platform}> platform </button>
<button onclick={optionnalTest}> optionnal test </button>
<button onclick={errorTest}> error test </button>
<button
  onclick={async () => {
    const res = await api.test.object(object);
    const res2 = await api.test.mapAndSet({
      map: new Map([
        [
          "test",
          {
            date: new Date(),
            name: "test"
          }
        ]
      ]),
      set: new Set(["test"])
    });
    console.log({ res, res2 });
  }}
>
  object
</button>

<button
  onclick={async () => {
    const res = await api.test.partial({ optional: "string" });

    console.log({ res });
  }}
>
  object streaming
</button>
<button
  onclick={async () => {
    const [res] = await api.test.array(array);
    console.log(res);
  }}
>
  array
</button>
<button onclick={objectStreaming}> object streaming </button>
<button onclick={textStreaming}> text streaming </button>

<style>
  button {
    @apply bg-blue-500 text-white px-4 py-2 rounded-md;
  }
</style>
