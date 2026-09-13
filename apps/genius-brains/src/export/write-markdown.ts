import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeMarkdown(filePath: string, content: string): Promise<string> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const normalized = `${content.replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
  await writeFile(filePath, normalized, "utf8");
  return filePath;
}
