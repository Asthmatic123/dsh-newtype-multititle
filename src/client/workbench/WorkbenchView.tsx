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
import { openTabBus, artRail, takePendingSession } from '../bus.ts'
import { titleOf as hostPageTitleOf, noteActiveSession, retainedByMainView } from '../pages.ts'
import { SessionPane } from './SessionPane.tsx'
import { HostConversationPane } from './HostConversationPane.tsx'
import { PagePane } from './PagePane.tsx'
import { FilePane } from './FilePane.tsx'
import { WebPane } from './WebPane.tsx'
import { ArtifactsPanel } from './ArtifactsPanel.tsx'
import { SessionAccessories, NT_VARS } from './SessionAccessories.tsx'

export interface WorkbenchProps {
  /** 会话 scope 标准道具；用于空布局时预置当前会话 */
  sessionId?: string
  openSession?: (id: string) => void
  retainSession?: (id: string) => NtSessionRef | null
  getSessionsList?: (() => NtSnap<NtSessionListState> | null) | null
  /** 框架装的会话域道具（D14-R1 换来的），用于把窗格绑到显式会话引用 */
  SessionProvider?: NtSessionProviderComponent
  /** factory 渲染面（D14-R2），宿主 conversation.content 用它实例化原版对话框 */
  renderFactorySlot?: NtRenderFactorySlot
  /** 宿主右栏开关（D15 accessory），sharedInject 注入 */
  openRightbar?: () => void
  closeRightbar?: () => void
  /** E31c 侧边栏按钮：better-sidebar 底部文件面板，缺席回落产出物栏 */
  openSidePanel?: (sid?: string) => void
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

/** 轨迹降级文案（模块级常量：renderSession 身份稳定的一部分） */
const TRACE_FALLBACK = <div className={s.pempty}>轨迹视图不可用（宿主未提供 trajectory 视图）</div>

/**
 * 找「当前正在看的 session tab」：按布局 DFS 找第一个面板，其选中视图是 session。
 * 找不到（当前选中的是文件/浏览器 tab）→ 返回 null，调用方回落开新 tab。
 */
function focusedSessionViewId(ws: any): string | null {
  try {
    const doc = ws.getDocument?.()
    const views = doc?.views ?? {}
    let hit: string | null = null
    const walk = (node: any): void => {
      if (hit || !node) return
      if (node.kind === 'panel') {
        const vid = node.selected
        if (vid && views[vid]?.type === 'session') hit = vid
        return
      }
      if (node.kind === 'stage') return walk(node.child)
      if (node.kind === 'split') for (const c of node.children ?? []) { walk(c); if (hit) return }
    }
    walk(doc?.root)
    return hit
  } catch { return null }
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
    () => (id: string) => byId[id]?.displayTitle ?? byId[id]?.title ?? id.slice(0, 8),
    [byId],
  )
  const mainViewId = retainedByMainView(list?.ids, list?.byId)
  // 图页归属口径同步（root scope 无 sessionId，按 retainedBy 判定；口径退化影响仅图页侧栏匹配）
  noteActiveSession(mainViewId)

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

  // 打开请求总线：图页（page:）/文件（file:）/会话 → ws.open 成 tab。
  // 会话分支（2026-10-09 主人需求）：左栏点行 = 当前会话 tab 原地换内容（setParams 换 sid，
  // 不新开 tab、不退回原版）；没有正在看的 session tab 时才回落开新 tab。
  // 拖拽进来的会话仍走 open（拖到边缘 = 分栏手势，语义不同）。
  useEffect(() => openTabBus.sub((tabId) => {
    const ws = wsRef.current
    if (!ws) return
    try {
      if (tabId.startsWith('page:')) ws.open('page', { params: { pid: tabId.slice(5) }, reuse: 'params' })
      else if (tabId.startsWith('file:')) ws.open('file', { params: { path: tabId.slice(5) }, reuse: 'params' })
      else {
        const cur = focusedSessionViewId(ws)
        if (cur) {
          ws.setParams(cur, { sid: tabId })
          ws.select(cur)
          ws.focus(cur)
        } else {
          ws.open('session', { params: { sid: tabId }, reuse: 'params' })
        }
      }
    } catch { /* 布局服务未就绪 */ }
  }), [])

