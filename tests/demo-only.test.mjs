import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer,request as httpRequest} from 'node:http'
import {createOpenPathServer,createRequestHandler} from '../server/index.mjs'
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+s.address().port)))
test('demo-only mode blocks account actions without provider calls while retaining private API authorization',async t=>{
 let calls=0
 const provider=createServer((_req,res)=>{calls++;res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({code:400,error_code:'invalid_credentials'}))})
 const env={DEMO_ONLY_MODE:'true',SUPABASE_URL:await listen(provider),SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'}
 const app=createOpenPathServer({env}),root=await listen(app);t.after(()=>{app.close();provider.close()})
 const post=(action,body={})=>fetch(root+'/api/'+action,{method:'POST',headers:{Origin:root,'content-type':'application/json'},body:JSON.stringify(body)})
 assert.deepEqual(await(await fetch(root+'/api/app-config')).json(),{demoOnly:true})
 for(const action of ['login','signup','forgot','resend','verify','exchange','reset','attest','onboarding']){
  const r=await post('auth/'+action);assert.equal(r.status,403);assert.match((await r.json()).error,/not available in this demo version/)
 }
 const status=await fetch(root+'/api/status',{headers:{Cookie:'op_access=forged-account-token'}})
 assert.equal(status.status,200);assert.equal((await status.json()).demoOnly,true);assert.equal(calls,0)
 assert.equal((await fetch(root+'/api/workspace')).status,401)
 assert.equal((await fetch(root+'/api/library?kind=draft')).status,401)
 assert.equal((await post('assistant',{message:'Read another account'})).status,401)
 assert.equal(calls,0)
 // The flag is reversible without changing Supabase data/policies or deleting code.
 env.DEMO_ONLY_MODE='false'
 assert.equal((await(await fetch(root+'/api/app-config')).json()).demoOnly,false)
 const login=await post('auth/login',{email:'qa@example.test',password:'synthetic-password'})
 assert.equal(login.status,400);assert.equal((await login.json()).code,'invalid_credentials');assert.equal(calls,1)
})
test('additional deployment origins are explicit and retain same-origin write checks',async t=>{
 const env={VERCEL:'1',VERCEL_ENV:'production',DEMO_ONLY_MODE:'true',OPENPATH_ORIGIN:'https://new.example.test',OPENPATH_ALLOWED_ORIGINS:'https://old.example.test,not-a-url,https://evil.example.test/path'}
 const app=createServer(createRequestHandler({env,hosted:true})),root=await listen(app);t.after(()=>app.close())
 const request=(host,origin)=>new Promise((resolve,reject)=>{const req=httpRequest(root+'/api/auth/login',{method:'POST',headers:{Host:host,Origin:origin,'content-type':'application/json'}},async res=>resolve(new Response(Buffer.concat(await Array.fromAsync(res)),{status:res.statusCode})));req.on('error',reject);req.end('{}')})
 for(const host of ['new.example.test','old.example.test']){
  const r=await request(host,'https://'+host);assert.equal(r.status,403);assert.match((await r.json()).error,/Account registration/)
 }
 const foreign=await request('old.example.test','https://evil.example.test');assert.equal(foreign.status,403);assert.match((await foreign.json()).error,/configured origin/)
 const pathOrigin=await request('evil.example.test','https://evil.example.test');assert.equal(pathOrigin.status,403);assert.match((await pathOrigin.json()).error,/configured origin/)
})
