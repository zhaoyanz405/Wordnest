import { repository, createRunner } from "../src/library.mjs";
import { lookupDictionary } from "../src/dictionary.mjs";
import { readPageSelection, showCollectionToast } from "./capture.mjs";

export function installExtension(
  api,
  repo = repository,
  run = createRunner(repo, lookupDictionary),
) {
  const safeRun = () =>
    run().catch((error) => console.error("拾词任务未完成：", error.message));
  async function feedback(tabId, message, failed = false) {
    await api.action.setBadgeBackgroundColor({
      color: failed ? "#b43b30" : "#087c71",
    });
    await api.action.setBadgeText({ text: failed ? "!" : "+1" });
    await api.action.setTitle({ title: `${message} · 点击打开拾词单词本` });
    if (tabId != null) {
      try {
        await api.scripting.executeScript({
          target: { tabId },
          func: showCollectionToast,
          args: [message, failed],
        });
      } catch {}
    }
  }
  async function capture(tab, info) {
    try {
      if (info?.editable)
        throw new Error("请在文章正文中选词，输入框内容不收集。");
      let metadata;
      try {
        const frames =
          info?.frameId != null
            ? { tabId: tab.id, frameIds: [info.frameId] }
            : { tabId: tab.id, allFrames: true };
        metadata = (
          await api.scripting.executeScript({
            target: frames,
            func: readPageSelection,
          })
        )
          .map((item) => item.result)
          .find(
            (item) =>
              item?.word &&
              (!info?.selectionText || item.word === info.selectionText.trim()),
          );
      } catch {}
      const word = info?.selectionText?.trim() || metadata?.word;
      if (!word)
        throw new Error(
          "未能读取选中文字。PDF 可优先使用右键收词，或在单词本中手动添加。",
        );
      const sourceUrl =
        [metadata?.sourceUrl, info?.pageUrl, info?.frameUrl, tab.url].find(
          (value) =>
            typeof value === "string" && /^(https?:|file:)/i.test(value),
        ) || "";
      const pageMatch = /(?:#|&)page=(\d+)/i.exec(sourceUrl);
      const result = await repo.capture({
        word,
        sentence: metadata?.sentence || "",
        source: metadata?.source || tab.title || "阅读页面",
        sourceUrl,
        format:
          /\.pdf(?:[?#]|$)/i.test(sourceUrl) || /\.pdf\b/i.test(tab.title || "")
            ? "PDF"
            : "文章",
        pageNumber: pageMatch ? Number(pageMatch[1]) : null,
      });
      await feedback(
        tab.id,
        result.duplicate
          ? `再次遇见 ${word}，已记录。`
          : `已收藏 ${word}，继续阅读吧。`,
      );
      void safeRun();
      return result;
    } catch (error) {
      await feedback(
        tab?.id,
        error.message || "收藏未成功，请稍后重试。",
        true,
      );
      return null;
    }
  }
  api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "shici-add") return capture(tab, info);
  });
  api.commands.onCommand.addListener(async (command, tab) => {
    if (command === "collect-word") {
      const active =
        tab || (await api.tabs.query({ active: true, currentWindow: true }))[0];
      if (active) await capture(active);
    }
  });
  api.action.onClicked.addListener(() => {
    api.action.setBadgeText({ text: "" });
    return api.tabs.create({ url: api.runtime.getURL("index.html") });
  });
  api.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== api.runtime.id || message?.type !== "shici:process")
      return;
    reply({ ok: true });
    void safeRun();
  });
  api.runtime.onInstalled.addListener(async () => {
    await api.contextMenus.removeAll();
    await api.contextMenus.create({
      id: "shici-add",
      title: "加入拾词单词本",
      contexts: ["selection"],
    });
    await api.alarms.create("shici-retry", { periodInMinutes: 1 });
    void safeRun();
  });
  api.runtime.onStartup.addListener(async () => {
    await api.alarms.create("shici-retry", { periodInMinutes: 1 });
    void safeRun();
  });
  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "shici-retry") void safeRun();
  });
  void safeRun();
  return { capture };
}

if (globalThis.chrome?.runtime?.id) installExtension(chrome);
