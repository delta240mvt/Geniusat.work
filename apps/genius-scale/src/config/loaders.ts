import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {
  ContentItemSchema,
  ProjectConfigSchema,
  parseContentItem,
  parseProjectConfig,
  type ContentItem,
  type ProjectConfig,
} from './schema.js';

const readJsonFile = async (filePath: string): Promise<unknown> => JSON.parse(await readFile(filePath, 'utf8'));

export const loadProjectFromFile = async (filePath: string): Promise<ProjectConfig> =>
  parseProjectConfig(await readJsonFile(filePath));

export const loadContentItemFromFile = async (filePath: string): Promise<ContentItem> =>
  parseContentItem(await readJsonFile(filePath));

export const loadContentItemsFromFile = async (filePath: string): Promise<ContentItem[]> => {
  const value = await readJsonFile(filePath);

  if (Array.isArray(value)) {
    return z.array(ContentItemSchema).parse(value);
  }

  return [ContentItemSchema.parse(value)];
};
