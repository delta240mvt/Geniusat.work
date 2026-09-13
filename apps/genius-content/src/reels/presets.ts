import {readFileSync} from 'node:fs';
import {resolveContentRoot} from '../lib/app-root.js';
import {reelSchema, type Reel} from './model.js';

// Optional private presets stay with recordings, outside the published source.
export function featuredReels(file = resolveContentRoot('input/featured-reels.json')): Reel[] {
  let raw: string;
  try { raw = readFileSync(file, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return reelSchema.array().parse(JSON.parse(raw));
}
