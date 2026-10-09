/**
 * 图页共享索引（client 半，P3.1）：轮询 host 半的只读页面服务 + 水位归属。
 * 归属口径（HB 教训，FR-4.1/AC-4）：页面到达时刻「当前聚焦的会话」收下它；
 * 没有聚焦会话 → 归收件箱（'' 哨兵）；首次使用（无存储）只记水位不归属，防旧池倾灌。
 * 存储键带 version（HB 坑：改结构必须 bump）。
 */
import { useSyncExternalStore } from 'react'

/** 端口候选，与 host 半 PAGE_PORTS 同序（实例并存时后启动的换口，这里探测发现）。 */
const PORT_CANDIDATES = [7917, 7918, 7919]
const POLL_MS = 4000
const STORE_KEY = 'dsh-newtype.pagepol.nt-v1'
const MAX_POLICY = 800

let resolvedBase: string | null = null
/** 已发现的页面服务基址（未发现返回 ''，组件拿到空串先渲染空态）。 */
export function pagesBase(): string {
  return resolvedBase ?? ''
}

async function resolveBase(): Promise<string | null> {
  if (resolvedBase) return resolvedBase
  for (const port of PORT_CANDIDATES) {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 800)
      const res = await fetch(`http://127.0.0.1:${port}/newtype/pages`, { signal: ctl.signal })
      clearTimeout(timer)
      if (res.ok) {
        resolvedBase = `http://127.0.0.1:${port}`
        return resolvedBase
      }
    } catch { /* 该口没服务：下一个 */ }
  }
  return null
}

export interface PageEntry {
  id: string
  name: string
  mtime: number
  bytes: number
}

interface Policy {
  seen: Record<string, number>
  attrib: Record<string, string>
}

interface Snap {
  list: PageEntry[]
  attrib: Record<string, string>
  /** fresh 版本号：markSeen 时自增，驱动下游 useMemo 重算 */
  fv: number
}

/** 空会话哨兵：attrib 值为 '' = 收件箱（到达时无聚焦会话）。 */
export const PAGE_INBOX = ''

function loadPolicy(): Policy {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Policy
  } catch { /* 坏档重开 */ }
  return { seen: {}, attrib: {} }
}

let snap: Snap = { list: [], attrib: {}, fv: 0 }
let policy = loadPolicy()
let lastActive: string | null = null
let firstSync = Object.keys(policy.seen).length === 0
/** 新到未过目（内存态：重启清零，避免旧账唠叨）。AC-3 徽标的数据源。 */
const fresh = new Set<string>()
const subs = new Set<() => void>()

function emit(next: Snap): void {
  snap = next
  for (const f of subs) f()
}

function savePolicy(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(policy)) } catch { /* 配额满可弃 */ }
}

function prunePolicy(): void {
  for (const key of ['seen', 'attrib'] as const) {
    const keys = Object.keys(policy[key])
    if (keys.length <= MAX_POLICY) continue
    keys.sort((a, b) => (policy.seen[a] ?? 0) - (policy.seen[b] ?? 0))
    for (const k of keys.slice(0, keys.length - MAX_POLICY)) delete policy[key][k]
  }
}

let pending = false
async function poll(): Promise<void> {
  if (pending) return
  pending = true
  try {
    const b = await resolveBase()
    if (!b) return
    const res = await fetch(`${b}/newtype/pages`)
    if (!res.ok) return
    const list = (await res.json()) as PageEntry[]
    const arrived: PageEntry[] = []
    let policyDirty = false
    for (const p of list) {
      if (!(p.id in policy.seen)) {
        policy.seen[p.id] = p.mtime
        policyDirty = true
        // 首次同步只记水位：不把整个旧池归给当前会话
        if (!firstSync) {
          policy.attrib[p.id] = lastActive ?? PAGE_INBOX
          arrived.push(p)
        }
      }
    }
    if (firstSync && list.length) { firstSync = false; policyDirty = true }
    if (arrived.length) { for (const p of arrived) fresh.add(p.id) }
    if (policyDirty) { prunePolicy(); savePolicy() }
    if (arrived.length || list.length !== snap.list.length ||
        (list[0]?.mtime ?? 0) !== (snap.list[0]?.mtime ?? 0) ||
        (list[0]?.id ?? '') !== (snap.list[0]?.id ?? '')) {
      emit({ list, attrib: { ...policy.attrib }, fv: snap.fv + (arrived.length ? 1 : 0) })
    }
  } catch { /* host 半降级中：静默重试 */ }
  finally { pending = false }
}

let started = false
/** 侧栏挂载时调用一次：起轮询。 */
export function startPages(): void {
  if (started) return
  started = true
  void poll()
  setInterval(() => { void poll() }, POLL_MS)
}

/** 侧栏每次渲染同步当前聚焦会话 → 新页归属用。 */
export function noteActiveSession(sessionId: string | null): void {
  lastActive = sessionId
}

/**
 * 「主视图当前会话」判定：会话列表里 retainedBy 含 mainView 的那一行。
 * root scope 拿不到 sessionId（NOTES 1.1b），只能走这个口径。
 * D14 后由 WorkbenchView 与 PagesPanel 共同调用，保证切面板时归属也跟着更新。
 */
export function retainedByMainView(
  ids: readonly string[] | undefined,
  byId: Record<string, { retainedBy?: Record<string, unknown> | string[] }> | undefined,
): string | null {
  for (const id of ids ?? []) {
    const r = byId?.[id]?.retainedBy
    const hit = Array.isArray(r) ? r.includes('mainView') : r ? Object.prototype.hasOwnProperty.call(r, 'mainView') : false
    if (hit) return id
  }
  return null
}

/** 页面 → 会话（'' = 收件箱）。 */
export function attributedTo(pageId: string): string {
  return policy.attrib[pageId] ?? PAGE_INBOX
}

/** 该页是否新到未过目（AC-3 徽标）。 */
export function isFresh(pageId: string): boolean {
  return fresh.has(pageId)
}

/** 过目清零：单页或一组。 */
export function markSeen(pageIds: readonly string[]): void {
  let changed = false
  for (const id of pageIds) { if (fresh.delete(id)) changed = true }
  if (changed) emit({ list: snap.list, attrib: snap.attrib, fv: snap.fv + 1 })
}

export function titleOf(pageId: string): string {
  return snap.list.find((p) => p.id === pageId)?.name ?? pageId
}

const subNoop = () => () => {}
export function usePages(): Snap {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb) } },
    () => snap,
    () => snap,
  )
}

export { subNoop }
