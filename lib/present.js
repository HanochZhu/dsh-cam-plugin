export const MAX_CHARS = 80_000;

export function present(value, maxChars = MAX_CHARS) {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  const omitted = text.length - maxChars;
  return `${text.slice(0, maxChars)}\n… truncated ${omitted} characters. Narrow the query or read one symbol.`;
}
