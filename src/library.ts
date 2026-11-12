import { useCallback, useEffect, useState } from 'react'
import { apiPost, failureMessage } from './api'
import type { LibraryEntry } from './documents'
import { useAccount } from './session'
import { useWorkspace } from './workspace'

export function useLibrary<T>(kind: 'draft' | 'conversation') {
  const { demo } = useWorkspace()
  const { demoOnly } = useAccount()
  const key = (demoOnly ? 'path4u.demo.session.library.' : 'path4u.library.') + kind
  const [items, setItems] = useState<LibraryEntry<T>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setError('')
    setLoading(true)
    try {
      if (demo) {
        const stored: unknown = JSON.parse((demoOnly ? sessionStorage : localStorage).getItem(key) ?? '[]')
        setItems(Array.isArray(stored) ? stored : [])
      } else {
        const response = await fetch('/api/library?kind=' + kind, { cache: 'no-store', signal })
        if (!response.ok) throw new Error('Your saved items could not be loaded.')
        const next = await response.json()
        if (!signal?.aborted) setItems(next)
      }
    } catch (failure) { if (!signal?.aborted) setError(failureMessage(failure)) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [demo, demoOnly, key, kind])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  async function save(id: string, value: T) {
    const entry = demo ? { id, value, updated_at: new Date().toISOString() }
      : await apiPost<LibraryEntry<T>>('library', { kind, id, value })
    if (demo) {
      const current = JSON.parse((demoOnly ? sessionStorage : localStorage).getItem(key) ?? '[]') as LibraryEntry<T>[]
      (demoOnly ? sessionStorage : localStorage).setItem(key, JSON.stringify([entry, ...current.filter(item => item.id !== id)].slice(0, 30)))
    }
    setItems(current => [entry, ...current.filter(item => item.id !== id)].slice(0, 30))
    return entry
  }

  async function remove(id: string) {
    if (demo) {
      const current = JSON.parse((demoOnly ? sessionStorage : localStorage).getItem(key) ?? '[]') as LibraryEntry<T>[]
      (demoOnly ? sessionStorage : localStorage).setItem(key, JSON.stringify(current.filter(item => item.id !== id)))
    } else await apiPost('library', { kind, id, remove: true })
    setItems(current => current.filter(item => item.id !== id))
  }

  return { items, loading, error, demo, refresh, save, remove }
}
