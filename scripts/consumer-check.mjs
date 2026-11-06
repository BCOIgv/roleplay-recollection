import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'.verify');fs.mkdirSync(base,{recursive:true});
const dir=fs.mkdtempSync(path.join(base,'consumer-'));
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Run this check with npm run verify:consumer');
const env={...process.env,npm_config_cache:path.join(base,'npm-cache')};
function run(args) {
  const result=spawnSync(process.execPath,[npm,...args],{cwd:root,env,encoding:'utf8',timeout:120000});
  if(result.status!==0)throw new Error(result.stderr||result.error?.message||'npm check failed');
  return result.stdout;
}
const core=JSON.parse(run(['pack','--ignore-scripts','--json','--pack-destination',dir]))[0];
const dsh=JSON.parse(run(['pack','./dsh','--ignore-scripts','--json','--pack-destination',dir]))[0];
for(const file of ['LICENSE','index.mjs','index.d.ts','src/global-core.mjs','src/source-setup.mjs'])if(!core.files.some(f=>f.path===file))throw new Error('Missing core artifact '+file);
for(const file of ['LICENSE','global.js','index.js'])if(!dsh.files.some(f=>f.path===file))throw new Error('Missing DSH artifact '+file);
fs.writeFileSync(path.join(dir,'package.json'),'{"private":true,"type":"module"}');
run(['install','--prefix',dir,'--ignore-scripts','--no-audit','--no-fund','--offline',path.join(dir,core.filename),path.join(dir,dsh.filename)]);
const smoke=spawnSync(process.execPath,['scripts/consumer-smoke.mjs',dir],{cwd:root,encoding:'utf8',timeout:30000});
if(smoke.status!==0)throw new Error(smoke.stderr||'Consumer smoke failed');
console.log(smoke.stdout.trim());
console.log(JSON.stringify({coreFiles:core.entryCount,dshFiles:dsh.entryCount,artifacts:dir}));
