import { useEffect, useRef, useSyncExternalStore } from 'react'

export const authRoutes = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/onboarding'])
export function href(path: string, params?: URLSearchParams) {
  const query = params?.toString()
  return (authRoutes.has(path) || path === '/' || path === '/dashboard' ? path : '/#' + path) + (query ? '?' + query : '')
}

// Only entries created in this app's same-origin navigation chain are safe to go back to.
// History state contains a depth, never form values, credentials or callback tokens.
const marker = 'path4u.navigation.v1'
type Entry = { depth: number; origin: string }
const address = () => window.location.pathname + window.location.search + window.location.hash
function readEntry(): Entry | null {
  const entry = window.history.state?.[marker]
  return entry?.origin === window.location.origin && Number.isSafeInteger(entry.depth) && entry.depth >= 0 && entry.depth < window.history.length ? entry : null
}
function stamp(depth: number) {
  window.history.replaceState({ ...window.history.state, [marker]: { depth, origin: window.location.origin } }, '')
}
function routeAt(url: URL) {
  if (authRoutes.has(url.pathname) || url.pathname === '/dashboard') return url.pathname + url.search
  return url.hash.startsWith('#/') ? url.hash.slice(1) : '/' + url.search
}
function screenIdentity(route: string) {
  const [path, query = ''] = route.split('?')
  return path === '/roadmap' || path === '/flowchart' ? path + '?plan=' + (new URLSearchParams(query).get('plan') ?? '') : path
}
function isAppURL(url: URL) {
  return url.origin === window.location.origin && (url.pathname === '/' || url.pathname === '/dashboard' || authRoutes.has(url.pathname))
}
let currentAddress = address()
let currentDepth = readEntry()?.depth ?? 0
let locationSnapshot = routeAt(new URL(window.location.href))
stamp(currentDepth)
const listeners = new Set<() => void>()
const guards = new Set<symbol>()
let pending: (() => void) | null = null
const guardListeners = new Set<() => void>()
function emitGuard() { for (const listener of guardListeners) listener() }
function commitLocation() {
  currentAddress = address()
  locationSnapshot = routeAt(new URL(window.location.href))
  currentDepth = readEntry()?.depth ?? 0
  stamp(currentDepth)
  for (const listener of listeners) listener()
}
function requestNavigation(action: () => void) {
  if (guards.size) { if (!pending) { pending = action; emitGuard() }; return }
  action()
}
export function cancelNavigation() { pending = null; emitGuard() }
export function confirmNavigation() {
  const action = pending
  pending = null
  emitGuard()
  action?.()
}
export function usePendingNavigation() {
  return useSyncExternalStore(listener => { guardListeners.add(listener); return () => { guardListeners.delete(listener) } }, () => Boolean(pending))
}
export function useUnsavedChanges(dirty: boolean) {
  const id = useRef(Symbol('unsaved'))
  useEffect(() => {
    const key = id.current
    if (dirty) guards.add(key)
    return () => { guards.delete(key) }
  }, [dirty])
  return () => { guards.delete(id.current) }
}

function visit(url: URL, replace = false) {
  if (!isAppURL(url)) return
  const target = url.pathname + url.search + url.hash
  if (target === currentAddress) return
  const action = () => {
    const depth = replace ? currentDepth : currentDepth + 1
    const state = { ...window.history.state, [marker]: { depth, origin: window.location.origin } }
    window.history[replace ? 'replaceState' : 'pushState'](state, '', target)
    commitLocation()
    window.dispatchEvent(new Event('hashchange'))
  }
  // Filter changes keep the screen mounted; selecting another saved plan can discard edits.
  // Replacement redirects are system transitions.
  if (!replace && screenIdentity(routeAt(url)) !== screenIdentity(locationSnapshot)) requestNavigation(action)
  else action()
}
export function navigate(path: string, params?: URLSearchParams, options?: { replace?: boolean }) {
  visit(new URL(href(path, params), window.location.origin), options?.replace)
}
let permitPop = false
export function goBack() {
  if (!currentDepth && locationSnapshot.split('?')[0] === '/dashboard') return
  requestNavigation(() => {
    if (readEntry() && currentDepth > 0) { permitPop = true; window.history.back() }
    else navigate('/dashboard', undefined, { replace: true })
  })
}
let restoring: { depth: number; resume: () => void } | null = null
function browserNavigation(event: Event) {
  if (restoring) {
    event.stopImmediatePropagation()
    if (readEntry()?.depth === restoring.depth) {
      const resume = restoring.resume
      restoring = null
      requestNavigation(resume)
    }
    return
  }
  if (address() === currentAddress) return
  const entry = readEntry()
  const changedPage = screenIdentity(routeAt(new URL(window.location.href))) !== screenIdentity(locationSnapshot)
  if (!permitPop && guards.size && changedPage && entry && entry.depth !== currentDepth) {
    const delta = entry.depth - currentDepth
    restoring = { depth: currentDepth, resume: () => { permitPop = true; window.history.go(delta) } }
    event.stopImmediatePropagation()
    window.history.go(-delta)
    return
  }
  permitPop = false
  // A manually typed route hash is also an internal entry; popstate is processed first on Back/Forward.
  if (event instanceof HashChangeEvent && changedPage && entry?.depth === currentDepth) stamp(currentDepth + 1)
  commitLocation()
}
window.addEventListener('popstate', browserNavigation)
window.addEventListener('hashchange', browserNavigation)
window.addEventListener('beforeunload', event => { if (guards.size) { event.preventDefault(); event.returnValue = '' } })
// Keep ordinary same-origin app links in the custom router. Downloads, section anchors,
// modified clicks, external links and explicit new tabs retain native browser behavior.
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
  const raw = anchor.getAttribute('href') || ''
  if (raw.startsWith('#') && !raw.startsWith('#/')) return
  const url = new URL(anchor.href)
  if (!isAppURL(url)) return
  event.preventDefault()
  visit(url)
})
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useRoute() {
  const location = useSyncExternalStore(subscribe, () => locationSnapshot)
  const separator = location.indexOf('?')
  return { path: separator < 0 ? location : location.slice(0, separator), params: new URLSearchParams(separator < 0 ? '' : location.slice(separator + 1)) }
}
