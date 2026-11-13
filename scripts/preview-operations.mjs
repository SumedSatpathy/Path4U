// Operator-only entry point. Normal application builds never invoke remote QA or repairs.
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const operations={
 'inspect-db':['inspect-postgres.mjs',['PATH4U_DB_INSPECT']],
 'audit-auth':['audit-auth-readonly.mjs',['PATH4U_AUTH_AUDIT']],
 'retained-qa':['read-retained-qa-tokens.mjs',['PATH4U_RETAINED_QA_RUN']],
 'migrate':['migrate-durable.mjs',['PATH4U_APPLY_DURABLE']],
 'verify-auth':['verify-auth.mjs',['PATH4U_VERIFY_AUTH']],
 'verify-quota':['verify-quota.mjs',['PATH4U_VERIFY_QUOTA']],
 'qa-accounts':['browser-qa-accounts.mjs',['PATH4U_QA_PUBLIC_KEY','PATH4U_QA_CLEANUP']],
 'mail-qa':['verify-mail.mjs',['PATH4U_MAIL_QA_ALIAS']],
 'refresh-feeds':['refresh-feeds.mjs',['PATH4U_FEED_REFRESH']],
 'verify-redirect':['verify-redirect.mjs',['PATH4U_VERIFY_REDIRECT']],
 'repair-labels':['repair-source-label.mjs',['PATH4U_FIX_SOURCE_LABELS']],
 'verify-demo':['verify-demo.mjs',['PATH4U_VERIFY_DEMO']],
 'inspect-backend':['inspect-backend.mjs',['PATH4U_INSPECT_BACKEND']],
 'verify-gemini':['verify-gemini.mjs',['PATH4U_VERIFY_GEMINI'],'--preview'],
}
const name=process.argv[2]
if(!name || ['--help','-h'].includes(name)){
 console.log('Usage: pnpm ops:preview <operation>\nPreview operators only. Existing opt-in flags and any owner approval are still required.\n\n'+Object.keys(operations).join('\n'))
}else{
 const operation=operations[name]
 if(!operation){console.error('Unknown operation. Run pnpm ops:preview --help.');process.exit(1)}
 if(process.env.VERCEL_ENV!=='preview'){console.error('Operations require VERCEL_ENV=preview. No operation started.');process.exit(1)}
 const [file,flags,...args]=operation
 if(!flags.some(flag=>Boolean(process.env[flag]))){console.error('The operation requires its existing explicit opt-in flag. No operation started.');process.exit(1)}
 const run=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url)),...args],{stdio:'inherit',env:process.env,windowsHide:true})
 process.exitCode=run.status??1
}
