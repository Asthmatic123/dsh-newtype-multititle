/**
 * NewType 工作台（main key 'newtype' + conversation.view 双注册体）—— D15 trellis 版：
 * 布局骨架整体交给 @danfessler/trellis 0.3.0（拖拽 dock / 并入 / zoom / 持久化 / 动画原装），
 * D2 自制 split 树（layout/state.ts + layout/Workspace.tsx）退休不删（回滚留底，测试仍覆盖纯逻辑层）。
 *
 * 窗格内容 = 宿主原版对话框（HostConversationPane，D14-R2），经 props 闭包注入 trellis view；
 * 降级链不变（SessionPane 兜底）。
 *
 * 拖拽桥（D15）：宿主左栏行是 HTML5 DnD 源（D14 实证 text/plain 带会话 id），
 * trellis 是 pointer 手势，两套不通 → 根容器补 dragover/drop，drop 翻译成 ws.open。
 *
 * children 声明里的 session 作用域子槽仍是硬前提：框架只在「声明了非 root 作用域
 * 子槽」的组件 props 上装 SessionProvider（ui-renderer client.js:732-740）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Workspace, ViewType, Stage, Panel, View } from '@danfessler/trellis-react'
// 走 dist 直连：构建器的 CSS 插件自解析路径，不认包 exports 映射（2026-10-09 E28）
import '@danfessler/trellis/dist/style.css'
import s from '../newtype.module.css'
import { openTabBus, artRail, subPendingSession, takePendingSession } from '../bus.ts'
import { titleOf as hostPageTitleOf, noteActiveSession, retainedByMainView } from '../pages.ts'
import { SessionPane } from './SessionPane.tsx'
import { HostConversationPane } from './HostConversationPane.tsx'
import { PagePane } from './PagePane.tsx'
import { FilePane } from './FilePane.tsx'
import { WebPane } from './WebPane.tsx'
import { getTab, setTabOpener, subscribeTabs, tabHost, type NtExtTab } from '../tabregistry.ts'
import { ArtifactsPanel } from './ArtifactsPanel.tsx'
import { SessionAccessories, NT_VARS } from './SessionAccessories.tsx'
import { SessionSubTabs, SubagentsPane, JobsPane, type NtSessionMode } from './SubagentsPane.tsx'

export interface WorkbenchProps {
  /** 会话 scope 标准道具；用于空布局时预置当前会话 */
  sessionId?: string
  /** B10-b：openSession 接会话 id 或 SubagentAddress（宿主 uiWorkspace.openSession 原样透传） */
  openSession?: (id: string | { parentSessionId: string; childSessionId: string; mode: 'one-shot' | 'continuable' | 'unknown' }) => void
  retainSession?: (id: string) => NtSessionRef | null
  getSessionsList?: (() => NtSnap<NtSessionListState> | null) | null
  /** 框架装的会话域道具（D14-R1 换来的），用于把窗格绑到显式会话引用 */
  SessionProvider?: NtSessionProviderComponent
  /** factory 渲染面（D14-R2），宿主 conversation.content 用它实例化原版对话框 */
  renderFactorySlot?: NtRenderFactorySlot
  /** 宿主右栏开关（D15 accessory），sharedInject 注入 */
  openRightbar?: () => void
  closeRightbar?: () => void
  /** B10-c：后台任务根服务（运行时惰性读，缺席页签自动隐藏） */
  getJobs?: () => unknown
  /** E31c 侧边栏按钮：better-sidebar 底部文件面板，缺席回落产出物栏 */
  openSidePanel?: (sid?: string) => void
  /** E43：容器内新建会话（宿主 startSession + E42b patch 拉回），缺席则隐藏入口 */
  newSession?: () => void
}

const TRELLIS_STORAGE_KEY = 'dsh-newtype.trellis.v1'

/**
 * E43v2：tab 排末尾「＋」。命令式插进 trellis 的 [data-trellis-part="tabs"]
 * （每个面板一个，flex+gap 排）当最后一个 tab 的兄弟节点——贴标签右侧、
 * 随横向滚动，纯原生 flex 排版（DOM 铁律合规，无坐标手算）。
 * 为什么不用 portal：tabs 容器是 trellis 自己的 React 渲染根，重渲染会把
 * 外来 portal 子树冲掉（真机实证「＋」不出现）。改为观察者 + 缺失即补插
 * （与 openSession 实例 patch 同款思路），卸载时统一摘除。
 */
