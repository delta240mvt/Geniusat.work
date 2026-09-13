import {describe,it,expect} from 'vitest';
import {captionPages,cutWords,createReel,graphicForText,normalizeWords,reelFrames,reelSchema} from '../src/reels/model';
import {exampleReels} from './fixtures/reels';
import {frameMarkup} from '../src/reels/visual';

describe('GENIUS@WORK reels',()=>{
  it('allows only Hyperframes for new project settings',()=>{
    const reel=exampleReels()[0];
    expect(reel.preferredEngine).toBe('hyperframes');
    expect(reelSchema.safeParse({...reel,preferredEngine:'remotion'}).success).toBe(false);
    expect(reelSchema.parse({...reel,preferredEngine:undefined}).preferredEngine).toBe('hyperframes');
  });
  it('calculates duration across continuous footage and four disjoint cuts',()=>{
    const [models,pipeline]=exampleReels();
    expect(reelFrames(models)).toBe(498);expect(reelFrames(pipeline)).toBe(1080);
    expect(pipeline.clips).toHaveLength(4);
  });
  it('rebases caption timing after a cut and drops words outside the edit',()=>{
    const words=cutWords([{startMs:0,endMs:6000,text:'a b c',words:[
      {word:'a',startMs:100,endMs:300},{word:'b',startMs:2100,endMs:2600},{word:'c',startMs:5100,endMs:5500},
    ]}],[{start:0,end:1},{start:5,end:5.3}]);
    expect(words).toEqual([{word:'a',startMs:100,endMs:300},{word:'c',startMs:1100,endMs:1300}]);
  });
  it('corrects split product names without losing word timing',()=>{
    expect(normalizeWords([{word:'chat',startMs:20,endMs:40},{word:'GPT,',startMs:40,endMs:60}]))
      .toEqual([{word:'ChatGPT,',startMs:20,endMs:60}]);
  });
  it('rejects gaps, reversed cuts and captions after the end',()=>{
    const reel=exampleReels()[0];
    expect(()=>reelSchema.parse({...reel,clips:[{start:5,end:1}]})).toThrow();
    expect(()=>reelSchema.parse({...reel,scenes:reel.scenes.map((s,i)=>i===1?{...s,start:4}:s)})).toThrow();
    expect(()=>reelSchema.parse({...reel,words:[{word:'late',startMs:17000,endMs:18000}]})).toThrow();
    expect(reelSchema.safeParse({...reel, scenes: []}).success).toBe(false);
  });
  it('does not omit or duplicate caption words while creating readable pages',()=>{
    const words=exampleReels()[1].words;const pages=captionPages(words);
    expect(pages.flat()).toEqual(words);
    expect(pages.every(p=>p.length<=6&&p.map(w=>w.word).join(' ').length<=36)).toBe(true);
  });
  it('renders the same state after backward and random seeks',()=>{
    const reel=exampleReels()[1];const expected=frameMarkup(reel,7.35);
    frameMarkup(reel,34);frameMarkup(reel,1);
    expect(frameMarkup(reel,7.35)).toBe(expected);
    expect(frameMarkup(reel,7.55)).not.toBe(expected);
  });
  it('holds the final scene when preview playback reaches the end',()=>{
    const reel=exampleReels()[1];
    expect(frameMarkup(reel,36)).toContain('08 / PRZYKŁAD');
    expect(frameMarkup(reel,50)).toBe(frameMarkup(reel,36));
  });
  it('chooses graphics from narration instead of unrelated rotating templates',()=>{
    expect(graphicForText('Whisper tworzy timestampy')).toBe('wave');
    expect(graphicForText('Gemini do deep researchu')).toBe('research');
    expect(graphicForText('Scraper zbiera materiały')).toBe('assets');
  });
  it('escapes user-authored titles and retains Polish characters',()=>{
    const reel=exampleReels()[0];reel.scenes[0].title='<img src=x onerror=alert(1)> żółć';
    const html=frameMarkup(reel,1);
    expect(html).not.toContain('<img');expect(html).toContain('&lt;img');expect(html).toContain('żółć');
  });
  it('uses narration-driven timing for newly created projects',()=>{
    const reel=createReel({id:'test',sourceId:'test',sourceFile:'test.mp4',title:'Moja rolka',duration:11,speech:[
      {startMs:0,endMs:3000,text:'Pierwsza myśl.',words:[]},{startMs:5000,endMs:10000,text:'Druga myśl.',words:[]},
    ]});
    expect(reel.scenes.map(s=>[s.start,s.end])).toEqual([[0,5],[5,11]]);
    expect(reelFrames(reel)).toBe(330);
  });
  it('handles repeated and unordered segment timestamps without zero-length scenes',()=>{
    const reel=createReel({id:'test',sourceId:'test',sourceFile:'test.mp4',title:'Tytuł',duration:8,speech:[
      {startMs:4000,endMs:7000,text:'... Druga myśl.',words:[]},
      {startMs:0,endMs:3000,text:'Pierwsza myśl.',words:[]},
      {startMs:0,endMs:3000,text:'Powtórzony segment.',words:[]},
    ]});
    expect(reel.scenes.map(scene=>[scene.start,scene.end])).toEqual([[0,4],[4,8]]);
    expect(reel.scenes[1].title).toBe('Druga myśl');
  });
});
