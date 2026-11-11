import { test } from "node:test";
import assert from "node:assert/strict";
import { filterWords } from "../src/data.mjs";
const base = {
  due: true,
  status: "ready",
  mastered: false,
  dictionaryState: "matched",
  meaning: "a subtle difference",
  source: "Reading notes",
  sourceId: "first",
};
const words = [
  {
    ...base,
    id: "nuance",
    word: "nuance",
    occurrences: [{ sourceId: "first" }, { sourceId: "second" }],
  },
  { ...base, id: "pending", word: "epistemic", status: "pending" },
  { ...base, id: "failed", word: "hello", status: "failed" },
  { ...base, id: "candidate", word: "RAG", dictionaryState: "candidate" },
];
test("due review excludes unfinished jobs and unconfirmed acronym meanings", () => {
  assert.deepEqual(
    filterWords(words, { filter: "due" }).map((word) => word.id),
    ["nuance"],
  );
});
test("search is case insensitive and trims surrounding whitespace", () => {
  assert.deepEqual(
    filterWords(words, { query: " NUANCE " }).map((word) => word.id),
    ["nuance"],
  );
  assert.equal(filterWords(words, { filter: "pending" })[0].id, "pending");
  assert.equal(filterWords(words, { filter: "failed" })[0].id, "failed");
});
test("source filtering includes earlier reading occurrences", () => {
  assert.deepEqual(
    filterWords(words, { sourceId: "second" }).map((word) => word.id),
    ["nuance"],
  );
});
