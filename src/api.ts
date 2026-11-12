import { useEffect, useState } from 'react'

export interface IntegrationStatus {
  ready?: boolean
  temporaryStorageExpires?: string
  privateAI?: boolean
  gemini: boolean
  image: boolean
  sheets: boolean
  gmail: boolean
  feed: boolean
}

const demo: IntegrationStatus = { gemini: false, image: false, sheets: false, gmail: false, feed: false }

export function useIntegrationStatus() {
  const [status, setStatus] = useState(demo)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(response => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
      .then((data: IntegrationStatus | null) => { if (!controller.signal.aborted) setStatus({...demo,...(data ?? {}),ready:true}) })
      .catch(() => {if(!controller.signal.aborted)setStatus(current=>({...current,ready:true}))})
    return () => controller.abort()
  }, [])
  return status
}

export async function apiPost<T>(resource: string, payload: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/' + resource, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The server returned an unreadable response. Try again.')
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(typeof data.error === 'string' ? data.error : 'The service couldn’t complete the request.'),{status:response.status,code:typeof data.code === 'string' ? data.code : undefined,resetAt:typeof data.resetAt==='string' ? data.resetAt : undefined,retryAfter:Number.isSafeInteger(data.retryAfter) ? data.retryAfter : undefined})
  return data as T
}

export function failureMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) return 'The service didn’t respond. Check the connection and try again.'
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

export function requireAnswer<T extends { answer: string }>(value: unknown): T {
  if (!value || typeof value !== 'object' || !('answer' in value) || typeof value.answer !== 'string' || !value.answer.trim()) throw new Error('No answer was returned. Your question is still here. Try again.');
  return value as T
}
