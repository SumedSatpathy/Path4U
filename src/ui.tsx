import { useEffect, useId, useRef, type FormEvent, type ReactNode, type RefObject } from 'react'
import { AlertCircle, Compass, Search, X } from 'lucide-react'
import { href } from './routes'

export function Logo({ compact }: { compact?: boolean }) {
  return <a className="brand" href={href('/')} aria-label="OpenPath AI home">
    <img src={import.meta.env.BASE_URL + 'mark.svg'} width="34" height="34" alt="" />
    {!compact && <span>OpenPath<span className="brand-ai"> AI</span></span>}
  </a>
}

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  onSubmit?: (value: string) => void
  className?: string
}

export function SearchBox({ value, onChange, placeholder = 'Search opportunities', label = placeholder, onSubmit, className }: SearchBoxProps) {
  const input = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!composing.current) onSubmit?.(value.trim())
  }
  return <form className={'search-box ' + (className ?? '')} role="search" noValidate onSubmit={submit} aria-label={label}>
    {onSubmit ? <button className="search-submit" aria-label="Submit search" type="submit"><Search size={17} /></button> : <Search size={17} aria-hidden="true" />}
    <input ref={input} type="search" aria-label={label} value={value} placeholder={placeholder}
      onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
      onChange={event => onChange(event.target.value)} />
    {value && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus() }}><X size={16} /></button>}
  </form>
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
