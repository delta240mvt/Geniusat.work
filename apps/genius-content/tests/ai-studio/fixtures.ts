import fs from 'node:fs/promises';
import path from 'node:path';

export const exampleScripts = "## 12. Gotowe Skrypty\n\n## 12.1 Skrypt: Example 1\n`script_id`: `demo_intro`\n`conflict_id`: `demo_intro`\n`viral_goal`:\n- Przykładowe narzędzia do pracy nad treścią.\n\n### Script\n`0:00-0:04` Zoe:\n> \"Oto przykładowy początek.\"\n\n`0:04-0:08` Elena:\n> \"Dodajmy prosty przykład.\"\n\n`0:08-0:12` Zoe:\n> \"Teraz mogę sprawdzić rezultat.\"\n\n`0:12-0:16` Elena:\n> \"Follow for more examples.\"\n\n## 12.2 Skrypt: Example 2\n`script_id`: `demo_edit`\n`conflict_id`: `demo_edit`\n`viral_goal`:\n- Przykładowe narzędzia do pracy nad treścią.\n\n### Script\n`0:00-0:04` Zoe:\n> \"Oto przykładowy początek.\"\n\n`0:04-0:08` Elena:\n> \"Dodajmy prosty przykład.\"\n\n`0:08-0:12` Zoe:\n> \"Teraz mogę sprawdzić rezultat.\"\n\n`0:12-0:16` Elena:\n> \"Follow for more examples.\"\n\n## 12.3 Skrypt: Example 3\n`script_id`: `demo_publish`\n`conflict_id`: `demo_publish`\n`viral_goal`:\n- Przykładowe narzędzia do pracy nad treścią.\n\n### Script\n`0:00-0:04` Zoe:\n> \"Oto przykładowy początek.\"\n\n`0:04-0:08` Elena:\n> \"Dodajmy prosty przykład.\"\n\n`0:08-0:12` Zoe:\n> \"Teraz mogę sprawdzić rezultat.\"\n\n`0:12-0:16` Elena:\n> \"Follow for more examples.\"\n";

const writeJson = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
};

const buildConfigSet = (contentRoot: string) => {
  const studioRoot = path.join(contentRoot, 'AI Studio');

  return {
    studio: {
      sourceFile: 'AI Studio/virality/Tworzenie Person AI do Promocji Memów.md',
      outputRoot: 'output/ai-studio/jobs',
      defaultAspectRatio: '9:16',
      defaultLanguage: 'pl-PL',
      timestampFormat: 'YYYYMMDD-HHmmss',
      naming: {
        jobSeparator: '-',
      },
    },
    models: {
      nanoBanana: {
        defaultModel: 'gemini-3.1-flash-image-preview',
        imageSize: '1080x1920',
        aspectRatio: '9:16',
      },
      veo: {
        defaultModel: 'veo-3.1-lite-generate-preview',
        fallbackModel: 'veo-3.1-fast-generate-preview',
        durationSeconds: 8,
        resolution: '1080x1920',
        personGeneration: 'allow_adult',
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
            timbre: 'reserved',
            cadence: 'medium',
            mouthMovement: 'natural',
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
            timbre: 'calm',
            cadence: 'measured',
            mouthMovement: 'precise',
            acousticEnvironment: 'treated room',
          },
        },
      },
    },
    shots: {
      shotOrder: ['zoe_open', 'elena_response', 'zoe_reaction', 'elena_cta'],
      definitions: {
        zoe_open: {activePersona: 'zoe', frameMode: 'first_only'},
        elena_response: {activePersona: 'elena', frameMode: 'first_only'},
        zoe_reaction: {activePersona: 'zoe', frameMode: 'first_and_last'},
        elena_cta: {activePersona: 'elena', frameMode: 'first_and_last'},
      },
    },
    prompts: {
      nanoBanana: {
        firstFrameTemplate: 'first {{shotId}}',
        lastFrameTemplate: 'last {{shotId}}',
      },
      veo: {
        shotTemplate: 'veo {{shotId}}',
      },
      audio: {
        dialogueTemplate: '{{line}}',
        ambientTemplate: '{{ambient}}',
      },
    },
  };
};

export const writeConfigFixture = async (contentRoot: string) => {
  const studioRoot = path.join(contentRoot, 'AI Studio');
  const configRoot = path.join(studioRoot, 'config');

  await fs.mkdir(path.join(studioRoot, 'virality'), {recursive: true});
  await fs.writeFile(path.join(studioRoot, 'virality', 'Tworzenie Person AI do Promocji Memów.md'), exampleScripts);

  for (const asset of ['Zoe_base.png', 'Zoe_round.png', 'Elena_base.png', 'Elena_round.png']) {
    await fs.writeFile(path.join(studioRoot, asset), asset);
  }

  const fixture = buildConfigSet(contentRoot);

  await writeJson(path.join(configRoot, 'studio.config.json'), fixture.studio);
  await writeJson(path.join(configRoot, 'models.json'), fixture.models);
  await writeJson(path.join(configRoot, 'personas.json'), fixture.personas);
  await writeJson(path.join(configRoot, 'shots.json'), fixture.shots);
  await writeJson(path.join(configRoot, 'prompts.json'), fixture.prompts);

  return {configRoot, fixture};
};
