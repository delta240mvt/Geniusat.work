import { readFile } from "node:fs/promises";

import { parseJob, type Job } from "./schema.js";

export async function loadJobFromFile(filePath: string): Promise<Job> {
  const fileContents = await readFile(filePath, "utf8");
  return parseJob(JSON.parse(fileContents));
}
