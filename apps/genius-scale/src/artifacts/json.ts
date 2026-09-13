import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sortJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJsonValue(value[key])]));
};

export const writeDeterministicJson = async (filePath: string, value: unknown): Promise<string> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `${JSON.stringify(sortJsonValue(value), null, 2)}\n`, 'utf8');
  return filePath;
};
