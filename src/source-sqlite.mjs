import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const quote = value => '"' + value.replaceAll('"', '""') + '"';

// No original plugin import, migration, extension, arbitrary SQL or schema repair.
export function sqliteRows(cfg, describeOnly = false) {
  const header = Buffer.alloc(100);
  const fd = fs.openSync(cfg.file, 'r');
  try { fs.readSync(fd, header, 0, 100, 0); } finally { fs.closeSync(fd); }
  if (header.subarray(0,16).toString() !== 'SQLite format 3\0') throw new Error('Not a SQLite database');
  if (header[18] === 2) {
    for (const suffix of ['-wal','-shm']) {
      const stat = fs.lstatSync(cfg.file + suffix);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Unsafe WAL sidecar');
    }
  }
  const {DatabaseSync} = require('node:sqlite');
  const db = new DatabaseSync(cfg.file, {readOnly:true, allowExtension:false, timeout:1000});
  try {
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN');
    const tables = db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
      .filter(t => !/CREATE\s+VIRTUAL\s+TABLE/i.test(t.sql || ''));
    const schemas = tables.map(t => ({name:t.name, columns:db.prepare('PRAGMA table_xinfo(' + quote(t.name) + ')').all().map(c=>({name:c.name,type:c.type,hidden:c.hidden}))}));
    if (describeOnly) return {format:'sqlite', tables:schemas};
    const table = schemas.find(t=>t.name===cfg.collection);
    if (!table) throw new Error('Mapped SQLite table does not exist');
    const columns = [...new Set([...Object.values(cfg.fields), ...(cfg.rp?.textField ? [cfg.rp.textField] : [])])];
    if (columns.some(c=>!table.columns.some(x=>x.name===c && x.hidden===0))) throw new Error('Missing or computed SQLite column');
    const rows=[];
    let bytes=0;
    const statement=db.prepare('SELECT ' + columns.map(quote).join(',') + ' FROM ' + quote(table.name));
    for (const row of statement.iterate()) {
      bytes += Buffer.byteLength(JSON.stringify(row));
      if (bytes > cfg.maxBytes || rows.length >= (cfg.maxRecords ?? 100000)) throw new Error('SQLite material limit exceeded');
      rows.push({...row});
    }
    return {rows, schema:schemas};
  } finally {
    try { db.exec('ROLLBACK'); } finally { db.close(); }
  }
}
