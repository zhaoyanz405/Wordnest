import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DICTIONARY_ENDPOINT,
  WIKTIONARY_ENDPOINT,
  lookupDictionary,
  parseDictionary,
  parseWiktionary,
} from "../src/dictionary.mjs";
import { readFile } from "node:fs/promises";

const entry = {
  word: "rag",
  license: {
    name: "CC BY-SA 3.0",
    url: "https://creativecommons.org/licenses/by-sa/3.0",
  },
  sourceUrls: ["https://en.wiktionary.org/wiki/rag", "javascript:alert(1)"],
  phonetics: [{ text: "/ræɡ/" }],
  meanings: [
    {
      partOfSpeech: "noun",
      definitions: [
        {
          definition: "a piece of old cloth",
          example: "Use a rag to wipe it.",
        },
      ],
    },
    { partOfSpeech: "verb", definitions: [{ definition: "to tease" }] },
  ],
};

const wikiEntry = {
  en: [{
    partOfSpeech: "Noun",
    definitions: [{
      definition: 'A <a href="/wiki/piece">piece</a> of old cloth &amp; fabric.<sup class="reference">[1]</sup>',
      examples: ["Use a <b>rag</b> to wipe it."],
    }, {
      definition: '<span class="mw-cite-backlink"><a>↑</a></span> <span class="mw-reference-text"><span>Reference, not a word meaning.</span></span>',
    }],
  }],
  fr: [{ definitions: [{ definition: "This is not an English definition." }] }],
};

const ok = (data) => ({ status: 200, ok: true, json: async () => data });

test("a primary 502 switches to Wiktionary, retaining real definitions, examples and attribution", async () => {
  const calls = [];
  const result = await lookupDictionary("Rag", async (url, options) => {
    calls.push({ url, options });
    return url.startsWith(DICTIONARY_ENDPOINT)
      ? { status: 502, ok: false }
      : ok(wikiEntry);
  });
  assert.deepEqual(calls.map(({ url }) => url), [DICTIONARY_ENDPOINT + "Rag", WIKTIONARY_ENDPOINT + "rag"]);
  assert.equal(result.status, "ready");
  assert.equal(result.dictionaryProvider, "Wiktionary");
  assert.equal(result.meaning, "A piece of old cloth & fabric.");
  assert.equal(result.example, "Use a rag to wipe it.");
  assert.equal(result.dictionarySenses.length, 1);
  assert.deepEqual(result.dictionarySources, ["https://en.wiktionary.org/wiki/rag#English"]);
  assert.equal(result.dictionaryLicenses[0].name, "CC BY-SA 4.0");
  assert.equal(result.context, "");
  assert.equal(result.ipa, "");
  for (const { options } of calls) {
    assert.equal(options.body, undefined);
    assert.equal(options.credentials, "omit");
    assert.equal(options.referrerPolicy, "no-referrer");
  }
});

test("network errors, timeouts, invalid JSON and invalid primary responses also use the fallback", async () => {
  for (const primary of [
    async () => { throw new TypeError("Failed to fetch"); },
    async () => { throw new DOMException("timeout", "TimeoutError"); },
    async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError(); } }),
    async () => ok(null),
    async () => ok([]),
  ]) {
    const result = await lookupDictionary("rag", (url) =>
      url.startsWith(DICTIONARY_ENDPOINT) ? primary() : ok(wikiEntry));
    assert.equal(result.dictionaryProvider, "Wiktionary");
    assert.equal(result.status, "ready");
  }
});

test("a fallback miss after a primary failure stays retryable and does not masquerade as an unlisted word", async () => {
  await assert.rejects(lookupDictionary("unknown", async (url) => ({
    status: url.startsWith(DICTIONARY_ENDPOINT) ? 502 : 404,
    ok: false,
  })), /主词典：.*502.*备用词典：.*尚未恢复/);
  await assert.rejects(lookupDictionary("unknown", async () => ({ status: 503, ok: false })), /主词典：.*503.*备用词典：.*503/);
});

test("successful primary lookups and genuine 404s do not request a second dictionary", async () => {
  for (const response of [ok([entry]), { status: 404, ok: false }]) {
    let calls = 0;
    const result = await lookupDictionary("rag", async () => { calls++; return response; });
    assert.equal(calls, 1);
    assert.ok(["ready", "unconfirmed"].includes(result.status));
  }
});

test("Wiktionary parsing rejects missing English definitions, strips active HTML, and keeps acronym results unconfirmed", () => {
  assert.throws(() => parseWiktionary({ fr: wikiEntry.fr }, "rag", "rag"), /英英释义/);
  assert.throws(() => parseWiktionary({ en: [null] }, "rag", "rag"), /有效释义/);
  const result = parseWiktionary({ en: [{ definitions: [{
    definition: '<script>ignore me</script><style>ignore me</style>pre<i>fix</i><br>&lt;word&gt; &#x1F340; &quot;test&quot;',
  }] }] }, "RAG", "RAG");
  assert.equal(result.meaning, 'prefix <word> 🍀 "test"');
  assert.equal(result.dictionaryState, "candidate");
});

test("the packaged extension grants only the two dictionary hosts required by the lookup", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.host_permissions.sort(), [DICTIONARY_ENDPOINT, WIKTIONARY_ENDPOINT].map((url) => new URL(url).origin + "/*").sort());
});

test("dictionary data retains all senses, attribution and licenses, flags acronym mismatches", () => {
  const result = parseDictionary([entry], "RAG");
  assert.equal(result.dictionaryState, "candidate");
  assert.equal(result.dictionarySenses.length, 2);
  assert.equal(result.dictionaryLicenses[0].name, "CC BY-SA 3.0");
  assert.deepEqual(result.dictionarySources, [
    "https://en.wiktionary.org/wiki/rag",
  ]);
  assert.equal(result.context, "");
  assert.equal(result.exampleZh, "");
});

test("HTTP 404 is unlisted, while network, malformed JSON, and HTTP failures remain retryable errors", async () => {
  assert.equal(
    (await lookupDictionary("unknown", async () => ({ status: 404 }))).status,
    "unconfirmed",
  );
  await assert.rejects(
    lookupDictionary("word", async () => {
      throw new Error("offline");
    }),
    /无法连接/,
  );
  await assert.rejects(
    lookupDictionary("word", async () => ({ status: 429, ok: false })),
    /429/,
  );
  await assert.rejects(
    lookupDictionary("word", async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new Error();
      },
    })),
    /内容异常/,
  );
});

test("results with no supported content license or definitions are not silently cached", () => {
  assert.throws(() => parseDictionary([null], "word"), /格式异常/);
  assert.throws(
    () => parseDictionary([{ ...entry, license: {} }], "rag"),
    /许可/,
  );
  assert.throws(
    () => parseDictionary([{ ...entry, meanings: [] }], "rag"),
    /有效释义/,
  );
});

test("only the selected term is transmitted to the dictionary", async () => {
  let sent;
  await lookupDictionary("in-context learning", async (...args) => {
    sent = args;
    return { status: 404 };
  });
  assert.equal(
    sent[0],
    "https://api.dictionaryapi.dev/api/v2/entries/en/in-context%20learning",
  );
  assert.equal(sent[1].body, undefined);
});
