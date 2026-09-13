import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {resolvePersonaLibrary, resolvePersonas} from '../../src/ai-studio/personas/resolve-personas.js';

const tempDirs: string[] = [];

const createTempRoot = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-studio-personas-'));
  tempDirs.push(tempRoot);
  return tempRoot;
};

const buildConfigFixture = (contentRoot: string) => {
  const studioRoot = path.join(contentRoot, 'AI Studio');

  return {
    models: {
      veo: {
        personGeneration: 'allow_adult' as const,
      },
    },
    personas: {
      personas: {
        zoe: {
          displayName: 'Zoe',
          references: [
            path.relative(contentRoot, path.join(studioRoot, 'Zoe_base.png')),
            path.relative(contentRoot, path.join(studioRoot, 'Zoe_round.png')),
          ],
          identity: ['adult woman', 'expressive hype persona'],
          negativeConstraints: ['minor'],
          voice: {
            timbre: 'bright contralto',
            cadence: 'fast punchy cadence',
            mouthMovement: 'natural speech sync',
            acousticEnvironment: 'dry studio',
          },
        },
        elena: {
          displayName: 'Elena',
          references: [
            path.relative(contentRoot, path.join(studioRoot, 'Elena_base.png')),
            path.relative(contentRoot, path.join(studioRoot, 'Elena_round.png')),
          ],
          identity: ['adult woman', 'technical explainer'],
          negativeConstraints: ['minor'],
          voice: {
            timbre: 'calm alto',
            cadence: 'measured',
            mouthMovement: 'precise articulation',
            acousticEnvironment: 'treated room',
          },
        },
      },
    },
  };
};

const buildLibraryConfig = (contentRoot: string) => {
  const studioRoot = path.join(contentRoot, 'AI Studio');
  const fixture = buildConfigFixture(contentRoot);

  return {
    models: fixture.models,
    personas: {
      personas: {
        zoe: {
          id: 'zoe',
          displayName: fixture.personas.personas.zoe.displayName,
          identity: fixture.personas.personas.zoe.identity,
          negativeConstraints: fixture.personas.personas.zoe.negativeConstraints,
          voice: fixture.personas.personas.zoe.voice,
          references: fixture.personas.personas.zoe.references,
          referenceImages: [
            {
              path: 'AI Studio/Zoe_base.png',
              absolutePath: path.join(studioRoot, 'Zoe_base.png'),
            },
            {
              path: 'AI Studio/Zoe_round.png',
              absolutePath: path.join(studioRoot, 'Zoe_round.png'),
            },
          ],
        },
        elena: {
          id: 'elena',
          displayName: fixture.personas.personas.elena.displayName,
          identity: fixture.personas.personas.elena.identity,
          negativeConstraints: fixture.personas.personas.elena.negativeConstraints,
          voice: fixture.personas.personas.elena.voice,
          references: fixture.personas.personas.elena.references,
          referenceImages: [
            {
              path: 'AI Studio/Elena_base.png',
              absolutePath: path.join(studioRoot, 'Elena_base.png'),
            },
            {
              path: 'AI Studio/Elena_round.png',
              absolutePath: path.join(studioRoot, 'Elena_round.png'),
            },
          ],
        },
      },
    },
  };
};

const writeFixture = async (contentRoot: string) => {
  const studioRoot = path.join(contentRoot, 'AI Studio');
  const fixture = buildConfigFixture(contentRoot);

  await fs.mkdir(studioRoot, {recursive: true});

  for (const asset of ['Zoe_base.png', 'Zoe_round.png', 'Elena_base.png', 'Elena_round.png']) {
    await fs.writeFile(path.join(studioRoot, asset), asset);
  }

  return fixture;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, {recursive: true, force: true})));
});

