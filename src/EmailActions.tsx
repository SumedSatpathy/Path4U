import { useState } from 'react'
import { Download, Mail } from 'lucide-react'
import { failureMessage } from './api'
import { downloadBlob, mailtoLink } from './documents'

export const emailTypes = ['Professional email', 'Internship application', 'Job application', 'Workshop inquiry', 'Follow-up', 'Networking request', 'Scholarship inquiry', 'Custom email'] as const
export const emailTones = ['Professional', 'Friendly', 'Formal', 'Concise'] as const

const purpose = [
  'I am writing about [topic]. [Add the question or request you would like to make.]',
  'I would like to apply for the [internship title] internship. [Briefly connect one relevant project or skill to the role.]',
  'I am interested in the [role title] position. [Include a relevant accomplishment you can verify.]',
  'I would like to ask about registration for [workshop name]. Could you confirm [your question]?',
  'I am following up on [application or conversation] from [date]. [Add the specific update or question.]',
  'I am exploring [field] and would value your perspective on [topic]. Would you be open to a brief conversation?',
  'I would like to learn more about the [scholarship name] application. Could you clarify [eligibility, deadline, or another question]?',
  '[Add the reason you are writing and what you would like the recipient to do.]',
]
export function emailTemplate(type: typeof emailTypes[number], tone: typeof emailTones[number], name: string) {
  const subject = type === 'Custom email' || type === 'Professional email' ? '[Subject]' : type + ' — [topic]'
  const text = purpose[emailTypes.indexOf(type)]
  const greeting = tone === 'Formal' ? 'Dear [Recipient],' : tone === 'Friendly' ? 'Hi [Recipient],' : 'Hello [Recipient],'
  const closing = tone === 'Formal' ? 'Sincerely,' : tone === 'Friendly' ? 'Thanks so much,' : 'Best regards,'
  return { subject, body: (tone === 'Concise' ? text : greeting + '\n\n' + text + '\n\nThank you for your time.') + '\n\n' + closing + '\n' + (name || '[Your name]') }
}

export function EmailActions({ recipient, subject, body }: { recipient: string; subject: string; body: string }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const draft = 'Subject: ' + subject + '\r\n\r\n' + body
  function open() {
    setError(''); setStatus('')
    try {
      const link = mailtoLink(recipient, subject, body)
      if (link.length > 1800) { setError('This draft may be too long for an email link. Use Copy Email to paste it into your email app.'); return }
      window.location.href = link
    } catch (failure) { setError(failureMessage(failure)) }
  }

  return <div className="email-actions">
    <div className="draft-toolbar">
      <button type="button" className="button button-secondary button-small" disabled={!subject.trim() || !body.trim()} onClick={open}><Mail size={15} /> Open in Email App</button>
      <button type="button" className="button button-ghost button-small" disabled={!body.trim()} onClick={async () => {
        setError(''); setStatus('')
        try { await navigator.clipboard.writeText(draft); setStatus('Email copied.') } catch (failure) { setError(failureMessage(failure)) }
      }}>Copy Email</button>
      <button type="button" className="button button-ghost button-small" disabled={!body.trim()} onClick={() => downloadBlob(new Blob([draft], { type: 'text/plain;charset=utf-8' }), 'Path4U_Email_Draft.txt')}><Download size={15} /> Download Draft</button>
    </div>
    <p className="field-help">Your email app opens an unsent draft for you to review.</p>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
  </div>
}
