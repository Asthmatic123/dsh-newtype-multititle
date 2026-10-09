/**
 * trellis accessory 位的三件套（D15 落地，对应 demo v4 交互）：
 *  ① OpenInMenu   —— 原版 "Open In..." 同款：用外部应用打开当前工作区目录。
 *                    真机数据源 = dsh-host-open-in-app 的 catalog 路由（探测/图标/启动）；
 *                    本轮先上 UI 骨架 + 静态白名单，接路由是独立小步（05 待办）。
 *  ② GearMenu     —— 会话功能：对话/轨迹切换（view.setParams，随布局持久化）、
 *                    当前模式行、下载对话日志（占位，接宿主 transcript 后启用）。
 *  ③ RightbarToggle —— 宿主右栏开关：ctx.layout.openRightbar/closeRightbar。
 *                    右栏全局共用一个，内容跟随聚焦窗格会话（原版架构）。
 *
 * accessory 挂点 = trellis per-surface 的 tab 条右端（每窗格一份）；
 * 菜单必须 portal 到 body —— tabbar overflow:hidden + .trellis contain:strict 双重裁剪（demo 实证）。
 */
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { WorkspaceHandle } from '@danfessler/trellis-react'

/* ---------- 通用图标 ---------- */
/* 尺寸对齐 DSH 原版侧栏图标：16×16 · strokeWidth 1（2026-10-09 主人要求，探针实测原版口径） */
const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
function Ico(props: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size ?? 16} height={props.size ?? 16} style={{ ...ic, flex: 'none', display: 'block' }} aria-hidden="true">
      <path d={props.d} />
    </svg>
  )
}
const D_FOLDER = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'
const D_GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
const D_DOWN = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'
const D_SWAP = 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4'
const D_RBAR = 'M3 5h18v14H3zM15 5v14'
const D_GLOBE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18'

/* ---------- 主题调色板（2026-10-09 浅色联动） ----------
 * 宿主并不定义 --dsh-* 变量（探针实证），插件 UI 一直靠 fallback 深色在撑。
 * light/dark 两套值由 WorkbenchView 按 hostTheme 注入：深色 = 原 fallback 值，
 * 浅色 = 宿主浅色实测（bg #ffffff / 侧栏 #f9fafb / 文字 #0f1115 / 边 rgba(0,0,0,.12)）。
 * portal 到 body 的菜单拿不到 [data-nt=wb] 上的变量，portal 容器也要带一份（props.vars）。 */
export const NT_VARS: Record<'light' | 'dark', Record<string, string>> = {
  dark: {
    '--dsh-bg': '#131110',
    '--dsh-surface': '#1e1c1a',
    '--dsh-overlay': '#1b1917',
    '--dsh-line': '#262422',
    '--dsh-text': '#f4f2f0',
    '--dsh-text-secondary': '#86827e',
    '--dsh-primary': '#69a1e8',
    '--dsh-faint': '#5b5854',
  },
  light: {
    '--dsh-bg': '#ffffff',
    '--dsh-surface': '#eef0f3',
    '--dsh-overlay': '#f9fafb',
    '--dsh-line': 'rgba(0, 0, 0, 0.12)',
    '--dsh-text': '#0f1115',
    '--dsh-text-secondary': '#5a6472',
    '--dsh-primary': '#3a6ff7',
    '--dsh-faint': '#9aa1ab',
  },
}

/** 弹出菜单通用壳：fixed 定位（防 tabbar/contain 裁剪）+ hover 延迟关闭 */
function usePop() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const closeT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const arm = () => { clearTimeout(closeT.current); closeT.current = setTimeout(() => setOpen(false), 260) }
  const cancel = () => clearTimeout(closeT.current)
  const show = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ x: r.right, y: r.bottom + 6 })
    cancel(); setOpen(true)
  }
  return { open, setOpen, pos, btnRef, arm, cancel, show }
}

