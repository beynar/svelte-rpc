// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      api: import("svelte-rpc").API<import("./hooks.server.ts").AppRouter>;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
  type InferRPCReturnType<P extends import("svelte-rpc").RouterPaths<import("./hooks.server.ts").AppRouter>> =
    import("svelte-rpc").ReturnTypeOfProcedure<import("./hooks.server.ts").AppRouter, P>;
  type InferRPCInput<P extends import("svelte-rpc").RouterPaths<import("./hooks.server.ts").AppRouter>> =
    import("svelte-rpc").InputOfProcedure<import("./hooks.server.ts").AppRouter, P>;
}

export {};
