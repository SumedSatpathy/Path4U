import { useSyncExternalStore } from 'react'

export function href(path: string, params?: URLSearchParams) {
  const query = params?.toString()
  return '#' + path + (query ? '?' + query : '')
}

export function navigate(path: string, params?: URLSearchParams, options?: { replace?: boolean }) {
  const url = href(path, params)
  if (window.location.hash === url) return
  if (options?.replace) {
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new Event('hashchange'))
  } else {
    window.location.hash = url
  }
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

function getHash() {
  return window.location.hash.startsWith('#/') ? window.location.hash : '#/'
}

export function useRoute() {
  const location = useSyncExternalStore(subscribe, getHash)
  const [path, query] = location.slice(1).split('?')
  return { path, params: new URLSearchParams(query) }
}
