import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {initializeMemorySources,GlobalMemoryLibrary,GlobalRecollection} from '../index.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'global-rp-demo-'));
const sourceDir=path.join(root,'source');fs.mkdirSync(sourceDir);
const file=path.join(sourceDir,'notes.json');
fs.writeFileSync(file,JSON.stringify([{id:'one',content:'雨天听过钢琴曲',scope:'private:owner',status:'active',truth:'reported'},{id:'two',content:'故事中在雨天重逢',scope:'story:other',status:'active',truth:'fictional'}]));
const owner={id:'demo-owner',audience:'private'};
let runtime;
try {
  const setup=await initializeMemorySources({sources:[{id:'notes',file,format:'auto',rp:{enabled:true}}],configDirectory:path.join(root,'runtime')});
  const library=new GlobalMemoryLibrary({sources:setup.sources,authorize:({context})=>context===owner});
  runtime=new GlobalRecollection({characterId:'demo',mode:'roleplay',storyId:'current-story',stateDir:path.join(root,'runtime')},{library,contextKey:a=>a===owner?'demo-owner:private':null,reflect:({input})=>({value:{action:'express',memoryId:input.memories[0].ref,anchor:'雨天',expression:'又想起那段与雨天有关的往事了。'}})});
  const context={mode:'roleplay',storyId:'current-story',trigger:'cue',cue:'雨天',opportunityId:'demo-1',allowExpression:true};
  const recalled=await runtime.recollect(context,{access:owner});
  const candidate=await runtime.takeExpression(recalled.intentId,{...context,delivery:'reply',replyToMessageId:'demo-message'},{access:owner});
  const settled=runtime.settleExpression(recalled.intentId,{outcome:'not_sent'},{access:owner});
  console.log(JSON.stringify({synthetic:true,setup:setup.results,scope:runtime.status().scope,recalled,candidate,settled,externalModelCalls:0,messagesSent:0},null,2));
} finally {if(runtime)await runtime.close();fs.rmSync(root,{recursive:true,force:true});}
