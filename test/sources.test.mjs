import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ReadOnlyMemorySource, GlobalMemoryLibrary, validateSourceConfig, CompanionMemory} from '../index.mjs';

function fixture(t, data, format = 'json') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recollection-source-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const file = path.join(dir, 'source.json');
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  return {dir, file, config: {id:'one', file, format, fields:{id:'id', text:'body', scope:'scope', time:'at', truth:'truth', status:'status'}, timeUnit:'seconds'}};
}

test('read-only snapshots preserve source bytes and make no write API calls, including reopen', t => {
  const {file, dir, config} = fixture(t, [{id:'a',body:'rain',scope:'private:a',at:100,truth:'reported'}]);
  const before = fs.readFileSync(file);
  const originals = new Map();
  try {
    for (const method of ['mkdirSync','writeFileSync','renameSync','unlinkSync']) {
      originals.set(method, fs[method]);
      fs[method] = () => { throw new Error('Unexpected write: ' + method); };
    }
    const open = fs.openSync;
    originals.set('openSync',open);
    fs.openSync = (target, flags, ...rest) => { assert.equal(flags,'r'); return open(target,flags,...rest); };
    for (let i=0;i<2;i++) {
      const snap = new ReadOnlyMemorySource(config).snapshot();
      assert.equal(snap.materials[0].eventAt,100000);
      assert.equal(snap.materials[0].truth,'reported');
      snap.materials[0].text = 'mutated result';
    }
  } finally { for (const [method, original] of originals) fs[method] = original; }
  assert.deepEqual(fs.readFileSync(file),before);
  assert.deepEqual(fs.readdirSync(dir),['source.json']);
});

test('missing source never creates a directory or an empty memory', t => {
  const {dir,config} = fixture(t,[]);
  config.file=path.join(dir,'missing','state.json');
  assert.throws(()=>new ReadOnlyMemorySource(config).snapshot(),/ENOENT/);
  assert.equal(fs.existsSync(path.dirname(config.file)),false);
});

test('malformed JSONL and invalid UTF-8 fail instead of silently dropping records', t => {
  const {file,config}=fixture(t,'{"id":"a","body":"rain"}\n{"id":','jsonl');
  assert.throws(()=>new ReadOnlyMemorySource(config).snapshot(),/JSONL/);
  fs.writeFileSync(file,Buffer.from([0xff]));
  assert.throws(()=>new ReadOnlyMemorySource(config).snapshot(),/encoded data/);
});

test('identity includes original scope; duplicate identity is rejected', t => {
  const {file,config}=fixture(t,[{id:1,body:'rain',scope:'a'},{id:1,body:'rain',scope:'b'}]);
  const source=new ReadOnlyMemorySource(config);
  assert.notEqual(...source.snapshot().materials.map(x=>x.ref));
  fs.writeFileSync(file,JSON.stringify([{id:1,body:'a'},{id:1,body:'b'}]));
  assert.throws(()=>source.snapshot(),/Duplicate/);
});

test('missing semantics stay unknown and invalid units/settings are rejected', t => {
  const {config}=fixture(t,[{id:'a',body:'rain'}]);
  const item=new ReadOnlyMemorySource(config).snapshot().materials[0];
  assert.equal(item.eventAt,null);
  assert.equal(item.truth,'unknown');
  assert.equal(item.sourceScope,null);
  assert.throws(()=>validateSourceConfig({...config,readOnly:true}),/Unknown setting/);
  assert.throws(()=>validateSourceConfig({...config,timeUnit:undefined}),/Time unit/);
});

test('global queries include every registered source and report truncation/failure', async t => {
  const a=fixture(t,[{id:'a',body:'rain',scope:'group:a'}]);
  const b=fixture(t,[{id:'a',body:'rain',scope:'private:b'}]);
  const sources=[a.config,{...b.config,id:'two'},{...a.config,id:'missing',file:path.join(a.dir,'absent')}];
  const library=new GlobalMemoryLibrary({sources,authorize:()=>true});
  const result=await library.query({query:'rain',limit:1});
  assert.equal(result.matched,2);
  assert.equal(result.truncated,true);
  assert.equal(result.sourceCoverage,'partial');
  assert.equal(result.sourceResults.filter(s=>s.status==='failed').length,1);
});

test('host permission checks happen before file access and per record before output', async t => {
  const {config}=fixture(t,[{id:'a',body:'private',scope:'a'},{id:'b',body:'shared',scope:'b'}]);
  const library=new GlobalMemoryLibrary({sources:[config],authorize:({context,material})=>context==='trusted' && (!material || material.sourceScope==='b')});
  assert.equal((await library.query({context:{admin:true}})).items.length,0);
  const result=await library.query({context:'trusted'});
  assert.deepEqual(result.items.map(x=>x.originalId),['b']);
});

test('native RP projection hides faded evidence and never relabels story or truth', async t => {
  const {dir}=fixture(t,[]);
  const now=Date.parse('2026-11-05T12:00:00Z');
  const memory=new CompanionMemory({characterId:'a',scopeId:'private:a',mode:'companion',stateDir:dir},{now:()=>now});
  memory.capture({id:'rain',truth:'reported',occurredAt:now,gist:'rain',evidence:[{id:'msg',kind:'user_message',text:'secret exact quote'}]},{mode:'companion'});
  await memory.close();
  const file=path.join(dir,'memory-state.json');
  const state=JSON.parse(fs.readFileSync(file));
  state.episodes[0].detailFaded=true;
  fs.writeFileSync(file,JSON.stringify(state));
  const library=new GlobalMemoryLibrary({sources:[{id:'native',file,format:'native-v2'}],authorize:()=>true});
  const result=await library.query({purpose:'rp',now});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].truth,'reported');
  assert.equal(result.items[0].sourceScope,'private:a');
  assert.equal(result.items[0].eventAt,null);
  assert.equal(result.items[0].detail,'impression');
  assert.equal(JSON.stringify(result.items).includes('secret exact quote'),false);
});

test('generic sources remain admin-readable until an RP visibility policy exists', async t => {
  const {config}=fixture(t,[{id:'a',body:'rain',status:'active'}]);
  const library=new GlobalMemoryLibrary({sources:[config],authorize:()=>true});
  assert.equal((await library.query()).items.length,1);
  assert.equal((await library.query({purpose:'rp'})).items.length,0);
});

test('source size bounds and hardlink aliases are rejected', t => {
  const {dir,file,config}=fixture(t,[{id:'a',body:'rain'}]);
  assert.throws(()=>new ReadOnlyMemorySource({...config,maxBytes:1}).snapshot(),/maxBytes/);
  const alias=path.join(dir,'alias');
  fs.linkSync(file,alias);
  assert.throws(()=>new ReadOnlyMemorySource(config).snapshot(),/unlinked/);
});
