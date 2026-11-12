// Controlled UI clock + real durable route/generators + isolated DB/Gemini doubles.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createOpenPathServer} from '../server/index.mjs'
import {durableDemoRequest} from '../server/durableDemo.mjs'
import {quotaFixture} from './fixtures/quota-store.mjs'
const {chromium}=await import(process.env.PATH4U_PLAYWRIGHT_MODULE || 'playwright')
test('open tab automatically renews at 08:00 Malaysia and all generators remain usable; focus refresh recovers a background tab',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T23:59:58Z')})
 const f=quotaFixture(t),app=createOpenPathServer({env:{DEMO_ONLY_MODE:'true'}})
 const root=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
 const browser=await chromium.launch({headless:true,executablePath:process.env.PATH4U_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.clock.install({time:new Date('2026-11-13T23:59:58Z')})
  let sessions=0,cookie='',exhaust=true
  await page.route('**/api/demo/**',async route=>{
   const request=route.request(),action=new URL(request.url()).pathname.split('/').at(-1),headers={}
   try{
    const result=await durableDemoRequest(action,request.postDataJSON()??{},{headers:{cookie,'x-vercel-forwarded-for':'203.0.113.4'}},{setHeader:(k,v)=>{headers[k]=v;cookie=v.split(';')[0]}},f.env,root,true)
    if(action==='session'){
     sessions++
     if(exhaust){const id=cookie.split('.')[1];f.counters.set('subject:2026-11-13:guest:'+id,4);result.credits=0}
    }
    await route.fulfill({status:200,headers:{...headers,'content-type':'application/json'},body:JSON.stringify(result)})
   }catch(error){await route.fulfill({status:error.status||500,contentType:'application/json',body:JSON.stringify({error:error.message,code:error.code,resetAt:error.resetAt,retryAfter:error.retryAfter})})}
  })
  await page.goto(root+'/dashboard?demo=1');await page.getByText('AI interactions: 0',{exact:true}).waitFor()
  exhaust=false;t.mock.timers.setTime(Date.parse('2026-11-14T00:00:00Z'))
  await page.clock.fastForward(2500);await page.getByText('AI interactions: 4',{exact:true}).waitFor();assert.ok(sessions>=2)
  await page.goto(root+'/#/roadmap');await page.getByLabel('Target role or skill').fill('Cybersecurity');await page.getByRole('button',{name:'Generate roadmap',exact:true}).click();await page.getByRole('heading',{name:'Cybersecurity',exact:true}).waitFor();await page.getByText('AI interactions: 3',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Save roadmap',exact:true}).click()
  await page.goto(root+'/#/flowchart');await page.getByLabel('Target role or skill').fill('Network security');await page.getByRole('button',{name:'Generate roadmap',exact:true}).click();await page.getByRole('heading',{name:'Network security',exact:true}).waitFor();await page.getByText('AI interactions: 2',{exact:true}).waitFor();await page.getByRole('button',{name:'Save roadmap',exact:true}).click()
  await page.goto(root+'/#/mind-map');await page.getByLabel('Topic',{exact:true}).fill('Cybersecurity');await page.getByRole('button',{name:'Generate mind map',exact:true}).click()
  await page.getByLabel('Branch',{exact:true}).first().waitFor();assert.equal(await page.getByLabel('Branch',{exact:true}).first().inputValue(),'Network defense')
  await page.getByText('AI interactions: 1',{exact:true}).waitFor();await page.getByRole('button',{name:'Save mind map',exact:true}).click()
  const before=sessions;t.mock.timers.setTime(Date.parse('2026-11-15T00:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('AI interactions: 4',{exact:true}).waitFor();assert.ok(sessions>before)
  assert.deepEqual(errors,[])
 }finally{await browser.close();app.close()}
})
