export function parseSkill(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { description: "Query the local cam code graph and project memory.", content: raw.trim() };
  }
  const descriptionLine = match[1].match(/^description:\s*"([\s\S]*?)"\s*$/m);
  return {
    description: descriptionLine?.[1] ?? "Query the local cam code graph and project memory.",
    content: match[2].trim(),
  };
}
