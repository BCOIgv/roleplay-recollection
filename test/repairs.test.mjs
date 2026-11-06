import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {CompanionMemory} from '../index.mjs';
import {MemoryStore} from '../src/store.mjs';
const identity={characterId:'a',scopeId:'b',mode:'companion',storyId:null};
function directory(t) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'memory-repair-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}

test('an empty live lock cannot be stolen or removed',t=>{
 const dir=directory(t),store=new MemoryStore({directory:dir,identity}),lock=path.join(dir,'memory-writer.lock');
 const fd=fs.openSync(lock,'wx');
 try {assert.throws(()=>store.transaction(s=>s.epoch++),/unknown/);assert.ok(fs.existsSync(lock));}finally{fs.closeSync(fd);}
});

test('concurrent writers preserve all successful updates',async t=>{
 const dir=directory(t);new MemoryStore({directory:dir,identity});
 const code=`import {MemoryStore} from ${JSON.stringify(new URL('../src/store.mjs',import.meta.url).href)};
 const store=new MemoryStore({directory:process.argv[1],identity:JSON.parse(process.argv[2])});
 for(let i=0;i<15;i++){let done=false;for(let n=0;n<500;n++){try{store.transaction(s=>++s.epoch);done=true;break;}catch(e){if(!/locked|guard busy|EEXIST/.test(e.message))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}}if(!done)throw Error('retry exhausted');}`;
 await Promise.all(Array.from({length:3},()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code,dir,JSON.stringify(identity)],{windowsHide:true});let err='';child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('exit',n=>n===0?resolve():reject(Error(err)));})));
 assert.equal(new MemoryStore({directory:dir,identity}).read().epoch,45);
});

test('changed excerpts cannot reintroduce withdrawn evidence under a new episode ID',async()=>{
 const now=Date.now(),core=new CompanionMemory({characterId:'a',scopeId:'b',mode:'companion'},{now:()=>now});
 try {
  const raw={id:'one',truth:'reported',occurredAt:now,gist:'rain',evidence:[{id:'msg',kind:'user_message',text:'rain'}]};
  core.capture(raw,{mode:'companion'});core.forget('one');
  assert.equal(core.capture({...raw,id:'two',evidence:[{id:'msg',kind:'user_message',text:'changed excerpt'}]},{mode:'companion'}).reason,'withdrawn_source');
 } finally {await core.close();}
});

test('taken and unknown contacts remain settleable after source withdrawal, correction or unavailability',async()=>{
 for(const change of ['forget','revise','unavailable'])for(const delivery of ['taken','unknown']) {
  let now=Date.parse('2026-11-05T15:00:00+08:00');
  const core=new CompanionMemory({characterId:'a',scopeId:'b',mode:'companion',solitudeIntervalHours:[72,72]},{now:()=>now,random:()=>0,wander:({input})=>({value:{action:'leave',memoryId:input.memories[0].id,anchor:'rain',shareText:'hello'}})});
  try {
   const raw={id:'one',truth:'reported',occurredAt:now,gist:'rain',retention:'explicitly_retained',retentionReason:'test',evidence:[{id:'msg',kind:'user_message',text:'rain'}]};
   const saved=core.capture(raw,{mode:'companion'});now=core.status().solitude.nextAt;
   const ctx={mode:'companion',allowExpression:true,lastInteractionAt:now-3600000};
   const r=await core.solitude(ctx);assert.ok(core.takeExpression(r.intentId,ctx));
   if(delivery==='unknown')core.settleExpression(r.intentId,{outcome:'unknown'});
   if(change==='forget')core.forget('one');else if(change==='revise')core.revise('one',saved.revision,{...raw,gist:'rain corrected'});else core.setSourceAvailable('one',false);
   const intent=core.store.read().expressions.find(e=>e.id===r.intentId);assert.equal(intent.text,'');assert.equal(intent.anchor,'');
   assert.equal(core.settleExpression(r.intentId,{outcome:'sent',receipt:'real-receipt'}).status,'sent');assert.equal(core.status().solitude.lastContactAt,now);
  } finally {await core.close();}
 }
});
