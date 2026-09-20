import {describe,it,expect} from 'vitest';
import {reelSchema} from '../src/reels/model';
import {frameMarkup} from '../src/reels/visual';
import {exampleReels} from './fixtures/reels';
describe('safe-zone comparison concepts',()=>{
  it('persists the selected concept and removes legacy overlay copy',()=>{
    const reel=reelSchema.parse({...exampleReels()[0],motionConcept:'interface'});
    expect(reel).toHaveProperty('motionConcept','interface');
    const html=frameMarkup(reel,1);
    expect(html).not.toContain('GENIUS@WORK');
    expect(html).not.toContain('d240-footer');
    expect(html).not.toContain('PRZYKŁAD');
  });
  it('produces distinct, seek-deterministic treatments of the same scene',()=>{
    const variants=['interface','metaphor','transformation'].map(motionConcept=>reelSchema.parse({...exampleReels()[0],motionConcept}));
    const frames=variants.map(reel=>frameMarkup(reel,1.5));
    expect(new Set(frames).size).toBe(3);
    variants.forEach((reel,i)=>{frameMarkup(reel,9);expect(frameMarkup(reel,1.5)).toBe(frames[i]);});
  });
});
