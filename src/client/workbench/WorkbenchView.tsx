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
import { getTab, registryQuietMs, setTabOpener, subscribeTabs, tabHost, type NtExtTab } from '../tabregistry.ts'
import { dotsModeAbort, isDotsMode, setDotsModeImpl } from '../dotsmode.ts'
import { ArtifactsPanel } from './ArtifactsPanel.tsx'
import { SessionAccessories, NT_VARS } from './SessionAccessories.tsx'
import { SessionSubTabs, SubagentsPane, JobsPane, type NtSessionMode } from './SubagentsPane.tsx'
import { nt, useT } from '../i18n.ts'

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

/** 字号/字体对齐 DSH 原版（2026-10-09 主人要求）：tab 14px（原 12.5 显小）、字体继承宿主栈；
 *  Y 向加长（同日追加）：tab 条 34→40px、内衬 8→6px，tab 本体 18→28px 高 */
const TRELLIS_FONT_TOKENS: Record<string, string> = {
  '--trellis-font': 'inherit',
  '--trellis-font-size': '14px',
  '--trellis-tabbar-height': '40px',
  '--trellis-tab-inset': '6px',
}
/** dark 主题的 DSH 深黑口径（demo 同款 tokens，2026-10-09 回退保持原值）。
 *  2026-10-13 tab 条底色跟 DSH 主题（主人要求）：tabbar = DSH bg（#131110），
 *  tab-active = DSH surface（#1e1c1a），替换原 trellis 冷黑 #141518/#1a1b1f。 */
const TRELLIS_DARK_TOKENS: Record<string, string> = {
  '--trellis-bg': '#0c0d0f',
  '--trellis-stage': '#111215',
  '--trellis-panel': '#1a1b1f',
  '--trellis-tabbar': '#131110',
  '--trellis-tab-active': '#1e1c1a',
  '--trellis-accent': '#4d8bff',
}
/** light 主题补丁（2026-10-13）：只覆盖 tab 条两色，跟 DSH 浅色面板（NT_VARS.light：
 *  bg #ffffff / surface #eef0f3）；trellis 默认浅色 tabbar #f1f1f4 偏灰，不跟主题。 */
const TRELLIS_LIGHT_TOKENS: Record<string, string> = {
  '--trellis-tabbar': '#ffffff',
  '--trellis-tab-active': '#eef0f3',
}

/** 宿主主题探测：html 内联 color-scheme（data-ds-theme-source=system 时随 OS 变，MutationObserver 跟随） */
function readHostTheme(): 'light' | 'dark' {
  try {
    return /^dark$/i.test(getComputedStyle(document.documentElement).colorScheme.trim()) ? 'dark' : 'light'
  } catch { return 'dark' }
}

const subNoop = () => () => {}

/** dots tab 图标（2026-10-13）：14x14 雷达点图，形状对齐 2dlist 的 DotsIcon
 *  （multititle 侧独立 inline 常量，不跨插件引组件）。模块级：renderSession 身份稳定。 */
const DotsTabIcon = (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 3a9 9 0 0 1 9 9" />
    <path d="M12 7.2a4.8 4.8 0 0 1 4.8 4.8" />
    <path d="M12 12l5.6-5.6" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="17" cy="15.4" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9.2" cy="17" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="12.6" r=".9" fill="currentColor" stroke="none" />
  </svg>
)

/** 外部插件注册的 tab（__ntMultititle 注册表）→ trellis ViewType 渲染体。
 *  跨插件边界不带 React 类型（对侧 bundle 自带组件、共享 loader 的 React 实例），窄 cast。 */
function ExtTabPane(props: { tab: NtExtTab }) {
  const Comp = props.tab.render as React.ComponentType<Record<string, never>>
  return <Comp />
}

