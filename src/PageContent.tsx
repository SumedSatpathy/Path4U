import { useRef, type ReactNode } from 'react'
import { BackButton } from './BackButton'
import { cancelNavigation, confirmNavigation, usePendingNavigation } from './routes'
import { Dialog } from './ui'

export function PageContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'page-content ' + className}><div className="page-back-row"><BackButton /></div>{children}</div>
}

export function NavigationConfirmation() {
  const open = usePendingNavigation()
  const stay = useRef<HTMLButtonElement>(null)
  return <Dialog open={open} title="Leave this page?" description="You have unsaved work. Stay to keep editing, or leave without saving those changes." onClose={cancelNavigation} initialFocusRef={stay}>
    <div className="choice-row"><button ref={stay} type="button" className="button button-primary" onClick={cancelNavigation}>Stay on page</button><button type="button" className="button button-secondary" onClick={confirmNavigation}>Leave without saving</button></div>
  </Dialog>
}
