import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { installExtension } from "../extension/background.mjs";
import { createRepository } from "../src/library.mjs";

function fakeChrome() {
  const event = () => ({
    addListener(listener) {
      this.listener = listener;
    },
  });
  return {
    contextMenus: {
      onClicked: event(),
      removeAll: async () => {},
      create: async () => {},
    },
    commands: { onCommand: event() },
    action: {
      onClicked: event(),
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {},
    },
    scripting: {
      executeScript: async () => {
        throw new Error("PDF cannot be scripted");
      },
    },
    runtime: {
      id: "test",
      onMessage: event(),
      onInstalled: event(),
      onStartup: event(),
      getURL: (path) => "chrome-extension://test/" + path,
    },
    alarms: { onAlarm: event(), create: async () => {} },
    tabs: { create: async () => {}, query: async () => [] },
  };
}

test("PDF collection saves selected text even when content injection is blocked", async () => {
  const repo = createRepository(`pdf-${crypto.randomUUID()}`),
    api = fakeChrome();
  const controller = installExtension(api, repo, async () => {});
  const result = await controller.capture(
    { id: 1, title: "A PDF", url: "https://example.com/paper.pdf#page=3" },
    {
      selectionText: "epistemic",
      pageUrl: "chrome-extension://pdf-viewer/index.html",
    },
  );
  assert.ok(result);
  const [word] = await repo.list();
  assert.equal(word.word, "epistemic");
  assert.equal(word.format, "PDF");
  assert.equal(word.pageNumber, 3);
  assert.equal(word.contextAvailable, false);
  await repo.close();
});

test("all event listeners register synchronously and input fields are not collected", async () => {
  const repo = createRepository(`input-${crypto.randomUUID()}`),
    api = fakeChrome();
  const controller = installExtension(api, repo, async () => {});
  assert.equal(typeof api.contextMenus.onClicked.listener, "function");
  assert.equal(typeof api.alarms.onAlarm.listener, "function");
  assert.equal(
    await controller.capture(
      { id: 1 },
      { editable: true, selectionText: "password" },
    ),
    null,
  );
  assert.equal((await repo.list()).length, 0);
  await repo.close();
});
