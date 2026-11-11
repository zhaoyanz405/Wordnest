export function Highlight({ text = "", word = "" }) {
  const index = word
    ? text.toLocaleLowerCase("en").indexOf(word.toLocaleLowerCase("en"))
    : -1;
  return index < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + word.length)}</mark>
      {text.slice(index + word.length)}
    </>
  );
}
