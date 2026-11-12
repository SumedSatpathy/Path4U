import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateResume,resumeCompletion,validateResumeDocument} from '../shared/resumeValidation.mjs'
import {buildResume} from '../shared/resume.mjs'
const keys='name email phone city linkedin github portfolio role level industry summary education work internships projects technical soft certifications achievements languages volunteer job template'.split(' ')
export const valid=()=>({...Object.fromEntries(keys.map(key=>[key,''])),name:'李明',email:'candidate@example.org',role:'Graduate Intern',education:'BSc Computer Science | APU | 2022-09 to 2026-06',technical:'Python, C++, React',template:'Student & Graduate'})
test('required fields and student optional sections, unicode names and international contact values',()=>{
 const p=valid();assert.deepEqual(validateResume(p),{});assert.equal(resumeCompletion(p),100)
 for(const phone of ['+60 12-345 6789','+44 (20) 7946 0958','+971 50 123 4567']) assert.equal(validateResume({...p,phone}).phone,undefined)
 for(const key of ['name','email','education','technical','role']) assert.ok(validateResume({...p,[key]:'   '})[key])
 assert.equal(validateResume({...p,name:'John Doe'}).name,undefined)
 assert.ok(validateResume({...p,name:'Your name'}).name)
 for(const email of ['bad','a@b','a b@example.org']) assert.ok(validateResume({...p,email}).email)
 for(const portfolio of ['javascript:alert(1)','ftp://example.org','https://']) assert.ok(validateResume({...p,portfolio}).portfolio)
 assert.equal(validateResume({...p,linkedin:'https://my.linkedin.com/in/person'}).linkedin,undefined)
 assert.ok(validateResume({...p,github:'https://github.com.evil.test/profile'}).github)
 assert.ok(validateResume({...p,technical:'Python, python'}).technical)
 assert.ok(validateResume({...p,technical:'Python,,React'}).technical)
 assert.equal(resumeCompletion({...p,phone:'invalid'}),100)
})
test('entry details and ordered real dates; client and server generation share the same gate',()=>{
 const p=valid()
 for(const [key,value] of [['education','BSc'],['work','Engineer | Company'],['projects','Untitled'],['certifications','Certificate'],['education','BSc | APU | 2026-06 to 2022-09'],['work','Engineer | Company | Fixed bugs | 2025-13 to Present']]) assert.ok(validateResume({...p,[key]:value})[key])
 assert.equal(validateResume({...p,projects:'A | UI',certifications:'Security basics | Cisco',work:'Intern | APU | Built UI | 2024-01 to Present'}).projects,undefined)
 assert.ok(validateResume({...p,work:'Intern | APU | Build UI | '+(new Date().getUTCFullYear()+2)+' to Present'}).work)
 assert.equal(validateResumeDocument('Jamie Lee\njamie@example.org\n\nEducation\nBSc Computer Science\nAPU\n\nSkills\nPython, SQL'),'')
 const content=buildResume(p);assert.equal(validateResumeDocument(content),'')
 assert.match(validateResumeDocument(content.replace(/## Education[\s\S]*?(?=##)/,'')),/education/)
 assert.throws(()=>buildResume({...p,education:''}),/education/)
 assert.doesNotThrow(()=>validateResume({...p,phone:123}))
})
