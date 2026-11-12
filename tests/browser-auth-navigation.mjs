// Local browser regression using a mock Supabase server; no live accounts or mail.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createOpenPathServer} from '../server/index.mjs'
const {chromium}=await import(process.env.PATH4U_PLAYWRIGHT_MODULE || 'playwright')
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)))
let revoked=false,signupCalls=0,resendCalls=0
const person={id:'11111111-2222-4333-8444-555555555555',email:'synthetic@example.test',identities:[{}],email_confirmed_at:'2026-11-12',app_metadata:{age_requirement_met:true},user_metadata:{full_name:'Synthetic QA'}}
const preferences={organization:'Synthetic University',field:'Technology',stage:'Student',interests:['AI'],skills:[],goals:['Learn']}
const mock=createServer(async(req,res)=>{
 const chunks=await Array.fromAsync(req),body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{}
 const path=new URL(req.url,'http://mock.test').pathname
 const send=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data))}
 if(path==='/auth/v1/settings')return send({mailer_autoconfirm:false})
 if(path==='/auth/v1/signup'){signupCalls++;return send({...person,email:body.email,email_confirmed_at:null})}
 if(path==='/auth/v1/resend'){resendCalls++;return send({})}
 if(path==='/auth/v1/token'){
  if(body.email==='unverified@example.test')return send({code:'email_not_confirmed'},400)
  if(body.password==='wrong-password')return send({code:'invalid_credentials'},400)
  revoked=false;return send({user:person,access_token:'local-access',refresh_token:'local-refresh',expires_in:3600})
 }
 if(path==='/auth/v1/user')return send(revoked?{}:person,revoked?401:200)
 if(path==='/auth/v1/logout'){revoked=true;return send({})}
 if(path.includes('/admin/users/'))return send(person)
 if(path==='/rest/v1/openpath_profiles')return send([{preferences}])
 if(path==='/rest/v1/openpath_workspace')return send([])
 return send([])
})
const app=createOpenPathServer({env:{SUPABASE_URL:await listen(mock),SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test'}})
const root=await listen(app)
const browser=await chromium.launch({headless:true,executablePath:process.env.PATH4U_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const errors=[]
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(root+'/login')
 await page.getByLabel('Email address').fill('synthetic@example.test')
 await page.getByLabel('Password',{exact:true}).fill('wrong-password')
 await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Email or password is incorrect.'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Resend verification',exact:true}).count(),0)
 await page.getByLabel('Email address').fill('unverified@example.test')
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password')
 await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Verify your email'}).waitFor()
 await page.getByRole('button',{name:'Resend verification',exact:true}).click()
 const cooldown=page.getByRole('button',{name:/Resend available in/})
 await cooldown.waitFor();assert.equal(await cooldown.isDisabled(),true)
 assert.equal(resendCalls,1)
 await page.getByRole('status').filter({hasText:'If confirmation is pending'}).waitFor()
 await page.getByLabel('Email address').fill('synthetic@example.test')
 assert.equal(await page.getByRole('button',{name:/Resend available in/}).count(),0)
 await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await page.waitForURL('**/dashboard');await page.reload()
 await page.getByRole('heading',{name:/Good (morning|afternoon|evening)/}).waitFor()
 const rail=page.getByRole('complementary',{name:'Workspace sidebar'})
 await rail.hover();await page.waitForFunction(()=>document.querySelector('.sidebar-dock').dataset.open==='true')
 for(const group of ['Atlas Index','Field Tools','Account']){
  await rail.getByRole('button',{name:group,exact:true}).hover()
  await page.waitForFunction(label=>[...document.querySelectorAll('.sidebar-group')].some(x=>x.textContent===label && x.getAttribute('aria-expanded')==='true'),group)
 }
 for(const label of ['Internships','Hackathons','Jobs','Workshops','Certifications','Scholarships'])assert.equal(await rail.getByRole('link',{name:label,exact:true,includeHidden:true}).count(),0)
 assert.equal(await rail.getByRole('link',{name:'Dashboard',exact:true,includeHidden:true}).count(),1)
 assert.equal(await rail.getByRole('link',{name:'Resume Studio',exact:true,includeHidden:true}).count(),1)
 await rail.getByRole('button',{name:'Atlas Index',exact:true}).hover()
 await rail.getByRole('link',{name:'Discover Opportunities',exact:true}).click()
 await page.getByRole('tablist',{name:'Opportunity categories'}).waitFor()
 assert.deepEqual(await page.getByRole('tab').allTextContents(),['Internships','Hackathons & Workshops','Jobs'])
 await page.getByRole('tab',{name:'Jobs',exact:true}).click();await page.waitForURL('**category=Job')
 await page.reload();await page.getByRole('tab',{name:'Jobs',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Jobs',exact:true}).getAttribute('aria-selected'),'true')
 await page.setViewportSize({width:390,height:844})
 await page.getByRole('button',{name:'Open workspace menu',exact:true}).click()
 const drawer=page.getByRole('dialog',{name:'Workspace menu',exact:true})
 await drawer.waitFor()
 for(const label of ['Internships','Hackathons','Jobs','Workshops','Certifications','Scholarships'])assert.equal(await drawer.getByRole('link',{name:label,exact:true,includeHidden:true}).count(),0)
 await drawer.getByText('Atlas Index',{exact:true}).click()
 await drawer.getByRole('link',{name:'Discover Opportunities',exact:true}).waitFor()
 assert.equal(await drawer.getByRole('link',{name:'Dashboard',exact:true}).count(),1)
 assert.equal(await drawer.getByRole('link',{name:'Resume Studio',exact:true}).count(),1)
 await drawer.getByRole('link',{name:'Resume Studio',exact:true}).click();await page.waitForURL('**/#/resume')
 await page.getByRole('heading',{name:'Path4U Resume Studio',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Back',exact:true}).count(),1)
 const placement=await page.evaluate(()=>({back:document.querySelector('.page-back-button').getBoundingClientRect().y,heading:document.querySelector('main h1').getBoundingClientRect().y,headerBottom:document.querySelector('.app-header').getBoundingClientRect().bottom}))
 assert.ok(placement.back>=placement.headerBottom && placement.back<placement.heading)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.getByRole('button',{name:'Open workspace menu',exact:true}).click()
 await drawer.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/?signedOut=1')
 const signedOut=await page.request.get(root+'/api/workspace');assert.equal(signedOut.status(),401)
 // Mobile signup exercises the actual form and backend with only the upstream mocked.
 await page.goto(root+'/signup')
 await page.getByLabel('Full name',{exact:true}).fill('Synthetic QA')
 await page.getByLabel('Email address').fill('mobile-signup@example.test')
 await page.getByLabel('Date of birth',{exact:true}).fill('2000-01-01')
 await page.getByLabel('Country',{exact:true}).fill('Malaysia')
 await page.getByLabel('State or region',{exact:true}).fill('KL')
 await page.getByLabel('City',{exact:true}).fill('KL')
 await page.getByLabel('Password',{exact:true}).fill('synthetic-new-password')
 await page.getByLabel('Confirm password',{exact:true}).fill('synthetic-new-password')
 await page.getByRole('checkbox').check()
 await page.getByRole('button',{name:'Create account',exact:true}).click()
 await page.getByRole('heading',{name:'Check your inbox',exact:true}).waitFor()
 await page.getByText(/Check your email to verify your account/).waitFor()
 assert.equal(signupCalls,1);assert.equal(await page.getByRole('button',{name:/Resend available in/}).isDisabled(),true)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:process.env.TEMP+'/path4u-auth-confirmation-mobile.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS local mocked-upstream browser: distinct login errors, verification resend/cooldown, login and refresh, desktop hover menus, six duplicate entries absent on desktop/mobile, Discover tabs and URL refresh, mobile Resume/Back/logout, signup confirmation and no overflow.')
}finally{await browser.close();app.close();mock.close()}
