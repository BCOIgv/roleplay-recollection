import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ReadOnlyMemorySource,GlobalMemoryLibrary,GlobalRecollection,initializeMemorySources} from '../index.mjs';

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'global-memory-'));
  fs.mkdirSync(path.join(dir,'source'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'source','memories.json');
  const rows=[{id:'one',scope:'group:a',text:'rain and piano',status:'active',truth:'reported',at:100},{id:'two',scope:'private:b',text:'rain and books',status:'active',truth:'fictional',story:'other-story',at:101}];
  const save=()=>fs.writeFileSync(file,JSON.stringify(rows));save();
  const source={id:'notes',file,format:'json',fields:{id:'id',text:'text',scope:'scope',status:'status',truth:'truth',storyId:'story',time:'at'},timeUnit:'seconds',rp:{enabled:true}};
  const library=new GlobalMemoryLibrary({sources:[source],authorize:({context,material})=>context?.verified===true&&(!material||context.audience==='admin'||material.sourceScope==='group:a')});
  return {dir,file,rows,save,source,library};
}
const access={verified:true,audience:'admin'};
const options={characterId:'hero',mode:'roleplay',storyId:'current-story',solitudeIntervalHours:[72,72]};
const context={mode:'roleplay',storyId:'current-story',trigger:'cue',cue:'rain',opportunityId:'turn1',allowExpression:true};
const key=a=>a?.verified?'principal:'+a.audience:null;
const express=({input})=>({value:{action:'express',memoryId:input.memories[0].ref,anchor:'rain',thought:'gentle rain',expression:'I remember the rain.'}});

 test('SQLite readonly sees committed WAL data, rejects SQL identifiers and leaves source bytes unchanged',t=>{
  const f=fixture(t),file=path.join(f.dir,'source','mem.sqlite');
  const db=new DatabaseSync(file);
  try {
  db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE memories(id TEXT,content TEXT,scope TEXT,status TEXT); INSERT INTO memories VALUES('1','new in WAL','a','active')");
  const before=fs.readFileSync(file),wal=fs.readFileSync(file+'-wal');
  const config={id:'db',file,format:'sqlite',collection:'memories',fields:{id:'id',text:'content',scope:'scope',status:'status'},rp:{enabled:true}};
  const snapshot=new ReadOnlyMemorySource(config).snapshot();
  assert.equal(snapshot.materials[0].text,'new in WAL');
  assert.equal(snapshot.consistency,'transaction');
  assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readFileSync(file+'-wal'),wal);
  assert.throws(()=>new ReadOnlyMemorySource({...config,collection:'memories; DROP TABLE memories'}).snapshot(),/table/);
  } finally { db.close(); }
 });
 test('paging preserves all sources and detects source changes between pages',async t=>{
  const f=fixture(t);const page=await f.library.query({context:access,limit:1});
  const next=await f.library.query({context:access,limit:1,cursor:page.nextCursor});
  assert.notEqual(next.items[0].ref,page.items[0].ref);
  f.rows[0].text='changed';f.save();
  await assert.rejects(f.library.query({context:access,limit:1,cursor:page.nextCursor}),/Stale cursor/);
 });
 test('setup uses safe known mappings, persists separately, and detects schema drift',async t=>{
  const f=fixture(t);let calls=0;
  const result=await initializeMemorySources({sources:[{id:'auto',file:f.file,format:'auto',rp:{enabled:true}}],model:()=>{calls++;throw Error('must not call');},configDirectory:path.join(f.dir,'runtime')});
  assert.equal(calls,0);assert.equal(result.results[0].status,'active');
  assert.equal(result.sources[0].fields.time,undefined);
  assert.ok(fs.existsSync(path.join(f.dir,'runtime','memory-sources.json')));
  f.rows[0].newField='changed schema';f.save();
  assert.throws(()=>new ReadOnlyMemorySource(result.sources[0]).snapshot(),/schema changed/);
  await assert.rejects(initializeMemorySources({sources:[f.source],configDirectory:path.dirname(f.file)}),/separate/);
 });
 test('setup model receives structure only and cannot choose new paths or privileges',async t=>{
  const f=fixture(t);fs.writeFileSync(f.file,JSON.stringify({a:[{key:'x',note:'secret'}],b:[]}));
  let input;
  const result=await initializeMemorySources({sources:[{id:'auto',file:f.file,format:'auto'}],model:req=>{input=req.input;return {value:{format:'json',collection:'a',fields:{id:'key',text:'note'},file:'stolen'}};}});
  assert.equal(JSON.stringify(input).includes('secret'),false);
  assert.equal(result.sources.length,0);assert.equal(result.results[0].status,'failed');
  const ok=await initializeMemorySources({sources:[{id:'auto',file:f.file,format:'auto'}],model:()=>({value:{format:'json',collection:'a',fields:{id:'key',text:'note'}}})});
  assert.equal(ok.results[0].status,'active');
 });
 test('global RP sees both scopes and preserves real/other-story labels; source bytes unchanged',async t=>{
  const f=fixture(t),before=fs.readFileSync(f.file);
  let input;const runtime=new GlobalRecollection({...options,stateDir:path.join(f.dir,'runtime')},{library:f.library,contextKey:key,reflect:req=>{input=req.input;return express(req);}});t.after(()=>runtime.close());
  const result=await runtime.recollect(context,{access});
  assert.equal(result.status,'expression_proposed');
  assert.equal(input.memories.length,2);
  assert.deepEqual(new Set(input.memories.map(m=>m.truth)),new Set(['reported','fictional']));
  assert.ok(input.memories.some(m=>m.storyId==='other-story'));
  assert.deepEqual(fs.readFileSync(f.file),before);
  const publicThoughts=await runtime.privateThoughts(context,{access:{verified:true,audience:'group:a'}});
  assert.equal(publicThoughts.length,0);
 });
 test('source change during model generation rejects late output',async t=>{
  const f=fixture(t);const runtime=new GlobalRecollection(options,{library:f.library,contextKey:key,reflect:req=>{const value=express(req);f.rows[0].text='new';f.save();return value;}});t.after(()=>runtime.close());
  const result=await runtime.recollect(context,{access});
  assert.equal(result.status,'failed');assert.equal(result.reason,'stale_source');
  assert.equal((await runtime.privateThoughts(context,{access})).length,0);
 });
 test('withdrawn source erases content but preserves delivery settlement through restart',async t=>{
  const f=fixture(t),stateDir=path.join(f.dir,'runtime');let runtime=new GlobalRecollection({...options,stateDir},{library:f.library,contextKey:key,reflect:express});
  const r=await runtime.recollect(context,{access});
  const taken=await runtime.takeExpression(r.intentId,{...context,delivery:'reply',replyToMessageId:'reply1'},{access});assert.ok(taken);
  for(const row of f.rows)row.status='withdrawn';f.save();
  await runtime.refresh({access});await runtime.close();
  const state=fs.readFileSync(path.join(stateDir,'memory-state.json'),'utf8');assert.equal(state.includes('I remember the rain.'),false);
  runtime=new GlobalRecollection({...options,stateDir},{library:f.library,contextKey:key});t.after(()=>runtime.close());
  assert.equal(runtime.settleExpression(r.intentId,{outcome:'used_in_reply',receipt:'receipt1'},{access}).status,'used_in_reply');
  assert.ok(runtime.status().lastContactAt);
 });
 test('foreground work consumes no calls and wrong audience cannot take a candidate',async t=>{
  const f=fixture(t);let calls=0;const runtime=new GlobalRecollection(options,{library:f.library,contextKey:key,reflect:req=>{calls++;return express(req);}});t.after(()=>runtime.close());
  assert.equal((await runtime.recollect({...context,hasPendingWork:true},{access})).status,'skipped');assert.equal(calls,0);
  const r=await runtime.recollect(context,{access});
  assert.equal(await runtime.takeExpression(r.intentId,{...context,delivery:'reply',replyToMessageId:'r'},{access:{verified:true,audience:'group:a'}}),null);
 });
 test('solitude reads global material after the due time and shares daily budget',async t=>{
  const f=fixture(t);let now=Date.parse('2026-11-05T15:00:00+08:00');
  const runtime=new GlobalRecollection(options,{library:f.library,contextKey:key,now:()=>now,random:()=>0,wander:express});t.after(()=>runtime.close());
  assert.equal((await runtime.solitude({...context,lastInteractionAt:now-3600000},{access})).reason,'not_due');
  now=runtime.status().nextAt;
  const r=await runtime.solitude({...context,lastInteractionAt:now-3600000},{access});
  assert.equal(r.status,'solitude_ended');assert.ok(r.intentId);assert.equal(runtime.status().modelCallsToday,1);
 });
