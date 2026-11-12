import { useEffect, useId, useRef, type FormEvent, type ReactNode, type RefObject } from 'react'
import { AlertCircle, Compass, Search, X } from 'lucide-react'
import { href } from './routes'
import { useAccount } from './session'

export function Logo({ compact }: { compact?: boolean }) {
  const { session } = useAccount()
  return <a className="brand" href={href(session?.user ? '/dashboard' : '/')} aria-label="Path4U home">
    <img className="brand-mark brand-mark-dark" src="/mark.svg" width="40" height="40" alt="" />
    <img className="brand-mark brand-mark-light" src="/mark-inverse.svg" width="40" height="40" alt="" />
    {!compact && <span className="brand-wordmark">Path4U</span>}
  </a>
}

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  onSubmit?: (value: string) => void
  className?: string
  embedded?: boolean
}

export function SearchBox({ value, onChange, placeholder = 'Search opportunities', label = placeholder, onSubmit, className, embedded = false }: SearchBoxProps) {
  const input = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!composing.current) onSubmit?.(value.trim())
  }
  const control = <>
    {onSubmit ? <button className="search-submit" aria-label="Submit search" type="submit"><Search size={17} /></button> : <Search size={17} aria-hidden="true" />}
    <input ref={input} type="search" aria-label={label} value={value} placeholder={placeholder}
      onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
      onKeyDown={event => { if (embedded && event.key === 'Enter') event.preventDefault() }} onChange={event => onChange(event.target.value)} />
    {value && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus() }}><X size={16} /></button>}
  </>
  const classes = 'search-box ' + (className ?? '')
  return embedded ? <div className={classes}>{control}</div> : <form className={classes} role="search" noValidate onSubmit={submit} aria-label={label}>{control}</form>
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function Dialog({ open, onClose, title, description, children, className, initialFocusRef }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return
    const opener = document.activeElement
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(initialFocusRef?.current ?? closeRef.current)?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previous
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [open, initialFocusRef])

  return <dialog ref={ref} className={'app-dialog ' + (className ?? '')} aria-labelledby={id}
    aria-describedby={description ? id + '-description' : undefined} onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }}>
    {open && <>
      <div className="dialog-heading">
        <div><h2 id={id}>{title}</h2>{description && <p id={id + '-description'}>{description}</p>}</div>
        <button ref={closeRef} type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
      </div>
      {children}
    </>}
  </dialog>
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <Compass size={22} />}</div><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function ErrorState({ title = 'This view couldn’t load', description = 'Try loading the page again.', onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <EmptyState icon={<AlertCircle size={22} />} title={title} description={description} action={onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>} />
}

export function LoadingSkeleton() {
  return <div className="loading-skeleton" role="status" aria-label="Loading workspace">
    <div /><div /><section><div /><div /><div /></section>
  </div>
}
