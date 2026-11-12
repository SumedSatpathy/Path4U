import assert from 'node:assert/strict'
import {createOpenPathServer} from '../server/index.mjs'
import {Document,Packer,Paragraph} from 'docx'
import {jsPDF} from 'jspdf'
const {chromium}=await import(process.env.PATH4U_PLAYWRIGHT_MODULE || 'playwright')
const app=createOpenPathServer({env:{}})
const root=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const synthetic='Jamie Lee\njamie@example.test\nEducation\nBSc Computer Science, Example University\nProjects\nBuilt a React dashboard with TypeScript.\nDesigned accessible HTML and CSS pages.\nImplemented Git workflows and accessibility tests.\nSkills\nReact, TypeScript, JavaScript, HTML, CSS, Git, accessibility'
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 const errors=[];const privateCalls=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('request',request=>{if(/\/api\/(assistant|analyze|draft)(?:$|\?)/.test(request.url()))privateCalls.push(request.url())})
 await page.goto(root+'/dashboard?demo=1')
 const rail=page.getByRole('complementary',{name:'Workspace sidebar'})
 await rail.hover();await rail.getByRole('link',{name:'Resume Studio',exact:true}).click()
 await page.getByRole('button',{name:'Analyze Resume',exact:false}).click()
 await page.getByLabel('Target role',{exact:true}).fill('Frontend Developer')
 const upload=page.getByLabel('Open a resume file')
 const pdf=new jsPDF();pdf.text(synthetic.split('\n'),15,15)
 const word=await Packer.toBuffer(new Document({sections:[{children:synthetic.split('\n').map(text=>new Paragraph(text))}]}))
 for(const file of [{name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))},{name:'synthetic.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:word}]) {
  await upload.setInputFiles(file)
  await page.waitForFunction(()=>document.querySelector('textarea')?.value.includes('Jamie Lee'))
  await page.getByRole('button',{name:'Score resume',exact:true}).click()
  await page.getByRole('heading',{name:'Path4U Resume Quality Score'}).waitFor()
  assert.equal(await page.locator('.resume-rubric > div').count(),5)
  await page.getByText('Evidence from your resume',{exact:true}).first().click()
  await page.getByRole('blockquote').filter({hasText:'Jamie Lee'}).waitFor()
 }
 await page.getByLabel('Job description (optional)',{exact:true}).fill('React TypeScript accessibility')
 await page.getByRole('button',{name:'Score resume',exact:true}).click()
 await page.getByRole('heading',{name:'Path4U Resume Quality Score'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Get Gemini feedback'}).count(),0)
 await page.setViewportSize({width:390,height:844})
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth)
 await page.screenshot({path:process.env.TEMP+'/path4u-local-resume-rater-mobile.png',fullPage:true})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:process.env.TEMP+'/path4u-local-resume-rater-mobile.png',fullPage:true})
 assert.deepEqual(privateCalls,[]);assert.deepEqual(errors,[])
 console.log('PASS: local synthetic PDF/DOCX parsing, five-category rubric, verbatim evidence, job-description scoring, privacy gating and mobile layout; zero private AI requests.')
} finally {await browser.close();app.close()}
