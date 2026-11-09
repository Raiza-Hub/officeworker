import { defineConfig } from "@trigger.dev/sdk";
import { lightpanda } from "@trigger.dev/build/extensions/lightpanda";

export default defineConfig({
  project: "proj_fjsxefrfjlabgkpolvch",
  dirs: ["./trigger"],
  machine: "micro",
  maxDuration: 600,
  build: {
    extensions: [lightpanda({ version: "latest" })],
  },
});
