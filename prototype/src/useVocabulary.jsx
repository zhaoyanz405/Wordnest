import { useCallback, useEffect, useState } from "react";
import { createRunner, repository } from "./library.mjs";
import { lookupDictionary } from "./dictionary.mjs";

export const isExtension =
  globalThis.location?.protocol === "chrome-extension:" &&
  !!globalThis.chrome?.runtime?.id;
const runInPage = createRunner(repository, lookupDictionary);

export function wakeQueue() {
  return isExtension
    ? chrome.runtime.sendMessage({ type: "shici:process" })
    : runInPage();
}

export function useVocabulary() {
  const [words, setWords] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setWords(await repository.list());
      setError("");
    } catch {
      setError("无法读取本地单词本，请检查浏览器的存储设置。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const unsubscribe = repository.subscribe(reload);
    const resume = () => {
      reload();
      wakeQueue().catch(() => {});
    };
    resume();
    window.addEventListener("focus", resume);
    const interval = isExtension ? null : window.setInterval(resume, 60_000);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", resume);
      if (interval) window.clearInterval(interval);
    };
  }, [reload]);
  const capture = useCallback(
    async (input) => {
      const result = await repository.capture(input);
      await reload();
      wakeQueue().catch(() => {});
      return result;
    },
    [reload],
  );
  const retry = useCallback(
    async (id) => {
      await repository.retry(id);
      await reload();
      wakeQueue().catch(() => {});
    },
    [reload],
  );
  const setFlags = useCallback(
    async (id, flags) => {
      await repository.setFlags(id, flags);
      await reload();
    },
    [reload],
  );
  return { words, loading, error, capture, retry, setFlags };
}
