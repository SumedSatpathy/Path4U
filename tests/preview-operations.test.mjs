import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const entry=new URL('../scripts/preview-operations.mjs',import.meta.url)
const run=(args,env={})=>spawnSync(process.execPath,[fileURLToPath(entry),...args],{encoding:'utf8',windowsHide:true,env:{...process.env,...env}})
test('operator entry point lists help without network operations and rejects unapproved environment/flags',()=>{
 const help=run(['--help']);assert.equal(help.status,0);assert.match(help.stdout,/Preview operators only/)
 const wrongEnvironment=run(['verify-auth'],{VERCEL_ENV:'production',PATH4U_VERIFY_AUTH:'1'});assert.equal(wrongEnvironment.status,1);assert.match(wrongEnvironment.stderr,/No operation started/)
 const noOptIn=run(['verify-auth'],{VERCEL_ENV:'preview',PATH4U_VERIFY_AUTH:''});assert.equal(noOptIn.status,1);assert.match(noOptIn.stderr,/explicit opt-in/)
 const unknown=run(['not-a-task'],{VERCEL_ENV:'preview'});assert.equal(unknown.status,1);assert.match(unknown.stderr,/Unknown operation/)
})
