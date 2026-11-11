export function filterWords(
  words,
  { query = "", filter = "all", sourceId = "" } = {},
) {
  const search = query.trim().toLocaleLowerCase("en");
  return words.filter((word) => {
    if (
      sourceId &&
      word.sourceId !== sourceId &&
      !word.occurrences?.some((entry) => entry.sourceId === sourceId)
    )
      return false;
    if (
      filter === "due" &&
      !(
        word.due &&
        word.status === "ready" &&
        !word.mastered &&
        word.dictionaryState !== "candidate"
      )
    )
      return false;
    if (filter === "pending" && word.status !== "pending") return false;
    if (filter === "failed" && word.status !== "failed") return false;
    if (filter === "unconfirmed" && word.status !== "unconfirmed") return false;
    if (filter === "bookmarked" && !word.bookmarked) return false;
    return (
      !search ||
      [word.word, word.meaning, word.source].some((text) =>
        text.toLocaleLowerCase("en").includes(search),
      )
    );
  });
}
