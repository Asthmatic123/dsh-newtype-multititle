/**
 * NewType 布局层 · split 树状态（FR-2 自由分栏模型）
 * 纯逻辑零依赖：可独立测试（NFR-2）。宿主接线在 Workspace.tsx。
 *
 * 模型（demo v3.2 1:1）：
 *   tree: 二叉树。leaf 引用 panes 下标；split 带 dir(row|col) 与 s(0~1 占比)。
 *   panes: 窗格数组，每窗格 { tabs: tabId[], active }。
 *   分裂=拖 tab 到窗格边缘；并入=拖到中心；空叶回收。
 */

export type Dir = 'row' | 'col'

export type SplitNode =
  | { t: 'leaf'; p: number }
  | { t: 'split'; dir: Dir; s: number; a: SplitNode; b: SplitNode }

export interface PaneState {
  tabs: string[]
  active: string | null
}

export interface LayoutState {
  tree: SplitNode
  panes: PaneState[]
  focused: number
}

/** 存储纪律：改初始结构必须 bump version（HB 教训，05 §E7）。 */
export const LAYOUT_VERSION = 'nt-v1'
const KEY = `dsh-newtype.layout.${LAYOUT_VERSION}`

export function defaultLayout(tabId: string | null = null): LayoutState {
  return {
    tree: { t: 'leaf', p: 0 },
    panes: [{ tabs: tabId ? [tabId] : [], active: tabId }],
    focused: 0,
  }
}

export function loadLayout(fallback: LayoutState): LayoutState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const st = JSON.parse(raw) as LayoutState
    if (st?.tree?.t !== 'leaf' && st?.tree?.t !== 'split') return fallback
    if (!Array.isArray(st.panes) || !st.panes.length) return fallback
    return st
  } catch {
    return fallback
  }
}

export function saveLayout(st: LayoutState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)) } catch { /* 配额满：布局丢失可接受 */ }
}

/* ============ 不可变操作（返回新 state；同引用 = 无变化） ============ */

export function countLeaves(n: SplitNode): number {
  return n.t === 'leaf' ? 1 : countLeaves(n.a) + countLeaves(n.b)
}

/** 树上最左上的叶 = 主窗格（ro 兜底模式豁免位）。 */
export function primaryPane(n: SplitNode): number {
  let c = n
  while (c.t === 'split') c = c.a
  return c.p
}

function mapLeafP(n: SplitNode, fn: (p: number) => number): SplitNode {
  if (n.t === 'leaf') return { ...n, p: fn(n.p) }
  return { ...n, a: mapLeafP(n.a, fn), b: mapLeafP(n.b, fn) }
}

/** 把 tab 打开进窗格（已存在则仅激活）。 */
export function openTab(st: LayoutState, paneIdx: number, tabId: string): LayoutState {
  const p = st.panes[paneIdx]
  if (!p) return st
  if (p.tabs.includes(tabId)) {
    if (p.active === tabId && st.focused === paneIdx) return st
    return { ...st, focused: paneIdx, panes: st.panes.map((q, i) => (i === paneIdx ? { ...q, active: tabId } : q)) }
  }
  return {
    ...st, focused: paneIdx,
    panes: st.panes.map((q, i) => (i === paneIdx ? { ...q, tabs: [...q.tabs, tabId], active: tabId } : q)),
  }
}

export function activate(st: LayoutState, paneIdx: number, tabId: string): LayoutState {
  const p = st.panes[paneIdx]
  if (!p || p.active === tabId) return st.focused === paneIdx ? st : { ...st, focused: paneIdx }
  return { ...st, focused: paneIdx, panes: st.panes.map((q, i) => (i === paneIdx ? { ...q, active: tabId } : q)) }
}

/** 关 tab；窗格空了 → 回收空叶（父 split 塌缩成另一侧）。 */
export function closeTab(st: LayoutState, paneIdx: number, tabId: string): LayoutState {
  const p = st.panes[paneIdx]
  if (!p) return st
  const tabs = p.tabs.filter((t) => t !== tabId)
  const active = tabId === p.active ? (tabs.at(-1) ?? null) : p.active
  const panes = st.panes.map((q, i) => (i === paneIdx ? { tabs, active } : q))
  if (tabs.length) return { ...st, panes }
  return prunePane({ ...st, panes }, paneIdx)
}

