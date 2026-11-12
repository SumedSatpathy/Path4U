if(process.env.PATH4U_VERIFY_QUOTA!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('QUOTA_QA_REQUIRES_PREVIEW')
import assert from 'node:assert/strict'
import {connectDatabase} from './postgres.mjs'
import {randomUUID} from 'node:crypto'
const db=await connectDatabase()
try{
 await db.query('begin');await db.query('set local role service_role')
 const subject='qa:'+randomUUID(),id=randomUUID(),fingerprint='a'.repeat(64)
 const reserve=async(request,kind='chat',fp=fingerprint)=>(await db.query('select public.path4u_reserve_ai($1,$2,$3,$4,true) as result',[subject,request,fp,kind])).rows[0].result
 assert.equal((await reserve(id)).state,'reserved')
 assert.equal((await reserve(id)).state,'duplicate')
 assert.equal((await reserve(id,'chat','b'.repeat(64))).state,'conflict')
 assert.equal((await reserve(randomUUID(),'roadmap')).state,'reserved')
 assert.equal((await reserve(randomUUID(),'roadmap')).state,'limited')
 console.info(JSON.stringify({event:'durable_quota_audit',passed:5,atomicDatabaseReservations:true,changesRolledBack:true}))
}catch(error){console.error(JSON.stringify({event:'durable_quota_audit',failed:true,code:error.code || 'QUOTA_ASSERTION_FAILED'}));process.exitCode=1}
finally{await db.query('rollback');await db.end()}
