import {describe,it,expect} from 'vitest';
import {captionPages,cutWords,createReel,defaultSceneMotion,graphicForText,normalizeWords,reelFrames,reelSchema} from '../src/reels/model';
import {exampleReels} from './fixtures/reels';
import {frameMarkup} from '../src/reels/visual';
import {safeFrameMarkup} from '../src/reels/safe-visual';
import {captionMotionMarkup} from '../src/reels/text-motion';

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
  it('replaces captions in one position and honors a timing offset',()=>{
    const motion=defaultSceneMotion().caption;
    motion.preset='replace';motion.lagMs=200;motion.holdMs=100;
    const words=[{word:'raz',startMs:0,endMs:500},{word:'dwa',startMs:500,endMs:1000}];
    expect(captionMotionMarkup(words,100,motion,s=>s)).toBe('');
    expect(captionMotionMarkup(words,550,motion,s=>s)).toContain('raz');
    expect(captionMotionMarkup(words,750,motion,s=>s)).toContain('dwa');
    expect(captionMotionMarkup(words,750,motion,s=>s)).not.toContain('raz');
  });
  it('limits the spoken-word stack and removes shadows from cutaway captions',()=>{
    const words=[{word:'pierwsze',startMs:0,endMs:200},{word:'drugie',startMs:200,endMs:400},
      {word:'trzecie',startMs:400,endMs:600},{word:'czwarte',startMs:600,endMs:800}];
    const motion=defaultSceneMotion(true).caption;
    motion.preset='stack';
    const stacked=captionMotionMarkup(words,550,motion,s=>s);
    expect(stacked).toContain('pierwsze');
    expect(stacked).toContain('drugie');
    expect(stacked).toContain('trzecie');
    expect(captionMotionMarkup(words,700,motion,s=>s)).toContain('czwarte');
    expect(captionMotionMarkup(words,700,motion,s=>s)).not.toContain('drugie');
    const reel=exampleReels()[0];
    reel.motionConcept='interface';
    reel.scenes[0].overlayOnly=true;
    reel.scenes[0].cutaway=true;
    reel.scenes[0].motion={...defaultSceneMotion(true),caption:{...motion,preset:'replace',shadowBlur:0}};
    const html=safeFrameMarkup(reel,.5);
    expect(html).toContain('d240-safe-window-mode d240-safe-cutaway');
    expect(html).toContain('text-shadow:none');
  });
  it('cuts brand cards on word starts and replaces each word without animation',()=>{
    const reel=exampleReels()[0];
    reel.motionConcept='interface';
    reel.brandCards=[{startMs:500,endMs:1500}];
    reel.scenes[0].overlayOnly=true;
    reel.scenes[0].motion={...defaultSceneMotion(true),caption:{...defaultSceneMotion(true).caption,
      font:'delta240mvt',preset:'stack',size:120,tracking:-10.2,y:1300}};
    expect(reelSchema.safeParse(reel).success).toBe(true);
    const card=safeFrameMarkup(reel,.75);
    expect(card).toContain('d240-safe-brand-card');
    expect(card).toContain('<span class="active">jest</span>');
    expect(card).toContain('top:875px');
    expect(card).toContain('text-shadow:none');
    expect(safeFrameMarkup(reel,1.25)).toContain('<span class="active">przykładowy</span>');
    expect(safeFrameMarkup(reel,1.5)).not.toContain('d240-safe-brand-card');
    expect(reelSchema.safeParse({...reel,brandCards:[{startMs:600,endMs:1500}]}).success).toBe(false);
  });
  it('keeps window timing inside its scene and renders text motion deterministically',()=>{
    const reel=exampleReels()[0];
    const motion=defaultSceneMotion();
    motion.windows=[{id:'window-1',kind:'finder',title:'Finder',content:'Folder',x:100,y:300,width:700,height:420,
      startMs:0,endMs:1000,enterMs:300,exitMs:200,enter:'pop',exit:'fade',easing:'ease-out',travelPx:80,scaleFrom:.9,
      lineDelayMs:260,contentSize:18,radius:28,blur:.25,shadowIntensity:.45,edgeOpacity:.5,edgeFeather:.55,
      displacement:50,saturation:140,aberration:2}];
    reel.scenes[0].motion=motion;
    const checked=reelSchema.parse(reel);
    const first=frameMarkup(checked,.4);
    expect(first).toContain('font-family:delta240mvt_font');
    frameMarkup(checked,2);frameMarkup(checked,.1);
    expect(frameMarkup(checked,.4)).toBe(first);
    const invalidScenes = [{...reel.scenes[0],motion:{...motion,windows:[{...motion.windows[0],endMs:999999}]}},...reel.scenes.slice(1)];
    expect(reelSchema.safeParse({...reel,scenes:invalidScenes}).success).toBe(false);
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