describe('resolvePersonaLibrary', () => {
  it('resolves Zoe and Elena refs from config with all four image paths present', async () => {
    const contentRoot = await createTempRoot();
    await writeFixture(contentRoot);
    const config = buildLibraryConfig(contentRoot);

    const personas = resolvePersonaLibrary(config);

    expect(Object.keys(personas)).toEqual(['zoe', 'elena']);
    expect(personas.zoe.canonicalRefs.nanoBanana[0].absolutePath).toBe(path.join(contentRoot, 'AI Studio', 'Zoe_base.png'));
    expect(personas.zoe.canonicalRefs.nanoBanana[1].absolutePath).toBe(path.join(contentRoot, 'AI Studio', 'Zoe_round.png'));
    expect(personas.elena.canonicalRefs.nanoBanana[0].absolutePath).toBe(path.join(contentRoot, 'AI Studio', 'Elena_base.png'));
    expect(personas.elena.canonicalRefs.nanoBanana[1].absolutePath).toBe(path.join(contentRoot, 'AI Studio', 'Elena_round.png'));
  });

  it('fails when a configured persona image path is missing on disk', async () => {
    const contentRoot = await createTempRoot();
    await writeFixture(contentRoot);

    await fs.rm(path.join(contentRoot, 'AI Studio', 'Elena_round.png'));

    await expect(
      resolvePersonas({
        contentRoot,
        models: {
          veo: {
            personGeneration: 'allow_adult',
          },
        },
        personas: {
          personas: {
            zoe: {
              displayName: 'Zoe',
              references: ['AI Studio/Zoe_base.png', 'AI Studio/Zoe_round.png'],
              identity: ['adult woman'],
              negativeConstraints: ['minor'],
              voice: {
                timbre: 'bright',
                cadence: 'quick',
                mouthMovement: 'natural',
                acousticEnvironment: 'dry studio',
              },
            },
            elena: {
              displayName: 'Elena',
              references: ['AI Studio/Elena_base.png', 'AI Studio/Elena_round.png'],
              identity: ['adult woman'],
              negativeConstraints: ['minor'],
              voice: {
                timbre: 'calm',
                cadence: 'measured',
                mouthMovement: 'precise',
                acousticEnvironment: 'treated room',
              },
            },
          },
        },
      }),
    ).rejects.toThrow(/Elena_round\.png/i);
  });

  it('carries allow_adult policy through resolved persona metadata', async () => {
    const contentRoot = await createTempRoot();
    await writeFixture(contentRoot);
    const config = buildLibraryConfig(contentRoot);

    const personas = resolvePersonaLibrary(config);

    expect(personas.zoe.isAdult).toBe(true);
    expect(personas.elena.regionPolicy.veoPersonGeneration).toBe('allow_adult');
    expect(personas.zoe.regionPolicy.veoPersonGeneration).toBe('allow_adult');
  });

  it('includes future voice placeholder fields alongside the current voice profile', async () => {
    const contentRoot = await createTempRoot();
    await writeFixture(contentRoot);
    const config = buildLibraryConfig(contentRoot);

    const personas = resolvePersonaLibrary(config);

    expect(personas.zoe.voiceProfile).toEqual({
      timbre: 'bright contralto',
      cadence: 'fast punchy cadence',
      mouthMovement: 'natural speech sync',
      acousticEnvironment: 'dry studio',
    });
    expect(personas.zoe.futureVoice).toEqual({
      timbreProfile: null,
      cadenceProfile: null,
      mouthMovementConstraints: null,
      acousticEnvironmentNotes: null,
    });
    expect(personas.zoe.promptAnchors.adultGuardLine).toMatch(/adult/i);
  });

  it('caps Veo reference allocation to three slots', async () => {
    const contentRoot = await createTempRoot();
    for (const asset of ['Zoe_base.png', 'Zoe_round.png', 'Elena_base.png', 'Elena_round.png', 'Elena_alt.png']) {
      await fs.mkdir(path.join(contentRoot, 'AI Studio'), {recursive: true});
      await fs.writeFile(path.join(contentRoot, 'AI Studio', asset), asset);
    }

    const resolved = await resolvePersonas({
      contentRoot,
      models: {
        veo: {
          personGeneration: 'allow_adult',
        },
      },
      personas: {
        personas: {
          zoe: {
            displayName: 'Zoe',
            references: ['AI Studio/Zoe_base.png', 'AI Studio/Zoe_round.png'],
            identity: ['adult woman'],
            negativeConstraints: ['minor'],
            voice: {
              timbre: 'bright',
              cadence: 'quick',
              mouthMovement: 'natural',
              acousticEnvironment: 'dry studio',
            },
          },
          elena: {
            displayName: 'Elena',
            references: [
              'AI Studio/Elena_base.png',
              'AI Studio/Elena_round.png',
              'AI Studio/Elena_alt.png',
              'AI Studio/Elena_base.png',
            ],
            identity: ['adult woman'],
            negativeConstraints: ['minor'],
            voice: {
              timbre: 'calm',
              cadence: 'measured',
              mouthMovement: 'precise',
              acousticEnvironment: 'treated room',
            },
          },
        },
      },
    });

    expect(resolved.veoReferenceLimit).toBe(3);
    expect(resolved.personas.zoe.canonicalRefs.veo).toHaveLength(2);
    expect(resolved.personas.elena.canonicalRefs.veo).toHaveLength(3);
  });
});
