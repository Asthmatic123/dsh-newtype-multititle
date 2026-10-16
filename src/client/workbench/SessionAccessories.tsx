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
import { nt, useT } from '../i18n.ts'
import type { NewTypeKey } from '../i18n.ts'

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
 * 应用 id 口径来自 dsh-client-ui-open-in-app 的 APP_LABEL_KEY；cat 用规范 id（i18n 后
 * 排序/分组不能押在文案上），显示名走 name（固定名）或 nameKey（本地化名）。
 */
type NtAppCat = 'editor' | 'terminal' | 'files'
const APP_META: Record<string, { name?: string; nameKey?: NewTypeKey; cat: NtAppCat }> = {
  vscode: { name: 'VS Code', cat: 'editor' },
  vscodeinsiders: { name: 'VS Code Insiders', cat: 'editor' },
  cursor: { name: 'Cursor', cat: 'editor' },
  windsurf: { name: 'Windsurf', cat: 'editor' },
  zed: { name: 'Zed', cat: 'editor' },
  sublimetext: { name: 'Sublime Text', cat: 'editor' },
  windowsterminal: { name: 'Windows Terminal', cat: 'terminal' },
  warp: { name: 'Warp', cat: 'terminal' },
  explorer: { nameKey: 'acc.app.explorer', cat: 'files' },
  filemanager: { nameKey: 'acc.app.fileManager', cat: 'files' },
  finder: { name: 'Finder', cat: 'files' },
}
const CAT_ORDER: readonly NtAppCat[] = ['editor', 'terminal', 'files']
const CAT_LABEL: Record<NtAppCat, NewTypeKey> = {
  editor: 'acc.cat.editor',
  terminal: 'acc.cat.terminal',
  files: 'acc.cat.files',
}
const OPENIN_CHOICE_KEY = 'dsh-newtype.openin.choice'

async function fetchAppIds(): Promise<string[]> {
  const res = await fetch('/open-in-app/apps', { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const payload = await res.json() as { apps?: unknown }
  return Array.isArray(payload.apps) ? payload.apps.filter((x): x is string => typeof x === 'string') : []
}

function OpenInMenu(props: { getCwd?: () => string | null; vars?: Record<string, string> }) {
  const pop = usePop()
  const t = useT()
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
  const appName = (id: string): string => {
    const m = APP_META[id]
    return m?.name ?? (m?.nameKey ? t(m.nameKey) : id)
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
        title={remembered && APP_META[remembered] ? t('acc.openWith', { name: appName(remembered) }) : t('acc.openIn')}
        onMouseEnter={() => { pop.show(); load() }}
        onClick={() => (pop.open ? pop.setOpen(false) : pop.show())}
      >
        <Ico d={D_FOLDER} />
      </button>
      {pop.open && createPortal(
        <div className="nt-menu" style={{ position: 'fixed', top: pop.pos.y, left: Math.max(8, pop.pos.x - 190), ...(props.vars ?? {}) }} onMouseEnter={pop.cancel} onMouseLeave={pop.arm}>
          <div className="nt-mi static">{t('acc.openInHeader')}</div>
          {failed && <div className="nt-mi static">{t('acc.noOpenService')}</div>}
          {!failed && ids !== null && groups.length === 0 && <div className="nt-mi static">{t('acc.noApps')}</div>}
          {groups.map((g) => (
            <div key={g.cat} className="nt-cat">
              <div className="nt-catname">{t(CAT_LABEL[g.cat])}</div>
              {g.apps.map((id) => (
                <button key={id} className={'nt-mi' + (id === remembered ? ' sel' : '')} disabled={busy} onClick={() => { void pick(id) }}>
                  <Ico d={D_FOLDER} />{appName(id)}{id === remembered && <span className="nt-mk">{t('acc.remembered')}</span>}
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

/* ---------- ② 齿轮：下载日志（对话/轨迹切换已上移 B10 迷你页签，2026-10-12） ---------- */
function GearMenu(props: {
  /** 浅色联动：portal 菜单容器上的 --dsh-* 变量 */
  vars?: Record<string, string>
}) {
  const pop = usePop()
  const t = useT()
  return (
    <div className="nt-accwrap" onMouseLeave={pop.arm} onMouseEnter={pop.cancel}>
      <button
        ref={pop.btnRef}
        className={pop.open ? 'nt-abtn on' : 'nt-abtn'}
        title={t('acc.category')}
        onMouseEnter={pop.show}
        onClick={() => (pop.open ? pop.setOpen(false) : pop.show())}
      >
        <Ico d={D_GEAR} />
      </button>
      {pop.open && createPortal(
        <div className="nt-menu" style={{ position: 'fixed', top: pop.pos.y, left: Math.max(8, pop.pos.x - 190), ...(props.vars ?? {}) }} onMouseEnter={pop.cancel} onMouseLeave={pop.arm}>
          <button className="nt-mi" title={t('acc.transcriptSoon')}>
            <Ico d={D_DOWN} />{t('acc.downloadLog')}
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ---------- ④ 浏览器按钮（E32：工作台内置浏览器 tab） ---------- */
export function BrowserButton(props: { onOpen: () => void }) {
  const t = useT()
  return (
    <button className="nt-abtn" title={t('acc.openBrowser')} aria-label={t('acc.openBrowser')} onClick={props.onOpen}>
      <Ico d={D_GLOBE} />
    </button>
  )
}

/* SessionAccessories 总装：view 句柄 + 右栏服务由 WorkbenchView 注入
 * （B10 起 mode 切换在窗格内迷你页签，gear 不再要 setParams/mode） */
export function SessionAccessories(props: {
  /** OpenIn 用：当前窗格会话的 cwd（宿主 open 路由要绝对目录） */
  getCwd?: () => string | null
  /** 浅色联动：注入到 portal 菜单容器上的 --dsh-* 变量（WorkbenchView 按 hostTheme 给） */
  vars?: Record<string, string>
  onOpenBrowser?: () => void
}) {
  return (
    <div className="nt-accrow">
      <OpenInMenu getCwd={props.getCwd} vars={props.vars} />
      <GearMenu vars={props.vars} />
      {props.onOpenBrowser && <BrowserButton onOpen={props.onOpenBrowser} />}
    </div>
  )
}
