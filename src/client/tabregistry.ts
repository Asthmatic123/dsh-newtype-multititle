/**
 * multititle 的 tab 宿主扩展点（2026-10-13，huabu 点图拆分为独立插件 dsh-newtype-2dlist）：
 * 挂 window.__ntMultititle，外部 client 插件（同 webview，window 全局互通已实证）
 * 经它把「工作台 tab」注册进本插件的工作台。当前唯一消费方：2dlist 的 'dots' tab。
 *
 * API：
 *  - registerTab({ id, title, render }) → boolean   注册/覆盖一个 tab 声明
 *  - openTab(id) → boolean                          请求打开（未注册=false，静默）
 *  - hasTab(id) → boolean
 *  - onRegistryChange(cb) → () => void              注册表变更订阅（按钮响应式隐藏/出现）
 */

export interface NtExtTab {
  id: string
  title: string
  render: unknown // 跨插件边界不带 React 类型（对侧 bundle 自带组件），渲染侧窄 cast
}

type Listener = () => void
type Opener = (id: string) => void

const tabs = new Map<string, NtExtTab>()
const subs = new Set<Listener>()
const openers = new Map<string, Opener>()

function notify(): void {
  for (const f of [...subs]) { try { f() } catch { /* 单个订阅者异常不影响其余 */ } }
}

export const tabHost = {
  registerTab(tab: NtExtTab): boolean {
    if (!tab || typeof tab.id !== 'string' || !tab.render) return false
    tabs.set(tab.id, tab)
    notify()
    return true
  },
  openTab(id: string): boolean {
    if (!tabs.has(id)) return false // 注册表为空/无此 tab：静默
    const open = openers.get(id)
    if (!open) return false
    try { open(id); return true } catch { return false }
  },
  hasTab(id: string): boolean {
    return tabs.has(id)
  },
  onRegistryChange(cb: Listener): () => void {
    subs.add(cb)
    return () => { subs.delete(cb) }
  },
}

/** WorkbenchView 就绪后登记某 tab 的打开器（openTab 的执行端）。 */
export function setTabOpener(id: string, open: Opener): void {
  openers.set(id, open)
}

/** React useSyncExternalStore 直连：注册表快照（Map 引用稳定，getSnapshot 幂等）。 */
export function getTab(id: string): NtExtTab | undefined {
  return tabs.get(id)
}
export function subscribeTabs(cb: Listener): () => void {
  return tabHost.onRegistryChange(cb)
}

/** apply 时把扩展点挂上 window（重复 apply 覆盖同引用，幂等）。 */
export function installTabHost(): void {
  ;(window as unknown as Record<string, unknown>).__ntMultititle = tabHost
}
