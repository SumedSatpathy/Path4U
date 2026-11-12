// Optional browser QA. Uses Playwright supplied by the host; no application dependency is added.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createOpenPathServer } from '../server/index.mjs'
import { roadmapFixture } from './fixtures/roadmap.mjs'
const { chromium } = await import(process.env.PATH4U_PLAYWRIGHT_MODULE || 'playwright')
const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve('http://127.0.0.1:' + server.address().port)))
let row
let revoked = false
let empty = false
let slow = false
const user = {id:'11111111-2222-4444-a333-555555555555',email:'qa@example.test',email_confirmed_at:'2026-11-11',app_metadata:{age_requirement_met:true},user_metadata:{full_name:'QA Candidate'}}
const upstream = createServer(async (req,res) => {
  const parts = await Array.fromAsync(req)
  const body = parts.length ? JSON.parse(Buffer.concat(parts).toString()) : null
  const path = new URL(req.url,'http://mock.test').pathname
  const send = (value,status=200) => {res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  if (path === '/auth/v1/token') return send(revoked ? {} : {user,access_token:'mock-access',refresh_token:'mock-refresh',expires_in:3600},revoked ? 401 : 200)
  if (path === '/auth/v1/user') return send(revoked ? {} : user,revoked ? 401 : 200)
  if (path === '/auth/v1/logout') {revoked=true;return send({})}
  if (path === '/rest/v1/openpath_profiles') return send([{preferences:{organization:'Test university',field:'Technology',stage:'Student',skills:[],interests:['AI'],goals:['Learn'],budget:'Free and paid'}}])
  if (path.endsWith('openpath_claim_assistant_usage')) return send(true)
  if (path === '/rest/v1/openpath_workspace') {
    if (body) row={state:body.state,revision:body.revision}
    return send(row ? [row] : [])
  }
  if (path === '/rest/v1/openpath_library') return send(body ? [{...body,updated_at:new Date().toISOString()}] : [])
  send([])
})
const originalFetch = globalThis.fetch
// Test provider only. These fixtures never run in the application runtime.
globalThis.fetch = async (url,options) => {
  if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(url,options)
  const body=JSON.parse(options.body)
  if (slow) await new Promise(resolve => setTimeout(resolve,1200))
  if (body.tools?.[0]?.google_search) return Response.json({candidates:[{content:{parts:[{text:'Read the official provider page.'}]},groundingMetadata:{groundingChunks:[{web:{title:'Google Cybersecurity',uri:'https://www.coursera.org/professional-certificates/google-cybersecurity/'}}],groundingSupports:[{segment:{text:'Read the official provider page.'},groundingChunkIndices:[0]}],searchEntryPoint:{renderedContent:'<a href="https://www.google.com/search?q=cybersecurity">Google Search suggestions</a>'}}}]})
  if (body.tools) return Response.json({candidates:[{content:{parts:[]}}]})
  const input=JSON.parse(body.contents[0].parts[0].text)
  const output = body.generationConfig.responseSchema.properties.milestones ? roadmapFixture(input) : {answer:empty ? '' : 'A contextual response.',title:'Guidance',artifact:'text',proposal:''}
  if (output.milestones) output.milestones[0].resourceIds=input.resources.filter(item => ['google-cyber','udemy-cyber'].includes(item.id)).map(item => item.id)
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})
}
const server=createOpenPathServer({env:{SUPABASE_URL:await listen(upstream),SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test',GEMINI_API_KEY:'mock',GEMINI_MODEL:'mock',GEMINI_SEARCH_ENABLED:'true',GEMINI_SEARCH_BILLING_APPROVED:'true'}})
const origin=await listen(server)
const browser=await chromium.launch({executablePath:process.env.PATH4U_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const errors=[]
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
  page.on('pageerror',e => errors.push(e.message))
  await page.goto(origin + '/dashboard')
  await page.getByLabel('Email address').fill('qa@example.test')
  await page.getByLabel('Password',{exact:true}).fill('example-password123')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.waitForURL('**/dashboard')
  await page.reload()
  await page.getByRole('heading',{name:/Good (morning|afternoon|evening)/}).waitFor()
  await page.getByRole('button',{name:'Path4U AI',exact:true}).click()
  await page.locator('.assistant-quick-actions button').first().waitFor()
  assert.equal(await page.locator('.assistant-quick-actions button').count(),6)
  await page.getByLabel('Use Gemini for this chat. Do not include personal or confidential information.').check()
  await page.getByRole('button',{name:'Build My Roadmap',exact:true}).click()
  assert.equal(await page.getByLabel('Your question').inputValue(),'Create a cybersecurity roadmap for a complete beginner.')
  slow=true
  await page.getByRole('button',{name:'Send question'}).click()
  await page.getByRole('status').filter({hasText:'Choosing tools'}).waitFor()
  await page.getByRole('button',{name:'Save & open roadmap'}).waitFor()
  slow=false
  await page.getByRole('button',{name:'Save & open roadmap'}).click()
  await page.getByRole('heading',{name:'cybersecurity',exact:true}).waitFor()
  await page.getByText('Saved to your workspace.',{exact:true}).waitFor()
  await page.locator('.is-roadmap summary').first().click()
  await page.getByRole('checkbox',{name:'Learn fundamentals',exact:true}).check()
  await page.getByRole('button',{name:'Save roadmap',exact:true}).click()
  await page.getByText('Saved to your workspace.',{exact:true}).waitFor()
  await page.waitForFunction(async () => {const data=await(await fetch('/api/workspace')).json();return data.state?.roadmaps?.[0]?.milestones?.[0]?.lessons?.[0]?.done === true})
  await page.reload()
  await page.locator('.is-roadmap summary').first().click()
  await page.getByRole('checkbox',{name:'Learn fundamentals',exact:true}).waitFor()
  assert.equal(await page.getByRole('checkbox',{name:'Learn fundamentals',exact:true}).isChecked(),true)
  assert.ok(await page.getByRole('link',{name:'View Course',exact:false}).count() >= 2)
  assert.ok(await page.getByRole('link',{name:'Free Alternative'}).count() >= 2)
  assert.equal(await page.locator('iframe[title="Google Search suggestions"]').count(),1)
  await page.frameLocator('iframe[title="Google Search suggestions"]').getByRole('link',{name:'Google Search suggestions'}).waitFor()
  await page.getByText('1 of 4 learning tasks complete',{exact:false}).waitFor()
  const attribution = page.frameLocator('iframe[title="Google Search suggestions"]').getByRole('link',{name:'Google Search suggestions'})
  await page.locator('iframe[title="Google Search suggestions"]').evaluate(node => node.scrollIntoView({behavior:'instant',block:'center'}))
  assert.equal(await attribution.evaluate(node => getComputedStyle(node.ownerDocument.body).color),'rgb(17, 17, 17)')
  await page.locator('iframe[title="Google Search suggestions"]').screenshot({path:process.env.TEMP + '/path4u-search-attribution.png'})
  await page.screenshot({path:process.env.TEMP + '/path4u-researched-roadmap-desktop.png',fullPage:true})
  const directoryLinks=await page.locator('.learning-course-grid a').evaluateAll(links => links.map(link => link.href))
  assert.ok(directoryLinks.some(url => url.includes('udemy.com/course/')))
  await page.setViewportSize({width:390,height:844})
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true)
  await page.screenshot({path:process.env.TEMP + '/path4u-researched-roadmap-mobile.png',fullPage:true})
  await page.setViewportSize({width:1440,height:1000})
  await page.getByRole('button',{name:'Path4U AI',exact:true}).click()
  await page.getByLabel('Use Gemini for this chat. Do not include personal or confidential information.').check()
  empty=true
  await page.getByLabel('Your question').fill('Explain subnetting')
  await page.getByRole('button',{name:'Send question'}).click()
  await page.getByRole('alert').filter({hasText:'no usable answer'}).waitFor()
  assert.equal(await page.getByLabel('Your question').inputValue(),'Explain subnetting')
  empty=false
  await page.getByRole('button',{name:'Minimize assistant'}).click()
  await page.getByRole('complementary',{name:'Workspace sidebar'}).getByRole('button',{name:'Log Out'}).click()
  await page.waitForURL('**/?signedOut=1')
  await page.goto(origin + '/dashboard')
  await page.waitForURL('**/login')
  assert.deepEqual(errors,[])
  console.log('Browser PASS: real UI/API with mocked providers; login refresh, six quick actions, loading, researched roadmap cards, private save/reload and lesson progress, narrow viewport, blank-response recovery and logout protection. Live provider credentials were not used.')
} finally {
  globalThis.fetch=originalFetch
  await browser.close();server.close();upstream.close()
}
