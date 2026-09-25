import type {TextMotion, Word} from './model.js';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function easeMotion(value: number, kind: TextMotion['easing'] = 'ease-out') {
  const t = clamp(value);
  if (kind === 'linear') return t;
  if (kind === 'ease-in-out') return t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  if (kind === 'spring') return t === 0 || t === 1 ? t : 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-7 * t);
  return 1 - (1 - t) ** 3;
}

export function textEntryStyle(motion: TextMotion, elapsedMs: number) {
  const progress = motion.preset === 'cut' || motion.durationMs === 0 ? 1 : easeMotion(elapsedMs / motion.durationMs, motion.easing);
  const distance = (1 - progress) * motion.offsetPx;
  const transform = motion.preset === 'fade-down' || motion.preset === 'stack' ? `translateY(${-distance}px)`
    : motion.preset === 'fade-up' ? `translateY(${distance}px)`
    : motion.preset === 'pop' ? `scale(${(0.88 + progress * 0.12).toFixed(4)})` : 'none';
  return `opacity:${clamp(progress).toFixed(4)};transform:${transform}`;
}

export function captionMotionMarkup(words: Word[], timeMs: number, motion: TextMotion, escape: (text: string) => string) {
  const adjustedTime = timeMs - motion.lagMs;
  const started = words.filter(word => adjustedTime >= word.startMs);
  const visible = motion.preset === 'replace' || motion.preset === 'cut'
    ? words.filter(word => adjustedTime >= word.startMs && adjustedTime < word.endMs + motion.holdMs).slice(-1)
    : motion.preset === 'stack' && started.length
      ? started.slice(Math.floor((started.length - 1) / 3) * 3)
      : started;
  return visible.map(word => `<span class="${adjustedTime < word.endMs ? 'active' : ''}" style="${textEntryStyle(motion, adjustedTime - word.startMs)}">${escape(word.word)}</span>`).join('');
}
