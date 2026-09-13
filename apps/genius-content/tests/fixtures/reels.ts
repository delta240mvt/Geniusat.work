import {reelSchema, type Reel} from '../../src/reels/model.js';

// Synthetic speech and timing; no user's recordings or transcripts.
export function exampleReels(): Reel[] {
  return [16.6,36].map((duration,index) => {
    const count = index ? 8 : 4;
    return reelSchema.parse({
      version:1,id:'example-'+index,title:'Przykładowa rolka',sourceId:'example',sourceFile:'example.mp4',sourceNote:'Sztuczne dane testowe.',
      style:index?'signal':'editorial',preferredEngine:'hyperframes',
      clips:index?[{start:0,end:13.2},{start:29.5,end:39.9},{start:56.1,end:60.0333333333},{start:76.4,end:84.8666666667}]:[{start:0,end:duration}],
      words:Array.from({length:Math.floor(duration*2)},(_,i)=>({word:['To','jest','przykładowy','tekst'][i%4],startMs:i*500,endMs:i*500+450})),
      scenes:Array.from({length:count},(_,i)=>({start:i*duration/count,end:(i+1)*duration/count,kicker:String(i+1).padStart(2,'0')+' / PRZYKŁAD',title:'Przykładowa scena',detail:'Treść testowa.',graphic:i%2?'wave':'models',accent:'turquoise',labels:[]})),
    });
  });
}
