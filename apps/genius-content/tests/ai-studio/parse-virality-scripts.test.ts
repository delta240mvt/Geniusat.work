import {describe, expect, it} from 'vitest';

import {exampleScripts} from './fixtures.js';
import {parseViralityScripts} from '../../src/ai-studio/parsers/parse-virality-scripts.js';

describe('ai studio script parser', () => {
  it('parses synthetic script ids and extracts exactly four beats per script', () => {
    const library = parseViralityScripts(exampleScripts, {sourcePath:'example.md',strict:true});
    const ids = library.scripts.map((script) => script.script_id);

    expect(ids).toEqual(['demo_intro', 'demo_edit', 'demo_publish']);
    expect(library.sourcePath).toBe('example.md');

    const ideWar = library.scripts.find((script) => script.script_id === 'demo_publish');
    expect(ideWar?.conflict_id).toBe('demo_publish');
    expect(ideWar?.viral_goal).toMatch(/narz[eę]dzia/i);
    expect(ideWar?.beats).toHaveLength(4);
    expect(ideWar?.beats.map((beat) => beat.speaker)).toEqual(['zoe', 'elena', 'zoe', 'elena']);
    expect(ideWar?.beats.map((beat) => beat.key)).toEqual([
      'zoe_open',
      'elena_response',
      'zoe_reaction',
      'elena_cta',
    ]);
    expect(ideWar?.beats[0]).toMatchObject({
      startTime: '0:00',
      endTime: '0:04',
      speaker: 'zoe',
    });
    expect(ideWar?.beats[3]?.cta).toMatch(/follow/i);
  });

  it('normalizes Zoe and Elena speaker labels from markdown headers', () => {
    const parsed = parseViralityScripts(
      `
## 12. Gotowe Skrypty

## 12.1 Skrypt: Demo
\`script_id\`: \`demo\`
\`conflict_id\`: \`demo_conflict\`
\`viral_goal\`:
- normalize speaker labels

### Script
\`0:00-0:01\` Zoe:
> "One."

\`0:01-0:02\` Elena:
> "Two."

\`0:02-0:03\` Zoe:
> "Three."

\`0:03-0:04\` Elena:
> "Four."
`,
      {sourcePath: 'AI Studio/virality/test.md'},
    );

    expect(parsed.scripts[0]?.beats.map((beat) => beat.speaker)).toEqual([
      'zoe',
      'elena',
      'zoe',
      'elena',
    ]);
  });

  it('fails on duplicate script ids', () => {
    expect(() =>
      parseViralityScripts(
        `
## 12. Gotowe Skrypty

## 12.1 Skrypt: First
\`script_id\`: \`dup\`
\`conflict_id\`: \`alpha\`
\`viral_goal\`:
- one
### Script
\`0:00-0:01\` Zoe:
> "One."
\`0:01-0:02\` Elena:
> "Two."
\`0:02-0:03\` Zoe:
> "Three."
\`0:03-0:04\` Elena:
> "Four."

## 12.2 Skrypt: Second
\`script_id\`: \`dup\`
\`conflict_id\`: \`beta\`
\`viral_goal\`:
- two
### Script
\`0:00-0:01\` Zoe:
> "One."
\`0:01-0:02\` Elena:
> "Two."
\`0:02-0:03\` Zoe:
> "Three."
\`0:03-0:04\` Elena:
> "Four."
`,
        {sourcePath: 'AI Studio/virality/test.md'},
      ),
    ).toThrow(/duplicate script_id/i);
  });

  it('fails on structurally incomplete script blocks in strict mode', () => {
    expect(() =>
      parseViralityScripts(
        `
## 12. Gotowe Skrypty

## 12.1 Skrypt: Broken
\`script_id\`: \`broken\`
\`conflict_id\`: \`broken\`
\`viral_goal\`:
- incomplete
### Script
\`0:00-0:01\` Zoe:
> "One."
\`0:01-0:02\` Elena:
> "Two."
\`0:02-0:03\` Zoe:
> "Three."
`,
        {sourcePath: 'AI Studio/virality/test.md', strict: true},
      ),
    ).toThrow(/exactly 4 beats/i);
  });
});
