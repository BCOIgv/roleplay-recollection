$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path $repoRoot ('.verify/acl-' + [guid]::NewGuid().ToString('N'))
$sourceRoot = Join-Path $fixtureRoot 'source'
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
$sourceFile = Join-Path $sourceRoot 'memory.json'
[IO.File]::WriteAllText($sourceFile, '[{"id":"one","body":"rain"}]')
$readerScript = Join-Path $fixtureRoot 'read.mjs'
@'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ReadOnlyMemorySource} from '../../index.mjs';
const file = process.argv[2];
const source = new ReadOnlyMemorySource({id:'acl-fixture',file,format:'json',fields:{id:'id',text:'body'}});
assert.equal(source.snapshot().materials[0].text,'rain');
assert.equal(source.snapshot().materials[0].text,'rain');
assert.throws(()=>fs.writeFileSync(file,'changed'),e=>['EPERM','EACCES'].includes(e.code));
assert.throws(()=>fs.writeFileSync(path.join(path.dirname(file),'extra'),'changed'),e=>['EPERM','EACCES'].includes(e.code));
assert.throws(()=>fs.unlinkSync(file),e=>['EPERM','EACCES'].includes(e.code));
console.log(JSON.stringify({read:true,reopen:true,overwriteDenied:true,createDenied:true,deleteDenied:true}));
'@ | Set-Content -LiteralPath $readerScript -Encoding utf8
$fileAcl = Get-Acl -LiteralPath $sourceFile
$dirAcl = Get-Acl -LiteralPath $sourceRoot
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$denied = [System.Security.AccessControl.FileSystemRights]::Write -bor [System.Security.AccessControl.FileSystemRights]::Delete -bor [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles
try {
  $restrictedFile = Get-Acl -LiteralPath $sourceFile
  $restrictedFile.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity,$denied,[System.Security.AccessControl.AccessControlType]::Deny))
  Set-Acl -LiteralPath $sourceFile -AclObject $restrictedFile
  $restrictedDir = Get-Acl -LiteralPath $sourceRoot
  $restrictedDir.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity,$denied,[System.Security.AccessControl.AccessControlType]::Deny))
  Set-Acl -LiteralPath $sourceRoot -AclObject $restrictedDir
  & node $readerScript $sourceFile
  if ($LASTEXITCODE -ne 0) { throw 'ACL verification failed' }
} finally {
  Set-Acl -LiteralPath $sourceRoot -AclObject $dirAcl
  Set-Acl -LiteralPath $sourceFile -AclObject $fileAcl
}
# Keep synthetic evidence in .verify. Never modify permissions outside this fixture.
