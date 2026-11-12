// Rebuilds the editable composition and exact scene-level subtitle cues.
// Run from the video directory after preparing assets and scenes.json.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scenes=JSON.parse(await readFile(resolve(root,'scenes.json'),'utf8'));
const comp=resolve(root,'composition');await mkdir(resolve(comp,'compositions'),{recursive:true});
const esc=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fonts="@font-face{font-family:'Inter Variable';src:url('assets/fonts/inter.woff2')}@font-face{font-family:'Space Grotesk Variable';src:url('assets/fonts/space-grotesk.woff2')}";
let start=0,srt=[],vtt=['WEBVTT\n'],hosts=[],audio=[];
function stamp(seconds,comma=false){const ms=Math.round(seconds*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+(comma?',':'.')+String(ms%1000).padStart(3,'0')}
for(const [i,s] of scenes.entries()){
 const d=Math.ceil((s.voiceDuration+1.1)*30)/30;s.start=start;s.duration=d;
 hosts.push(`<div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${start}" data-duration="${d}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`);
 audio.push(`<audio id="voice-${s.id}" class="clip" src="assets/${s.id}.wav" data-start="${start+0.4}" data-duration="${s.voiceDuration}" data-volume="1" data-track-index="3"></audio>`);
 const captionId=`caption-${s.id}`,begin=start+0.35,end=start+0.4+s.voiceDuration;
 srt.push(`${i+1}\n${stamp(begin,true)} --> ${stamp(end,true)}\n${s.narration}\n`);
 vtt.push(`${i+1}\n${stamp(begin)} --> ${stamp(end)}\n${s.narration}\n`);
 await writeFile(resolve(comp,`compositions/${s.id}.html`),`<template><style>${fonts}
#root{position:absolute;inset:0;color:#fff;font-family:'Inter Variable',sans-serif}
.stage{position:absolute;inset:0;background:#080808}.heading{position:absolute;left:192px;top:62px;font-family:'Space Grotesk Variable',sans-serif;font-size:44px;line-height:1.1;font-weight:600;margin:0}
.number{position:absolute;left:116px;top:69px;font-size:28px;color:#b8b8b8}.screen{position:absolute;left:192px;top:150px;width:1536px;height:736px;border-radius:18px;border:1px solid #444;overflow:hidden;background:#111}.screen img{width:100%;height:100%;object-fit:contain}
.note{position:absolute;left:192px;top:1010px;font-size:28px;color:#b8b8b8}.brand{position:absolute;right:192px;top:68px;width:150px;height:40px;object-fit:contain}
</style><div id="root" data-composition-id="${s.id}" data-width="1920" data-height="1080"><div class="stage" data-hold="true"><div class="entrance"><div class="number">${String(i+1).padStart(2,'0')}</div><h1 class="heading">${esc(s.title)}</h1><img class="brand" src="assets/wordmark.svg" alt="Path4U"><div class="screen"><img src="assets/screens/${s.id}.png" alt="Actual Path4U ${esc(s.id)} screen"></div><div class="note">${s.id==='resume'?'Fictional sample resume · local review':'Actual interface walkthrough · guest workspace'}</div></div></div></div><script>const tl=gsap.timeline({paused:true});tl.fromTo('.entrance',{opacity:${i===0?1:0},y:${i===0?0:12}},{opacity:1,y:0,duration:0.35,ease:'power2.out'},0);tl.to('.entrance',{opacity:0,duration:0.25,ease:'power2.in'},${d-0.25});window.__timelines['${s.id}']=tl;</script></template>`);
 start+=d;
}
const captionMarkup=scenes.map(s=>`<div id="cue-${s.id}" class="clip" data-start="${s.start+0.35}" data-duration="${s.voiceDuration+0.05}"><p class="caption">${esc(s.narration)}</p></div>`).join('\n');
await writeFile(resolve(comp,'compositions/captions.html'),`<template><style>${fonts}#root{position:absolute;inset:0;color:#fff;font-family:'Inter Variable',sans-serif}.caption{position:absolute;left:192px;top:903px;width:1536px;height:70px;font-size:30px;line-height:35px;text-align:center;margin:0;color:#fff;background:#080808;display:flex;align-items:center;justify-content:center}</style><div id="root" data-composition-id="captions" data-width="1920" data-height="1080">${captionMarkup}</div><script>window.__timelines['captions']=gsap.timeline({paused:true});</script></template>`);
await writeFile(resolve(comp,'index.html'),`<!doctype html><html lang="en" data-composition-variables='[{"id":"color-ground","type":"color","label":"Background","default":"#080808"},{"id":"color-ink","type":"color","label":"Text","default":"#FFFFFF"}]'><head><meta charset="utf-8"><title>Path4U · workflow walkthrough</title><style>html,body{margin:0;background:#080808}#root{position:relative;width:1920px;height:1080px;overflow:hidden;background:var(--color-ground,#080808)}.progress{position:absolute;left:192px;top:1050px;width:1536px;height:3px;background:#fff;transform-origin:left center;z-index:100}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="${start}" data-width="1920" data-height="1080" data-fps="30">${hosts.join('\n')}<div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${start}" data-track-index="2" data-track-kind="captions" data-width="1920" data-height="1080" style="z-index:50"></div>${audio.join('\n')}<audio id="music" class="clip" src="assets/music.mp3" data-start="0" data-duration="${start}" data-volume="0.08" data-fade-in="1" data-fade-out="3" data-track-index="4"></audio><div class="progress" aria-hidden="true"></div></div><script src="assets/vendor/gsap.min.js"></script><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});tl.fromTo('.progress',{scaleX:0},{scaleX:1,duration:${start},ease:'none'},0);window.__timelines['main']=tl;</script></body></html>`);
await writeFile(resolve(root,'path4u-workflow.srt'),srt.join('\n'));await writeFile(resolve(root,'path4u-workflow.vtt'),vtt.join('\n'));
await writeFile(resolve(root,'scenes.json'),JSON.stringify(scenes,null,2));console.log(JSON.stringify({scenes:scenes.length,duration:start,subtitles:srt.length}));
