import { task } from "@trigger.dev/sdk";

// Temporary scaffold-verification task. Replaced by the real portal pipeline
// tasks in Phase 4 (portalLogin / prepareTermSheet / submitTermSheet).
export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { name?: string }) => {
    return { message: `Hello, ${payload.name ?? "world"}!` };
  },
});
