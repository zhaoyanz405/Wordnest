import { Parser } from "htmlparser2";

export const DICTIONARY_ENDPOINT =
  "https://api.dictionaryapi.dev/api/v2/entries/en/";
export const WIKTIONARY_ENDPOINT =
  "https://en.wiktionary.org/api/rest_v1/page/definition/";

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function parseDictionary(entries, query) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 20)
    throw new Error("词典返回格式异常，请稍后重试。");
  const senses = [],
    sources = new Set(),
    licenses = new Map();
  let ipa = "",
    headword = "";
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("词典返回格式异常，请稍后重试。");
    const licenseUrl = httpsUrl(entry.license?.url);
    if (
      !/^https:\/\/creativecommons\.org\/licenses\/by-sa\/(3\.0|4\.0)\/?$/.test(
        licenseUrl,
      )
    )
      throw new Error("词典结果缺少可保存的许可信息，暂未缓存释义。");
    licenses.set(licenseUrl, {
      name: String(entry.license.name || "CC BY-SA").slice(0, 80),
      url: licenseUrl,
    });
    headword ||= String(entry.word || query).slice(0, 100);
    ipa ||= String(
      entry.phonetic ||
        (Array.isArray(entry.phonetics)
          ? entry.phonetics.find((item) => item?.text)?.text
          : "") ||
        "",
    ).slice(0, 150);
    for (const url of Array.isArray(entry.sourceUrls) ? entry.sourceUrls : []) {
      const safe = httpsUrl(url);
      if (safe) sources.add(safe);
    }
    for (const meaning of (Array.isArray(entry.meanings)
      ? entry.meanings
      : []
    ).slice(0, 20)) {
      if (!meaning || typeof meaning !== "object") continue;
      for (const item of (Array.isArray(meaning.definitions)
        ? meaning.definitions
        : []
      ).slice(0, 20)) {
        if (
          !item ||
          typeof item.definition !== "string" ||
          !item.definition.trim()
        )
          continue;
        senses.push({
          pos: String(meaning.partOfSpeech || "").slice(0, 60),
          definition: item.definition.slice(0, 1000),
          example:
            typeof item.example === "string" ? item.example.slice(0, 1000) : "",
        });
      }
    }
  }
  if (!senses.length) throw new Error("词典暂未返回有效释义，请稍后重试。");
  const candidate = /^[A-Z0-9 .’'\-]{2,}$/.test(query) && headword !== query;
  return {
    status: "ready",
    dictionaryState: candidate ? "candidate" : "matched",
    dictionaryProvider: "Free Dictionary API",
    dictionaryHeadword: headword,
    meaning: senses[0].definition,
    dictionary: senses[0].definition,
    definition: "",
    dictionarySenses: senses.slice(0, 16),
    dictionarySources: [...sources].slice(0, 20),
    dictionaryLicenses: [...licenses.values()],
    ipa,
    pos: [...new Set(senses.map((sense) => sense.pos))]
      .filter(Boolean)
      .join(" / "),
    example: senses.find((sense) => sense.example)?.example || "",
    exampleZh: "",
    context: "",
    usage: "",
  };
}

function dictionaryText(value) {
  if (typeof value !== "string" || value.length > 50_000) return "";
  const chunks = [];
  let ignored = 0;
  const lineBreak = (name) => {
    if (["br", "p", "li", "div"].includes(name)) chunks.push(" ");
  };
  new Parser({
    onopentag(name, attributes) {
      // Wiktionary can include reference-list items among its definitions.
      if (ignored || name === "script" || name === "style" ||
          /(?:^|\s)(?:mw-cite-backlink|mw-reference-text|reference)(?:\s|$)/.test(attributes.class || ""))
        ignored++;
      else lineBreak(name);
    },
    ontext(text) {
      if (!ignored) chunks.push(text);
    },
    onclosetag(name) {
      if (ignored) ignored--;
      else lineBreak(name);
    },
  }).end(value);
  return chunks.join("").replace(/\s+/g, " ").trim().slice(0, 1000);
}

export function parseWiktionary(data, title, query) {
  if (!data || typeof data !== "object" || !Array.isArray(data.en))
    throw new Error("备用词典暂未返回有效英英释义。");
  const result = parseDictionary([
    {
      word: title,
      license: {
        name: "CC BY-SA 4.0",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
      sourceUrls: [
        `https://en.wiktionary.org/wiki/${encodeURIComponent(title)}#English`,
      ],
      meanings: data.en.slice(0, 20).map((entry) => ({
        partOfSpeech: dictionaryText(entry?.partOfSpeech).slice(0, 60),
        definitions: (Array.isArray(entry?.definitions)
          ? entry.definitions
          : []
        ).slice(0, 20).map((item) => ({
          definition: dictionaryText(item?.definition),
          example: Array.isArray(item?.examples)
            ? dictionaryText(item.examples.find((example) => typeof example === "string"))
            : "",
        })),
      })),
    },
  ], query);
  result.dictionaryProvider = "Wiktionary";
  // This endpoint omits the resolved headword, so acronym matches need confirmation.
  if (/^[A-Z0-9 .’'\-]{2,}$/.test(query))
    result.dictionaryState = "candidate";
  return result;
}

async function requestDictionary(endpoint, word, fetcher, timeout) {
  let response;
  try {
    response = await fetcher(endpoint + encodeURIComponent(word), {
      headers: { Accept: "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    throw new Error(
      error.name === "TimeoutError" || error.name === "AbortError"
        ? "词典查询超时。"
        : "暂时无法连接词典。",
    );
  }
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`词典服务暂不可用（${response.status}）。`);
  try {
    const data = await response.json();
    if (!data || typeof data !== "object") throw new Error("Invalid dictionary data");
    return data;
  } catch (error) {
    throw new Error(
      error.name === "TimeoutError" || error.name === "AbortError"
        ? "词典查询超时。"
        : "词典返回内容异常。",
    );
  }
}

export async function lookupDictionary(word, fetcher = fetch) {
  const preview = import.meta.env?.DEV && globalThis.location &&
    ["http:", "https:"].includes(location.protocol);
  let primaryError;
  try {
    const data = await requestDictionary(
      preview ? "/dictionary-api/" : DICTIONARY_ENDPOINT,
      word, fetcher, 10_000,
    );
    if (data !== null) return parseDictionary(data, word);
    return {
      status: "unconfirmed",
      dictionaryState: "missing",
      meaning: "词典未收录",
      dictionaryProvider: "Free Dictionary API",
      dictionary: "",
      dictionarySenses: [],
      dictionarySources: [],
      dictionaryLicenses: [],
      ipa: "",
      pos: "",
      example: "",
      context: "",
    };
  } catch (error) {
    primaryError = error;
  }
  try {
    const title = /^[A-Z0-9 .’'\-]{2,}$/.test(word)
      ? word
      : word.toLocaleLowerCase("en");
    const data = await requestDictionary(
      preview ? "/wiktionary-api/" : WIKTIONARY_ENDPOINT,
      title, fetcher, 12_000,
    );
    if (data === null) throw new Error("备用词典未收录，主词典尚未恢复。");
    return parseWiktionary(data, title, word);
  } catch (fallbackError) {
    throw new Error(
      `收藏已保留。主词典：${primaryError.message}备用词典：${fallbackError.message}`,
    );
  }
}
