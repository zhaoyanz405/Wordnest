import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCapture,
  createRepository,
  createRunner,
} from "../src/library.mjs";

const makeRepo = () => createRepository(`test-${crypto.randomUUID()}`);

test("captures commit before lookup, concurrent captures merge without losing contexts", async () => {
  const repo = makeRepo();
  const results = await Promise.all([
    repo.capture({
      word: "nuance",
      sentence: "A nuance in her tone.",
      sourceUrl: "https://example.com/a",
    }),
    repo.capture({
      word: "Nuance",
      sentence: "A second nuance.",
      sourceUrl: "https://example.com/b",
    }),
  ]);
  assert.equal(results.filter((result) => result.duplicate).length, 1);
  const words = await repo.list();
  assert.equal(words.length, 1);
  assert.equal(words[0].status, "pending");
  assert.equal(words[0].encounters, 2);
  assert.equal(words[0].occurrences.length, 2);
  await repo.close();
  assert.equal(words[0].meaning, "");
});

test("reopening the database retains captures, bookmarks, and review flags", async () => {
  const name = `durable-${crypto.randomUUID()}`,
    repo = createRepository(name);
  const { word } = await repo.capture({ word: "underscore" });
  await repo.setFlags(word.id, {
    bookmarked: true,
    mastered: true,
    due: false,
    dictionary: "not allowed",
  });
  await repo.close();
  const reopened = createRepository(name),
    [saved] = await reopened.list();
  assert.equal(saved.bookmarked, true);
  assert.equal(saved.mastered, true);
  assert.equal(saved.due, false);
  assert.equal(saved.dictionary, "");
  await reopened.close();
});

test("job lease survives a stopped worker and concurrent runners cannot take the same job", async () => {
  const repo = makeRepo();
  await repo.capture({ word: "resilient" });
  const now = Date.now();
  const jobs = await Promise.all([repo.takeJob(now), repo.takeJob(now)]);
  assert.equal(jobs.filter(Boolean).length, 1);
  assert.equal(await repo.takeJob(now + 59_000), null);
  assert.equal((await repo.takeJob(now + 60_001)).attempts, 2);
  await repo.close();
});

test("failed requests retain context and retry with backoff, a later success preserves user flags", async () => {
  const repo = makeRepo();
  const { word } = await repo.capture({
    word: "nuance",
    sentence: "A nuance in her tone.",
  });
  await createRunner(repo, async () => {
    throw new Error("network unavailable");
  })();
  let saved = (await repo.list())[0];
  assert.equal(saved.status, "failed");
  assert.equal(saved.sentence, "A nuance in her tone.");
  assert.ok(saved.nextRetryAt > Date.now());
  await repo.setFlags(word.id, { bookmarked: true });
  await repo.retry(word.id);
  await createRunner(repo, async () => ({
    status: "ready",
    meaning: "a subtle difference",
  }))();
  saved = (await repo.list())[0];
  assert.equal(saved.bookmarked, true);
  assert.equal(saved.meaning, "a subtle difference");
  assert.equal(saved.status, "ready");
  await repo.close();
});

test("capture validation prevents oversized payloads and dangerous URLs, preserves acronym distinctions", () => {
  assert.equal(cleanCapture({ word: "café" }).word, "café");
  assert.throws(() => cleanCapture({ word: "x".repeat(101) }));
  assert.throws(() => cleanCapture({ word: "<script>" }));
  assert.equal(
    cleanCapture({ word: "hello", sourceUrl: "javascript:alert(1)" }).sourceUrl,
    "",
  );
  assert.notEqual(
    cleanCapture({ word: "RAG" }).id,
    cleanCapture({ word: "rag" }).id,
  );
  assert.equal(
    cleanCapture({ word: "test", sourceUrl: "file:///tmp/read.pdf#page=3" })
      .format,
    "PDF",
  );
});

test("an older failed lookup cannot overwrite the result of a manual retry", async () => {
  const repo = makeRepo();
  const { word } = await repo.capture({ word: "nuance" });
  const oldJob = await repo.takeJob();
  await repo.retry(word.id);
  const newJob = await repo.takeJob();
  await repo.complete(
    word.id,
    { status: "ready", meaning: "a subtle difference" },
    newJob.jobToken,
  );
  await repo.fail(word.id, new Error("stale timeout"), oldJob.jobToken);
  assert.equal((await repo.list())[0].status, "ready");
  await repo.close();
});
