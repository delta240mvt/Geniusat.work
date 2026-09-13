import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type FlowDocument = {
  title: string;
  description?: string;
  metadata?: Record<string, string | number | boolean | null>;
  steps: FlowStep[];
};

export type FlowStep = {
  id: string;
  title: string;
  next?: string[];
  notes?: string[];
};

export async function writeFlow(filePath: string, document: FlowDocument): Promise<string> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, renderFlow(document), "utf8");
  return filePath;
}

function renderFlow(document: FlowDocument): string {
  const lines: string[] = [`# ${document.title}`, ""];

  if (document.description) {
    lines.push(document.description, "");
  }

  if (document.metadata && Object.keys(document.metadata).length > 0) {
    lines.push("## Metadata");

    for (const key of Object.keys(document.metadata).sort()) {
      lines.push(`- ${key}: ${String(document.metadata[key])}`);
    }

    lines.push("");
  }

  lines.push("## Steps");

  document.steps.forEach((step, index) => {
    lines.push(`${index + 1}. \`${step.id}\` - ${step.title}`);

    if (step.next && step.next.length > 0) {
      lines.push(`   Next: ${[...step.next].sort().join(", ")}`);
    }

    for (const note of step.notes ?? []) {
      lines.push(`   - ${note}`);
    }
  });

  return `${lines.join("\n")}\n`;
}
