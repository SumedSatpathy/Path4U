import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ChevronDown, Copy, Download, Edit3, History, Image, Mic, Paperclip, Plus, RefreshCw, Save, Send, Share2, Sparkles, Square, X } from 'lucide-react'
import { CourseCards, SearchSuggestions } from './CourseCards'
import type { AssistantReply, Course, Roadmap } from '../shared/learning.mjs'
import { apiPost, failureMessage, requireAnswer, useIntegrationStatus } from './api'
import { type Attachment, attachmentTypes, encodeAttachment, readAttachment } from './attachments'
import { downloadBlob, type Conversation, type ConversationTurn, type DocumentFormat, type Draft } from './documents'
import { DraftEditor } from './DraftEditor'
import { useLearning } from './Learning'
import { useLibrary } from './library'
import { Markdown } from './Markdown'
import { navigate } from './routes'
import { Dialog } from './ui'
import { useWorkspace } from './workspace'
import './assistant.css'

type Artifact = 'text' | 'document' | 'roadmap' | 'flowchart' | 'mindmap'
type Result = AssistantReply & { roadmap?: Roadmap; resources?: Course[]; suggestions?: string; planInputs?: { hours?: number; durationWeeks?: number; level?: string }; tools?: { name: string; status: string }[]; sources?: { title: string; url: string }[]; title?: string; artifact?: Artifact; processed?: boolean; warning?: string; image?: { mime: string; data: string } }
type Turn = ConversationTurn & { roadmap?: Roadmap; resources?: Course[]; suggestions?: string; planInputs?: Result['planInputs']; tools?: Result['tools']; sources?: Result['sources']; title?: string; artifact?: Artifact; image?: Result['image'] }

interface SpeechResult {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResult) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
const speechWindow = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const imageSrc = (image: NonNullable<Result['image']>) => 'data:' + image.mime + ';base64,' + image.data

