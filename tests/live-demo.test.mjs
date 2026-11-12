import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createOpenPathServer} from '../server/index.mjs'
import {roadmapFixture} from './fixtures/roadmap.mjs'
import {reserveScript} from '../server/liveDemo.mjs'
import {parseLearningRequest} from '../shared/intent.mjs'

test('live guest chat bypasses Supabase but preserves session, quota, original prompts and Gemini error boundaries',async t=>{
 const store=new Map();let calls=0,limited=false,providerFailure=false
 const native=globalThis.fetch
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).includes('synthetic.upstash.io')) {
   const [command,...args]=JSON.parse(options.body)
   let result
   if(command==='GET')result=store.get(args[0])??null
   else if(command==='SET'){store.set(args[0],args[1]);result='OK'}
   else if(command==='EVAL'){
    const [script,count,...values]=args,keys=values.slice(0,count),argv=values.slice(count)
    if(script===reserveScript){
     if(store.get(keys[0])!==argv[0])result=['expired']
     else if(store.has(keys[1]))result=[store.get(keys[1])===argv[1]?'duplicate':'conflict']
     else if(limited)result=['limited']
     else {store.set(keys[1],argv[1]);result=['reserved','19']}
    }else{store.set(keys[0],argv[0]);result=1}
   }else throw Error('Unsupported test command')
   return Response.json({result})
  }
  if(String(url).startsWith('https://generativelanguage.googleapis.com/')){
   calls++;if(providerFailure)return new Response('',{status:429})
   const body=JSON.parse(options.body),data=JSON.parse(body.contents[0].parts[0].text)
   const output=body.generationConfig.responseSchema.properties.milestones?roadmapFixture(data):{answer:'Live fixture: '+data.message,title:'Guidance',artifact:'roadmap',proposal:'Unrelated proposal'}
   return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})
  }
  assert.ok(!String(url).includes('supabase'),'Live demo must not call Supabase')
  return native(url,options)
 })
 const app=createOpenPathServer({env:{PATH4U_DEMO_BACKEND:'redis',GEMINI_API_KEY:'mock',GEMINI_MODEL:'mock',UPSTASH_REDIS_REST_URL:'https://synthetic.upstash.io',UPSTASH_REDIS_REST_TOKEN:'synthetic'}})
 const origin=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
 t.after(()=>app.close())
 let cookie=''
 const post=(path,body)=>fetch(origin+'/api/demo/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await post('assistant',{message:'Hello',requestId:crypto.randomUUID()})).status,401)
 const session=await post('session',{});assert.equal(session.status,200);cookie=session.headers.get('set-cookie').split(';')[0];assert.equal((await session.json()).liveAI,true)
 const prompts=['Hello.','Explain Python loops.','Create a cybersecurity roadmap for a complete beginner.','Create a six-month AI engineering roadmap.','Recommend cybersecurity courses from Coursera and Udemy.']
 for(const message of prompts){const response=await post('assistant',{message,requestId:crypto.randomUUID(),history:[{question:'I am a beginner',answer:'What would you like to learn?'}]});assert.equal(response.status,200);const result=(await response.json()).result;assert.ok(result.answer);if(['Hello.','Explain Python loops.'].includes(message)){assert.equal(result.proposal,'');assert.equal(result.artifact,'text')}if(message.includes('six-month')){assert.equal(result.roadmap.durationWeeks,26);assert.equal(result.roadmap.goal,'AI engineering')}}
 const requestId=crypto.randomUUID();const first=await post('assistant',{message:'Explain loops',requestId});assert.equal(first.status,200);const before=calls;const again=await post('assistant',{message:'Explain loops',requestId});assert.equal(again.status,200);assert.equal(calls,before)
 assert.equal((await post('assistant',{message:'Different',requestId})).status,409)
 limited=true;assert.equal((await post('assistant',{message:'Hello',requestId:crypto.randomUUID()})).status,429);assert.equal(calls,before)
 limited=false;providerFailure=true;assert.equal((await post('assistant',{message:'Hello',requestId:crypto.randomUUID()})).status,429)
 assert.equal((await post('assistant',{message:'Email me at person@example.test',requestId:crypto.randomUUID()})).status,403)
 if(process.env.PATH4U_PLAYWRIGHT_MODULE){
  limited=false;providerFailure=false
  const {chromium}=await import(process.env.PATH4U_PLAYWRIGHT_MODULE)
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'})
   await page.goto(origin+'/dashboard?demo=1')
   await page.getByRole('button',{name:'Path4U AI',exact:true}).click()
   await page.getByText('Live Gemini demo',{exact:false}).waitFor()
   await page.getByLabel('Your question').fill('Explain Python loops.')
   await page.getByRole('button',{name:'Send question'}).click()
   await page.getByText('Live fixture: Explain Python loops.',{exact:true}).waitFor()
   providerFailure=true
   await page.getByLabel('Your question').fill('Explain DNS')
   await page.getByRole('button',{name:'Send question'}).click()
   await page.getByRole('alert').filter({hasText:'quota or rate limit'}).waitFor()
   assert.equal(await page.getByLabel('Your question').inputValue(),'Explain DNS')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  }finally{await browser.close()}
 }

})
test('worded duration parser preserves the original target',()=>{const parsed=parseLearningRequest('Create a six-month AI engineering roadmap.');assert.equal(parsed.durationWeeks,26);assert.equal(parsed.goal,'AI engineering')})
