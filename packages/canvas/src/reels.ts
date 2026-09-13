import {readdir, readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {IncomingMessage, ServerResponse} from 'node:http';
import type {CanvasConfig} from './types.js';

const execFileAsync = promisify(execFile);
type Job = {
  id: string;
  reelId: string;
  action: string;
  engine?: string;
  status: 'running' | 'complete' | 'failed';
  message: string;
  startedAt: string;
  finishedAt?: string;
};
const jobs = new Map<string, Job>();
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
const present = async (p: string) =>
  stat(p).then(
    (s) => s.size > 0,
    () => false,
  );
const json = (response: ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
};
const appPath = (c: CanvasConfig, ...parts: string[]) =>
  path.join(c.workspaceRoot, 'apps/genius-content', ...parts);
const fileUrl = (relative: string) =>
  '/api/workspace/' +
  relative.replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/');

export async function reelCatalog(config: CanvasConfig) {
  const names = await readdir(appPath(config, 'reels')).catch(() => []);
  const warnings: string[] = [];
  const entries = await Promise.all(
    names
      .filter((n) => n.endsWith('.json'))
      .map(async (n) => {
        try {
          const reel = {...JSON.parse(
            await readFile(appPath(config, 'reels', n), 'utf8'),
          ), preferredEngine: 'hyperframes'};
          if (
            !validId(reel.id) ||
            !Array.isArray(reel.clips) ||
            !reel.clips.length
          )
            throw new Error('Niepoprawny zapis rolki.');
          const previewPath = appPath(
            config,
            'public/reels',
            reel.id,
            'index.html',
          );
          const outputs = [];
          for (const engine of ['hyperframes']) {
            const relative = `apps/genius-content/output/renders/${reel.id}-${engine}.mp4`;
            if (await present(path.join(config.workspaceRoot, relative))) {
              const info = await stat(
                path.join(config.workspaceRoot, relative),
              );
              const provenance = await readFile(
                appPath(config, 'output/renders', `${reel.id}-${engine}.json`),
                'utf8',
              )
                .then(JSON.parse)
                .catch(() => ({}));
              outputs.push({
                engine,
                url: fileUrl(relative),
                bytes: info.size,
                updatedAt: info.mtime.toISOString(),
                stale: JSON.stringify(provenance.reel) !== JSON.stringify(reel),
              });
            }
          }
          return {
            ...reel,
            duration: reel.clips.reduce(
              (n: number, c: {start: number; end: number}) =>
                n + c.end - c.start,
              0,
            ),
            outputs,
            previewUrl: (await present(previewPath))
              ? fileUrl(
                  `apps/genius-content/public/reels/${reel.id}/index.html`,
                ) + '?preview=1'
              : null,
          };
        } catch {
          warnings.push(
            `Nie można odczytać projektu ${n}. Pozostałe projekty są dostępne.`,
          );
          return null;
        }
      }),
  );
  return {
    reels: entries.filter((entry) => entry !== null),
    warnings,
    jobs: [...jobs.values()].slice(-20),
  };
}

export async function reelLibrary(config: CanvasConfig) {
  const names = await readdir(config.videoRoot).catch(() => []);
  const bundled = await readFile(
    appPath(config, 'input/library-transcripts.json'),
    'utf8',
  )
    .then(JSON.parse)
    .catch(() => ({}));
  const result = [];
  for (const name of names.filter(
    (n) => /\.(mov|mp4)$/i.test(n) && !/(studio|browser|remotion)/i.test(n),
  )) {
    const sourceId = name.replace(/\.[^.]+$/, '').toLowerCase();
    if (!validId(sourceId)) continue;
    const sourcePath = path.join(config.videoRoot, name);
    const info = await stat(sourcePath);
    if (info.size < 1000) continue;
    try {
      const {stdout} = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration:stream=codec_type',
          '-of',
          'json',
          sourcePath,
        ],
        {windowsHide: true, timeout: 15000},
      );
      const metadata = JSON.parse(stdout);
      const duration = Number(metadata.format.duration);
      const transcript =
        bundled[sourceId] ??
        (await readFile(
          appPath(
            config,
            'output/pipeline',
            sourceId,
            '00-transcript-clean.json',
          ),
          'utf8',
        )
          .then(JSON.parse)
          .catch(() => null));
      const ready =
        Array.isArray(transcript?.speech) &&
        transcript.speech.some(
          (segment: {words?: unknown[]}) => segment.words?.length,
        );
      const usable =
        Number.isFinite(duration) &&
        duration > 0 &&
        duration <= 1800 &&
        metadata.streams.some(
          (stream: {codec_type: string}) => stream.codec_type === 'audio',
        );
      result.push({
        sourceId,
        name,
        duration,
        bytes: info.size,
        transcriptReady: ready,
        usable,
      });
    } catch {
      result.push({
        sourceId,
        name,
        duration: 0,
        bytes: info.size,
        transcriptReady: false,
        usable: false,
      });
    }
  }
  return result;
}