function TabPlus(props: { containerRef: React.RefObject<HTMLDivElement | null>; onClick: () => void }) {
  const onClickRef = useRef(props.onClick)
  onClickRef.current = props.onClick
  useEffect(() => {
    const container = props.containerRef.current ?? document.body
    const made = new Set<HTMLButtonElement>()
    const make = () => {
      const b = document.createElement('button')
      b.dataset.nt = 'tabnew'
      b.title = '新建会话'
      b.textContent = '＋'
      Object.assign(b.style, {
        flex: '0 0 auto', alignSelf: 'stretch', width: '22px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 4px',
        border: 'none', outline: 'none',
        borderRadius: 'var(--trellis-tab-radius, 6px) var(--trellis-tab-radius, 6px) 0 0',
        // E43c：选中 tab 同款顶部 2px accent 细条 + tab 底色（主人指名的淡蓝顶条样式）
        background: 'linear-gradient(var(--trellis-accent, #4d8bff), var(--trellis-accent, #4d8bff)) center top / 100% 2px no-repeat, var(--trellis-tab, rgba(127,127,127,.15))',
        color: 'var(--trellis-text-muted, #8a8f98)',
        fontSize: '13px', lineHeight: '1', cursor: 'pointer', opacity: '0.85',
      } as CSSStyleDeclaration)
      const hoverBg = () => 'linear-gradient(var(--trellis-accent, #4d8bff), var(--trellis-accent, #4d8bff)) center top / 100% 2px no-repeat, var(--trellis-tab-hover, rgba(127,127,127,.2))'
      const restBg = () => 'linear-gradient(var(--trellis-accent, #4d8bff), var(--trellis-accent, #4d8bff)) center top / 100% 2px no-repeat, var(--trellis-tab, rgba(127,127,127,.15))'
      b.addEventListener('mouseenter', () => { b.style.background = hoverBg(); b.style.color = 'var(--trellis-text, #d8d5d0)' })
      b.addEventListener('mouseleave', () => { b.style.background = restBg(); b.style.opacity = '0.85' })
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClickRef.current() })
      made.add(b)
      return b
    }
    const ensure = () => {
      container.querySelectorAll<HTMLElement>('[data-trellis-part="tabs"]').forEach((tabs) => {
        if (!tabs.querySelector('[data-nt="tabnew"]')) tabs.appendChild(make())
      })
    }
    ensure()
    const mo = new MutationObserver(ensure)
    mo.observe(container, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      made.forEach((b) => b.remove())
      made.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef 身份稳定
  }, [])
  return null
}
/** 字号/字体对齐 DSH 原版（2026-10-09 主人要求）：tab 14px（原 12.5 显小）、字体继承宿主栈；
 *  Y 向加长（同日追加）：tab 条 34→40px、内衬 8→6px，tab 本体 18→28px 高 */
const TRELLIS_FONT_TOKENS: Record<string, string> = {
  '--trellis-font': 'inherit',
  '--trellis-font-size': '14px',
  '--trellis-tabbar-height': '40px',
  '--trellis-tab-inset': '6px',
}
/** dark 主题的 DSH 深黑口径（demo 同款 tokens，2026-10-09 回退保持原值） */
const TRELLIS_DARK_TOKENS: Record<string, string> = {
  '--trellis-bg': '#0c0d0f',
  '--trellis-stage': '#111215',
  '--trellis-panel': '#1a1b1f',
  '--trellis-tabbar': '#141518',
  '--trellis-tab-active': '#1a1b1f',
  '--trellis-accent': '#4d8bff',
}

/** 宿主主题探测：html 内联 color-scheme（data-ds-theme-source=system 时随 OS 变，MutationObserver 跟随） */
function readHostTheme(): 'light' | 'dark' {
  try {
    return /^dark$/i.test(getComputedStyle(document.documentElement).colorScheme.trim()) ? 'dark' : 'light'
  } catch { return 'dark' }
}

const subNoop = () => () => {}

/** 外部插件注册的 tab（__ntMultititle 注册表）→ trellis ViewType 渲染体。
 *  跨插件边界不带 React 类型（对侧 bundle 自带组件、共享 loader 的 React 实例），窄 cast。 */
function ExtTabPane(props: { tab: NtExtTab }) {
  const Comp = props.tab.render as React.ComponentType<Record<string, never>>
  return <Comp />
}

