import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeDeterministicJson(filePath: string, value: unknown): Promise<string> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const content = `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
  await writeFile(filePath, content, "utf8");
  return filePath;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortJsonValue((value as Record<string, unknown>)[key]);
        return sorted;
      }, {});
  }

  return value;
}
