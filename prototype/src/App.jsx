import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Drawer,
  Input,
  NoData,
  Pagination,
  Tag,
} from "animal-island-ui";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  BookmarkIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  DonutIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HelpCircleIcon,
  KeyboardIcon,
  LeafIcon,
  QuoteIcon,
  RefreshIcon,
  SearchIcon,
  Volume2Icon,
} from "naive-icons";
import { filterWords } from "./data.mjs";
import { useVocabulary, isExtension } from "./useVocabulary.jsx";
import { Highlight } from "./Highlight.jsx";
import { WordDetail } from "./WordDetail.jsx";

const PAGE_SIZE = 6;

function ReadingDemo({ onCollect, onBack }) {
  const articleRef = useRef(null);
  const [selection, setSelection] = useState("");
  const [menu, setMenu] = useState(null);
  const captureSelection = () => {
    const selected = window.getSelection();
    const text = selected?.toString().trim();
    if (text && articleRef.current?.contains(selected.anchorNode))
      setSelection(text.slice(0, 100));
    return text && articleRef.current?.contains(selected.anchorNode)
      ? text.slice(0, 100)
      : "";
  };
  const save = () => {
    const text = captureSelection() || selection;
    if (!text) return;
    const sentence =
      articleRef.current?.innerText
        .split(/(?<=[.!?])\s+/)
        .find((part) => part.includes(text))
        ?.trim() || text;
    onCollect({ word: text, sentence, source: "阅读示例", sourceUrl: "" });
    setMenu(null);
  };
  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") setMenu(null);
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return (
    <main className="reading-view">
      <div className="reading-toolbar">
        <Button type="text" icon={<ArrowLeftIcon size={18} />} onClick={onBack}>
          返回单词本
        </Button>
        <Tag>阅读演示</Tag>
        <span className="reading-toolbar-tip">收词后留在原文，慢慢读。</span>
        <Button
          type="primary"
          disabled={!selection}
          icon={<BookmarkIcon size={19} />}
          onClick={save}
        >
          收藏选中的词
        </Button>
      </div>
      <div className="reading-intro">
        <KeyboardIcon size={20} />
        <span>
          双击下方标记的词，再右键加入单词本。也可使用 <kbd>⌘ / Ctrl</kbd> +{" "}
          <kbd>Shift</kbd> + <kbd>S</kbd>。
        </span>
      </div>
      <article
        ref={articleRef}
        className="reading-article"
        onMouseUp={captureSelection}
        onContextMenu={(event) => {
          const text = captureSelection();
          if (!text) return;
          event.preventDefault();
          setMenu({
            x: Math.max(8, Math.min(event.clientX, window.innerWidth - 285)),
            y: Math.max(8, Math.min(event.clientY, window.innerHeight - 130)),
          });
        }}
      >
        <p className="eyebrow">READING NOTES · 04 MIN READ</p>
        <h1>A little room for the unexpected</h1>
        <p className="article-deck">
          Good ideas do not always arrive when we are looking for them.
        </p>
        <p>
          We tend to imagine learning as a straight path: choose a subject, make
          a plan, and follow it. Yet some of the most useful discoveries begin
          with a <mark>serendipitous</mark> encounter.
        </p>
        <p>
          A sentence in an article leads us to a new question. A conversation
          changes the way we see a familiar problem. These moments are easy to
          miss when every minute has already been assigned a purpose.
        </p>
        <p>
          Making space for them can be a <mark>deliberate</mark> choice. Read a
          little beyond your usual interests. Notice an unfamiliar word without
          feeling the need to stop everything and understand it at once.
        </p>
        <p>
          There is a <mark>nuance</mark> here: paying attention does not mean
          collecting everything. It means leaving a small trace of what makes
          you curious, so you can return when the time is right.
        </p>
        <p>
          Learning continues long after the page is closed. Sometimes, the most
          important step is simply to keep reading.
        </p>
        <div className="article-end">
          <LeafIcon size={23} />
          <span>Leave a small trace. Keep reading.</span>
        </div>
      </article>
      {menu && (
        <>
          <div className="context-menu-dismiss" onClick={() => setMenu(null)} />
          <div
            className="capture-menu"
            role="menu"
            aria-label="收词菜单"
            style={{ left: menu.x, top: menu.y }}
          >
            <span className="caption">{selection}</span>
            <Button
              autoFocus
              type="text"
              role="menuitem"
              block
              icon={<BookOpenIcon size={21} />}
              onClick={save}
            >
              加入拾词单词本
            </Button>
            <Button
              type="text"
              size="small"
              role="menuitem"
              onClick={() => setMenu(null)}
            >
              取消
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function Review({ queue, onRate, onExit }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const word = queue[index];
  const rate = async (rating) => {
    if (!revealed || !word || busy) return;
    setBusy(true);
    setSaveError("");
    try {
      await onRate(word.id, rating);
      if (rating === "remembered") setRemembered((count) => count + 1);
      setIndex((value) => value + 1);
      setRevealed(false);
    } catch {
      setSaveError("复习结果未能保存，请重试。");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const handler = (event) => {
      if (
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLInputElement
      )
        return;
      if (event.code === "Space" && !revealed && word) {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed && ["1", "2", "3"].includes(event.key))
        rate({ 1: "forgot", 2: "unsure", 3: "remembered" }[event.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return (
    <main className="review-view">
      <div className="review-header">
        <Button type="text" icon={<ArrowLeftIcon size={18} />} onClick={onExit}>
          返回单词本
        </Button>
        <span className="muted">今天的复习</span>
        <span>
          {Math.min(index + 1, queue.length)} / {queue.length}
        </span>
      </div>
      <div
        className="review-progress"
        role="progressbar"
        aria-label="本次复习进度"
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={queue.length}
      >
        <span
          style={{
            width: `${queue.length ? (index / queue.length) * 100 : 0}%`,
          }}
        />
      </div>
      {saveError && (
        <p className="storage-error" role="alert">
          {saveError}
        </p>
      )}
      {!word ? (
        <div className="review-finished">
          <BookOpenIcon size={68} />
          <p className="eyebrow">A LITTLE MORE FAMILIAR</p>
          <h1>{queue.length ? "又熟悉了一点。" : "还没有待复习的词"}</h1>
          <p>
            {queue.length
              ? `这次回顾了 ${queue.length} 个词，记住了 ${remembered} 个。`
              : "收藏并查到释义后，就可以开始复习。"}
          </p>
          <p className="muted">模糊或没记住的词会继续留在待复习中。</p>
          <Button type="primary" onClick={onExit}>
            回到单词本
          </Button>
        </div>
      ) : (
        <>
          <section className="review-card">
            <p className="eyebrow">在原句里，想起它的意思</p>
            <h1>{word.word}</h1>
            <p className="review-sentence">
              <Highlight
                text={word.sentence || "本次未能获取原句，请先回忆词义。"}
                word={word.word}
              />
            </p>
            <p className="caption">
              {word.source} · {word.format}
            </p>
            {revealed ? (
              <div className="review-answer" aria-live="polite">
                <ol className="review-senses">
                  {word.dictionarySenses.map((sense, index) => (
                    <li key={index}>
                      <span className="sense-pos">{sense.pos}</span>
                      <p>{sense.definition}</p>
                    </li>
                  ))}
                </ol>
                <p>
                  {word.context ||
                    "词典义项尚未与原句自动匹配，请结合语境回忆。"}
                </p>
                <div className="review-answer-source">
                  <Tag color="app-teal">词典释义</Tag>
                  <span className="caption">Free Dictionary API · 原文</span>
                </div>
              </div>
            ) : (
              <div className="review-reveal">
                <Button
                  type="primary"
                  icon={<BookOpenIcon size={21} />}
                  onClick={() => setRevealed(true)}
                >
                  翻开释义
                </Button>
                <span className="caption">先回忆，再揭晓</span>
              </div>
            )}
          </section>
          {revealed && (
            <div className="review-ratings">
              <Button disabled={busy} onClick={() => rate("forgot")}>
                没记住 <span className="key-hint">1</span>
              </Button>
              <Button disabled={busy} onClick={() => rate("unsure")}>
                有点模糊 <span className="key-hint">2</span>
              </Button>
              <Button
                type="primary"
                icon={<CheckIcon size={20} />}
                disabled={busy}
                onClick={() => rate("remembered")}
              >
                记住了 <span className="key-hint">3</span>
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export function App() {
  const vocabulary = useVocabulary();
  const { words } = vocabulary;
  const [view, setView] = useState("notebook");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("grounding");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sourceWord, setSourceWord] = useState(null);
  const [toast, setToast] = useState("");
  const [queue, setQueue] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newSentence, setNewSentence] = useState("");
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(
    () => filterWords(words, { query, filter, sourceId }),
    [words, query, filter, sourceId],
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
  );
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selected = visible.find((word) => word.id === selectedId) || visible[0];
  const due = filterWords(words, { filter: "due" });
  const pending = words.filter((word) => word.status === "pending").length;
  const failed = words.filter((word) => word.status === "failed").length;
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (mobileDetail && window.matchMedia("(max-width: 760px)").matches)
      window.scrollTo(0, 0);
  }, [mobileDetail, selectedId]);
  function navigate(next) {
    setMobileDetail(false);
    setView(next);
    window.scrollTo(0, 0);
  }
  function startReview() {
    setQueue(due);
    navigate("review");
  }
  async function parse(id) {
    try {
      await vocabulary.retry(id);
      setToast("已重新加入查询队列。");
    } catch {
      setToast("无法保存查询任务，请重试。");
    }
  }
  async function capture(captured) {
    try {
      const result = await vocabulary.capture(captured);
      setSelectedId(result.word.id);
      setToast(
        result.duplicate
          ? `再次遇见 ${captured.word}，已记录。`
          : `已收藏 ${captured.word}，继续阅读吧。`,
      );
      return result;
    } catch (error) {
      setToast(error.message || "收藏未成功，请重试。");
      return null;
    }
  }
  async function toggleMaster(id) {
    const current = words.find((word) => word.id === id);
    try {
      await vocabulary.setFlags(id, {
        mastered: !current.mastered,
        due: current.mastered,
      });
      setToast(current.mastered ? "已重新加入待复习。" : "已标记掌握。");
    } catch {
      setToast("未能保存掌握标记，请重试。");
    }
  }
  async function toggleBookmark(id) {
    const current = words.find((word) => word.id === id);
    try {
      await vocabulary.setFlags(id, { bookmarked: !current.bookmarked });
      setToast(current.bookmarked ? "已取消重点收藏。" : "已加入重点收藏。");
    } catch {
      setToast("未能保存重点收藏，请重试。");
    }
  }
  function exportWords() {
    const blob = new Blob(
      [
        JSON.stringify(
          { schemaVersion: 1, exportedAt: new Date().toISOString(), words },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `拾词-${new Intl.DateTimeFormat("sv-SE").format(new Date())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const sources = [
    ...new Map(
      words
        .flatMap((word) => word.occurrences || [word])
        .map((entry) => [
          entry.sourceId,
          { title: entry.source, format: entry.format },
        ]),
    ).entries(),
  ];
  const sourceNames = Object.fromEntries(
    sources.map(([id, info]) => [id, info.title]),
  );
  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setToast("当前浏览器暂不支持语音朗读。");
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    utterance.onerror = () => setToast("当前系统语音不可用，可以稍后再试。");
    speechSynthesis.speak(utterance);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="topbar">
        <div className="brand">
          <BookOpenIcon size={40} />
          <span>拾词</span>
        </div>
        <div className="brand-divider" />
        <nav aria-label="主导航">
          {[
            ["notebook", "单词本"],
            ["review", "复习"],
            ["sources", "阅读记录"],
          ].map(([key, label]) => (
            <div
              key={key}
              className={`nav-item ${view === key ? "active" : ""}`}
            >
              <Button
                type="text"
                className="nav-button"
                aria-current={view === key ? "page" : undefined}
                onClick={() =>
                  key === "review" ? startReview() : navigate(key)
                }
              >
                {label}
              </Button>
            </div>
          ))}
        </nav>
        <div className="topbar-end">
          <Tag>{isExtension ? "本机单词本" : "本地网页版"}</Tag>
          <Button
            type="text"
            aria-label="使用说明"
            icon={<HelpCircleIcon size={24} />}
            onClick={() => setHelpOpen(true)}
          />
        </div>
      </header>
      <div id="main-content" tabIndex={-1}>
        {view === "notebook" && (
          <main className="notebook-view">
            {vocabulary.error && (
              <p className="storage-error" role="alert">
                {vocabulary.error}
              </p>
            )}
            <div className="page-heading">
              <div className="heading-copy">
                <h1>我的单词本</h1>
                <p>
                  {words.length} 个词，{due.length} 个等你重逢
                </p>
              </div>
              <div className="heading-actions">
                <Input
                  className="search-input"
                  size="large"
                  aria-label="搜索单词、释义或来源"
                  placeholder="搜索单词、释义或来源…"
                  prefix={<SearchIcon size={21} />}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                    setMobileDetail(false);
                  }}
                  allowClear
                  onClear={() => {
                    setQuery("");
                    setPage(1);
                  }}
                />
                <Button
                  type="primary"
                  size="large"
                  disabled={!due.length}
                  icon={<BookOpenIcon size={23} />}
                  onClick={startReview}
                >
                  开始复习
                </Button>
                <Button onClick={() => setAddOpen(true)}>添加单词</Button>
                <Button type="text" onClick={() => navigate("reading")}>
                  阅读示例
                </Button>
              </div>
            </div>
            {sourceId && (
              <div className="source-filter">
                <FileTextIcon size={18} />
                <span>来自 {sourceNames[sourceId]}</span>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setSourceId("");
                    setPage(1);
                  }}
                >
                  查看全部来源
                </Button>
              </div>
            )}
            <div
              className={`workspace ${mobileDetail ? "show-mobile-detail" : ""}`}
            >
              <section className="list-panel" aria-label="单词列表">
                <div className="list-toolbar">
                  <div
                    className="filter-tabs"
                    role="group"
                    aria-label="筛选单词"
                  >
                    {[
                      ["all", "全部", words.length],
                      ["due", "待复习", due.length],
                      ["pending", "待解析", pending],
                      [
                        "unconfirmed",
                        "待确认",
                        words.filter((word) => word.status === "unconfirmed")
                          .length,
                      ],
                    ].map(([key, label, count]) => (
                      <span
                        key={key}
                        className={`filter-pill ${filter === key ? "active" : ""}`}
                      >
                        <Button
                          type="text"
                          aria-pressed={filter === key}
                          onClick={() => {
                            setFilter(key);
                            setPage(1);
                          }}
                        >
                          {label} {count}
                        </Button>
                      </span>
                    ))}
                  </div>
                  <span className="save-hint">
                    <CheckCircleIcon size={17} />
                    收藏即保存，释义在后台准备
                  </span>
                </div>
                <div className="word-table">
                  <div className="table-head">
                    <span>单词</span>
                    <span>释义</span>
                    <span className="source-column">来源</span>
                  </div>
                  {visible.length ? (
                    visible.map((word) => (
                      <div
                        className={`word-row ${selected?.id === word.id ? "selected" : ""}`}
                        key={word.id}
                      >
                        <Button
                          type="text"
                          block
                          className="word-row-button"
                          aria-pressed={selected?.id === word.id}
                          aria-label={`查看 ${word.word}`}
                          onClick={() => {
                            setSelectedId(word.id);
                            setMobileDetail(true);
                          }}
                        >
                          <span className="word-row-inner">
                            <span className="word-cell">
                              {word.status === "pending" ? (
                                <DonutIcon
                                  className="spin row-status"
                                  size={17}
                                />
                              ) : word.mastered ? (
                                <CheckIcon className="row-status" size={16} />
                              ) : (
                                <span
                                  className={`status-indicator ${word.status === "failed" ? "error" : ""}`}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="word-text">{word.word}</span>
                              {word.dictionaryState === "sense-mismatch" && (
                                <span className="context-label">语境释义</span>
                              )}
                            </span>
                            <span
                              className={`row-meaning ${word.status !== "ready" ? "muted" : ""}`}
                            >
                              {word.status === "pending"
                                ? "词典查询中"
                                : word.status === "failed"
                                  ? "解析失败，可重试"
                                  : word.status === "unconfirmed"
                                    ? "待确认"
                                    : word.meaning}
                            </span>
                            <span
                              className="row-source source-column"
                              title={`${word.source} · ${word.format}`}
                            >
                              {word.source} · {word.format}
                            </span>
                          </span>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <NoData
                      variant="search"
                      title={
                        vocabulary.loading
                          ? "正在读取本地单词本…"
                          : query
                            ? "还没有遇见这个词"
                            : "这里暂时没有单词"
                      }
                      description={
                        query
                          ? "换个关键词，或在阅读中收藏新的词。"
                          : "从阅读示例开始，或手动添加第一个词。"
                      }
                      extra={
                        <Button
                          onClick={() => {
                            setQuery("");
                            setFilter("all");
                            setSourceId("");
                            setPage(1);
                          }}
                        >
                          查看全部单词
                        </Button>
                      }
                    />
                  )}
                </div>
                <div className="list-footer">
                  <div>
                    <span>共 {filtered.length} 个词</span>
                    {failed > 0 && (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setFilter(filter === "failed" ? "all" : "failed");
                          setPage(1);
                        }}
                      >
                        {filter === "failed"
                          ? "返回全部"
                          : `${failed} 个解析失败`}
                      </Button>
                    )}
                  </div>
                  <Pagination
                    total={filtered.length}
                    pageSize={PAGE_SIZE}
                    current={currentPage}
                    onChange={(value) => {
                      setPage(value);
                      setMobileDetail(false);
                    }}
                    variant="teal"
                  />
                </div>
              </section>
              <WordDetail
                key={selected?.id || "empty"}
                word={selected}
                onMaster={toggleMaster}
                onBookmark={toggleBookmark}
                onRetry={parse}
                onSource={setSourceWord}
                onSpeak={speak}
                onBack={() => setMobileDetail(false)}
              />
            </div>
          </main>
        )}
        {view === "reading" && (
          <ReadingDemo
            onCollect={capture}
            onBack={() => {
              setQuery("");
              setFilter("all");
              setSourceId("");
              setPage(1);
              navigate("notebook");
            }}
          />
        )}
        {view === "review" && (
          <Review
            key={queue.map((word) => word.id).join("-")}
            queue={queue}
            onExit={() => navigate("notebook")}
            onRate={(id, rating) =>
              vocabulary.setFlags(id, {
                mastered: rating === "remembered",
                due: rating !== "remembered",
              })
            }
          />
        )}
        {view === "sources" && (
          <main className="sources-view">
            <div className="page-heading">
              <div className="heading-copy">
                <h1>阅读记录</h1>
                <p>每个词，都有它最初出现的地方。</p>
              </div>
              <Button
                type="primary"
                icon={<BookOpenIcon size={21} />}
                onClick={() => navigate("reading")}
              >
                打开阅读示例
              </Button>
            </div>
            <div className="sources-list">
              {sources.map(([id, info]) => (
                <div className="source-record" key={id}>
                  <FileTextIcon size={36} />
                  <div>
                    <h2>{info.title}</h2>
                    <p className="muted">
                      {info.format} ·{" "}
                      {
                        words.filter((word) =>
                          word.occurrences?.some(
                            (entry) => entry.sourceId === id,
                          ),
                        ).length
                      }{" "}
                      个收藏词
                    </p>
                  </div>
                  <Button
                    icon={<ArrowRightIcon size={19} />}
                    onClick={() => {
                      setSourceId(id);
                      setQuery("");
                      setFilter("all");
                      setPage(1);
                      navigate("notebook");
                    }}
                  >
                    查看单词
                  </Button>
                </div>
              ))}
            </div>
            <p className="caption source-disclaimer">
              阅读片段仅保存在本机。点击词条中的“阅读来源”可查看原句和原网页链接。
            </p>
          </main>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircleIcon size={23} />
          <span>{toast}</span>
          <Button
            type="text"
            size="small"
            aria-label="关闭提示"
            icon={<CloseIcon size={17} />}
            onClick={() => setToast("")}
          />
        </div>
      )}
      {helpOpen && (
        <Drawer
          open
          title="一点使用说明"
          width="min(440px, 100vw)"
          pushBackground={false}
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-content">
            <BookOpenIcon size={48} />
            <h2>让阅读继续，让词留下。</h2>
            <p>
              安装 Chrome
              插件后，在网页中选词并右键收藏。也可在“阅读示例”中尝试收词，保存后留在原文。
            </p>
            <h3>词典优先，语境补充</h3>
            <p>
              词典释义与 AI
              语境解释分开呈现。词典未收录、语境义不匹配和网络失败是不同状态。
            </p>
            <h3>数据保存在本机</h3>
            <p>
              单词、原句、查询状态和复习标记保存在当前浏览器。关闭页面或重启后会保留。只有选中的词会发送给
              Free Dictionary API，原句和来源不会发出。
            </p>
            <p>
              当前提供真实英英释义及词典例句。模型尚未启用，不生成中文讲解或推测释义。
            </p>
            <p>
              插件与本地网页版使用各自独立的存储空间。卸载插件或清除站点数据会删除本地记录，建议定期导出。
            </p>
            <Button onClick={exportWords} disabled={!words.length}>
              导出单词本
            </Button>
            <p>
              朗读使用浏览器的系统语音。PDF
              中优先尝试右键收词；无法读取原句时可手动补充。
            </p>
            <a
              href="https://github.com/guokaigdg/animal-island-ui"
              target="_blank"
              rel="noreferrer"
            >
              界面使用 Animal Island UI
            </a>
          </div>
        </Drawer>
      )}
      {addOpen && (
        <Drawer
          open
          title="添加一个词"
          width="min(480px, 100vw)"
          pushBackground={false}
          onClose={() => setAddOpen(false)}
        >
          <form
            className="add-word-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving) return;
              setSaving(true);
              const result = await capture({
                word: newWord,
                sentence: newSentence,
                source: "手动收藏",
              });
              setSaving(false);
              if (result) {
                setAddOpen(false);
                setNewWord("");
                setNewSentence("");
                setFilter("all");
                setQuery("");
                setSourceId("");
                setPage(1);
                navigate("notebook");
              }
            }}
          >
            <label htmlFor="new-word">英文单词或短语</label>
            <Input
              id="new-word"
              value={newWord}
              onChange={(event) => setNewWord(event.target.value)}
              maxLength={100}
              required
              autoFocus
            />
            <label htmlFor="new-sentence">原句（可选）</label>
            <Input
              id="new-sentence"
              value={newSentence}
              onChange={(event) => setNewSentence(event.target.value)}
              maxLength={1200}
            />
            <p className="muted">
              先保存在本机，再查询词典。原句不会发送给词典。
            </p>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              disabled={!newWord.trim() || saving}
            >
              保存到单词本
            </Button>
          </form>
        </Drawer>
      )}
      {sourceWord && (
        <Drawer
          open
          title="遇见这个词的地方"
          width="min(540px, 100vw)"
          pushBackground={false}
          onClose={() => setSourceWord(null)}
        >
          <div className="source-excerpt">
            <Tag>{sourceWord.format} · 阅读来源</Tag>
            <h2>{sourceWord.source}</h2>
            <blockquote>
              <Highlight text={sourceWord.sentence} word={sourceWord.word} />
            </blockquote>
            {sourceWord.occurrences?.map((entry, index) => (
              <section className="occurrence" key={index}>
                <p className="caption">
                  {entry.source}
                  {entry.pageNumber
                    ? ` · 第 ${entry.pageNumber} 页`
                    : ""} · {new Date(entry.capturedAt).toLocaleString("zh-CN")}
                </p>
                <p>{entry.sentence || "未能读取原句，仅保存了选中的词。"}</p>
                {entry.sourceUrl && (
                  <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
                    打开原文
                  </a>
                )}
              </section>
            ))}
            {!sourceWord.sourceUrl && (
              <Button
                onClick={() => {
                  setSourceWord(null);
                  navigate("reading");
                }}
              >
                打开阅读示例
              </Button>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