/** 轨迹降级文案（调用点现取，跟语言设置走；HostConversationPane 只在缺席帧用它） */
const TRACE_FALLBACK = () => <div className={s.pempty}>{nt('wb.traceUnavailable')}</div>

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
  useT() // 语言代际订阅：切语言时标题工厂/空态文案跟着重渲染
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
      if (r?.blank) return nt('wb.newChat')
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

  // NT1011F（主人拍板）：dots 模式 ON 期间手动关掉 dots tab → 自动翻回 OFF + 还原侧栏。
  // 信号是「DOM 里 dots 视图消失」而非 tab 注册表——关视图不注销注册（第一版挂错信号，
  // effect 永不触发，真机实锤）。检测放看门狗 tick（下方 useEffect）。

  // NT1011F：等 tab 注册表安静（≥800ms 无变更）再挂 Workspace，上限 2.5s 强制放行。
  // 目的：storage 恢复布局发生时外部插件 tab 类型已声明，防占位僵尸 tab（详见 tabregistry.ts）。
  const [wsReady, setWsReady] = useState(false)
  useEffect(() => {
    const t0 = Date.now()
    const t = setInterval(() => {
      if (registryQuietMs() >= 800 || Date.now() - t0 > 2500) { clearInterval(t); setWsReady(true) }
    }, 100)
    return () => clearInterval(t)
  }, [])

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

  // 方案 A（2026-10-13 主人拍板）：dots 模式执行端（dotsmode.ts）。
  // ON  = 等 ws 就绪 → 深拷贝快照当前 trellis 文档（含 root/views/-floating）→
  //       开「专用靠左窗格」：placement {beside: 首个 docked 面板, edge:'left', share:0.3}
  //       （trellis open 的显式 beside 落位，比模糊的 'side' 确定）。
  // OFF = setDocument 还原快照（trellis getDocument/setDocument，dist/index.d.ts:539/544）。
  // ws 5 秒未就绪 → dotsModeAbort()（翻回 OFF + 还原我们折的侧栏）。
  const dotsSnapRef = useRef<unknown>(null)
  const dotsPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dotsCalRef = useRef<ReturnType<typeof setInterval> | null>(null) /* NT1011H：校准计时器句柄，OFF 时清 */
  /* NT1011K（2026-10-14）：暴露「当前开着哪些 session 视图」给 2dlist 引擎对账——
     关 tab 后蓝虚光环同步摘除。读 trellis 文档收 session 视图的 params.sid。 */
  useEffect(() => {
    const w = window as unknown as { __ntSessionTabs?: () => string[] | null; __ntDocDump?: () => unknown; __ntOpenSessionTab?: (sid: string) => boolean }
    w.__ntSessionTabs = () => {
      try {
        const doc = wsRef.current?.getDocument() as any
        const sids: string[] = []
        const walk = (n: any): void => {
          if (!n || typeof n !== 'object') return
          if (n.kind === 'panel') {
            for (const v of n.views ?? []) {
              if (typeof v === 'string') continue
              if (v?.type === 'session' && typeof v?.params?.sid === 'string') sids.push(v.params.sid)
            }
            return
          }
          for (const c of n.children ?? []) walk(c)
          if (n.child) walk(n.child)
        }
        walk(doc?.root)
        return sids
      } catch { return null }
    }
    /* 诊断：dump trellis 文档原文（查 session 视图真实形状；随对账功能一起清理） */
    w.__ntDocDump = () => {
      try { return wsRef.current?.getDocument() ?? null } catch { return null }
    }
    /* NT1011N（2026-10-14 主人拍板）：2dlist 双击开会话的受控落位——
       显式 open 进「第一个不含 dots 的面板」（正常工作区），绝不落 dots 窗格及邻近；
       没有非 dots 面板（stage 全空）时才用默认落位（trellis 会建新面板，也不挨 dots）。 */
    w.__ntOpenSessionTab = (sid: string) => {
      try {
        const ws = wsRef.current
        if (!ws) return false
        const doc = ws.getDocument() as any
        const panels: string[] = []
        const walk = (n: any): void => {
          if (!n || typeof n !== 'object') return
          if (n.kind === 'panel') {
            const hasDots = (n.views ?? []).some((v: any) => (typeof v === 'string' ? /^dots-/.test(v) : v?.type === 'dots'))
            if (!hasDots) panels.push(String(n.id))
            return
          }
          for (const c of n.children ?? []) walk(c)
          if (n.child) walk(n.child)
        }
        walk(doc?.root)
        const placement: any = panels.length ? { into: panels[0] } : undefined
        ws.open('session', { params: { sid }, reuse: 'params', ...(placement ? { placement } : {}) } as never)
        return true
      } catch { return false }
    }
    return () => { delete w.__ntSessionTabs; delete w.__ntDocDump; delete w.__ntOpenSessionTab }
  }, [])
  /* NT1011J（2026-10-14 主人拍板）：漂移自动取证——ON/OFF/宽度突变(>40px)时自动把
     weights+视觉宽写 console 与 localStorage('nt2dlist.diaglog'，环形 50 条)，主人零动作 */
  const dotsLastWRef = useRef<number | null>(null)
  const dotsDiag = useCallback((event: string) => {
    try {
      const ws = wsRef.current
      const el = wrapRef.current?.querySelector<HTMLElement>('#ntDotsRoot')
      const w = el ? Math.round(el.getBoundingClientRect().width) : null
      const doc = ws ? (ws.getDocument() as any) : null
      const weights: number[] = []
      const walk = (n: any): void => {
        if (!n || typeof n !== 'object') return
        if (n.kind === 'split' && Array.isArray(n.weights)) weights.push(...n.weights.map((x: number) => Number(x.toFixed(3))))
        for (const c of n.children ?? []) walk(c)
        if (n.child) walk(n.child)
      }
      walk(doc?.root)
      const rec = { t: new Date().toISOString().slice(11, 23), event, w, weights }
      console.debug('[nt2d][diag]', JSON.stringify(rec))
      const arr: unknown[] = JSON.parse(localStorage.getItem('nt2dlist.diaglog') ?? '[]')
      arr.push(rec)
      localStorage.setItem('nt2dlist.diaglog', JSON.stringify(arr.slice(-50)))
      /* NT1011J：跨实例统一落盘——2dlist host 半 diag sink（127.0.0.1:3095）追加 ~/.dsh/nt2dlist-diag.jsonl；
         缺席/多实例端口冲突时静默失败，localStorage 兜底仍在 */
      try {
        void fetch('http://127.0.0.1:3095/diag', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-token': 'nt2d-diag' },
          body: JSON.stringify({ origin: location.origin, ...rec }),
        }).catch(() => { /* sink 缺席：静默 */ })
      } catch { /* 取证失败不影响主流程 */ }
    } catch { /* 取证失败不影响主流程 */ }
  }, [])
  useEffect(() => {
    setDotsModeImpl((on) => {
      if (on) {
        if (dotsPollRef.current) clearInterval(dotsPollRef.current)
        /* NT1011H：每轮 ON 重置回弹样本/自愈标记——上一轮的样本不带本轮上下文，跨周期复用会弹回旧宽度 */
        dotsGoodDocRef.current = null
        dotsFixTriedRef.current = false
        let tries = 0
        dotsPollRef.current = setInterval(() => {
          /* NT1011H：点火前复查模式——快开快关时 OFF 先到（dotsSnapRef 还是 null、无从还原），
             此处若照常开窗会留下没校准的孤儿 dots 窗格（watchdog 因 mode OFF 全体早退，
             宽度失控缩不回——真机 750px 漂移的候选根源） */
          if (!isDotsMode()) { if (dotsPollRef.current) { clearInterval(dotsPollRef.current); dotsPollRef.current = null } return }
          const ws = wsRef.current
          if (!ws) {
            if (++tries >= 50) { // 保险丝：工作台没就绪 → 回退模式
              if (dotsPollRef.current) { clearInterval(dotsPollRef.current); dotsPollRef.current = null }
              dotsModeAbort()
            }
            return
          }
          if (dotsPollRef.current) { clearInterval(dotsPollRef.current); dotsPollRef.current = null }
          try {
            const doc = ws.getDocument()
            dotsSnapRef.current = JSON.parse(JSON.stringify(doc))
            // 首个 docked 面板（DFS：split 有 children，stage 有 child，panel 即命中）
            const firstPanel = (n: any): string | null => {
              if (!n || typeof n !== 'object') return null
              if (n.kind === 'panel') return String(n.id)
              for (const c of n.children ?? []) { const hit = firstPanel(c); if (hit) return hit }
              return n.child ? firstPanel(n.child) : null
            }
            const beside = firstPanel(doc?.root)
            ws.open('dots', {
              params: {},
              reuse: 'none',
              focus: true,
              placement: beside ? { beside, edge: 'left', share: 0.25 } : 'side',
            })
            /* NT1011F（主人拍板）：初始宽度校准到 DSH 原始侧栏宽（280px）。
               share 换算的分母与 trellis 内部不一致（实测 0.25→378px），比例法不可靠；
               等 #ntDotsRoot 挂载（200ms 轮询，最多 3s）后量实际视觉宽，按比例修权重。 */
            let calTries = 0
            const calTimer = setInterval(() => {
              try {
                const el2 = wrapRef.current?.querySelector<HTMLElement>('#ntDotsRoot')
                if (!el2) { if (++calTries > 15) clearInterval(calTimer); return }
                clearInterval(calTimer)
                /* NT1011G（2026-10-14 主人拍板方案 a）：web 端落位修正——dots 面板不在根 split
                   最左时重排 children+weights 到最左。桌面本来就落左（重排是空操作）；
                   只处理 dots 是根 split 直接 child 的情况，嵌套更深不动（防误伤桌面布局）。 */
                try {
                  const docL = JSON.parse(JSON.stringify(ws.getDocument())) as any
                  const dotsPanelId = (n: any): string | null => {
                    if (!n || typeof n !== 'object') return null
                    if (n.kind === 'panel') {
                      return (n.views ?? []).some((v: any) => (typeof v === 'string' ? /^dots-/.test(v) : v?.type === 'dots')) ? String(n.id) : null
                    }
                    for (const c of n.children ?? []) { const hit = dotsPanelId(c); if (hit) return hit }
                    return n.child ? dotsPanelId(n.child) : null
                  }
                  const pid = dotsPanelId(docL?.root)
                  const rL = docL?.root
                  if (pid && rL?.kind === 'split' && Array.isArray(rL.children) && rL.children.length > 1) {
                    const i = rL.children.findIndex((c: any) => c && String(c.id) === pid)
                    if (i > 0) {
                      const ch = [...rL.children]
                      /* trellis split 的 weights 与 children 等长（校准段 w[i] 同口径），换序必须同步换权 */
                      const w = Array.isArray(rL.weights) && rL.weights.length === ch.length ? [...rL.weights] : null
                      const [mv] = ch.splice(i, 1); ch.unshift(mv)
                      if (w) { const [mw] = w.splice(i, 1); w.unshift(mw) }
                      rL.children = ch
                      if (w) rL.weights = w
                      ws.setDocument(docL as never)
                      dotsGoodDocRef.current = null /* 重排后作废旧样本，防弹回右侧布局 */
                    }
                  }
                } catch { /* 重排失败：保持现状 */ }
                const cur = el2.getBoundingClientRect().width
                if (cur < 60 || Math.abs(cur - 280) < 14) return /* 已达标 */
                const doc2 = JSON.parse(JSON.stringify(ws.getDocument())) as any
                const hasDots = (n: any): boolean => {
                  if (!n || typeof n !== 'object') return false
                  if (n.kind === 'panel') return (n.views ?? []).some((v: any) => (typeof v === 'string' ? /^dots-/.test(v) : v?.type === 'dots'))
                  if (n.kind === 'split') return (n.children ?? []).some(hasDots)
                  if (n.kind === 'stage') return n.child ? hasDots(n.child) : false
                  return false
                }
                const findSplit = (n: any): { n: any; idx: number } | null => {
                  if (!n || typeof n !== 'object') return null
                  if (n.kind === 'split') {
                    const idx = (n.children ?? []).findIndex(hasDots)
                    if (idx >= 0 && n.axis === 'x') return { n, idx }
                    for (const c of n.children ?? []) { const hit = findSplit(c); if (hit) return hit }
                  } else if (n.kind === 'stage') { return n.child ? findSplit(n.child) : null }
                  return null
                }
                const hit = findSplit(doc2?.root)
                if (hit && Array.isArray(hit.n.weights)) {
                  const f = Math.max(0.4, Math.min(2.5, 280 / cur))
                  const w = hit.n.weights
                  const i = hit.idx
                  const ni = Math.max(0.08, (w[i] ?? 0.25) * f)
                  const rest = Math.max(0.05, 1 - ni)
                  const restSum = w.reduce((acc: number, v: number, j: number) => (j === i ? acc : acc + (v ?? 0)), 0) || 1
                  hit.n.weights = w.map((v: number, j: number) => (j === i ? ni : ((v ?? 0) / restSum) * rest))
                  ws.setDocument(doc2 as never)
                  dotsGoodDocRef.current = null /* 校准后作废旧样本，防弹回 378 旧布局 */
                }
              } catch { /* 校准失败：保持 0.25 档 */ }
              dotsDiag('cal') /* NT1011J */
            }, 200)
            dotsCalRef.current = calTimer /* NT1011H：登记句柄，OFF/卸载时清 */
          } catch { dotsModeAbort() }
        }, 100)
        return true
      }
      if (dotsPollRef.current) { clearInterval(dotsPollRef.current); dotsPollRef.current = null }
      /* NT1011H：OFF 必须停校准计时器——留着它会在还原后的布局上再写 setDocument，
         把 dots 布局写回去（宽度漂移/关不干净的候选根源） */
      if (dotsCalRef.current) { clearInterval(dotsCalRef.current); dotsCalRef.current = null }
      const ws = wsRef.current
      if (ws && dotsSnapRef.current) {
        try { ws.setDocument(dotsSnapRef.current as never) } catch { /* 还原失败：布局保持现状 */ }
      }
      dotsSnapRef.current = null
      dotsLastWRef.current = null
      dotsDiag('off-restore') /* NT1011J */
      return true
    })
    return () => {
      /* NT1011F 复核茬1：ON 期间卸载（如切回原生对话面板）→ 先尽力还原 trellis
         （快照还在就 setDocument），再 abort 翻回 OFF + 还原侧栏；否则模式卡 ON、
         侧栏卡折叠、重挂载后快照丢失还原不了。 */
      if (isDotsMode()) {
        const ws = wsRef.current
        if (ws && dotsSnapRef.current) {
          try { ws.setDocument(dotsSnapRef.current as never) } catch { /* 尽力还原 */ }
        }
        dotsSnapRef.current = null
        dotsModeAbort()
      }
      setDotsModeImpl(null)
      if (dotsPollRef.current) { clearInterval(dotsPollRef.current); dotsPollRef.current = null }
      if (dotsCalRef.current) { clearInterval(dotsCalRef.current); dotsCalRef.current = null }
    }
  }, [])

  // NT1011F 真机修订（主人反馈「最小缩放没有」）：trellis 的 ViewRules.minSize 只管
  // 「内容按 minSize 排版再缩小塞进小窗格」（scale<1，字跟着变小），divider 拖拽下限
  // 是写死的 PANEL_MIN={w:80}（dist layoutMetrics），做不出硬下限——minSize 已拆。
  // 改「软下限 + 松手弹回」：dots 窗格 <400px 且指针已松开 → setDocument 弹回最近一次
  // ≥400px 的布局（dots 保持打开）。拖动中不弹（指针按住时不干预，避免与 trellis 拖拽打架）。
  // 妥协：工作台初始就窄于 400px 时取不到合法样本，不弹（布局保留现状）。
  const DOTS_MIN_W = 280 // NT1011F（主人拍板）：= DSH 原始对话列表宽度（实测 hHd-Xa_root 280px）
  const dotsGoodDocRef = useRef<unknown>(null)
  const dotsPointerDownRef = useRef(false)
  const dotsFixTriedRef = useRef(false)
  const dotsHadViewRef = useRef(false)
  useEffect(() => {
    const down = () => { dotsPointerDownRef.current = true }
    const up = () => { dotsPointerDownRef.current = false }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    const tick = () => {
      if (!isDotsMode()) { dotsHadViewRef.current = false; return }
      const el = wrapRef.current?.querySelector<HTMLElement>('#ntDotsRoot')
      const ws = wsRef.current
      /* NT1011F：关 tab 自动还原——dots 模式 ON 时视图从 DOM 消失（手动点 x）＝
         用户离开点图：翻回 OFF + 还原侧栏。只在「曾出现过视图」后才判缺席，
         避免 ON 刚起步（窗格未挂）误判。 */
      if (!el) {
        if (dotsHadViewRef.current && !dotsPointerDownRef.current) {
          dotsHadViewRef.current = false
          dotsModeAbort()
        }
        return
      }
      dotsHadViewRef.current = true
      if (!ws) return
      /* NT1011F 真机二次修订：量「视觉宽」（rect，含 trellis 拖拽中的 scale transform）。
         布局宽（offsetWidth）在 trellis 缩放塞内容时不变（实测 480 vs 显示 376），
         会漏掉「视觉已缩到 400 以下、缩放卡死不回」的真实形态。 */
      const w = el.getBoundingClientRect().width
      /* NT1011J：宽度突变(>40px)自动取证 */
      if (dotsLastWRef.current !== null && Math.abs(w - dotsLastWRef.current) > 40) dotsDiag('jump')
      dotsLastWRef.current = w
      /* NT1011M 修（2026-10-14 紧急 bug：双击开的会话 tab 闪现即消失）：采样/回弹线与
         校准命中带（280±14）同口径——窗格校准后实测 278.9 恒 <280，旧硬 280 回弹线
         导致每个 tick 都 setDocument(旧好样本)，把刚开的会话视图一并回滚掉。
         改为 w≥266 采样为好样本、w<266 才回弹。 */
      if (w >= DOTS_MIN_W - 14) {
        if (el.dataset.ntGoodW !== String(Math.round(w))) {
          el.dataset.ntGoodW = String(Math.round(w))
          try { dotsGoodDocRef.current = JSON.parse(JSON.stringify(ws.getDocument())) } catch { /* 采样失败忽略 */ }
        }
      } else if (!dotsPointerDownRef.current) {
        if (dotsGoodDocRef.current) {
          try { ws.setDocument(dotsGoodDocRef.current as never) } catch { /* 弹回失败忽略 */ }
        } else if (!dotsFixTriedRef.current) {
          /* NT1011F 真机三次修订：持久化布局可能把 dots 钉在 <400（无合法样本可弹）。
             直接改布局文档权重：找到含 dots view 的 split，把 dots 侧顶到 ≥440px 当量。
             只试一次（失败不循环，避免与 trellis 打架）。 */
          dotsFixTriedRef.current = true
          try {
            const wbW = wrapRef.current?.offsetWidth || 0
            if (wbW > 600) {
              const doc = JSON.parse(JSON.stringify(ws.getDocument())) as any
              const hasDots = (n: any): boolean => {
                if (!n || typeof n !== 'object') return false
                if (n.kind === 'panel') return (n.views ?? []).some((v: any) => (typeof v === 'string' ? /^dots-/.test(v) : v?.type === 'dots'))
                if (n.kind === 'split') return (n.children ?? []).some(hasDots)
                if (n.kind === 'stage') return n.child ? hasDots(n.child) : false
                return false
              }
              const findSplit = (n: any): { n: any; idx: number } | null => {
                if (!n || typeof n !== 'object') return null
                if (n.kind === 'split') {
                  const idx = (n.children ?? []).findIndex(hasDots)
                  if (idx >= 0 && n.axis === 'x') return { n, idx }
                  for (const c of n.children ?? []) { const hit = findSplit(c); if (hit) return hit }
                } else if (n.kind === 'stage') { return n.child ? findSplit(n.child) : null }
                return null
              }
              const hit = findSplit(doc?.root)
              const target = Math.min(0.5, 300 / wbW)
              if (hit && Array.isArray(hit.n.weights)) {
                const w = hit.n.weights
                const i = hit.idx
                if ((w[i] ?? 0) < target) {
                  const rest = Math.max(0.05, 1 - target)
                  const restSum = w.reduce((acc: number, v: number, j: number) => (j === i ? acc : acc + (v ?? 0)), 0) || 1
                  hit.n.weights = w.map((v: number, j: number) => (j === i ? target : ((v ?? 0) / restSum) * rest))
                  ws.setDocument(doc as never)
                }
              }
            }
          } catch { /* 自愈失败：保持现状，下轮不再试 */ }
        }
      }
      /* NT1011H（2026-10-14 主人需求）：dots 面板独占——混进来的非 dots 视图驱逐到
         第一个无 dots 的面板（trellis 无面板级 accept 限制，行为上等价「拖不进」）。
         指针按住时不干预（避免与 trellis 拖拽打架，松手下一 tick 驱逐）。 */
      if (!dotsPointerDownRef.current && ws) {
        try {
          const docE = JSON.parse(JSON.stringify(ws.getDocument())) as any
          let dotsPanel: any = null
          let hostPanel: any = null
          const isDotsV = (v: any): boolean => (typeof v === 'string' ? /^dots-/.test(v) : v?.type === 'dots')
          const walk = (n: any): void => {
            if (!n || typeof n !== 'object') return
            if (n.kind === 'panel') {
              const hasD = (n.views ?? []).some(isDotsV)
              if (hasD && !dotsPanel) dotsPanel = n
              else if (!hasD && !hostPanel) hostPanel = n
              return
            }
            for (const c of n.children ?? []) walk(c)
            if (n.child) walk(n.child)
          }
          walk(docE?.root)
          if (dotsPanel && hostPanel && Array.isArray(dotsPanel.views) && dotsPanel.views.length > 1) {
            const keep: unknown[] = []
            const evict: unknown[] = []
            for (const v of dotsPanel.views) (isDotsV(v) ? keep : evict).push(v)
            if (evict.length) {
              dotsPanel.views = keep
              hostPanel.views = [...(hostPanel.views ?? []), ...evict]
              ws.setDocument(docE as never)
              dotsGoodDocRef.current = null /* 驱逐后作废旧样本 */
            }
          }
        } catch { /* 驱逐失败：下轮再试 */ }
      }
    }
    const t = setInterval(tick, 300)
    return () => {
      clearInterval(t)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
    }
  }, [])

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
    if (!retain) return <div className={s.pempty}>{nt('wb.sessionNotReady')}</div>
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
        fallback={TRACE_FALLBACK()}
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
        {/* NT1011F 真机三次修订：Workspace 挂载延迟到「tab 注册表安静 ≥800ms」。
            否则 storage 恢复布局时外部插件 tab（dots）类型未声明 → 恢复出占位僵尸 tab
            （标题在、内容空、关不掉，桌面实机实锤）。上限 2.5s 强制放行，不拖死启动。 */}
        {wsReady ? (
        <Workspace
          ref={wsRef}
          theme={hostTheme}
          navigation="free"
          storageKey={TRELLIS_STORAGE_KEY}
          version={1}
          tokens={hostTheme === 'dark'
            ? { ...TRELLIS_FONT_TOKENS, ...TRELLIS_DARK_TOKENS }
            : { ...TRELLIS_FONT_TOKENS, ...TRELLIS_LIGHT_TOKENS }}
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
              return p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1) || nt('wb.tabFile')
            }}
            render={(v: any) => <FilePane path={v?.params?.path ?? ''} />}
          />
          {/* E32：内置浏览器（E40 双引擎：Desktop webview / Web iframe，不依赖宿主右栏） */}
          <ViewType
            id="web"
            title={(v: { params?: { url?: string } }) => {
              const u = v.params?.url ?? ''
              return u ? (u.replace(/^https?:\/\//, '').split('/')[0] || nt('wb.tabBrowser')) : nt('wb.tabBrowser')
            }}
            render={(v: any) => <WebPane url={v?.params?.url ?? ''} setParams={(patch) => v?.setParams?.(patch)} openWebTab={openInBrowser} />}
          />
          {/* NT1011B 二版 → 2026-10-13 拆分：huabu 点图 tab（组件由 2dlist 插件注册）；
              未注册时整个 ViewType 不声明（trellis children 声明件按序扫描，null 跳过） */}
          {dotsTab
            ? (
              <ViewType
                id="dots"
                title={() => dotsTab.title || nt('wb.tabDots')}
                icon={DotsTabIcon}
                render={() => <ExtTabPane tab={dotsTab} />}
                /* NT1011G（2026-10-14 web 实测）：不声明 minSize 时 trellis 默认仍把内容
                   按布局宽缩放进窄窗格（实测 280px 槽缩放 0.57）——canvas 引擎字号/按钮全被压小。
                   scaling:false = 内容按窗格实际尺寸排版，画布自适应（resizeCv 读 offsetWidth）。 */
                scaling={false}
              />
            )
            : null}
          <Stage empty={
            <div className={s.pempty}>
              {nt('wb.emptyHint')}
              <div style={{ marginTop: 6, color: 'var(--dsh-faint, #5b5854)' }}>
                {nt('wb.emptyNew')}
              </div>
              <div style={{ marginTop: 12 }}>
                <button className={s.webGo} onClick={() => wsRef.current?.open('web', { params: { url: '' }, reuse: false })}>
                  {nt('acc.openBrowser')}
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
        ) : (
          <div className={s.pempty}>{nt('wb.starting')}</div>
        )}
      </div>
      {/* E30：常驻挂载 + class 切宽，宽度/透明度过渡替代条件挂载（动画不再僵硬） */}
      <div className={s.wbRight + (artOpen ? ' ' + s.wbRightOn : '')} data-nt="wrightrail" aria-hidden={!artOpen}>
        <div className={s.hd}>
          <span>{nt('artifacts.title')}</span>
          <span className={s.hdRight}>
            <button className={s.icbtn} data-nt="artrclose" title={nt('wb.collapseRight')} onClick={() => artRail.set(false)}>
              <svg viewBox="0 0 24 24" className={s.ic}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </span>
        </div>
        <ArtifactsPanel mode="global" />
      </div>
    </div>
  )
}
