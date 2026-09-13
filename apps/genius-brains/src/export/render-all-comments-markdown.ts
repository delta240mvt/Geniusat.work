export type AllCommentsValue = string | number | boolean | null;

export function renderAllCommentsMarkdown<T extends object>(comments: T[]): string {
  return comments.map(renderYamlBlock).join("\n\n");
}

function renderYamlBlock(comment: object): string {
  const lines = ["```yaml"];

  for (const [key, value] of Object.entries(comment as Record<string, unknown>)) {
    if (key === "text") {
      lines.push(`${key}: |`);
      for (const line of String(value ?? "").replace(/\r\n?/g, "\n").split("\n")) {
        lines.push(`  ${line}`);
      }
      continue;
    }

    lines.push(`${key}: ${formatYamlValue(toYamlValue(value))}`);
  }

  lines.push("```");
  return lines.join("\n");
}

function formatYamlValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function toYamlValue(value: unknown): AllCommentsValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return JSON.stringify(value);
}
