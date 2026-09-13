import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {it, expect} from 'vitest';
import {featuredReels} from '../src/reels/presets.js';
import {exampleReels} from './fixtures/reels.js';

it('starts without private presets and preserves user-authored local presets when supplied', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'genius-private-presets-'));
  const file = path.join(root,'featured-reels.json');
  try {
    expect(featuredReels(file)).toEqual([]);
    const reels = exampleReels();
    reels[0].title = 'Własny tytuł';
    await writeFile(file,JSON.stringify(reels));
    expect(featuredReels(file)).toEqual(reels);
    await writeFile(file,'{"broken":true}');
    expect(() => featuredReels(file)).toThrow();
  } finally { await rm(root,{recursive:true,force:true}); }
});
