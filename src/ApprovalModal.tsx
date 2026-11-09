import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarClock, Check, FileDiff, ListTodo } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { formatDate, opportunities, type CalendarResolution, type DeadlineChange } from './data'
import { Dialog } from './ui'
import './approval.css'

interface ApprovalModalProps {
  open: boolean
  change: DeadlineChange
  resolution: CalendarResolution | null
  onClose: () => void
  onConfirm: () => boolean
}

export function ApprovalModal({ open, change, resolution, onClose, onConfirm }: ApprovalModalProps) {
  const [failed, setFailed] = useState(false)
  const focus = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()
  const result = resolution?.changeId === change.id ? resolution : null
  const opportunity = opportunities.find(item => item.id === change.opportunityId)

  useEffect(() => {
    if (open && result) focus.current?.focus()
  }, [open, result])

  function close() {
    setFailed(false)
    onClose()
  }

  return <Dialog open={open} onClose={close} title="Deadline change" className="approval-dialog"
    description={opportunity ? `${opportunity.title} · ${opportunity.organization}` : change.sourceName} initialFocusRef={focus}>
    <div className="approval-body">
      <div className="approval-dates" aria-label="Previous and new deadlines">
        <div className="approval-date approval-date-old"><span>Previous deadline</span><time dateTime={change.oldDate}>{formatDate(change.oldDate, 'long')}</time></div>
        <ArrowRight className="approval-date-arrow" size={17} aria-hidden="true" />
        <div className="approval-date approval-date-new"><span>New deadline</span><time dateTime={change.newDate}>{formatDate(change.newDate, 'long')}</time></div>
      </div>

      <section className="approval-source" aria-label="Source change">
        <div className="approval-source-title"><FileDiff size={16} aria-hidden="true" /><strong>Source excerpt</strong><span>Fictional source</span></div>
        <p>{change.sourceName}</p>
        <div className="approval-diff">
          <div className="approval-removed"><span className="approval-diff-label">Before</span><del>{change.before}</del></div>
          <div className="approval-added"><span className="approval-diff-label">After</span><ins>{change.after}</ins></div>
        </div>
      </section>

      <div className="approval-context">
        <ListTodo size={19} aria-hidden="true" />
        <div><strong>Affected task</strong><p>{change.task}</p></div>
      </div>

      {result ? <motion.div className="approval-context approval-result" role="status"
        initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        <Check size={19} aria-hidden="true" />
        <div><strong>Simulated Calendar update recorded</strong><p>Demo reminder set for <time dateTime={result.date}>{formatDate(result.date, 'long')}</time>.</p></div>
      </motion.div> : <div className="approval-context approval-proposal">
        <CalendarClock size={19} aria-hidden="true" />
        <div><strong>Suggested Calendar update <span className="approval-simulation">Simulation</span></strong>
          <p>Move the demo application reminder to <time dateTime={change.newDate}>{formatDate(change.newDate, 'long')}</time>.</p>
        </div>
      </div>}
      {failed && !result && <p className="approval-error" role="alert">The simulated update could not be saved. Try confirming again.</p>}
    </div>

    <div className="approval-actions">
      {result ? <button type="button" className="button button-primary" ref={focus} onClick={close}>Close</button> : <>
        <button type="button" className="button button-secondary" ref={focus} onClick={close}>Cancel</button>
        <button type="button" className="button button-primary" onClick={() => setFailed(!onConfirm())}>Confirm update</button>
      </>}
    </div>
  </Dialog>
}
