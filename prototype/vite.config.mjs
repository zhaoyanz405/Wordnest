import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { DICTIONARY_ENDPOINT, WIKTIONARY_ENDPOINT } from "./src/dictionary.mjs";

function dictionaryPreviewProxy() {
  return {
    name: "dictionary-preview-proxy",
    configureServer(server) {
      for (const [route, endpoint] of [
        ["/dictionary-api/", DICTIONARY_ENDPOINT],
        ["/wiktionary-api/", WIKTIONARY_ENDPOINT],
      ]) server.middlewares.use(route, async (request, response) => {
        if (request.method !== "GET") {
          response.writeHead(405).end();
          return;
        }
        let word;
        try {
          word = decodeURIComponent(request.url.slice(1));
        } catch {
          response.writeHead(400).end();
          return;
        }
        if (
          !word ||
          word.length > 100 ||
          !/^[\p{L}\p{N} .’'\-–]+$/u.test(word)
        ) {
          response.writeHead(400).end();
          return;
        }
        try {
          const upstream = await fetch(
            endpoint + encodeURIComponent(word),
            {
              headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(10_000),
            },
          );
          const body = await upstream.text();
          response.writeHead(upstream.status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          });
          response.end(body);
        } catch {
          response
            .writeHead(502, { "Content-Type": "application/json" })
            .end('{"error":"Dictionary unavailable"}');
        }
      });
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), dictionaryPreviewProxy()],
});
