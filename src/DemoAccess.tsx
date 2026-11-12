import { LockKeyhole } from 'lucide-react'

export function DisabledAccountActions({ compact = false }: { compact?: boolean }) {
  return <div className={'demo-account-actions' + (compact ? ' demo-account-actions-compact' : '')}>
    {['Sign In', 'Create Account'].map(label => <button key={label} type="button" className="button button-secondary" disabled aria-label={label + ' — Coming Soon'} title="Account registration and sign-in are not available in this demo version.">
      <LockKeyhole size={15} aria-hidden="true" /><span>{label}</span><small>Coming Soon</small>
    </button>)}
  </div>
}
