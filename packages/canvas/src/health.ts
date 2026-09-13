import {execFile} from 'node:child_process';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {parse} from 'dotenv';

const exec = promisify(execFile);
const fileExists = (file: string) =>
  stat(file).then(
    (info) => info.isFile(),
    () => false,
  );

export async function readHealth(workspaceRoot: string) {
  const contentRoot = path.join(workspaceRoot, 'apps/genius-content');
  const rootEnv = parse(
    await readFile(path.join(workspaceRoot, '.env'), 'utf8').catch(() => ''),
  );
  const contentEnv = parse(
    await readFile(path.join(contentRoot, '.env'), 'utf8').catch(() => ''),
  );
  const env = {...rootEnv, ...contentEnv, ...process.env};
  const has = (name: string) => Boolean(env[name]?.trim());
  const probe = async (command: string, args: string[]) => {
    try {
      const result = await exec(command, args, {
        windowsHide: true,
        timeout: 15_000,
      });
      return {ok: true, output: result.stdout};
    } catch {
      return {ok: false, output: ''};
    }
  };
  const [ffmpeg, ffprobe, whisper] = await Promise.all([
    probe('ffmpeg', ['-hide_banner', '-filters']),
    probe('ffprobe', ['-version']),
    probe(env.WHISPER_PYTHON || 'python', [
      '-c',
      'import whisper; print("ready")',
    ]),
  ]);
  const filtersReady = ['zscale', 'tonemap', 'loudnorm'].every((name) =>
    ffmpeg.output.includes(name),
  );
  const serviceAccountReady =
    has('GOOGLE_SERVICE_ACCOUNT_JSON') &&
    (await fileExists(
      path.resolve(workspaceRoot, env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    ));
  return {
    checkedAt: new Date().toISOString(),
    checks: [
      {
        name: 'Eksport MP4',
        ready: ffmpeg.ok && ffprobe.ok && filtersReady,
        detail:
          ffmpeg.ok && ffprobe.ok && filtersReady
            ? 'FFmpeg i obsługa obrazu HDR są gotowe.'
            : 'Zainstaluj FFmpeg i ffprobe z filtrami zscale, tonemap, loudnorm.',
      },
      {
        name: 'Napisy lokalne',
        ready: whisper.ok,
        detail: whisper.ok
          ? 'Whisper jest dostępny. Przy pierwszym użyciu pobiera model.'
          : 'Zainstaluj openai-whisper lub wskaż interpreter przez WHISPER_PYTHON.',
      },
    ],
    integrations: [
      {
        name: 'Korekta napisów z Gemini',
        configured:
          has('GEMINI_API_KEY') ||
          has('GOOGLE_API_KEY') ||
          has('GOOGLE_VIDEO_INTELLIGENCE_API_KEY'),
        variables: ['GEMINI_API_KEY'],
        detail: 'Opcjonalna. Bez klucza działa lokalna korekta napisów.',
      },
      {
        name: 'Materiały z internetu',
        configured: has('FIRECRAWL_API_KEY'),
        variables: ['FIRECRAWL_API_KEY'],
        detail: 'Firecrawl dla dodatkowego researchu.',
      },
      {
        name: 'Komentarze YouTube',
        configured: has('YOUTUBE_API_KEY'),
        variables: ['YOUTUBE_API_KEY'],
        detail: 'Analiza komentarzy w Genius@Brains.',
      },
      {
        name: 'Analiza obrazu w Google Cloud',
        configured:
          serviceAccountReady || has('GOOGLE_VIDEO_INTELLIGENCE_ACCESS_TOKEN'),
        variables: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
        detail:
          'Opcjonalny plik konta usługi; alternatywnie OAuth lub lokalne ADC. Nie jest potrzebny do eksportu rolek.',
      },
      {
        name: 'Publikacja w Threads',
        configured: has('THREADS_ACCESS_TOKEN') && has('THREADS_USER_ID'),
        variables: ['THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'],
        detail: 'Potrzebne tylko do publikowania przez Genius@Scale.',
      },
    ],
    note: 'Status potwierdza obecność konfiguracji. Nie sprawdza ważności kluczy ani uprawnień w usługach.',
  };
}