/** 轨迹降级文案（模块级常量：renderSession 身份稳定的一部分） */
const TRACE_FALLBACK = <div className={s.pempty}>轨迹视图不可用（宿主未提供 trajectory 视图）</div>

/* ===== E47 拖拽落点：宿主左栏行（HTML5 DnD）→ trellis 布局 =====
 *
 * 为什么需要这套：宿主拖动源是 HTML5 DnD，trellis 的拖拽是 pointer 手势，两套不通。
 * 以前 drop 只做 `ws.open()`，丢掉了指针位置信息 → 只能先落成 tab、再拖 tab 分栏（两步）。
 * 现在 drop 时做五分区命中测试（VS Code 口径）：目标窗格外圈 22% 边缘带 = 分裂，
 * 中心 = 并入当 tab。位置信息一步到位。
 *
 * 坐标：trellis 的 rect 是世界单位（整个布局 0~1），navigation.camera 是当前可视区。
 * 屏幕 → 世界要减掉 trellis 自己的 pad（gap/2，见其内部 toScreen）。
 *
 * 预览高亮挂进**目标窗格自己的 surface 元素**（inset 百分比，零坐标手算，DOM 铁律合规）。
 */
type DropZone = 'lft' | 'rgt' | 'top' | 'btm' | 'cnt'
/** 边缘带宽度占比：<此值 = 该侧分裂；否则并入中心。 */
const EDGE_BAND = 0.22
const EDGE_OF: Record<'lft' | 'rgt' | 'top' | 'btm', 'left' | 'right' | 'top' | 'bottom'> =
  { lft: 'left', rgt: 'right', top: 'top', btm: 'bottom' }

/** 布局树按 id 找节点（panel / stage / split 通用）。 */
function findNode(node: unknown, id: string): any {
  if (!node || typeof node !== 'object') return null
  const n = node as { id?: string; child?: unknown; children?: unknown[] }
  if (n.id === id) return n
  const viaChild = findNode(n.child, id)
  if (viaChild) return viaChild
  for (const c of n.children ?? []) { const hit = findNode(c, id); if (hit) return hit }
  return null
}

/** 指针 → 命中窗格 + 分区。指针不在任何窗格上（如空白 stage）→ null。
 *  量的是 trellis 自己的根（ws.element）而不是 React 外层容器——外层还含产出物右栏，
 *  坐标系对不上就会整体偏移。 */
function hitPanel(ws: any, clientX: number, clientY: number): { panelId: string; zone: DropZone } | null {
  try {
    const cam = ws?.navigation?.camera as { x: number; y: number; w: number; h: number } | undefined
    const rects = ws?.getLayoutRects?.() as Map<string, { node: { kind?: string }; rect: { x: number; y: number; w: number; h: number } }> | undefined
    const el = ws?.element as HTMLElement | undefined
    if (!cam || !rects || !el) return null
    const box = el.getBoundingClientRect()
    if (!box.width || !box.height) return null
    const g = parseFloat(getComputedStyle(el).getPropertyValue('--trellis-gap'))
    const pad = (Number.isFinite(g) ? g : 6) / 2
    const wx = cam.x + ((clientX - box.left - pad) / (box.width - pad * 2)) * cam.w
    const wy = cam.y + ((clientY - box.top - pad) / (box.height - pad * 2)) * cam.h
    for (const [id, entry] of rects) {
      if (entry?.node?.kind !== 'panel') continue
      const r = entry.rect
      if (wx < r.x || wx > r.x + r.w || wy < r.y || wy > r.y + r.h) continue
      const fx = (wx - r.x) / r.w
      const fy = (wy - r.y) / r.h
      if (Math.min(fx, 1 - fx, fy, 1 - fy) >= EDGE_BAND) return { panelId: id, zone: 'cnt' }
      if (Math.min(fx, 1 - fx) <= Math.min(fy, 1 - fy)) return { panelId: id, zone: fx < 0.5 ? 'lft' : 'rgt' }
      return { panelId: id, zone: fy < 0.5 ? 'top' : 'btm' }
    }
    return null
  } catch { return null }
}

/** 环的样式（挂在**内框**上，百分比相对窗格整体，见 paintMark）。与 trellis 拖 tab 的
 *  落点环同款：透明底 + `inset 0 0 0 2px var(--trellis-accent)` + var(--trellis-radius)。
 *  边缘分区只改覆盖区域（半格），不改样式——告诉主人「新窗格落在哪一半」。 */
