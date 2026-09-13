import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {resolveFromContentOrAbsolute} from '../src/lib/app-root.js';
import {
  assertInputExists,
  getVideoId,
  stageSourceVideo,
} from '../src/lib/paths.js';
import {runTranscriptStage} from '../src/lib/transcript-stage.js';
import {createReel} from '../src/reels/model.js';
import {
  exists,
  loadReel,
  prepareReel,
  reelsRoot,
  saveReel,
} from '../src/reels/files.js';
import {readTranscript} from '../src/reels/transcripts.js';
import {renderReel} from '../src/reels/render.js';

export function parsePipelineArgs(argv: string[]) {
  const {positionals, values} = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      prepare: {type: 'boolean', default: false},
      engine: {type: 'string', default: 'hyperframes'},
      title: {type: 'string'},
      help: {type: 'boolean', default: false},
    },
  });
  if (values.help) return {help: true as const};
  if (positionals.length !== 1)
    throw new Error(
      'Podaj ścieżkę do jednego nagrania MOV lub MP4. Użycie: npm run pipeline -- "input/film.MOV"',
    );
  if (!/\.(mov|mp4)$/i.test(positionals[0]))
    throw new Error('Obsługiwane nagrania: MOV i MP4.');
  if (values.engine !== 'hyperframes')
    throw new Error('Silnik eksportu to Hyperframes.');
  return {
    help: false as const,
    inputPath: resolveFromContentOrAbsolute(positionals[0]),
    prepare: values.prepare,
    engine: values.engine,
    title: values.title,
  } as const;
}

export async function main(argv: string[]) {
  const options = parsePipelineArgs(argv);
  if (options.help) {
    console.log(
      'npm run pipeline -- "input/film.MOV" [--prepare] [--title "Tytuł"] — eksport Hyperframes',
    );
    return;
  }
  await assertInputExists(options.inputPath);
  const id = getVideoId(options.inputPath);
  let reel;
  if (await exists(path.join(reelsRoot, `${id}.json`))) {
    reel = await loadReel(id);
    console.log('Korzystam z zapisanego scenariusza.');
  } else {
    const source = await stageSourceVideo(options.inputPath, id);
    let speech = await readTranscript(id);
    if (!speech) {
      console.log('Tworzę napisy lokalnie…');
      speech = (await runTranscriptStage({inputPath: options.inputPath}))
        .speech;
    }
    if (!speech.some((segment) => segment.words.length))
      throw new Error('Nie wykryto mowy w nagraniu.');
    const {execFile} = await import('node:child_process');
    const {promisify} = await import('node:util');
    const {stdout} = await promisify(execFile)(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        source,
      ],
      {windowsHide: true},
    );
    reel = await saveReel(
      createReel({
        id,
        sourceId: id,
        sourceFile: path.basename(source),
        title: options.title || speech[0].text.trim().slice(0, 90) || id,
        duration: Number(JSON.parse(stdout).format.duration),
        speech,
      }),
    );
  }
  return options.prepare ? prepareReel(reel) : renderReel(reel);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
