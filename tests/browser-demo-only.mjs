// Local UI regression. Guided AI is a local fixture; live Gemini is checked separately on Preview.
import assert from 'node:assert/strict'
import {createOpenPathServer} from '../server/index.mjs'
const {chromium}=await import(process.env.PATH4U_PLAYWRIGHT_MODULE || 'playwright')
const app=createOpenPathServer({env:{DEMO_ONLY_MODE:'true'}})
const root=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
const browser=await chromium.launch({headless:true,executablePath:process.env.PATH4U_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 let authRequests=0,privateRequests=0;const errors=[]
 page.on('request',r=>{if(/\/api\/auth\//.test(r.url()))authRequests++;if(/\/api\/(workspace|library)(\?|$)/.test(r.url()))privateRequests++})
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(root)
 const demo=page.getByRole('link',{name:'Explore Path4U Demo',exact:true})
 await demo.waitFor();await page.getByText('Available Now',{exact:true}).waitFor()
 for(const label of ['Sign In — Coming Soon','Create Account — Coming Soon'])assert.equal(await page.getByRole('button',{name:label,exact:true}).isDisabled(),true)
 assert.equal(await page.locator('a[href="/login"],a[href="/signup"]').count(),0)
 const primary=await demo.boundingBox(),disabled=await page.getByRole('button',{name:'Sign In — Coming Soon',exact:true}).boundingBox();assert.ok(primary.height>disabled.height)
 assert.equal(await demo.evaluate(node=>getComputedStyle(node).animationName),'none')
 await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await demo.evaluate(node=>getComputedStyle(node).animationName),'demo-breathe');await page.emulateMedia({reducedMotion:'reduce'})
 await page.evaluate(()=>{localStorage.setItem('openpath.demo.v1',JSON.stringify({profile:{name:'OLD LOCAL PRIVATE VALUE'}}));localStorage.setItem('path4u.library.draft',JSON.stringify([{id:'old',value:{title:'OLD LOCAL PRIVATE DRAFT'}}]))})
 for(const route of ['/login','/signup','/forgot-password','/reset-password','/onboarding','/auth/callback?code=unused-synthetic-code']){
  await page.goto(root+route);await page.waitForURL('**/?accounts=coming-soon');await page.getByRole('status').filter({hasText:'Account registration and sign-in are not available'}).waitFor()
 }
 await page.getByRole('link',{name:'Explore Path4U Demo',exact:true}).click();await page.waitForURL('**/dashboard?demo=1');await page.getByRole('heading',{name:/Good .*Guest/}).waitFor()
 assert.equal(await page.getByText('OLD LOCAL PRIVATE VALUE',{exact:true}).count(),0)
 assert.equal(await page.getByText(/Public demo · Progress and sample drafts stay in this tab/).count(),1)
 async function menu(group,label){const rail=page.getByRole('complementary',{name:'Workspace sidebar'});await rail.hover();if(!['Dashboard','Resume Studio'].includes(label))await rail.getByRole('button',{name:group,exact:true}).hover();await rail.getByRole('link',{name:label,exact:true}).click()}
 await menu('Account','My Profile');await page.getByLabel('Display name').fill('Demo Visitor');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.reload();await page.getByLabel('Display name').waitFor();assert.equal(await page.getByLabel('Display name').inputValue(),'Demo Visitor')
 assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('path4u.demo.session.v1')).profile.name),'Demo Visitor')
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('openpath.demo.v1')).profile.name),'OLD LOCAL PRIVATE VALUE')
 await menu('Atlas Index','Discover Opportunities');await page.getByRole('tab',{name:'Internships',exact:true}).waitFor();assert.deepEqual(await page.getByRole('tab').allTextContents(),['Internships','Hackathons & Workshops','Jobs'])
 await menu('Field Tools','Resume Studio');await page.getByRole('heading',{name:'Path4U Resume Studio',exact:true}).waitFor();await page.getByRole('button',{name:'Analyze Resume',exact:false}).click();await page.getByLabel('Resume text',{exact:true}).waitFor()
 await menu('Field Tools','Draft Library');await page.getByLabel('Draft title').fill('Sample demo note');await page.getByLabel('Document text').fill('Non-sensitive example material for a judging demonstration.');await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByText('Draft saved.',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>sessionStorage.getItem('path4u.demo.session.library.draft')?.includes('Sample demo note')));assert.equal(await page.getByText('OLD LOCAL PRIVATE DRAFT',{exact:true}).count(),0)
 await page.reload();await page.getByText('Sample demo note',{exact:true}).first().waitFor({state:'attached'})
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open workspace menu',exact:true}).click();const drawer=page.getByRole('dialog',{name:'Workspace menu'});await drawer.getByRole('link',{name:'Resume Studio',exact:true}).click();await page.getByRole('heading',{name:'Path4U Resume Studio',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Back',exact:true}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.getByRole('button',{name:'Path4U AI',exact:true}).click();await page.getByLabel('Your question').fill('Explain cybersecurity');await page.getByRole('button',{name:'Send question'}).click();await page.locator('.assistant-answer').first().waitFor()
 await page.getByRole('button',{name:'Minimize assistant',exact:true}).click();await page.setViewportSize({width:1440,height:1000});await page.goto(root+'/#/roadmap');await page.getByLabel('Target role or skill').fill('Cybersecurity');await page.getByRole('button',{name:'Generate roadmap',exact:true}).click();await page.getByRole('heading',{name:'Cybersecurity',exact:true}).waitFor();await page.getByRole('button',{name:'Save roadmap',exact:true}).click();await page.waitForURL('**plan=*');await page.reload();await page.getByRole('heading',{name:'Cybersecurity',exact:true}).waitFor();assert.ok(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('path4u.demo.session.v1')).roadmaps.length>0))
 assert.equal(authRequests,0);assert.equal(privateRequests,0);assert.deepEqual(errors,[])
 console.log('PASS local demo-only UI: primary CTA, disabled accounts, breathing/reduced motion, all auth redirects, guest entry/refresh, isolated tab storage, discovery tabs, resume review, draft save, mobile navigation, guided chat/roadmap save and refresh, zero auth/private API calls and runtime errors.')
}finally{await browser.close();app.close()}
