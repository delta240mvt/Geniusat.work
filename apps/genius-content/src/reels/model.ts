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
export const textMotionSchema = z.object({
  preset: z.enum(['fade-down', 'fade-up', 'pop', 'replace', 'stack', 'cut']),
  font: z.enum(['inter', 'delta240mvt']).default('inter'),
  easing: z.enum(['ease-out', 'ease-in-out', 'linear', 'spring']).default('ease-out'),
  durationMs: z.number().min(0).max(1800),
  offsetPx: z.number().min(0).max(160),
  size: z.number().min(24).max(160),
  tracking: z.number().min(-14).max(12),
  y: z.number().min(0).max(1850),
  shadowBlur: z.number().min(0).max(80),
  lagMs: z.number().min(-500).max(500).default(0),
  holdMs: z.number().min(0).max(1000).default(0),
});
export const macWindowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  kind: z.enum(['finder', 'editor', 'terminal', 'browser', 'glass']),
  title: z.string().max(80),
  content: z.string().max(1000),
  x: z.number().min(0).max(1080), y: z.number().min(0).max(1920),
  width: z.number().min(180).max(1080), height: z.number().min(120).max(1400),
  startMs: z.number().nonnegative(), endMs: z.number().positive(),
  enterMs: z.number().min(0).max(1800), exitMs: z.number().min(0).max(1800),
  enter: z.enum(['fade-down', 'slide-right', 'pop', 'cut']),
  exit: z.enum(['fade', 'slide-up', 'shrink', 'cut']).default('fade'),
  easing: z.enum(['ease-out', 'ease-in-out', 'linear', 'spring']).default('ease-out'),
  travelPx: z.number().min(0).max(400).default(90),
  scaleFrom: z.number().min(0.5).max(1.2).default(0.9),
  lineDelayMs: z.number().min(0).max(1000).default(260),
  contentSize: z.number().min(12).max(32).default(18),
  radius: z.number().min(8).max(80),
  blur: z.number().min(0).max(1),
  shadowIntensity: z.number().min(0).max(1).default(0.45),
  edgeOpacity: z.number().min(0).max(1).default(0.5),
  edgeFeather: z.number().min(0).max(1).default(0.55),
  displacement: z.number().min(0).max(120),
  saturation: z.number().min(50).max(220),
  aberration: z.number().min(0).max(8),
});
export const sceneMotionSchema = z.object({
  title: textMotionSchema,
  caption: textMotionSchema,
  windows: z.array(macWindowSchema).max(12),
});
export type TextMotion = z.infer<typeof textMotionSchema>;
export type MacWindow = z.infer<typeof macWindowSchema>;
export type SceneMotion = z.infer<typeof sceneMotionSchema>;
export const defaultSceneMotion = (safe = false): SceneMotion => ({
  title: {preset: 'fade-down', font: 'delta240mvt', easing: 'ease-out', durationMs: 420, offsetPx: 24, size: safe ? 76 : 108, tracking: safe ? -3 : -6, y: safe ? 330 : 237, shadowBlur: safe ? 18 : 0, lagMs: 0, holdMs: 0},
  caption: {preset: 'fade-down', font: 'delta240mvt', easing: 'ease-out', durationMs: 320, offsetPx: 20, size: safe ? 42 : 46, tracking: -1.2, y: 1496, shadowBlur: 18, lagMs: 0, holdMs: 0},
  windows: [],
});
export const sceneSchema = z.object({
  start: z.number().nonnegative(), end: z.number().positive(),
  kicker: z.string().max(70), title: z.string().min(1).max(90),
  accent: z.enum(['turquoise', 'yellow', 'violet']),
  graphic: z.enum(['models', 'code', 'writing', 'research', 'pipeline', 'wave', 'assets', 'render', 'outro']),
  detail: z.string().max(150), labels: z.array(z.string().max(40)).max(4),
  cutaway: z.boolean().optional(),
  overlayOnly: z.boolean().optional(),
  motion: sceneMotionSchema.optional(),
});
export const reelSchema = z.object({
  version: z.literal(1), id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  title: z.string().min(1).max(100), sourceId: z.string().regex(/^[a-z0-9-]+$/),
  sourceFile: z.string().regex(/^[\w.-]+\.(mp4|mov)$/i),
  style: z.enum(['editorial', 'signal']), preferredEngine: z.literal('hyperframes').default('hyperframes'),
  motionConcept: z.enum(['interface', 'metaphor', 'transformation']).optional(),
  clips: z.array(z.object({start: z.number().nonnegative(), end: z.number().positive()})).min(1),
  brandCards: z.array(z.object({startMs: z.number().nonnegative(), endMs: z.number().positive()})).default([]),
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
    scene.motion?.windows.forEach((window, j) => {
      if (window.endMs <= window.startMs || window.endMs > (scene.end - scene.start) * 1000 + 1)
        ctx.addIssue({code: 'custom', path: ['scenes', i, 'motion', 'windows', j], message: 'Czas okna musi mieścić się w scenie.'});
    });
  });
  if (Math.abs(reel.scenes.at(-1)!.end - duration) > .06)
    ctx.addIssue({code: 'custom', path: ['scenes'], message: 'Czas scen nie zgadza się z montażem.'});
  reel.brandCards.forEach((card, i) => {
    if (card.endMs <= card.startMs || card.endMs > duration * 1000 + 1 || card.startMs < (reel.brandCards[i - 1]?.endMs ?? 0))
      ctx.addIssue({code: 'custom', path: ['brandCards', i], message: 'Przebitki muszą być rozłączne i mieścić się w filmie.'});
    if (!reel.words.some(word => word.startMs === card.startMs) ||
        (card.endMs < duration * 1000 && !reel.words.some(word => word.startMs === card.endMs || word.endMs === card.endMs)))
      ctx.addIssue({code: 'custom', path: ['brandCards', i], message: 'Granice przebitki muszą trafiać w początek słowa.'});
  });
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
export const brandCardAt = (reel: Reel, timeMs: number) => reel.brandCards?.find(card => timeMs >= card.startMs && timeMs < card.endMs);
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
