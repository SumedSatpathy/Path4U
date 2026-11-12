export const templates = ['Classic Professional', 'Modern Technical', 'Student & Graduate'] as const
export type Template = typeof templates[number]
export type Draft = { title: string; content: string; template: Template }
export type ConversationTurn = { id: string; question: string; answer: string; at: string; proposal?: string; attachment?: string }
export type Conversation = { title: string; turns: ConversationTurn[] }
export type LibraryEntry<T> = { id: string; value: T; updated_at: string }
export type DocumentFormat = 'pdf' | 'docx'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function mailtoLink(recipient: string, subject: string, body: string) {
  const address = recipient.trim()
  if (address && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(address)) throw new Error('Enter a valid recipient email address or leave it blank.')
  if (!subject.trim() || !body.trim()) throw new Error('Enter a subject and a message before opening your email app.')
  return 'mailto:' + encodeURIComponent(address).replace('%40', '@') + '?subject=' + encodeURIComponent(subject.trim().replace(/[\r\n]+/g, ' ')) + '&body=' + encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))
}
