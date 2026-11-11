# Prototype Instructions

## Product decisions

- The user approved the next implementation stage: a loadable Chrome extension with real dictionary lookup and durable local storage. Model integration is explicitly deferred.
- Preserve the selected option 2: top navigation, vocabulary list on the left, contextual detail on the right.
- Use the real `animal-island-ui` package and its Nunito / Noto Sans SC fonts, parchment backgrounds, warm brown text, mint accents, rounded controls, and native tactile buttons.
- Dictionary meanings and AI contextual explanations must remain visibly separate. Never show sample definitions as real results. Keep provider attribution and license metadata with stored dictionary results.
- Collection must not navigate away from reading. Keep pending, failed, and unconfirmed states distinct from dictionary misses.
- Real words and jobs are stored in IndexedDB. Free Dictionary API is primary; network/server errors and invalid responses fall back to Wiktionary. Only selected terms are transmitted, without cookies or reading-page referrers; reading context stays local. Retain the actual provider and its license. No model keys, backend service, or cloud synchronization in this stage.
- Distribute and update the loadable build in `dist/extension`; `extension` contains source files and cannot be loaded directly. Keep the build path stable to preserve the unpacked extension ID and stored vocabulary.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
