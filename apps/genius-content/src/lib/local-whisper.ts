import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolveContentRoot} from './app-root.js';
import './env.js';

const execFileAsync = promisify(execFile);

export type WhisperResult = {
  text?: string;
  language?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
    words?: Array<{
      start?: number;
      end?: number;
      word?: string;
      probability?: number;
    }>;
  }>;
};

export const transcribeWithLocalWhisper = async (inputPath: string): Promise<WhisperResult> => {
  const {stdout} = await execFileAsync(process.env.WHISPER_PYTHON || 'python', [resolveContentRoot('src/whisper/transcribe_medium.py'), inputPath], {
    maxBuffer: 50 * 1024 * 1024,
    encoding: 'buffer',
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
    windowsHide: true,
  });

  const payload = Buffer.isBuffer(stdout) ? stdout.toString('utf8') : Buffer.from(stdout).toString('utf8');
  return JSON.parse(payload.replace(/^\uFEFF/, '')) as WhisperResult;
};
