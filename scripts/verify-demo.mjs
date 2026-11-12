if(process.env.PATH4U_VERIFY_DEMO!=='1')process.exit(0)
const {createOpenPathServer}=await import('../server/index.mjs')
const app=createOpenPathServer({env:process.env})
const origin=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
let cookie=''
const post=(path,payload)=>fetch(origin+'/api/demo/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},body:JSON.stringify(payload)})
try{
 const session=await post('session',{}),info=await session.json()
 if(!session.ok || !info.liveAI)throw Error('Session initialization failed')
 cookie=session.headers.get('set-cookie')?.split(';')[0] || ''
 const history=[]
 const prompts=['Hello.','Explain Python loops.','Create a cybersecurity roadmap for a complete beginner.','Create a six-month AI engineering roadmap.','Recommend cybersecurity courses from Coursera and Udemy.']
 for(const [index,message]of prompts.entries()){
  if(index===3)await new Promise(resolve=>setTimeout(resolve,61000))
  const result=await post('assistant',{message,history,requestId:crypto.randomUUID()});const body=await result.json()
  if(!result.ok || !body.result?.answer?.trim()){console.error(JSON.stringify({event:'live_demo_check',index:index+1,passed:false,status:result.status,error:body.error}));process.exitCode=1;break}
  history.push({question:message,answer:body.result.answer.slice(0,1000)})
  console.info(JSON.stringify({event:'live_demo_check',index:index+1,passed:true,status:result.status,actualGemini:index!==4,phases:body.result.roadmap?.milestones?.length,durationWeeks:body.result.roadmap?.durationWeeks,credits:body.credits}))
 }
}finally{app.close()}