function prunePane(st: LayoutState, paneIdx: number): LayoutState {
  if (countLeaves(st.tree) === 1) {
    return { tree: { t: 'leaf', p: 0 }, panes: [{ tabs: [], active: null }], focused: 0 }
  }
  const walk = (n: SplitNode): SplitNode | null => {
    if (n.t === 'leaf') return n.p === paneIdx ? null : n
    const a = walk(n.a), b = walk(n.b)
    if (a === null) return b
    if (b === null) return a
    return { ...n, a, b }
  }
  const tree = walk(st.tree) ?? { t: 'leaf' as const, p: 0 }
  const panes = st.panes.filter((_, i) => i !== paneIdx)
  const fixed = mapLeafP(tree, (p) => (p > paneIdx ? p - 1 : p))
  return { tree: fixed, panes, focused: Math.min(st.focused, panes.length - 1) }
}

/** 分裂：把 paneIdx 窗格沿 dir 切开，tabId 进新叶（after=true 在右/下）。 */
export function splitPane(st: LayoutState, paneIdx: number, dir: Dir, tabId: string, after: boolean): LayoutState {
  const panes: PaneState[] = [...st.panes, { tabs: [tabId], active: tabId }]
  const np = panes.length - 1
  const walk = (n: SplitNode): SplitNode => {
    if (n.t === 'leaf') {
      if (n.p !== paneIdx) return n
      const leafNew: SplitNode = { t: 'leaf', p: np }
      const leafOld: SplitNode = { t: 'leaf', p: paneIdx }
      return { t: 'split', dir, s: 0.5, a: after ? leafOld : leafNew, b: after ? leafNew : leafOld }
    }
    return { ...n, a: walk(n.a), b: walk(n.b) }
  }
  return { tree: walk(st.tree), panes, focused: np }
}

/** 跨窗格搬家：从 src 摘 tab，入 dst 中心。 */
export function moveTab(st: LayoutState, src: number, dst: number, tabId: string): LayoutState {
  if (src === dst) return activate(st, dst, tabId)
  const s = st.panes[src]
  if (!s) return st
  const tabs = s.tabs.filter((t) => t !== tabId)
  const active = tabId === s.active ? (tabs.at(-1) ?? null) : s.active
  let next: LayoutState = { ...st, panes: st.panes.map((q, i) => (i === src ? { tabs, active } : q)) }
  if (!tabs.length) next = prunePane(next, src)
  return openTab(next, next.panes.indexOf(st.panes[dst]) >= 0 ? dst : Math.min(dst, next.panes.length - 1), tabId)
}

/** 拖 divider：改 split 节点占比（0.15~0.85 夹逼）。 */
export function setRatio(st: LayoutState, path: number[], s: number): LayoutState {
  const walk = (n: SplitNode, d: number): SplitNode => {
    if (n.t === 'leaf') return n
    if (d === path.length) return { ...n, s: Math.min(0.85, Math.max(0.15, s)) }
    const side = path[d]
    return { ...n, [side === 0 ? 'a' : 'b']: walk(side === 0 ? n.a : n.b, d + 1) }
  }
  return { ...st, tree: walk(st.tree, 0) }
}

/** 聚焦窗格并入相邻（左上优先的下一个存活叶）。 */
export function collapsePane(st: LayoutState, paneIdx: number): LayoutState {
  const p = st.panes[paneIdx]
  if (!p || countLeaves(st.tree) === 1) return st
  const order: number[] = []
  const collect = (n: SplitNode) => { if (n.t === 'leaf') order.push(n.p); else { collect(n.a); collect(n.b) } }
  collect(st.tree)
  const nb = order.find((i) => i !== paneIdx)
  if (nb === undefined) return st
  let next = st
  for (const t of p.tabs) next = openTab(next, nb, t)
  return prunePane(next, paneIdx)
}
