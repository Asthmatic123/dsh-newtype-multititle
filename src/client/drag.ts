/**
 * 跨树拖拽状态单例：sidebar（tab 源）与工作台 view（落点）是两棵 React 树，
 * HTML5 dataTransfer 在 dragover 里读不到数据（protected mode），
 * 用模块级单例 + 订阅通知（useSyncExternalStore 直连）。
 */

export interface TabDrag {
  /** 拖的 tab（= sessionId） */
  id: string
  /** 来源窗格下标；null = 来自左栏 tab 栏 */
  from: number | null
}

type Listener = () => void

let current: TabDrag | null = null
const subs = new Set<Listener>()

export const tabDrag = {
  get(): TabDrag | null {
    return current
  },
  set(v: TabDrag | null): void {
    current = v
    for (const f of subs) f()
  },
  sub(f: Listener): () => void {
    subs.add(f)
    return () => { subs.delete(f) }
  },
}