function markBox(zone: DropZone): string {
  const acc = 'var(--trellis-accent, #4d8bff)'
  const ring = `background:transparent;box-shadow:inset 0 0 0 2px ${acc};border-radius:var(--trellis-radius, 8px);`
  let box = 'left:0;top:0;width:100%;height:100%;'
  if (zone === 'lft') box = 'left:0;top:0;width:50%;height:100%;'
  else if (zone === 'rgt') box = 'right:0;top:0;width:50%;height:100%;'
  else if (zone === 'top') box = 'left:0;top:0;width:100%;height:50%;'
  else if (zone === 'btm') box = 'left:0;bottom:0;width:100%;height:50%;'
  return 'position:absolute;' + box + ring
}

/**
 * 把落点预览挂到 **`.trellis-layer`**（panel 的兄弟），而不是 panel 里面。
 * ⚠️ 实测图层（2026-10-12）：`.trellis-layer` 下 panel `z-index:10`、surface `z-index:11`——
 * 内容层压在 panel 之上，所以挂在 panel 里的环只露出 tab 条那一条上框线，其余被内容遮住。
 * panel 的摆放是内联 `transform:translate(x,y)` + width/height；此处**镜像**它当外框
 * （不手算坐标），内框用百分比画环，z-index 12 压过内容层 → 环完整且与 tab 拖拽一致。
 */
function paintMark(ws: any, panelId: string, zone: DropZone, mark: HTMLDivElement): boolean {
  try {
    const viewId = findNode(ws?.getDocument?.()?.root, panelId)?.selected
    if (!viewId) return false
    const q = `[data-trellis-part="surface"][data-view="${CSS.escape(String(viewId))}"]`
    const surface = ws?.element?.querySelector?.(q) as HTMLElement | null
    if (!surface) return false
    const panelQ = `[data-trellis-part="panel"][data-panel="${CSS.escape(String(panelId))}"]`
    const panel = ws?.element?.querySelector?.(panelQ) as HTMLElement | null
    const host = (panel?.parentElement ?? surface.parentElement) as HTMLElement | null
    if (!host) return false
    if (mark.parentElement !== host) host.appendChild(mark)
    const outer = panel
      ? `position:absolute;left:0;top:0;transform:${panel.style.transform};width:${panel.style.width};height:${panel.style.height};`
      : 'position:absolute;left:0;top:0;right:0;bottom:0;'
    mark.setAttribute('style', outer + 'z-index:12;pointer-events:none;background:transparent;')
    let inner = mark.firstElementChild as HTMLDivElement | null
    if (!inner) { inner = document.createElement('div'); mark.appendChild(inner) }
    inner.setAttribute('style', markBox(zone))
    return true
  } catch { return false }
}

/**
 * 卡顿治理（2026-10-09）：宿主会话列表在流式期间高频 emit，WorkbenchView 每次都整树重渲，
 * 窗格里的原版对话 factory 大子树跟着重跑。两层治理：
 *  ① 订阅层签名去重——ids + 各会话标题/blank 拼成签名，没变就不通知 React；
 *  ② 窗格层 React.memo——renderSession / fallback 全部稳定化（动态数据走 ref 读最新），
 *     列表 emit 不再波及 HostConversationPane 子树。
 */
function sessionSig(snap: NtSessionListState | null): string {
  if (!snap) return 'null'
  const byId = snap.byId ?? {}
  let out = String(snap.ids?.length ?? 0)
  for (const id of snap.ids ?? []) {
    const r = byId[id]
    out += `|${id}:${r?.displayTitle ?? ''}:${r?.title ?? ''}:${r?.blank ? 1 : 0}`
  }
  return out
}