/* ---------- ① Open In…（接宿主 dsh-host-open-in-app 真路由，2026-10-09） ----------
 * GET /open-in-app/apps → { apps: id[] }（宿主探测到的才在列表里，探测不到不显示）；
 * POST /open-in-app/open { app, path } → 用该应用打开目录（path = 当前窗格会话的 cwd）。
 * 应用 id 口径来自 dsh-client-ui-open-in-app 的 APP_LABEL_KEY；分类/中文名是我们自己的映射。
 */
const APP_META: Record<string, { name: string; cat: string }> = {
  vscode: { name: 'VS Code', cat: '编辑器 · IDE' },
  vscodeinsiders: { name: 'VS Code Insiders', cat: '编辑器 · IDE' },
  cursor: { name: 'Cursor', cat: '编辑器 · IDE' },
  windsurf: { name: 'Windsurf', cat: '编辑器 · IDE' },
  zed: { name: 'Zed', cat: '编辑器 · IDE' },
  sublimetext: { name: 'Sublime Text', cat: '编辑器 · IDE' },
  windowsterminal: { name: 'Windows Terminal', cat: '终端' },
  warp: { name: 'Warp', cat: '终端' },
  explorer: { name: '文件资源管理器', cat: '文件管理器' },
  filemanager: { name: '文件管理器', cat: '文件管理器' },
  finder: { name: 'Finder', cat: '文件管理器' },
}
const CAT_ORDER = ['编辑器 · IDE', '终端', '文件管理器']
const OPENIN_CHOICE_KEY = 'dsh-newtype.openin.choice'

