import fs from 'node:fs';
import path from 'node:path';

export function assertSeparateDirectory(directory, files) {
  const resolve = target => {
    let base=path.resolve(target), tail=[];
    while (!fs.existsSync(base)) { tail.unshift(path.basename(base)); const parent=path.dirname(base); if(parent===base) break; base=parent; }
    return path.resolve(fs.realpathSync(base),...tail);
  };
  const runtime=resolve(directory);
  for(const file of files) {
    const source=path.dirname(resolve(file));
    const inside=(a,b)=>{const r=path.relative(a,b);return !r || (!r.startsWith('..'+path.sep) && r!=='..' && !path.isAbsolute(r));};
    if(inside(source,runtime) || inside(runtime,source)) throw new Error('Runtime and source directories must be separate');
  }
  return runtime;
}