  // E33b：挂载后消化待开会话（startSession 劫持跨重挂载的交付通道）。
  // wsRef 由 trellis useImperativeHandle 异步就绪 → 轮询等它。
  useEffect(() => {
    const sid = takePendingSession()
    if (!sid) return
    let tries = 0
    const t = setInterval(() => {
      const ws = wsRef.current
      if (!ws) return
      clearInterval(t)
      try {
        ws.open('session', { params: { sid }, reuse: 'params' })
      } catch { /* 布局服务未就绪 */ }
    }, 200)
    return () => clearInterval(t)
  }, [])

  /* 拖拽桥（D15）：宿主行 HTML5 DnD → ws.open；trellis 自家 tab 拖拽照走 pointer 手势，互不干扰 */
  const onDragOver = (e: React.DragEvent) => {
    const t = e.dataTransfer?.types
    if (t && (t.includes('application/x-dsh-session') || t.includes('text/plain'))) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDropHot(true)
    }
  }
  const onDragLeave = (e: React.DragEvent) => {
    const to = e.relatedTarget as Node | null
    if (!to || !wrapRef.current?.contains(to)) setDropHot(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropHot(false)
    const sid = e.dataTransfer?.getData('application/x-dsh-session') || e.dataTransfer?.getData('text/plain')
    if (sid) {
      try { wsRef.current?.open('session', { params: { sid }, reuse: 'params' }) } catch { /* 未就绪 */ }
    }
  }

  // —— 卡顿治理②：动态数据（byId）走 ref，renderSession 身份恒定，
  //    配合 HostConversationPane 的 React.memo（自定义比较器），列表 emit 不再波及窗格子树 ——
  const byIdRef = useRef(byId)
  byIdRef.current = byId

  /** view 内容：mode 切换（对话/轨迹，齿轮 setParams；params 随 trellis 布局持久化） */
  const renderSession = useCallback((view: {
    params?: { sid?: string; mode?: string }
    setParams: (patch: Record<string, unknown>) => void
  }) => {
    const sid = view.params?.sid ?? ''
    const mode = view.params?.mode === 'trace' ? 'trace' : 'chat'
    const retain = props.retainSession
    if (!retain) return <div className={s.pempty}>会话服务未就绪</div>
    if (mode === 'trace') {
      return (
        <HostConversationPane
          sessionId={sid}
          viewName="trajectory"
          retainSession={retain}
          SessionProvider={props.SessionProvider}
          renderFactorySlot={props.renderFactorySlot}
          fallback={TRACE_FALLBACK}
        />
      )
    }
    return (
      <HostConversationPane
        sessionId={sid}
        blank={!!byIdRef.current[sid]?.blank}
        retainSession={retain}
        SessionProvider={props.SessionProvider}
        renderFactorySlot={props.renderFactorySlot}
        fallback={<SessionPane sessionId={sid} retainSession={retain} />}
      />
    )
  }, [props.retainSession, props.SessionProvider, props.renderFactorySlot])

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
                view={v}
                ws={wsRef.current}
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
          {/* E32：内置浏览器（自绘 URL 栏 + iframe，不依赖宿主右栏） */}
          <ViewType
            id="web"
            title={(v: { params?: { url?: string } }) => {
              const u = v.params?.url ?? ''
              return u ? (u.replace(/^https?:\/\//, '').split('/')[0] || '浏览器') : '浏览器'
            }}
            render={(v: any) => <WebPane url={v?.params?.url ?? ''} setParams={(patch) => v?.setParams?.(patch)} />}
          />
          <Stage empty={
            <div className={s.pempty}>
              把左侧会话拖进来 · 拖 tab 到边缘分栏 · 双击 tab 条聚焦
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