async function fetchAppIds(): Promise<string[]> {
  const res = await fetch('/open-in-app/apps', { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const payload = await res.json() as { apps?: unknown }
  return Array.isArray(payload.apps) ? payload.apps.filter((x): x is string => typeof x === 'string') : []
}

export function OpenInMenu(props: { getCwd?: () => string | null; vars?: Record<string, string> }) {
  const pop = usePop()
  const [ids, setIds] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remembered, setRemembered] = useState<string>(() => {
    try { return localStorage.getItem(OPENIN_CHOICE_KEY) ?? '' } catch { return '' }
  })
  const load = () => {
    if (ids || failed) return
    fetchAppIds().then(setIds).catch(() => setFailed(true))
  }
  const pick = async (id: string) => {
    try { localStorage.setItem(OPENIN_CHOICE_KEY, id) } catch { /* 配额满可弃 */ }
    setRemembered(id)
    const path = props.getCwd?.()
    if (!path) { pop.setOpen(false); return }
    setBusy(true)
    try {
      const res = await fetch('/open-in-app/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: id, path }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      pop.setOpen(false)
    } catch { /* 启动失败：菜单留在原地让用户重试/换应用 */ } finally { setBusy(false) }
  }
  const groups = CAT_ORDER
    .map((cat) => ({ cat, apps: (ids ?? []).filter((id) => APP_META[id]?.cat === cat) }))
    .filter((g) => g.apps.length > 0)
  return (
    <div className="nt-accwrap" onMouseLeave={pop.arm} onMouseEnter={() => { pop.cancel(); load() }}>
      <button
        ref={pop.btnRef}
        className={pop.open ? 'nt-abtn on' : 'nt-abtn'}
        title={remembered && APP_META[remembered] ? `用「${APP_META[remembered].name}」打开会话目录` : 'Open In… · 打开会话目录'}
        onMouseEnter={() => { pop.show(); load() }}
        onClick={() => (pop.open ? pop.setOpen(false) : pop.show())}
      >
        <Ico d={D_FOLDER} />
      </button>
      {pop.open && createPortal(
        <div className="nt-menu" style={{ position: 'fixed', top: pop.pos.y, left: Math.max(8, pop.pos.x - 190), ...(props.vars ?? {}) }} onMouseEnter={pop.cancel} onMouseLeave={pop.arm}>
          <div className="nt-mi static">在以下应用中打开会话目录</div>
          {failed && <div className="nt-mi static">宿主未提供打开服务</div>}
          {!failed && ids !== null && groups.length === 0 && <div className="nt-mi static">未探测到可用应用</div>}
          {groups.map((g) => (
            <div key={g.cat} className="nt-cat">
              <div className="nt-catname">{g.cat}</div>
              {g.apps.map((id) => (
                <button key={id} className={'nt-mi' + (id === remembered ? ' sel' : '')} disabled={busy} onClick={() => { void pick(id) }}>
                  <Ico d={D_FOLDER} />{APP_META[id]?.name ?? id}{id === remembered && <span className="nt-mk">记住</span>}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ---------- ② 齿轮：对话/轨迹切换 · 当前模式 · 下载日志 ---------- */
export function GearMenu(props: {
  /** trellis view 句柄：setParams 切对话/轨迹（params 随布局持久化） */
  setParams: (patch: Record<string, unknown>) => void
  mode: 'chat' | 'trace'
  /** 浅色联动：portal 菜单容器上的 --dsh-* 变量 */
  vars?: Record<string, string>
}) {
  const pop = usePop()
  const mode = props.mode
  return (
    <div className="nt-accwrap" onMouseLeave={pop.arm} onMouseEnter={pop.cancel}>
      <button
        ref={pop.btnRef}
        className={pop.open ? 'nt-abtn on' : 'nt-abtn'}
        title="会话功能"
        onMouseEnter={pop.show}
        onClick={() => (pop.open ? pop.setOpen(false) : pop.show())}
      >
        <Ico d={D_GEAR} />
      </button>
      {pop.open && createPortal(
        <div className="nt-menu" style={{ position: 'fixed', top: pop.pos.y, left: Math.max(8, pop.pos.x - 190), ...(props.vars ?? {}) }} onMouseEnter={pop.cancel} onMouseLeave={pop.arm}>
          <button className="nt-mi" onClick={() => { pop.setOpen(false); props.setParams({ mode: mode === 'chat' ? 'trace' : 'chat' }) }}>
            <Ico d={D_SWAP} />切换到{mode === 'chat' ? '轨迹' : '对话'}
          </button>
          <div className="nt-mi static">当前模式：{mode === 'chat' ? '对话 · 标准' : '轨迹 · 标准'}</div>
          <button className="nt-mi" title="接宿主 transcript 导出后启用">
            <Ico d={D_DOWN} />下载对话日志
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ---------- ③ 右栏开关（宿主 ctx.layout） ---------- */
export function RightbarToggle(props: {
  open: boolean
  onOpen: () => void
  onClose: () => void
}) {
  return (
    <button
      className={props.open ? 'nt-abtn on' : 'nt-abtn'}
      title={props.open ? '收起右侧边栏' : '打开右侧边栏'}
      aria-label={props.open ? '收起右侧边栏' : '打开右侧边栏'}
      onClick={() => (props.open ? props.onClose() : props.onOpen())}
    >
      <Ico d={D_RBAR} />
    </button>
  )
}

/* ---------- ④ 浏览器按钮（E32：工作台内置浏览器 tab） ---------- */
export function BrowserButton(props: { onOpen: () => void }) {
  return (
    <button className="nt-abtn" title="打开浏览器" aria-label="打开浏览器" onClick={props.onOpen}>
      <Ico d={D_GLOBE} />
    </button>
  )
}

/** accessory 行的总装：view 句柄 + 右栏服务由 WorkbenchView 注入 */
export function SessionAccessories(props: {
  view: {
    params?: Record<string, unknown>
    setParams: (patch: Record<string, unknown>) => void
  }
  ws: WorkspaceHandle | null
  onOpenBrowser?: () => void
  /** OpenIn 用：当前窗格会话的 cwd（宿主 open 路由要绝对目录） */
  getCwd?: () => string | null
  /** 浅色联动：注入到 portal 菜单容器上的 --dsh-* 变量（WorkbenchView 按 hostTheme 给） */
  vars?: Record<string, string>
}) {
  const mode = props.view.params?.mode === 'trace' ? 'trace' : 'chat'
  return (
    <div className="nt-accrow">
      <OpenInMenu getCwd={props.getCwd} vars={props.vars} />
      <GearMenu setParams={props.view.setParams} mode={mode as 'chat' | 'trace'} vars={props.vars} />
      {props.onOpenBrowser && <BrowserButton onOpen={props.onOpenBrowser} />}
    </div>
  )
}
