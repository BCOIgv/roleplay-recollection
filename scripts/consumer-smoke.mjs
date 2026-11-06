import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const consumer=path.resolve(process.argv[2]);
const require=createRequire(path.join(consumer,'package.json'));
const {apply}=await import(pathToFileURL(require.resolve('roleplay-recollection-dsh')));
const {GlobalRecollection,GlobalMemoryLibrary}=await import(pathToFileURL(require.resolve('roleplay-recollection')));

const root=fs.mkdtempSync(path.join(consumer,'fixtures-'));fs.mkdirSync(path.join(root,'source'),{recursive:true});
const file=path.join(root,'source','notes.json');fs.writeFileSync(file,JSON.stringify([{id:'one',content:'rain',scope:'a',status:'active',truth:'reported'}]));
function host(services) {const tools=new Map();let dispose;return {tools,get dispose(){return dispose;},ctx:{tools:{register(d){tools.set(d.name,d);return ()=>tools.delete(d.name);}},effect(fn){dispose=fn();},recollection:services}};}
const legacy=host();apply(legacy.ctx,{});assert.equal(legacy.tools.size,11);
assert.equal(legacy.tools.get('roleplay_recollection_capture').execute({id:'event',truth:'reported',occurredAt:Date.now()-1,gist:'rain',evidence:[{id:'msg',kind:'user_message',text:'rain'}]}).stored,true);
legacy.dispose();assert.equal(legacy.tools.size,0);
const token={identity:'owner',audience:'private'};
const global=host({resolveAccess:exec=>exec===token?token:null,authorize:({context})=>context===token,contextKey:access=>access===token?'owner:private':null,reflect:({input})=>({value:{action:'express',memoryId:input.memories[0].ref,anchor:'rain',expression:'remember rain'}})});
await apply(global.ctx,{characterId:'test',mode:'companion',stateDir:path.join(root,'runtime'),sources:[{id:'one',file,format:'auto',rp:{enabled:true}}]});
assert.equal(global.tools.size,9);
await assert.rejects(global.tools.get('roleplay_recollection_global_search').execute({query:'rain'},{admin:true}),/denied/);
const found=await global.tools.get('roleplay_recollection_global_search').execute({query:'rain'},token);assert.equal(found.items.length,1);
const recalled=await global.tools.get('roleplay_recollection_recollect').execute({cue:'rain',opportunityId:'one',allowExpression:true},token);assert.equal(recalled.status,'expression_proposed');
const taken=await global.tools.get('roleplay_recollection_take_expression').execute({id:recalled.intentId,allowExpression:true,delivery:'reply',replyToMessageId:'msg'},token);assert.ok(taken.candidate);
const settled=await global.tools.get('roleplay_recollection_settle_expression').execute({id:recalled.intentId,outcome:'used_in_reply',receipt:'receipt'},token);assert.equal(settled.status,'used_in_reply');
global.dispose();assert.equal(global.tools.size,0);
assert.equal(typeof GlobalRecollection,'function');assert.equal(typeof GlobalMemoryLibrary,'function');
console.log(JSON.stringify({installedCore:true,installedDsh:true,legacyDefault:true,globalTools:9,permissionDenial:true,recallTakeSettle:true,dispose:true}));
