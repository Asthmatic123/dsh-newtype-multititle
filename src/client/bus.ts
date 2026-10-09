/**
 * 打开请求总线：图页面板（或任何地方）请求工作台开一个 tab。
 *
 * D14 改：请求不再「未挂载即丢」。D14 后图页列表住进了 main key 'newtype-pages'
 * 面板 —— 点图页时工作台面板（另一个 main key）**一定没挂载**，旧实现会静默丢事件，
 * 表现为「点了没反应」。现在记住最后一次请求，新订阅者立刻补消费一次。
 */

type Listener = (tabId: string) => void

const subs = new Set<Listener>()
let pending: string | null = null

export const openTabBus = {
  emit(tabId: string): void {
    if (subs.size === 0) { pending = tabId; return }
    for (const f of subs) f(tabId)
  },
  sub(f: Listener): () => void {
    subs.add(f)
    if (pending !== null) { const t = pending; pending = null; f(t) }
    return () => { subs.delete(f) }
  },
}

/* E33b：startSession 劫持用——工作台可能正被宿主卸载/重挂（replaceMain 切面板），
   总线时序不可靠。index 写入待开会话，WorkbenchView 挂载后自行取用（一次性）。 */
let pendingSessionId: string | null = null
export function setPendingSession(id: string): void { pendingSessionId = id }
export function takePendingSession(): string | null { const v = pendingSessionId; pendingSessionId = null; return v }

/** 右栏产出物栏开合状态（工作台内侧栏，trellis Preview 式）：useSyncExternalStore 直连。 */
let artOpen = false
const artSubs = new Set<() => void>()
export const artRail = {
  get(): boolean {
    return artOpen
  },
  set(v: boolean): void {
    if (artOpen === v) return
    artOpen = v
    for (const f of artSubs) f()
  },
  toggle(): void {
    artOpen = !artOpen
    for (const f of artSubs) f()
  },
  sub(f: () => void): () => void {
    artSubs.add(f)
    return () => { artSubs.delete(f) }
  },
}

/** 「打开产出物」请求（侧栏小按钮 → index.tsx：切到工作台 + 展开右栏）。 */
const panelSubs = new Set<() => void>()
export const artifactPanelBus = {
  emit(): void {
    for (const f of panelSubs) f()
  },
  sub(f: () => void): () => void {
    panelSubs.add(f)
    return () => { panelSubs.delete(f) }
  },
}
