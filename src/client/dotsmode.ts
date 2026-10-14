/**
 * dots 模式（方案 A，2026-10-13 主人拍板）：2dlist 交互模式改造——
 * 弃 2dlist 的 sidebar.workspaces 影子替换，改「折叠宿主原版侧栏 + 工作台专用靠左窗格」。
 *
 * 状态自持在本模块。DotsBtn（index.tsx）点 toggleDotsMode()：
 *  ON  = WorkbenchView 注册的 impl 快照 trellis 树 → 开靠左 dots 窗格；
 *        同时折叠宿主侧栏（ctx.layout.toggleSidebar，host.d.ts:155；真实现
 *        ui-layout lib/client.js:478-479 `this.panels.toggleSidebar()`）。
 *        折叠态探测走 DOM：宿主 frame 挂 `data-sidebar-collapsed` 属性
 *        （ui-layout lib/client.js，`"data-sidebar-collapsed": sidebarCollapsed || void 0`）。
 *        仅当「原本没折叠」才记 weCollapsed——关闭时只恢复自己折的。
 *  OFF = setDocument 还原快照 + 恢复侧栏。
 * impl 缺席（工作台未挂载）→ 返回 false，调用方落旧兜底（emit('dots')+selectPanel）。
 */

type Listener = () => void

/** ON/OFF 的执行端（WorkbenchView 挂载时注册；返回 false = trellis 侧不接受）。 */
export type DotsModeImpl = (on: boolean) => boolean

/** 宿主侧栏折叠钩子（index.tsx apply 时用 ctx.layout 注册）。 */
export interface DotsModeSidebar {
  isCollapsed(): boolean
  collapse(): boolean
  restore(): boolean
}

let dotsMode = false
let weCollapsed = false
let impl: DotsModeImpl | null = null
let sidebar: DotsModeSidebar | null = null
const subs = new Set<Listener>()

function notify(): void {
  for (const f of [...subs]) { try { f() } catch { /* 单个订阅者异常不影响其余 */ } }
}

export function isDotsMode(): boolean {
  return dotsMode
}
export function subscribeDotsMode(cb: Listener): () => void {
  subs.add(cb)
  return () => { subs.delete(cb) }
}
/** WorkbenchView 挂载时注册执行端；卸载时传 null。 */
export function setDotsModeImpl(f: DotsModeImpl | null): void {
  impl = f
}
/** index.tsx apply 时注册侧栏钩子（ctx.layout 缺席则不注册，折叠静默跳过）。 */
export function setDotsModeSidebar(h: DotsModeSidebar | null): void {
  sidebar = h
}

/** 双向切换。返回「是否已处理」；false 仅 = 工作台未挂载（调用方落旧兜底）。 */
export function toggleDotsMode(): boolean {
  if (!impl) return false
  const on = !dotsMode
  if (on) {
    let ok = false
    try { ok = impl(true) } catch { ok = false }
    if (!ok) return false // trellis 侧不接受：不切换、不动侧栏
    if (sidebar && !sidebar.isCollapsed()) {
      let done = false
      try { done = sidebar.collapse() } catch { done = false }
      weCollapsed = done
    }
    dotsMode = true
  } else {
    try { impl(false) } catch { /* 还原异常：照常清态 */ }
    /* NT1011F 复核茬2：恢复前重探测——用户 ON 期间手动展开过侧栏，就不再折回去 */
    if (weCollapsed) {
      let stillCollapsed = true
      try { stillCollapsed = sidebar?.isCollapsed() ?? true } catch { stillCollapsed = true }
      if (stillCollapsed) { try { sidebar?.restore() } catch { /* 恢复失败不阻塞 */ } }
    }
    weCollapsed = false
    dotsMode = false
  }
  notify()
  return true
}

/** ON 失败回退（WorkbenchView 的 ws 就绪轮询超时 / 快照失败时调）：
 *  模式翻回 OFF 并还原我们折的侧栏；trellis 树无需还原（快照前没动它）。 */
export function dotsModeAbort(): void {
  if (!dotsMode) return
  if (weCollapsed) { try { sidebar?.restore() } catch { /* 恢复失败不阻塞 */ } }
  weCollapsed = false
  dotsMode = false
  notify()
}
