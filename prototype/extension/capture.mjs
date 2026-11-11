export function readPageSelection() {
  if (
    document.activeElement?.matches('input,textarea,[contenteditable="true"]')
  )
    return null;
  const selection = window.getSelection();
  const word = selection?.toString().trim();
  if (!word || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const parent =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
  const block =
    parent?.closest("p,li,blockquote,figcaption,td,h1,h2,h3") || parent;
  let sentence = "";
  if (block) {
    const text = block.textContent || "";
    try {
      const prefix = range.cloneRange();
      prefix.selectNodeContents(block);
      prefix.setEnd(range.startContainer, range.startOffset);
      const offset = prefix.toString().length;
      if (typeof Intl.Segmenter === "function")
        sentence =
          [
            ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(
              text,
            ),
          ].find(
            (part) =>
              offset >= part.index && offset < part.index + part.segment.length,
          )?.segment || "";
      if (!sentence)
        sentence = text.slice(
          Math.max(0, offset - 300),
          offset + word.length + 500,
        );
    } catch {
      sentence = text.slice(0, 1200);
    }
  }
  return {
    word,
    sentence: sentence.trim().replace(/\s+/g, " ").slice(0, 1200),
    source: document.title,
    sourceUrl: location.href,
  };
}

export function showCollectionToast(message, failed = false) {
  document.getElementById("shici-collection-feedback")?.remove();
  const host = document.createElement("div");
  host.id = "shici-collection-feedback";
  host.style.cssText =
    "position:fixed;bottom:26px;right:26px;z-index:2147483647;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const note = document.createElement("div");
  note.setAttribute("role", "status");
  note.textContent = message;
  note.style.cssText = `font:500 14px/1.6 sans-serif;color:#794f27;background:${failed ? "#fff0e8" : "#e6f9f6"};border:1px solid #d4c9b4;border-radius:18px;padding:12px 20px;max-width:320px;box-shadow:0 3px 10px #3d34281a`;
  shadow.append(note);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 2600);
}
