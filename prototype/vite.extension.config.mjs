import { mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import base from "./vite.config.mjs";

export default mergeConfig(base, {
  base: "./",
  build: {
    outDir: "dist/extension",
    rollupOptions: {
      input: {
        notebook: fileURLToPath(new URL("./index.html", import.meta.url)),
        background: fileURLToPath(
          new URL("./extension/background.mjs", import.meta.url),
        ),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background"
            ? "background.js"
            : "assets/[name]-[hash].js",
      },
    },
  },
});