export function WorkbenchView(props: WorkbenchProps) {
  const wsRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dropHot, setDropHot] = useState(false)
  const artOpen = useSyncExternalStore(artRail.sub, artRail.get)
  // 浅色主题联动（2026-10-09 主人要求）：跟随宿主 color-scheme，css 变化即重读
  const [hostTheme, setHostTheme] = useState<'light' | 'dark'>(readHostTheme)
  useEffect(() => {
    const read = () => setHostTheme(readHostTheme())
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-ds-theme-source'] })
    return () => obs.disconnect()
  }, [])

  const listSrc = props.getSessionsList?.() ?? null
  const lastSigRef = useRef<string>('')
  const list = useSyncExternalStore(
    useMemo(() => {
      if (!listSrc) return subNoop
      return (cb: () => void) => listSrc.subscribe(() => {
        // 签名没变就不叫醒 React（流式期间的标题不变 emit 全被挡在这）
        const sig = sessionSig(listSrc.getSnapshot())
        if (sig === lastSigRef.current) return
        lastSigRef.current = sig
        cb()
      })
    }, [listSrc]),
    listSrc ? () => listSrc.getSnapshot() : () => null,
    listSrc ? () => listSrc.getSnapshot() : () => null,
  )
  const byId = list?.byId ?? {}
  const titleOf = useMemo(
    () => (id: string) => {
      const r = byId[id]
      // E43c：未发言的空会话统一叫「新对话」（宿主给新会话的标题是工作区名，观感怪）
      if (r?.blank) return '新对话'
      return r?.displayTitle ?? r?.title ?? id.slice(0, 8)
    },
    [byId],
  )
  const mainViewId = retainedByMainView(list?.ids, list?.byId)
  // 图页归属口径同步（root scope 无 sessionId，按 retainedBy 判定；口径退化影响仅图页侧栏匹配）
  noteActiveSession(mainViewId)

  // 2026-10-13 拆分：huabu 点图 tab 本体改读 __ntMultititle 注册表
  // （2dlist 插件 registerTab 进来；未注册 = 不渲染该 ViewType，useSyncExternalStore 响应式）。
  const dotsTab = useSyncExternalStore(subscribeTabs, () => getTab('dots'), () => getTab('dots'))

  // 空态自动预置：trellis 布局里一个 session view 都没有时，把当前会话开进来（绝不覆盖已开 tab）
  useEffect(() => {
    if (!mainViewId || !wsRef.current) return
    try {
      const ws = wsRef.current
      if ((ws.views?.({ type: 'session' }) ?? []).length === 0) {
        ws.open('session', { params: { sid: mainViewId }, reuse: 'params' })
      }
    } catch { /* workspace 未就绪：下一轮列表变更再试 */ }
  }, [mainViewId])

  // NT1011B：开 huabu 点图 tab（轮询等 ws 就绪——工作台可能刚重挂载，同
  // openPendingWhenReady 模式）；reuse:'params'（无参）= 同类只开一份。
  // 2026-10-13 拆分：tab 本体由 2dlist 插件经 __ntMultititle.registerTab 注册，
  // 这里只提供「打开器」，经 tabHost.openTab('dots') 调用（未注册时静默）。
  const openDotsWhenReady = useCallback(() => {
    const t = setInterval(() => {
      const ws = wsRef.current
      if (!ws) return
      clearInterval(t)
      try { ws.open('dots', { params: {}, reuse: 'params' }) } catch { /* open 失败静默 */ }
    }, 100)
    setTimeout(() => clearInterval(t), 10000) // 保险丝
  }, [])
  useEffect(() => { setTabOpener('dots', openDotsWhenReady) }, [openDotsWhenReady])

  // 打开请求总线：图页（page:）/文件（file:）/会话 → ws.open 成 tab。
  // 会话分支（E47）：find-or-open。reuse:'params' 按 params 深比命中已有 tab（trellis
  // index.js:4361），语义 = VS Code「按资源 URI 找，找到就聚焦，找不到就开」。
  // 旧实现按 DFS 找「第一个 session tab」再 setParams 原地换 sid——那会把用户正看着的
  // 另一个 tab 偷偷改成别的会话，且焦点未必在那个 tab 上（对应逻辑怪的真因）。
  useEffect(() => openTabBus.sub((tabId) => {
    // NT1011B（2026-10-13 拆分）：dots 走扩展点 openTab（注册表为空时静默；
    // 打开器内部自己轮询等 ws 就绪，不怕工作台重挂载丢一次性请求）。
    if (tabId === 'dots') { tabHost.openTab('dots'); return }
    const ws = wsRef.current
    if (!ws) return
    try {
      if (tabId.startsWith('page:')) ws.open('page', { params: { pid: tabId.slice(5) }, reuse: 'params' })
      else if (tabId.startsWith('file:')) ws.open('file', { params: { path: tabId.slice(5) }, reuse: 'params' })
      else ws.open('session', { params: { sid: tabId }, reuse: 'params' })
    } catch { /* 布局服务未就绪 */ }
  }), [openDotsWhenReady])

  // E33b：消化待开会话。E43f：事件式订阅（挂载即补消费存量 + 写入即时投递）。
  // E43g：再加 400ms 轮询兜底——双保险，任何一条通道漏了另一条接住。
  // wsRef 由 trellis useImperativeHandle 异步就绪 → 轮询等它。
  const openPendingWhenReady = useCallback((sid: string) => {
    const t = setInterval(() => {
      const ws = wsRef.current
      if (!ws) return
      try {
        ws.open('session', { params: { sid }, reuse: 'params' })
        clearInterval(t)
      } catch { /* E43h：open 抛错不清表，下一轮重试（旧版先清表再 open，一抛就丢交付） */ }
    }, 200)
    // 保险丝：10 秒还开不出去就放弃这条
    setTimeout(() => clearInterval(t), 10000)
  }, [])
  useEffect(() => subPendingSession(openPendingWhenReady), [openPendingWhenReady])
  useEffect(() => {
    const t = setInterval(() => {
      const sid = takePendingSession()
      if (sid) openPendingWhenReady(sid)
    }, 400)
    return () => clearInterval(t)
  }, [openPendingWhenReady])

  /* 拖拽桥（E47）：宿主行 HTML5 DnD → trellis。trellis 自家 tab 拖拽照走 pointer 手势，互不干扰。
     dragover 每次只在「命中窗格+分区」变化时动 DOM（同 retired Workspace.tsx 的 hlRef 去重）。
     dropHot（整框虚线）只在**没有**命中窗格时给，避免和窗格高亮两层视觉打架。 */
  const markRef = useRef<HTMLDivElement | null>(null)
  const markKeyRef = useRef('')
  const markEl = () => {
    let m = markRef.current
    if (!m) { m = document.createElement('div'); m.dataset.nt = 'dropmark'; markRef.current = m }
    return m
  }
  const clearMark = () => {
    markKeyRef.current = ''
    markRef.current?.remove()
  }
  useEffect(() => () => { markRef.current?.remove() }, [])

  // 兜底清理（2026-10-12）：拖拽可能在**任何**方向提前结束——按 Esc 取消、落到浏览器
  // 窗口外、落到侧栏（宿主的排序 drop）——这些路径都走不到本组件的 onDrop/onDragLeave，
  // 落点环就会永久留在窗格上（实测 dragend 后 mark 仍在）。故挂全局 dragend/drop。
  useEffect(() => {
    const done = () => { setDropHot(false); clearMark() }
    document.addEventListener('dragend', done)
    document.addEventListener('drop', done)
    return () => {
      document.removeEventListener('dragend', done)
      document.removeEventListener('drop', done)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDragOver = (e: React.DragEvent) => {
    const t = e.dataTransfer?.types
    if (!t || !(t.includes('application/x-dsh-session') || t.includes('text/plain'))) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const ws = wsRef.current
    const hit = ws ? hitPanel(ws, e.clientX, e.clientY) : null
    setDropHot(!hit)
    const key = hit ? `${hit.panelId}:${hit.zone}` : ''
    if (key === markKeyRef.current) return
    markKeyRef.current = key
    if (hit && ws && paintMark(ws, hit.panelId, hit.zone, markEl())) return
    markKeyRef.current = ''
    markRef.current?.remove()
  }
  const onDragLeave = (e: React.DragEvent) => {
    const to = e.relatedTarget as Node | null
    if (!to || !wrapRef.current?.contains(to)) { setDropHot(false); clearMark() }
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropHot(false)
    clearMark()
    const sid = e.dataTransfer?.getData('application/x-dsh-session') || e.dataTransfer?.getData('text/plain')
    const ws = wsRef.current
    if (!sid || !ws) return
    const hit = hitPanel(ws, e.clientX, e.clientY)
    try {
      const exist = (ws.views?.({ type: 'session' }) ?? []).find(
        (v: { id: string; panelId: string; params?: { sid?: string } }) => v.params?.sid === sid,
      )
      // 没命中窗格（空白处）：开/聚焦，落点交给 trellis 默认规则
      if (!hit) {
        if (exist) ws.focus(exist.id)
        else ws.open('session', { params: { sid }, reuse: 'none' })
        return
      }
      // 已在这个窗格里：只聚焦，不 dock（dock 到自身会把面板摘掉再插回，布局会乱）
      if (exist && exist.panelId === hit.panelId) { ws.focus(exist.id); return }
      let target: unknown
      if (hit.zone === 'cnt') target = { into: hit.panelId }
      else target = { beside: hit.panelId, edge: EDGE_OF[hit.zone], share: 0.5 }
      // 已开在别处 = 搬过来（VS Code 拖动语义）；没开过 = 按落点一步开出来
      if (exist) ws.dock(exist.id, target)
      else ws.open('session', { params: { sid }, placement: target, reuse: 'none' })
    } catch { /* 布局服务未就绪 */ }
  }

  // —— 卡顿治理②：动态数据（byId）走 ref，renderSession 身份恒定，
  //    配合 HostConversationPane 的 React.memo（自定义比较器），列表 emit 不再波及窗格子树 ——
  const byIdRef = useRef(byId)
  byIdRef.current = byId

  /** E35：对话内链接 → 内置浏览器新 tab（wsRef 是 ref，回调身份恒定，memo 不破） */
  const openInBrowser = useCallback((url: string) => {
    try { wsRef.current?.open('web', { params: { url }, reuse: false }) } catch { /* 未就绪 */ }
  }, [])

  /** view 内容：mode 切换（对话/子代理/轨迹，B10-b 迷你页签 setParams；params 随布局持久化） */
  const renderSession = useCallback((view: {
    params?: { sid?: string; mode?: string }
    setParams: (patch: Record<string, unknown>) => void
  }) => {
    const sid = view.params?.sid ?? ''
    const raw = view.params?.mode
    const mode: NtSessionMode = raw === 'trace' ? 'trace' : raw === 'subs' ? 'subs' : raw === 'jobs' ? 'jobs' : 'chat'
    const retain = props.retainSession
    if (!retain) return <div className={s.pempty}>会话服务未就绪</div>
    // E41：文件点击 → 文件窗格。相对路径（@file chip 的 title）按会话 cwd 拼绝对。
    const openInFilePane = (raw: string) => {
      let p = raw.replace(/^@/, '').replace(/^"|"$/g, '')
      if (!/^[A-Za-z]:[\\/]/.test(p) && !p.startsWith('/')) {
        const cwd = (byIdRef.current[sid] as { cwd?: string } | undefined)?.cwd
        if (cwd) p = `${cwd.replace(/[\\/]+$/, '')}/${p.replace(/^\/+/, '')}`
      }
      try { wsRef.current?.open('file', { params: { path: p }, reuse: false }) } catch { /* 未就绪 */ }
    }
    // B10-b（2026-10-12 主人拍板 A）：子代理页签只在 catalog 非空时出现（SessionSubTabs 内判），
    // 点击子代理走宿主 openSession(SubagentAddress) 原版链路切主视图（dsh-client-ui-subagent 同款）。
    const listSrc = props.getSessionsList?.() ?? null
    const jobs = props.getJobs?.() ?? null
    const body = mode === 'trace' ? (
      <HostConversationPane
        sessionId={sid}
        viewName="trajectory"
        retainSession={retain}
        SessionProvider={props.SessionProvider}
        renderFactorySlot={props.renderFactorySlot}
        fallback={TRACE_FALLBACK}
      />
    ) : mode === 'subs' ? (
      <SubagentsPane listSrc={listSrc} sid={sid} onOpen={(addr) => props.openSession?.(addr)} />
    ) : mode === 'jobs' ? (
      <JobsPane jobs={jobs} sid={sid} />
    ) : (
      <HostConversationPane
        sessionId={sid}
        blank={!!byIdRef.current[sid]?.blank}
        retainSession={retain}
        SessionProvider={props.SessionProvider}
        renderFactorySlot={props.renderFactorySlot}
        fallback={<SessionPane sessionId={sid} retainSession={retain} />}
        onOpenLink={openInBrowser}
        onOpenFile={openInFilePane}
      />
    )
    return (
      <div className={s.sessub}>
        <SessionSubTabs listSrc={listSrc} jobs={jobs} sid={sid} mode={mode} setParams={view.setParams} />
        {body}
      </div>
    )
  }, [props.retainSession, props.SessionProvider, props.renderFactorySlot, props.getSessionsList, props.openSession, props.getJobs])

  return (
    <div
      data-nt="wb"
      ref={wrapRef}
      className={s.wbWrap + (dropHot ? ' ' + s.dropHot : '')}
      style={NT_VARS[hostTheme]}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={s.wbMain}>
        <Workspace
          ref={wsRef}
          theme={hostTheme}
          navigation="free"
          storageKey={TRELLIS_STORAGE_KEY}
          version={1}
          tokens={hostTheme === 'dark' ? { ...TRELLIS_FONT_TOKENS, ...TRELLIS_DARK_TOKENS } : TRELLIS_FONT_TOKENS}
          className={s.ntws}
        >
          <ViewType
            id="session"
            title={(v: { params?: { sid?: string } }) => titleOf(v.params?.sid ?? '')}
            render={(v: any) => renderSession(v)}
            accessory={(v: any) => (
              <SessionAccessories
                getCwd={() => {
                  const sid = v?.params?.sid ?? ''
                  const rec = byIdRef.current[sid] as { cwd?: string } | undefined
                  return rec?.cwd ?? null
                }}
                vars={NT_VARS[hostTheme]}
                 onOpenBrowser={() => {
                   try { wsRef.current?.open('web', { params: { url: '' }, reuse: false }) } catch { /* 未就绪 */ }
                 }}
              />
            )}
          />
          <ViewType
            id="page"
            title={(v: { params?: { pid?: string } }) => hostPageTitleOf(v.params?.pid ?? '')}
            render={(v: any) => <PagePane pageId={v?.params?.pid ?? ''} />}
          />
          {/* E31 spike：工作台内点文件 → 只读文件窗格（host 半 /newtype/file 端点） */}
          <ViewType
            id="file"
            title={(v: { params?: { path?: string } }) => {
              const p = v.params?.path ?? ''
              return p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1) || '文件'
            }}
            render={(v: any) => <FilePane path={v?.params?.path ?? ''} />}
          />
          {/* E32：内置浏览器（E40 双引擎：Desktop webview / Web iframe，不依赖宿主右栏） */}
          <ViewType
            id="web"
            title={(v: { params?: { url?: string } }) => {
              const u = v.params?.url ?? ''
              return u ? (u.replace(/^https?:\/\//, '').split('/')[0] || '浏览器') : '浏览器'
            }}
            render={(v: any) => <WebPane url={v?.params?.url ?? ''} setParams={(patch) => v?.setParams?.(patch)} openWebTab={openInBrowser} />}
          />
          {/* NT1011B 二版 → 2026-10-13 拆分：huabu 点图 tab（组件由 2dlist 插件注册）；
              未注册时整个 ViewType 不声明（trellis children 声明件按序扫描，null 跳过） */}
          {dotsTab
            ? (
              <ViewType
                id="dots"
                title={() => dotsTab.title || '点图'}
                render={() => <ExtTabPane tab={dotsTab} />}
              />
            )
            : null}
          <Stage empty={
            <div className={s.pempty}>
              把左侧会话拖到窗格边缘分栏 · 拖到窗格中心并入 · 双击 tab 条聚焦
              <div style={{ marginTop: 12 }}>
                <button className={s.webGo} onClick={() => wsRef.current?.open('web', { params: { url: '' }, reuse: false })}>
                  打开浏览器
                </button>
              </div>
            </div>
          }>
            <Panel>
              {props.sessionId
                ? <View type="session" params={{ sid: props.sessionId }} />
                : null}
            </Panel>
          </Stage>
        </Workspace>
        {/* E43v3：TabPlus 必须放 Workspace 外——Workspace 对 children 只认声明件
            （ViewType/Stage/Panel…），未知元素在声明期就被丢弃不挂载（探针实证：
            tabs 容器在场而 tabnew=0）。append 目标靠 querySelector 找，与 React 树位置无关 */}
        <TabPlus containerRef={wrapRef} onClick={() => props.newSession?.()} />
      </div>
      {/* E30：常驻挂载 + class 切宽，宽度/透明度过渡替代条件挂载（动画不再僵硬） */}
      <div className={s.wbRight + (artOpen ? ' ' + s.wbRightOn : '')} data-nt="wrightrail" aria-hidden={!artOpen}>
        <div className={s.hd}>
          <span>产出物</span>
          <span className={s.hdRight}>
            <button className={s.icbtn} data-nt="artrclose" title="收起右栏" onClick={() => artRail.set(false)}>
              <svg viewBox="0 0 24 24" className={s.ic}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </span>
        </div>
        <ArtifactsPanel mode="global" />
      </div>
    </div>
  )
}
