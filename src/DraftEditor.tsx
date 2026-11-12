import { useEffect, useRef, useState } from 'react'
import { Bold, Copy, Download, Heading, Italic, Link, List, Redo2, Save, Table, Undo2 } from 'lucide-react'
import { failureMessage } from './api'
import { downloadBlob, templates, type DocumentFormat, type Draft } from './documents'
import { useUnsavedChanges } from './routes'
import { useLibrary } from './library'
import { Markdown } from './Markdown'
import './documents.css'

export function DraftEditor({ draft, onSave, onChange, exportError, validateExport }: { draft: Draft; onSave: (value: Draft) => Promise<unknown>; onChange?: (value: Draft) => void; exportError?: string; validateExport?: (value: Draft) => string }) {
  const [value, setValue] = useState(draft)
  const [savedValue, setSavedValue] = useState(JSON.stringify(draft))
  useUnsavedChanges(JSON.stringify(value) !== savedValue)
  const [history, setHistory] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const editor = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { onChange?.(value) }, [value, onChange])

  function change(content: string) {
    setHistory(items => [...items.slice(-69), value.content])
    setFuture([])
    setValue({ ...value, content })
    setStatus('')
  }

  function format(prefix: string, suffix = '', placeholder = 'Text') {
    const field = editor.current
    if (!field) return
    const { selectionStart: start, selectionEnd: end } = field
    const selection = value.content.slice(start, end) || placeholder
    const content = value.content.slice(0, start) + prefix + selection + suffix + value.content.slice(end)
    if (content.length > 20_000) return
    change(content)
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(start + prefix.length, start + prefix.length + selection.length)
    })
  }

  async function action(name: string, run: () => Promise<void>) {
    setBusy(name)
    setError('')
    setStatus('')
    try { await run() } catch (failure) { setError(failureMessage(failure)) } finally { setBusy('') }
  }

  async function exportFile(format: DocumentFormat) {
    const problem=exportError || validateExport?.(value)
    if(problem) throw new Error(problem)
    const { documentBlob } = await import('./documentExport')
    const base = value.title.trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 65) || 'Draft'
    downloadBlob(await documentBlob(value, format), 'Path4U_' + base + '.' + format)
    setStatus('Download started.')
  }

  const exportProblem=exportError || validateExport?.(value) || ''
  const valid = Boolean(value.title.trim() && value.content.trim())
  return <div className="draft-editor">
    <div className="draft-toolbar">
      <button className="button button-primary button-small" type="button" disabled={!valid || !!busy} onClick={() => void action('save', async () => { await onSave(value); setSavedValue(JSON.stringify(value)); setStatus('Draft saved.') })}><Save size={15} />{busy === 'save' ? 'Saving…' : 'Save Draft'}</button>
      <button className="button button-secondary button-small" type="button" disabled={!valid || !!busy || Boolean(exportProblem)} onClick={() => void action('pdf', () => exportFile('pdf'))}><Download size={15} />Download PDF</button>
      <button className="button button-secondary button-small" type="button" disabled={!valid || !!busy || Boolean(exportProblem)} onClick={() => void action('docx', () => exportFile('docx'))}><Download size={15} />Download Word</button>
      <button className="button button-ghost button-small" type="button" disabled={!valid || !!busy} onClick={() => void action('copy', async () => { await navigator.clipboard.writeText(value.content); setStatus('Draft copied.') })}><Copy size={15} />Copy</button>
    </div>
    {status && <p role="status">{status}</p>}
    {exportProblem && <p role="alert" className="field-error">{exportProblem}</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <div className="draft-fields">
      <label className="field">Draft title<input value={value.title} maxLength={120} onChange={event => { setValue({ ...value, title: event.target.value }); setStatus('') }} /></label>
      <label className="field">Layout<select value={value.template} onChange={event => { setValue({ ...value, template: event.target.value as Draft['template'] }); setStatus('') }}>{templates.map(item => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="draft-split">
      <div className="draft-input">
        <div className="draft-toolbar" aria-label="Formatting">
          <button type="button" className="icon-button" aria-label="Heading" title="Heading" onClick={() => format('## ')}><Heading size={16} /></button>
          <button type="button" className="icon-button" aria-label="Bold" title="Bold" onClick={() => format('**', '**')}><Bold size={16} /></button>
          <button type="button" className="icon-button" aria-label="Italic" title="Italic" onClick={() => format('*', '*')}><Italic size={16} /></button>
          <button type="button" className="icon-button" aria-label="List item" title="List item" onClick={() => format('- ')}><List size={16} /></button>
          <button type="button" className="icon-button" aria-label="Link" title="Link" onClick={() => format('[', '](https://example.com)', 'Link title')}><Link size={16} /></button>
          <button type="button" className="icon-button" aria-label="Table" title="Table" onClick={() => format('', '', '\n| Heading | Heading |\n| --- | --- |\n| Value | Value |\n')}><Table size={16} /></button>
          <button type="button" className="icon-button" aria-label="Undo" title="Undo" disabled={!history.length} onClick={() => {
            setFuture(items => [value.content, ...items]); setValue({ ...value, content: history.at(-1)! }); setHistory(items => items.slice(0, -1)); setStatus('')
          }}><Undo2 size={16} /></button>
          <button type="button" className="icon-button" aria-label="Redo" title="Redo" disabled={!future.length} onClick={() => {
            setHistory(items => [...items, value.content]); setValue({ ...value, content: future[0] }); setFuture(items => items.slice(1)); setStatus('')
          }}><Redo2 size={16} /></button>
        </div>
        <label className="field">Document text<textarea className="resize-none" ref={editor} maxLength={20_000} value={value.content} onChange={event => change(event.target.value)} rows={14} /></label>
      </div>
      <section className="draft-paper" data-template={value.template} aria-label="Document preview">
        {!/^# /m.test(value.content) && <h2>{value.title || 'Untitled draft'}</h2>}
        {value.content ? <Markdown value={value.content} /> : <p>Your document preview will appear here.</p>}
      </section>
    </div>
  </div>
}

export function DraftLibrary() {
  const library = useLibrary<Draft>('draft')
  const [id, setId] = useState<string>(() => crypto.randomUUID())
  const selected = library.items.find(item => item.id === id)?.value
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(false)
  return <div className="learning-page">
    <header><p className="eyebrow">Documents</p><h1>Draft Library</h1><p>{library.demo ? 'Saved drafts stay in this browser. Use sample details in the demo.' : 'Saved drafts are private to your account.'}</p></header>
    <div className="panel learning-card">
      <div className="draft-toolbar">
        <label className="field">Open saved draft<select value={selected ? id : ''} disabled={library.loading || pending} onChange={event => { setId(event.target.value || crypto.randomUUID()); setStatus('') }}><option value="">New draft</option>{library.items.map(item => <option key={item.id} value={item.id}>{item.value.title}</option>)}</select></label>
        <button type="button" className="button button-secondary button-small" onClick={() => { setId(crypto.randomUUID()); setStatus('') }}>New draft</button>
        {selected && <button type="button" className="button button-ghost button-small" disabled={pending} onClick={async () => {
          setPending(true)
          try { await library.remove(id); setId(crypto.randomUUID()); setStatus('Draft deleted.') }
          catch (failure) { setStatus(failureMessage(failure)) } finally { setPending(false) }
        }}>Delete saved draft</button>}
      </div>
      {library.error && <p role="alert">{library.error} <button className="button button-ghost button-small" type="button" onClick={() => void library.refresh()}>Retry</button></p>}
      {status && <p role="status">{status}</p>}
      <DraftEditor key={id} draft={selected ?? { title: '', content: '', template: 'Classic Professional' }} onSave={value => library.save(id, value)} />
    </div>
  </div>
}
