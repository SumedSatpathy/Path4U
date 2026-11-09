import { useEffect, useState } from 'react'

export interface IntegrationStatus {
  gemini: boolean
  sheets: boolean
  gmail: boolean
  feed: boolean
}

const demo: IntegrationStatus = { gemini: false, sheets: false, gmail: false, feed: false }

export function useIntegrationStatus() {
  const [status, setStatus] = useState(demo)
  useEffect(() => {
    const controller = new AbortController()
    fetch('api/status', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(response => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
      .then((data: IntegrationStatus | null) => { if (data && !controller.signal.aborted) setStatus(data) })
      .catch(() => {})
    return () => controller.abort()
  }, [])
  return status
}

export async function apiPost<T>(resource: string, payload: object): Promise<T> {
  const response = await fetch('api/' + resource, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35_000),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The local integration server is unavailable.')
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The service couldn’t complete the request.')
  return data as T
}

export function failureMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')) return 'The service didn’t respond. Check the connection and try again.'
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}
