import {z} from 'zod';

export const BRAND = {
  ink: '#020304', ivory: '#F8F7F3', paper: '#FFFEFA', turquoise: '#00D6D8',
  yellow: '#F2E500', violet: '#8F5BFF', violetText: '#6350BE', muted: '#656565',
  line: 'rgba(2,3,4,.18)', sans: 'Inter, Arial, sans-serif', mono: '"IBM Plex Mono", Consolas, monospace',
} as const;
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const wordSchema = z.object({word: z.string(), startMs: z.number().nonnegative(), endMs: z.number().nonnegative()});
export const sceneSchema = z.object({
  start: z.number().nonnegative(), end: z.number().positive(),
  kicker: z.string().max(70), title: z.string().min(1).max(90),
  accent: z.enum(['turquoise', 'yellow', 'violet']),
  graphic: z.enum(['models', 'code', 'writing', 'research', 'pipeline', 'wave', 'assets', 'render', 'outro']),
  detail: z.string().max(150), labels: z.array(z.string().max(40)).max(4),
});
export const reelSchema = z.object({
  version: z.literal(1), id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  title: z.string().min(1).max(100), sourceId: z.string().regex(/^[a-z0-9-]+$/),
  sourceFile: z.string().regex(/^[\w.-]+\.(mp4|mov)$/i),
  style: z.enum(['editorial', 'signal']), preferredEngine: z.literal('hyperframes').default('hyperframes'),
  motionConcept: z.enum(['interface', 'metaphor', 'transformation']).optional(),
  clips: z.array(z.object({start: z.number().nonnegative(), end: z.number().positive()})).min(1),
  scenes: z.array(sceneSchema).min(1), words: z.array(wordSchema),
  sourceNote: z.string(),
}).superRefine((reel, ctx) => {
  if (!reel.scenes.length) return;
  let duration = 0;
  reel.clips.forEach((clip, i) => {
    if (clip.end <= clip.start) ctx.addIssue({code: 'custom', path: ['clips', i], message: 'Koniec ujęcia musi być po początku.'});
    duration += clip.end - clip.start;
  });
  reel.scenes.forEach((scene, i) => {
    if (scene.end <= scene.start || Math.abs(scene.start - (reel.scenes[i - 1]?.end ?? 0)) > .05)
      ctx.addIssue({code: 'custom', path: ['scenes', i], message: 'Sceny muszą kolejno pokrywać cały montaż.'});
  });
  if (Math.abs(reel.scenes.at(-1)!.end - duration) > .06)
    ctx.addIssue({code: 'custom', path: ['scenes'], message: 'Czas scen nie zgadza się z montażem.'});
  reel.words.forEach((word, i) => {
    if (word.endMs < word.startMs || word.endMs > duration * 1000 + 50 || word.startMs < (reel.words[i-1]?.startMs ?? 0))
      ctx.addIssue({code: 'custom', path: ['words', i], message: 'Niepoprawna kolejność lub czas napisów.'});
  });
});
export type Reel = z.infer<typeof reelSchema>;
export type ReelScene = z.infer<typeof sceneSchema>;
export type Word = z.infer<typeof wordSchema>;
export type Speech = {startMs: number; endMs: number; text: string; words: Word[]};
export const reelDuration = (reel: Reel) => reel.clips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
export const reelFrames = (reel: Reel) => Math.round(reelDuration(reel) * FPS);

export function normalizeWords(words: Word[]): Word[] {
  const result: Word[]=[];
  for(let i=0;i<words.length;i++) {
    const current=words[i], next=words[i+1];
    if(/^chat$/i.test(current.word)&&next&&/^GPT\b/i.test(next.word)) {
      result.push({...current,word:`Chat${next.word.replace(/^gpt/i,'GPT')}`,endMs:next.endMs});i++;
    } else result.push({...current});
  }
  return result;
}

/** Preserve source timing through cuts; never stretch speech to an arbitrary runtime. */
export function cutWords(speech: Speech[], clips: Reel['clips']): Word[] {
  let offset = 0;
  return clips.flatMap((clip) => {
    const words = normalizeWords(speech.flatMap(s => s.words)).filter(w => w.startMs >= clip.start * 1000 && w.startMs < clip.end * 1000)
      .map(w => ({...w, startMs: Math.round(w.startMs - clip.start * 1000 + offset), endMs: Math.round(Math.min(w.endMs, clip.end * 1000) - clip.start * 1000 + offset)}));
    offset += (clip.end - clip.start) * 1000;
    return words;
  });
}

export function captionPages(words: Word[]): Word[][] {
  const pages: Word[][] = [];
  let page: Word[] = [];
  for (const word of words) {
    const chars = [...page, word].map(w => w.word).join(' ').length;
    if (page.length && (chars > 36 || page.length >= 6 || word.startMs - page.at(-1)!.endMs > 450)) {
      pages.push(page); page = [];
    }
    page.push(word);
    if (/[.!?]$/.test(word.word)) { pages.push(page); page = []; }
  }
  if (page.length) pages.push(page);
  return pages;
}

export function graphicForText(text: string): ReelScene['graphic'] {
  if(/whisper|transkry|timestamp/i.test(text))return 'wave';
  if(/scrap|aset|asset|materiał/i.test(text))return 'assets';
  if(/remotion|hyperframe|render|montaż|animac/i.test(text))return 'render';
  if(/gemini|research|źródł/i.test(text))return 'research';
  if(/claude|anthropic|artyst|redakc/i.test(text))return 'writing';
  if(/chatgpt|kodowa|programow/i.test(text))return 'code';
  return 'pipeline';
}

export function createReel(input: {id: string; sourceId: string; sourceFile: string; title: string; duration: number; speech: Speech[]; style?: Reel['style']}): Reel {
  const duration = Math.round(input.duration * FPS) / FPS;
  const groups = input.speech.filter(s => s.startMs / 1000 < duration)
    .sort((a, b) => a.startMs - b.startMs)
    .filter((segment, index, all) => index === 0 || segment.startMs > all[index - 1].startMs);
  const starts = [0, ...groups.slice(1).map(s => s.startMs / 1000)];
  const scenes: ReelScene[] = starts.map((start, index) => ({
    start, end: starts[index+1] ?? duration, kicker: `NOTATKA ${String(index + 1).padStart(2, '0')}`,
    title: index === 0 ? input.title.trim().slice(0,90) : (groups[index]?.text.split(/[.!?]/).find(part => part.trim())?.trim() || input.title).slice(0, 85),
    accent: (['turquoise', 'yellow', 'violet'] as const)[index%3],
    graphic: graphicForText(groups[index]?.text??input.title),
    detail: index === 0 ? 'Z praktyki. Na własnym projekcie.' : 'Jedna myśl. Konkretny kolejny krok.', labels: [],
  }));
  return reelSchema.parse({version: 1, id: input.id, title: input.title, sourceId: input.sourceId, sourceFile: input.sourceFile,
    style: input.style ?? 'editorial', preferredEngine: 'hyperframes', clips: [{start: 0, end: duration}], scenes,
    words: cutWords(groups, [{start: 0, end: duration}]), sourceNote: 'Nagranie z lokalnej biblioteki. Napisy zsynchronizowane z wypowiedzią.'});
}
