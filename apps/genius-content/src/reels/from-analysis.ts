import type {NormalizedAnalysis} from '../types/analysis.js';
import {createReel, graphicForText, type Reel} from './model';
import type {ChoreographyDocument} from '../types/choreography';

export function reelFromAnalysis(analysis:NormalizedAnalysis,sourceFile:string,choreography?:ChoreographyDocument):Reel {
  const reel=createReel({id:analysis.videoId,sourceId:analysis.videoId,sourceFile,
    title:analysis.storyboard[0]?.hookText?.slice(0,90)||'Z praktyki pracy z AI.',
    duration:Math.max(1/30,analysis.durationMs/1000),speech:analysis.speech,style:'editorial'});
  reel.scenes=reel.scenes.map(scene=>{
    const direction=choreography?.scenes.find(s=>s.startMs/1000<=scene.start&&s.endMs/1000>scene.start);
    if(!direction)return scene;
    return {...scene,kicker:direction.kicker.slice(0,70),title:direction.hookText.slice(0,90)||scene.title,
      detail:direction.caption.slice(0,150),labels:direction.supportingBullets.slice(0,4).map(s=>s.slice(0,40)),graphic:graphicForText(direction.transcriptText)};
  });
  return reel;
}
