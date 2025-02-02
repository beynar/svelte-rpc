import { createRPCClient } from "svelte-rpc/client";
import type { InferApiTypes } from "svelte-rpc";
import type { AppRouter } from "../../../demo/src/hooks.server.js";

export const api = createRPCClient<AppRouter>({
  onError: (error: any) => {
    console.log(error);
  }
});

export type API = InferApiTypes<AppRouter>;
