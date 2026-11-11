export const DATABASE = "shici-vocabulary-v1";
export const MAX_ATTEMPTS = 4;

export function cleanCapture(input, now = Date.now()) {
  const word = String(input?.word ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
  if (
    !word ||
    word.length > 100 ||
    !/[a-z]/i.test(word) ||
    !/^[\p{L}\p{N}\s.'’\-–]+$/u.test(word) ||
    word.split(" ").length > 8
  )
    throw new Error("请选择不超过 8 个词的英文单词或短语。");
  const normalized = /^[A-Z0-9 .’'\-]+$/.test(word)
    ? word
    : word.toLocaleLowerCase("en");
  let sourceUrl = "";
  try {
    const url = new URL(input.sourceUrl);
    if (["http:", "https:", "file:"].includes(url.protocol)) {
      url.username = "";
      url.password = "";
      sourceUrl = url.href;
    }
  } catch {}
  const format =
    input.format === "PDF" || /\.pdf(?:[?#]|$)/i.test(sourceUrl)
      ? "PDF"
      : "文章";
  const pageNumber =
    Number.isInteger(input.pageNumber) && input.pageNumber > 0
      ? input.pageNumber
      : null;
  const source = String(input.source || "手动收藏").slice(0, 200);
  const sentence = String(input.sentence || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 1200);
  return {
    id: `word:${normalized}`,
    word,
    sentence,
    source,
    sourceUrl,
    sourceId: sourceUrl.split("#")[0] || `manual:${source}`,
    format,
    pageNumber,
    capturedAt: now,
    contextAvailable: !!sentence && sentence !== word,
  };
}

const request = (value) =>
  new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });

export function createRepository(name = DATABASE) {
  let database;
  async function open() {
    if (!database)
      database = new Promise((resolve, reject) => {
        const operation = indexedDB.open(name, 1);
        operation.onupgradeneeded = () =>
          operation.result.createObjectStore("words", { keyPath: "id" });
        operation.onsuccess = () => {
          operation.result.onversionchange = () => {
            operation.result.close();
            database = undefined;
          };
          resolve(operation.result);
        };
        operation.onerror = () => {
          database = undefined;
          reject(operation.error);
        };
      });
    return database;
  }
  async function transaction(mode, operation) {
    const db = await open();
    const tx = db.transaction("words", mode);
    const finished = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () =>
        reject(tx.error || new Error("保存未完成，请重试。"));
    });
    let value;
    try {
      value = await operation(tx.objectStore("words"));
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await finished.catch(() => {});
      throw error;
    }
    await finished;
    if (mode === "readwrite" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(name);
      channel.postMessage("changed");
      channel.close();
    }
    return value;
  }
  async function update(id, mutate) {
    return transaction("readwrite", async (store) => {
      const current = await request(store.get(id));
      if (!current) return null;
      const next = mutate(current);
      await request(store.put(next));
      return next;
    });
  }
  return {
    async list() {
      return (
        await transaction("readonly", (store) => request(store.getAll()))
      ).sort((a, b) => b.lastCapturedAt - a.lastCapturedAt);
    },
    async capture(input) {
      const capture = cleanCapture(input);
      return transaction("readwrite", async (store) => {
        const existing = await request(store.get(capture.id));
        const occurrence = { ...capture };
        delete occurrence.id;
        const next = existing
          ? {
              ...existing,
              word: existing.word,
              sentence: capture.sentence,
              source: capture.source,
              sourceId: capture.sourceId,
              sourceUrl: capture.sourceUrl,
              format: capture.format,
              pageNumber: capture.pageNumber,
              contextAvailable: capture.contextAvailable,
              lastCapturedAt: capture.capturedAt,
              encounters: existing.encounters + 1,
              occurrences: [...existing.occurrences, occurrence].slice(-50),
              ...(existing.status === "failed"
                ? {
                    status: "pending",
                    attempts: 0,
                    nextRetryAt: 0,
                    jobToken: null,
                  }
                : {}),
            }
          : {
              ...capture,
              lastCapturedAt: capture.capturedAt,
              encounters: 1,
              occurrences: [occurrence],
              status: "pending",
              dictionaryState: "unknown",
              meaning: "",
              dictionary: "",
              definition: "",
              ipa: "",
              pos: "",
              context: "",
              usage: "",
              example: "",
              exampleZh: "",
              due: true,
              mastered: false,
              bookmarked: false,
              attempts: 0,
              nextRetryAt: 0,
              lastError: "",
              dictionarySenses: [],
              dictionarySources: [],
              dictionaryLicenses: [],
            };
        await request(store.put(next));
        return { word: next, duplicate: !!existing };
      });
    },
    async setFlags(id, flags) {
      const patch = Object.fromEntries(
        ["mastered", "bookmarked", "due"]
          .filter((key) => typeof flags[key] === "boolean")
          .map((key) => [key, flags[key]]),
      );
      return update(id, (word) => ({ ...word, ...patch }));
    },
    async retry(id) {
      return update(id, (word) => ({
        ...word,
        status: "pending",
        attempts: 0,
        nextRetryAt: 0,
        lastError: "",
        jobToken: null,
      }));
    },
    async takeJob(now = Date.now()) {
      return transaction("readwrite", async (store) => {
        const words = await request(store.getAll());
        const word = words
          .filter(
            (item) =>
              (item.status === "pending" || item.status === "failed") &&
              item.attempts < MAX_ATTEMPTS &&
              item.nextRetryAt <= now,
          )
          .sort((a, b) => a.capturedAt - b.capturedAt)[0];
        if (!word) return null;
        const leased = {
          ...word,
          status: "pending",
          attempts: word.attempts + 1,
          nextRetryAt: now + 60_000,
          jobToken: crypto.randomUUID(),
        };
        await request(store.put(leased));
        return leased;
      });
    },
    async complete(id, result, jobToken) {
      return update(id, (word) =>
        word.jobToken !== jobToken
          ? word
          : {
              ...word,
              ...result,
              nextRetryAt: null,
              lastError: "",
              lookedUpAt: Date.now(),
            },
      );
    },
    async fail(id, error, jobToken, now = Date.now()) {
      return update(id, (word) =>
        word.jobToken !== jobToken
          ? word
          : {
              ...word,
              status: "failed",
              lastError: String(error?.message || error).slice(0, 250),
              nextRetryAt:
                now +
                Math.min(60, 2 ** Math.max(0, word.attempts - 1)) * 60_000,
            },
      );
    },
    subscribe(callback) {
      const channel = new BroadcastChannel(name);
      channel.onmessage = callback;
      return () => channel.close();
    },
    async close() {
      if (database) (await database).close();
      database = undefined;
    },
  };
}

export const repository = createRepository();

export function createRunner(repo, lookup) {
  let running;
  return function run() {
    if (running) return running;
    running = (async () => {
      let job;
      while ((job = await repo.takeJob())) {
        try {
          await repo.complete(job.id, await lookup(job.word), job.jobToken);
        } catch (error) {
          await repo.fail(job.id, error, job.jobToken);
        }
      }
    })().finally(() => {
      running = undefined;
    });
    return running;
  };
}