function localAttachmentReply(attachment: Attachment): Result {
  const paragraphs = attachment.text?.split(/\n+/).map(line => line.trim()).filter(Boolean) ?? []
  if (!paragraphs.length) throw new Error('Image and scanned document analysis requires Gemini on a connected account.')
  const preview = paragraphs.slice(0, 6).join('\n').slice(0, 950)
  return { answer: '**Text found in ' + attachment.name.replace(/[\[\]*_`]/g, '') + '**\n\n' + preview + '\n\nThis is a local text preview. Connect Gemini to ask questions about the document.', processed: true }
}

export function Assistant({ open, close, prompt = '' }: { open: boolean; close: () => void; prompt?: string }) {
  const { state, saveRoadmap } = useWorkspace()
  const { demo, run } = useLearning()
  const integration = useIntegrationStatus()
  const library = useLibrary<Conversation>('conversation')
  const drafts = useLibrary<Draft>('draft')
  const [turns, setTurns] = useState<Turn[]>([])
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID())
  const [sidebar, setSidebar] = useState(false)
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<Attachment | null>(null)
  const [thumbnail, setThumbnail] = useState('')
  const [reading, setReading] = useState(false)
  const [shareGoal, setShareGoal] = useState(false)
  const [useGemini, setUseGemini] = useState(true)
  const [busy, setBusy] = useState(false)
  const [canStop, setCanStop] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [editor, setEditor] = useState<{ id: string; draft: Draft } | null>(null)
  const [expandedImage, setExpandedImage] = useState<Result['image']>()
  const field = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const chat = useRef<HTMLDivElement>(null)
  const requestIds = useRef(new Map<string,string>())
  const controller = useRef<AbortController | null>(null)
  const recorder = useRef<Recognition | null>(null)
  const stayAtBottom = useRef(true)
  const goal = state.roadmaps?.[0]?.goal ?? ''
  const live = demo ? demo.liveAI : integration.gemini && useGemini

  useEffect(() => { if (open) field.current?.focus(); else recorder.current?.stop() }, [open])
  useEffect(() => { if (open && prompt) setMessage(current => current.trim() ? current : prompt.slice(0, 1500)) }, [open, prompt])
  useEffect(() => { if (chat.current && stayAtBottom.current) chat.current.scrollTop = chat.current.scrollHeight }, [turns, open, busy])
  useEffect(() => {
    if (!file?.mime.startsWith('image/')) { setThumbnail(''); return }
    const url = URL.createObjectURL(file.file)
    setThumbnail(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => { controller.current?.abort(); recorder.current?.abort() }, [])

  function dictation() {
    if (recording) { recorder.current?.stop(); return }
    if (!SpeechRecognition) { setError('Voice dictation is unavailable in this browser. You can type your message.'); return }
    const recognizer = new SpeechRecognition()
    const prefix = message ? message.trimEnd() + ' ' : ''
    recognizer.lang = navigator.language
    recognizer.continuous = true
    recognizer.interimResults = true
    recognizer.onresult = event => {
      const text = Array.from(event.results, result => result[0].transcript).join(' ')
      setMessage((prefix + text).slice(0, 1500))
    }
    recognizer.onerror = event => {
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Microphone access was denied. Check browser permissions or type your message.' : 'Voice dictation stopped. You can continue typing.')
      setRecording(false)
    }
    recognizer.onend = () => { recorder.current = null; setRecording(false); if (open) field.current?.focus() }
    recorder.current = recognizer
    setError('')
    try { recognizer.start(); setRecording(true) }
    catch { recorder.current = null; setError('The microphone could not start. You can type your message.'); setRecording(false) }
  }

  function switchChat(id: string, next: Turn[]) {
    setChatId(id); setTurns(next); setMessage(''); setFile(null); setError(''); setStatus(''); stayAtBottom.current = true
  }

  async function saveChat(next: Turn[]) {
    if (!next.length) return
    const savedTurns = next.slice(-10).map(({ image: _image, roadmap: _roadmap, resources: _resources, ...turn }) => turn)
    try {
      await library.save(chatId, { title: (next[0].question || 'Untitled conversation').slice(0, 75), turns: savedTurns })
    } catch {
      setStatus('This conversation is open in this tab. History could not be saved.')
    }
  }

  async function send(question: string, action: 'chat' | 'image' = 'chat', replaceId?: string) {
    if (!question.trim() || controller.current || reading || recording || (demo && !demo.ready)) return
    if(!demo && useGemini && !integration.ready) {setError('Checking the live AI connection. Try again shortly.');return}
    if(!demo && useGemini && !integration.gemini) {setError('Live Gemini is unavailable on this deployment. Check the server GEMINI_API_KEY setting. Your question is preserved.');return}
    setError(''); setStatus(''); setBusy(true); setCanStop(action === 'image' || live)
    const abort = new AbortController()
    controller.current = abort
    stayAtBottom.current = true
    try {
      let reply: Result
      if(demo?.liveAI) {
        if(file || action==='image') throw new Error('Live demo supports non-sensitive text questions. Resume files stay in local Resume Studio.')
        reply=await run<Result>('assistant',{message:question,goal:shareGoal?goal:'',history:turns.filter(turn=>turn.id!==replaceId).slice(-5).map(({question,answer})=>({question,answer}))})
      } else if (action === 'image' || live) {
        if(file && !integration.privateAI) throw new Error('Use local Resume Studio for resume files. Attachments cannot be shared with the free Gemini service.')
        const requestKey=JSON.stringify({action,question,replaceId,goal:shareGoal?goal:'',history:turns.filter(turn=>turn.id!==replaceId).slice(-5).map(({question,answer})=>({question,answer})),file:file?{name:file.name,text:file.text}:null})
        const requestId=requestIds.current.get(requestKey) ?? crypto.randomUUID()
        requestIds.current.set(requestKey,requestId)
        reply = await apiPost<Result>('assistant', { requestId, privateDataConsent: Boolean(integration.privateAI && useGemini), action, message: question, goal: shareGoal ? goal : '', history: turns.filter(turn => turn.id !== replaceId).slice(-5).map(({ question, answer }) => ({ question, answer })), attachment: file ? await encodeAttachment(file) : undefined }, abort.signal)
        requestIds.current.delete(requestKey)
      } else if (file) {
        reply = localAttachmentReply(file)
      } else {
        reply = await run<Result>('assistant', { message: question, history: turns.slice(-5).map(({question,answer}) => ({question,answer})), goal: shareGoal ? goal : '', useGemini: false })
      }
      if (abort.signal.aborted) { setStatus('Generation stopped.'); return }
      reply = requireAnswer<Result>(reply)
      const turn: Turn = { id: replaceId ?? crypto.randomUUID(), question, answer: reply.answer, at: new Date().toISOString(), roadmap: reply.roadmap, resources: reply.resources, suggestions: reply.suggestions, proposal: reply.proposal, title: reply.title, artifact: reply.artifact, planInputs: reply.planInputs, tools: reply.tools, sources: reply.sources, image: reply.image, attachment: reply.processed ? file?.name.slice(0, 180) : undefined }
      const next = replaceId ? turns.map(item => item.id === replaceId ? turn : item) : [...turns, turn].slice(-10)
      setTurns(next)
      setMessage('')
      setFile(null)
      await saveChat(next)
      if (reply.warning) setStatus(reply.warning)
      if (reply.image) setStatus('Download the generated image to keep it. Image files are not saved in chat history.')
    } catch (failure) {
      if (abort.signal.aborted) setStatus('Generation stopped.')
      else setError(failureMessage(failure))
    } finally {
      if (controller.current === abort) { controller.current = null; setBusy(false); setCanStop(false) }
    }
  }

  const draftFor = (turn: Turn): Draft => ({ title: turn.title || turn.question.slice(0, 80), content: turn.answer, template: 'Classic Professional' })
  async function output(action: () => Promise<void>) {
    setError('')
    try { await action() } catch (failure) { setError(failureMessage(failure)) }
  }
  async function exportReply(turn: Turn, format: DocumentFormat) {
    const { documentBlob } = await import('./documentExport')
    downloadBlob(await documentBlob(draftFor(turn), format), 'Path4U_Response.' + format)
    setStatus('Download started.')
  }
  async function downloadImage(image: NonNullable<Result['image']>) {
    const blob = await (await fetch(imageSrc(image))).blob()
    downloadBlob(blob, 'Path4U_Image.' + (image.mime === 'image/jpeg' ? 'jpg' : image.mime.split('/')[1]))
  }

  if (!open) return null
  return <aside className="assistant-panel panel" aria-label="Path4U AI" onKeyDown={event => { if (event.key === 'Escape' && !editor && !expandedImage) { event.stopPropagation(); close() } }}>
    <header className="assistant-head"><div><Sparkles size={16} /> <h2>Path4U AI</h2></div><div>
      <button className="icon-button" type="button" title="Conversation history" aria-label="Conversation history" aria-expanded={sidebar} onClick={() => setSidebar(!sidebar)}><History size={18} /></button>
      <button className="icon-button" type="button" title="New conversation" aria-label="New conversation" disabled={busy || reading || recording} onClick={() => switchChat(crypto.randomUUID(), [])}><Plus size={19} /></button>
      <button className="icon-button" type="button" aria-label="Minimize assistant" onClick={close}><ChevronDown size={20} /></button>
    </div></header>
    <div className="assistant-content">
      {sidebar && <nav className="assistant-history" aria-label="Previous conversations"><strong>Previous chats</strong>
        <p className="muted">{library.demo ? 'Saved in this browser' : 'Private to your account'}</p>
        {library.error && <p role="alert">{library.error}</p>}
        {!library.items.length && <p className="muted">{library.loading ? 'Loading…' : 'No saved chats.'}</p>}
        {library.items.map(item => <button type="button" className="button button-ghost button-small" key={item.id} disabled={busy || reading || recording} aria-current={item.id === chatId} onClick={() => switchChat(item.id, item.value.turns)}>{item.value.title}</button>)}
        {library.items.some(item => item.id === chatId) && <button type="button" className="button button-secondary button-small" disabled={busy} onClick={() => void output(async () => { await library.remove(chatId); switchChat(crypto.randomUUID(), []); setStatus('Conversation deleted.') })}>Delete current chat</button>}
        {turns.length > 0 && <button type="button" className="button button-ghost button-small" disabled={busy} onClick={() => void saveChat(turns)}>Save conversation</button>}
      </nav>}
      <div className="assistant-messages" ref={chat} aria-live="polite" onScroll={event => {
        const node = event.currentTarget
        stayAtBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 75
      }}>
        {!turns.length && <div className="assistant-intro"><Sparkles size={23} /><h3>What are you working on?</h3><p className="muted">Ask for a learning plan, get feedback on an application, or attach a document.</p></div>}
        {turns.map((turn, index) => <div key={turn.id} className="assistant-turn">
          <p className="assistant-question">{turn.question}</p>
          <time className="assistant-time" dateTime={turn.at}>{clock.format(new Date(turn.at))}</time>
          {turn.attachment && <span className="assistant-file-note"><Paperclip size={13} /> {turn.attachment}</span>}
          <div className="assistant-answer"><Markdown value={turn.answer} /></div>
          {turn.resources?.length ? <CourseCards resources={turn.resources} /> : null}
          <SearchSuggestions html={turn.suggestions} />
          {turn.roadmap && <button type="button" className="button button-primary button-small" onClick={() => { const id = crypto.randomUUID(); if (saveRoadmap({ ...turn.roadmap!, id })) { navigate('/roadmap', new URLSearchParams({plan:id})); close() } }}>Save &amp; open roadmap <ArrowRight size={14} /></button>}
          {turn.tools?.map(tool => <p className="field-help" key={tool.name}>{tool.name.replaceAll('_', ' ')} · {tool.status.replaceAll('_', ' ')}</p>)}
          {turn.sources?.length ? <ul>{turn.sources.map(source => <li key={source.url}><a className="text-link" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul> : null}
          {turn.image && <div className="assistant-artifact"><img src={imageSrc(turn.image)} alt="Generated illustration" /><div className="draft-toolbar">
            <button type="button" className="button button-secondary button-small" onClick={() => setExpandedImage(turn.image)}>Expand image</button>
            <button type="button" className="button button-secondary button-small" onClick={() => void output(() => downloadImage(turn.image!))}><Download size={14} /> Download image</button>
          </div></div>}
          {(turn.proposal || turn.artifact === 'document') && <div className="assistant-artifact"><strong>{turn.title || turn.proposal || 'Draft document'}</strong>
            {turn.proposal && <div className="draft-toolbar">{([['/roadmap', 'Review roadmap goal'], ['/flowchart', 'Open Flowchart'], ['/mind-map', 'Open Mind Map']] as const).map(([path, label]) => <button key={path} type="button" className="button button-secondary button-small" onClick={() => {
              navigate(path, new URLSearchParams({ goal: turn.proposal!, ...(turn.planInputs?.hours ? { hours: String(turn.planInputs.hours) } : {}), ...(turn.planInputs?.durationWeeks ? { weeks: String(turn.planInputs.durationWeeks) } : {}), ...(turn.planInputs?.level ? { level: turn.planInputs.level } : {}) })); close()
            }}>{label} <ArrowRight size={13} /></button>)}</div>}
            {turn.artifact === 'document' && <button type="button" className="button button-secondary button-small" onClick={() => setEditor({ id: crypto.randomUUID(), draft: draftFor(turn) })}>Preview and edit draft</button>}
          </div>}
          <div className="assistant-response-actions">
            <button type="button" className="button button-ghost button-small" onClick={() => void output(async () => { await navigator.clipboard.writeText(turn.answer); setStatus('Response copied.') })}><Copy size={14} /> Copy</button>
            <button type="button" className="button button-ghost button-small" onClick={() => void output(async () => { await drafts.save(turn.id, draftFor(turn)); setStatus('Saved to Draft Library.') })}><Save size={14} /> Save</button>
            <button type="button" className="button button-ghost button-small" disabled={busy} onClick={() => { setMessage(turn.question); field.current?.focus() }}>Edit and resend</button>
            <button type="button" className="button button-ghost button-small" onClick={() => setEditor({ id: turn.id, draft: draftFor(turn) })}><Edit3 size={14} /> Edit</button>
            {index === turns.length - 1 && !turn.attachment && <button type="button" className="button button-ghost button-small" disabled={busy || reading || !!file || (!!turn.image && !integration.image)} onClick={() => void send(turn.question, turn.image ? 'image' : 'chat', turn.id)}><RefreshCw size={14} /> Regenerate</button>}
            <button type="button" className="button button-ghost button-small" onClick={() => void output(() => exportReply(turn, 'pdf'))}>PDF</button>
            <button type="button" className="button button-ghost button-small" onClick={() => void output(() => exportReply(turn, 'docx'))}>Word</button>
            {typeof navigator.share === 'function' && <button type="button" className="button button-ghost button-small" onClick={() => void output(async () => {
              try { await navigator.share({ title: turn.title || 'Path4U response', text: turn.answer }) }
              catch (failure) { if (!(failure instanceof DOMException && failure.name === 'AbortError')) throw failure }
            })}><Share2 size={14} /> Share</button>}
          </div>
        </div>)}
        {busy && <p role="status" className="assistant-thinking">Choosing tools and preparing a response…</p>}
      </div>
    </div>
    <form className="assistant-form" noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); void send(message.trim()) }}>
      {file && <div className="assistant-attachment">{thumbnail ? <img src={thumbnail} alt="" /> : <Paperclip size={18} />}<span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB · {live && integration.privateAI ? 'Sent only when you submit' : file.text ? 'Text preview on this device' : 'Gemini required for analysis'}</small></span><button type="button" className="icon-button" aria-label="Remove attachment" disabled={busy} onClick={() => setFile(null)}><X size={17} /></button></div>}
      {file?.text && <details className="assistant-file-preview"><summary>Preview document text</summary><pre>{file.text.slice(0, 550)}</pre></details>}
      {!turns.length && <div className="assistant-quick-actions" aria-label="Assistant quick actions">{[
        ['Build My Roadmap', 'Create a cybersecurity roadmap for a complete beginner.'],
        ['Find Courses', 'Find free Python courses.'],
        ['Create Study Plan', 'Create a 3-month Python study plan.'],
        ['Find Internships', 'Find software engineering internships in Malaysia.'],
        ['Explore Hackathons', 'Find beginner hackathons.'],
        ['Explain a Topic', 'Explain computer networking from scratch.'],
      ].map(([label, prompt]) => <button type="button" className="button button-secondary button-small" key={label} onClick={() => { setMessage(prompt); field.current?.focus() }}>{label}</button>)}</div>}
      <div className="assistant-input">
        <input ref={fileInput} type="file" accept={attachmentTypes} hidden aria-label="Upload attachment" onChange={async event => {
          const selected = event.target.files?.[0]
          event.target.value = ''
          if (!selected) return
          setReading(true); setError('')
          try { setFile(await readAttachment(selected)) } catch (failure) { setError(failureMessage(failure)) } finally { setReading(false) }
        }} />
        <button type="button" className="icon-button" aria-label="Attach file" title="Attach file" disabled={busy || reading} onClick={() => fileInput.current?.click()}><Paperclip size={17} /></button>
        <input ref={field} className="assistant-text" aria-label="Your question" maxLength={1500} value={message} onChange={event => setMessage(event.target.value)} disabled={busy} placeholder="Ask Path4U AI…" />
        <button type="button" className="icon-button" title={recording ? 'Stop dictation' : 'Start dictation'} aria-label={recording ? 'Stop dictation' : 'Start dictation'} aria-pressed={recording} disabled={busy} onClick={dictation}>{recording ? <Square size={16} /> : <Mic size={17} />}</button>
        {busy && canStop ? <button type="button" className="icon-button" aria-label="Stop generation" onClick={() => controller.current?.abort()}><Square size={17} /></button> : <button type="submit" className="icon-button" aria-label="Send question" disabled={busy || reading || recording || !message.trim() || Boolean(demo && !demo.ready)}><Send size={17} /></button>}
      </div>
      {reading && <p role="status">Reading attachment…</p>}
      {recording && <p role="status">Listening… Review the transcription before sending.</p>}
      {status && <p role="status">{status}</p>}
      {(error || demo?.error) && <p role="alert" className="field-error">{error || demo?.error}</p>}
      <div className="assistant-options">
        {demo && <small>{demo.error ? 'Demo AI unavailable · ' : !demo.ready ? 'Checking demo AI · ' : demo.liveAI ? 'Live Gemini demo · ' : 'Guided demo · '}{demo.credits === null ? 'Preview' : demo.credits+' units remaining'}</small>}
        {!SpeechRecognition && <small>Dictation unavailable on this browser.</small>}
        {goal && <label className="learning-check"><input type="checkbox" checked={shareGoal} onChange={event => setShareGoal(event.target.checked)} /> Share roadmap goal</label>}
        {!demo && integration.gemini && <label className="learning-check"><input type="checkbox" checked={useGemini} disabled={busy} onChange={event => setUseGemini(event.target.checked)} /> {integration.privateAI ? 'I consent to sharing this chat and attachments with the approved Gemini service.' : 'Use Gemini for this chat. Do not include personal or confidential information.'}</label>}
        {!integration.privateAI && <small>Resume files and sensitive details stay in Resume Studio. Attachments cannot be sent to the free AI service.</small>}
        {!live && <small>{integration.gemini ? 'Enable Gemini for career and learning answers.' : 'Gemini image and document analysis are unavailable here.'}</small>}
        {!demo && integration.image && <button type="button" className="button button-secondary button-small" disabled={busy || recording || reading || !!file || !message.trim()} onClick={() => void send(message.trim(), 'image')}><Image size={14} /> Generate image with Gemini</button>}
      </div>
    </form>
    <Dialog open={!!editor} onClose={() => setEditor(null)} title="Edit response draft" className="draft-dialog">
      {editor && <DraftEditor key={editor.id} draft={editor.draft} onSave={value => drafts.save(editor.id, value)} />}
    </Dialog>
    <Dialog open={!!expandedImage} onClose={() => setExpandedImage(undefined)} title="Generated image" className="draft-dialog">
      {expandedImage && <img className="assistant-expanded-image" src={imageSrc(expandedImage)} alt="Generated illustration" />}
    </Dialog>
  </aside>
}