async function requestJson(request: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Żądanie jest za duże.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
    string,
    unknown
  >;
}

async function startJob(
  config: CanvasConfig,
  payload: Record<string, unknown>,
) {
  if ([...jobs.values()].some((j) => j.status === 'running'))
    throw new Error(
      'Trwa przygotowanie lub renderowanie. Poczekaj na zakończenie.',
    );
  const id = randomUUID();
  const job: Job = {
    id,
    reelId: String(payload.id),
    action: String(payload.action),
    engine: payload.engine as string | undefined,
    status: 'running',
    message: 'Rozpoczynam…',
    startedAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  const folder = appPath(config, 'output/tmp/reel-jobs');
  const requestFile = path.join(folder, `${id}.json`);
  try {
    await mkdir(folder, {recursive: true});
    await writeFile(requestFile, JSON.stringify(payload));
  } catch (error) {
    job.status = 'failed';
    job.message = String(error);
    throw error;
  }
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', appPath(config, 'scripts/reel-job.ts'), requestFile],
    {
      cwd: config.workspaceRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let tail = '';
  const receive = (chunk: Buffer) => {
    tail = (tail + chunk.toString()).slice(-3000);
    const line = chunk
      .toString()
      .replace(/\x1b\[[0-9;]*m/g, '')
      .split(/[\r\n]/)
      .filter(Boolean)
      .at(-1);
    if (line) job.message = line.slice(-400);
  };
  child.stdout.on('data', receive);
  child.stderr.on('data', receive);
  child.on('error', (error) => {
    job.status = 'failed';
    job.message = error.message;
    job.finishedAt = new Date().toISOString();
  });
  child.on('close', (code) => {
    job.status = code === 0 ? 'complete' : 'failed';
    job.message =
      code === 0 ? 'Gotowe. Podgląd i pliki są dostępne.' : tail.slice(-1500);
    job.finishedAt = new Date().toISOString();
  });
  if (jobs.size > 30) jobs.delete(jobs.keys().next().value!);
  return job;
}

export async function handleReelRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  config: CanvasConfig,
) {
  if (!url.pathname.startsWith('/api/reels')) return false;
  try {
    if (request.method === 'GET' && url.pathname === '/api/reels')
      json(response, 200, await reelCatalog(config));
    else if (request.method === 'GET' && url.pathname === '/api/reels/library')
      json(response, 200, await reelLibrary(config));
    else if (request.method === 'POST') {
      if (request.headers.origin && request.headers.origin !== url.origin) {
        json(response, 403, {
          error: 'Żądanie musi pochodzić z tego workspace.',
        });
        return true;
      }
      const body = await requestJson(request);
      if (url.pathname === '/api/reels') {
        const source = (await reelLibrary(config)).find(
          (s) => s.sourceId === body.sourceId && s.usable,
        );
        if (!source)
          throw new Error(
            'Wybierz poprawne nagranie z dźwiękiem, do 30 minut.',
          );
        if (
          typeof body.title !== 'string' ||
          !body.title.trim() ||
          body.title.length > 100
        )
          throw new Error('Wpisz tytuł (do 100 znaków).');
        if (
          body.style !== undefined &&
          !['editorial', 'signal'].includes(String(body.style))
        )
          throw new Error('Wybierz dostępny styl.');
        const id = `${source.sourceId}-${Date.now().toString(36)}`;
        json(
          response,
          202,
          await startJob(config, {
            action: 'create',
            id,
            sourceId: source.sourceId,
            sourceFile: source.name,
            duration: source.duration,
            title: body.title.trim(),
            style: body.style ?? 'editorial',
          }),
        );
      } else {
        const match = url.pathname.match(
          /^\/api\/reels\/([a-z0-9-]+)\/(render|prepare|save)$/,
        );
        if (
          !match ||
          !validId(match[1]) ||
          !(await present(appPath(config, 'reels', `${match[1]}.json`)))
        )
          throw new Error('Nie znaleziono rolki.');
        if (
          body.engine !== undefined &&
          body.engine !== 'hyperframes'
        )
          throw new Error('Niepoprawny silnik renderowania.');
        json(
          response,
          202,
          await startJob(config, {
            action: match[2],
            id: match[1],
            engine: body.engine,
            title: body.title,
            style: body.style,
            scenes: body.scenes,
          }),
        );
      }
    } else json(response, 405, {error: 'Niedozwolona metoda.'});
  } catch (error) {
    json(response, 400, {
      error:
        error instanceof Error
          ? error.message
          : 'Nie udało się wykonać operacji.',
    });
  }
  return true;
}
