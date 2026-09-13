import path from 'node:path';
import {fileURLToPath} from 'node:url';

export interface ScalePaths {
  outputRoot: string;
  preparedItemsFile: string;
  calendarFile: string;
  calendarMarkdownFile: string;
  runsRoot: string;
  getItemRunDir: (itemId: string) => string;
}

export interface CreateScalePathsInput {
  outputRoot?: string;
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const safePathSegment = (value: string): string => {
  const encoded = encodeURIComponent(value).replace(/[.!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return encoded.length > 0 ? encoded : '_';
};

export const createScalePaths = (input: CreateScalePathsInput = {}): ScalePaths => {
  const outputRoot = path.resolve(input.outputRoot ?? path.join(packageRoot, 'output'));
  const runsRoot = path.join(outputRoot, 'runs');

  return {
    outputRoot,
    preparedItemsFile: path.join(outputRoot, 'prepared-items.json'),
    calendarFile: path.join(outputRoot, 'calendar.json'),
    calendarMarkdownFile: path.join(outputRoot, 'calendar.md'),
    runsRoot,
    getItemRunDir: (itemId: string) => path.join(runsRoot, safePathSegment(itemId)),
  };
};
