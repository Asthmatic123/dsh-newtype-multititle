/**
 * NewType 布局层 · Workspace 渲染器（FR-2 自由分栏，demo v3.2 的 1:1 组件化）
 * 宿主无关：数据全走 props，纯受控。DOM 铁律：flex 自动排版，
 * divider 只改 flex-grow 比例，零 JS 手算坐标。
 *
 * D14 拖拽源双轨（因为左栏已交还宿主）：
 *  - 自家 pane tab 拖起 → tabDrag 单例（跨 React 树，dragover 里读不到 data）
 *  - 宿主 WorkspaceBrowser 行拖起 → 宿主自带协议，我们只在 drop 时读
 *    dataTransfer.getData（drop 事件不在 protected mode 里）
 *  判活统一用 dataTransfer.types（含 'text/plain' 即可信），dragover 可读。
 */
import { useRef } from 'react'
import type { DragEvent as RDragEvent, PointerEvent as RPointerEvent, ReactNode } from 'react'
import type { LayoutState, SplitNode, Dir } from './state'

export interface WorkspaceProps {
  st: LayoutState
  /** 渲染一个窗格主体（tab 条 + 内容由上层 paneRenderer 给） */
  renderPane: (paneIdx: number, focused: boolean) => ReactNode
  onActivatePane: (paneIdx: number) => void
  /** 拖拽落点：边缘=分裂，中心=并入 */
  onDropTab: (paneIdx: number, zone: 'lft' | 'rgt' | 'top' | 'btm' | 'cnt', tabId: string, fromPane: number | null) => void
  /** 当前被拖的 tab（null=没在拖）；由上层 dragstart 设置 */
  dragging: { id: string; from: number | null } | null
  onRatio: (path: number[], s: number) => void
}

function zoneOf(el: HTMLElement, clientX: number, clientY: number): 'lft' | 'rgt' | 'top' | 'btm' | 'cnt' {
  const r = el.getBoundingClientRect()
  const x = clientX - r.left, y = clientY - r.top
  const fx = Math.min(x, r.width - x) / r.width
  const fy = Math.min(y, r.height - y) / r.height
  if (Math.max(fx, fy) < 0.22) return fx < fy ? (x < r.width / 2 ? 'lft' : 'rgt') : (y < r.height / 2 ? 'top' : 'btm')
  return 'cnt'
}

/** 这次拖拽带着可用的会话 id 吗（自家单例优先，其次宿主 dataTransfer）。 */
function dragIdOf(e: RDragEvent<HTMLElement>, dragging: WorkspaceProps['dragging']): { id: string; from: number | null } | null {
  if (dragging) return dragging
  const types = e.dataTransfer?.types
  if (!types || !Array.from(types).includes('text/plain')) return null
  let id = ''
  try { id = e.dataTransfer.getData('text/plain') } catch { return null }
  return id ? { id, from: null } : null
}

export function Workspace(props: WorkspaceProps) {
  const { st, dragging } = props
  const hlRef = useRef<Map<number, string>>(new Map())

  const handleOver = (e: RDragEvent<HTMLDivElement>, paneIdx: number) => {
    if (!dragIdOf(e, dragging)) return
    e.preventDefault()
    const z = zoneOf(e.currentTarget, e.clientX, e.clientY)
    if (hlRef.current.get(paneIdx) !== z) { hlRef.current.set(paneIdx, z); forceHl(paneIdx, z) }
  }
  const forceHl = (paneIdx: number, z: string | null) => {
    const el = paneEls.current.get(paneIdx)
    if (!el) return
    const hl = el.querySelector('.nt-zhl')
    if (!hl) return
    hl.className = 'nt-zhl' + (z ? ` on ${z}` : '')
  }
  const paneEls = useRef<Map<number, HTMLDivElement>>(new Map())

  const renderNode = (node: SplitNode, path: number[]): ReactNode => {
    if (node.t === 'leaf') {
      return (
        <div key={`l${node.p}`} className="nt-pane-wrap"
          ref={(el) => { el ? paneEls.current.set(node.p, el) : paneEls.current.delete(node.p) }}
          onDragOver={(e) => handleOver(e, node.p)}
          onDragLeave={() => { hlRef.current.delete(node.p); forceHl(node.p, null) }}
          onDrop={(e) => {
            const d = dragIdOf(e, dragging)
            if (!d) return
            e.preventDefault()
            const z = zoneOf(e.currentTarget, e.clientX, e.clientY)
            hlRef.current.delete(node.p)
            forceHl(node.p, null)
            props.onDropTab(node.p, z, d.id, d.from)
          }}
        >
          {props.renderPane(node.p, node.p === st.focused)}
        </div>
      )
    }
    return (
      <div key={`s${path.join()}`} className={`nt-split ${node.dir}`}>
        <div className="nt-child" style={{ flexGrow: node.s }}>{renderNode(node.a, [...path, 0])}</div>
        <Divider dir={node.dir} onRatio={(s) => props.onRatio(path, s)} />
        <div className="nt-child" style={{ flexGrow: 1 - node.s }}>{renderNode(node.b, [...path, 1])}</div>
      </div>
    )
  }
  return <div className="nt-workspace">{renderNode(st.tree, [])}</div>
}

/** divider：pointer 拖 = 按比例改 flex-grow；双击均分。零坐标计算。 */
function Divider({ dir, onRatio }: { dir: Dir; onRatio: (s: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const d = ref.current
    if (!d) return
    const host = d.parentElement
    if (!host) return
    const [a, , b] = Array.from(host.children) as HTMLElement[]
    const rect = host.getBoundingClientRect()
    const horiz = dir === 'row'
    d.setPointerCapture(e.pointerId)
    d.classList.add('act')
    const move = (ev: PointerEvent) => {
      const s = horiz ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height
      const c = Math.min(0.85, Math.max(0.15, s))
      a.style.flexGrow = String(c)
      b.style.flexGrow = String(1 - c)
    }
    const up = (ev: PointerEvent) => {
      d.removeEventListener('pointermove', move as EventListener)
      d.removeEventListener('pointerup', up as EventListener)
      d.classList.remove('act')
      const s = horiz ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height
      onRatio(s)
    }
    d.addEventListener('pointermove', move)
    d.addEventListener('pointerup', up)
  }
  return <div ref={ref} className={`nt-divider ${dir}`} onPointerDown={down}
    onDoubleClick={() => onRatio(0.5)} />
}
