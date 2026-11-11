import { Button, NoData, Tag } from "animal-island-ui";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CheckCircleIcon,
  CheckIcon,
  DonutIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
  LeafIcon,
  QuoteIcon,
  RefreshIcon,
  Volume2Icon,
} from "naive-icons";
import { Highlight } from "./Highlight.jsx";
import { MAX_ATTEMPTS } from "./library.mjs";

export function WordDetail({
  word,
  onMaster,
  onBookmark,
  onRetry,
  onSource,
  onSpeak,
  onBack,
}) {
  if (!word)
    return (
      <aside className="detail-panel empty-detail">
        <NoData
          variant="simple"
          title="每个词，都从一次阅读开始"
          description="选中单词后右键收藏，或手动添加。"
        />
      </aside>
    );
  const ready = word.status === "ready";
  return (
    <aside className="detail-panel" aria-label="单词详情">
      <div className="mobile-back">
        <Button type="text" icon={<ArrowLeftIcon size={19} />} onClick={onBack}>
          返回单词列表
        </Button>
      </div>
      <div className="word-heading">
        <h2>{word.word}</h2>
        <div className="pronunciation">
          {word.ipa && <span>{word.ipa}</span>}
          <Button
            type="text"
            size="small"
            aria-label={`朗读 ${word.word}`}
            title="系统语音朗读"
            icon={<Volume2Icon size={22} />}
            onClick={() => onSpeak(word.word)}
          />
        </div>
        <p className="muted">
          {word.pos ||
            (word.status === "unconfirmed"
              ? "未收录 · 待确认"
              : word.status === "failed"
                ? "等待重试"
                : "等待词典结果")}
        </p>
      </div>
      <blockquote className="context-quote">
        <QuoteIcon size={25} />
        <p>
          {word.contextAvailable ? (
            <Highlight text={word.sentence} word={word.word} />
          ) : (
            <span className="missing-context">
              未能获取完整原句，已保留选中的词。
            </span>
          )}
        </p>
        <Button type="link" size="small" onClick={() => onSource(word)}>
          {word.source} · 阅读来源 <ExternalLinkIcon size={15} />
        </Button>
      </blockquote>
      {!ready ? (
        <section className="parse-state" aria-live="polite">
          {word.status === "pending" ? (
            <>
              <DonutIcon size={34} className="spin" />
              <h3>词已留下，释义正在准备</h3>
              <p>原词和阅读片段已保存在本机，词典查询在后台继续。</p>
              <Button
                onClick={() => onRetry(word.id)}
                icon={<RefreshIcon size={18} />}
              >
                立即重试
              </Button>
            </>
          ) : word.status === "failed" ? (
            <>
              <RefreshIcon size={34} />
              <h3>词典查询暂未完成</h3>
              <p>{word.lastError || "收藏已保留，可以稍后重试。"}</p>
              <p className="muted">
                {word.attempts < MAX_ATTEMPTS
                  ? "后台将自动重试，也可以立即重试查询。"
                  : "自动重试次数已用完。恢复网络后，可以手动重试查询。"}
              </p>
              <Button type="primary" onClick={() => onRetry(word.id)}>
                重试查询
              </Button>
            </>
          ) : (
            <>
              <HelpCircleIcon size={34} />
              <h3>词典暂未收录这个表达</h3>
              <p>
                单词和原句已保留。词典未收录不代表拼写一定错误；当前版本不生成推测释义。
              </p>
              <Tag color="brown">待确认</Tag>
              <Button onClick={() => onRetry(word.id)}>重新查词典</Button>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="definition-section">
            <div className="section-label">
              <h3>词典释义</h3>
              <span className="caption">英英词典</span>
            </div>
            <p className="sense-note">
              以下为词典义项，尚未自动判断原句对应的词义。
            </p>
            {word.dictionaryState === "candidate" && (
              <p className="candidate-note">
                词典返回的是 “{word.dictionaryHeadword}
                ”。它可能不是当前缩写或专有名词的含义，请结合原句确认。
              </p>
            )}
            <ol className="dictionary-senses">
              {word.dictionarySenses.map((sense, index) => (
                <li key={index}>
                  <span className="sense-pos">{sense.pos}</span>
                  <p>{sense.definition}</p>
                </li>
              ))}
            </ol>
            <div className="dictionary-attribution">
              <span>来源：{word.dictionaryProvider}</span>
              {word.dictionarySources.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  查看原始词条
                </a>
              ))}
              {word.dictionaryLicenses.map((license) => (
                <a
                  key={license.url}
                  href={license.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {license.name}
                </a>
              ))}
            </div>
          </section>
          <section className="definition-section">
            <div className="section-label">
              <h3>语境解释</h3>
              <Tag color="brown" size="small">
                尚未启用
              </Tag>
            </div>
            <p className="muted">原句已保留，后续启用后再补充语境解释。</p>
          </section>
          <section className="definition-section usage-section">
            <div className="section-label">
              <h3>词典例句</h3>
              <span className="caption">词典原文</span>
            </div>
            <p className={word.example ? "example" : "muted"}>
              {word.example || "这个词条暂未提供例句。"}
            </p>
          </section>
          <div className="detail-actions">
            <Button
              type="primary"
              icon={<CheckIcon size={20} />}
              onClick={() => onMaster(word.id)}
            >
              {word.mastered ? "重新加入复习" : "标记已掌握"}
            </Button>
            <Button
              aria-label={word.bookmarked ? "取消重点收藏" : "重点收藏"}
              aria-pressed={word.bookmarked}
              icon={
                word.bookmarked ? (
                  <CheckCircleIcon size={21} />
                ) : (
                  <BookmarkIcon size={21} />
                )
              }
              onClick={() => onBookmark(word.id)}
            />
          </div>
        </>
      )}
      {word.encounters > 1 && (
        <p className="encounters">
          <LeafIcon size={16} /> 已在阅读中遇见 {word.encounters} 次
        </p>
      )}
    </aside>
  );
}
