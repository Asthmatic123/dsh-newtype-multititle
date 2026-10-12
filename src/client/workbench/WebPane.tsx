/**
 * 浏览器窗格（E32 → E40 双引擎）：工作台内置内部浏览器。
 *
 * E40（2026-10-10）：Desktop 态接 `globalThis.dshDesktop.browser` 桥 + Electron
 * <webview>——不受 X-Frame-Options 约束，大站不再白屏。协议照抄官方
 * dsh-client-ui-sidebar-browser（只读查证 2026-10-10，05 §E40）：
 *   acquire(workspace) → {lease, partition}
 *   webview 五属性：name=lease / partition / allowpopups / src=about:blank#<lease>
 *   dom-ready → loadURL(真 URL)；onOpenRequested(lease, cb) 收 popup
 *   render-process-gone / destroyed → release + error 态，重试时重新 acquire
 * 无桥（web 版 / 协议不符 / acquire 失败）→ 回落 iframe（XFO 限制同官方）
 * + 「外部打开」按钮兜底。
 *
 * 保活口径：隐藏不卸载（卸载 = release，guest 被主进程销毁）；trellis 若在
 * tab 隐藏时 unmount，重挂会按 params.url 重载——与 iframe 行为一致。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import s from '../newtype.module.css'

const normalize = (raw: string): string => {
  const t = raw.trim()
  if (!t) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t
  return `http://${t}`
}

/* —— dshDesktop.browser 桥：字段最小集（口径 = 官方 lib/types/types.d.ts:6-22） —— */
interface NtBrowserReservation { lease: string; partition: string }
interface NtBrowserBridge {
  acquire(workspace: string): Promise<NtBrowserReservation>
  release(lease: string): Promise<void>
  onOpenRequested(lease: string, listener: (url: string) => void): () => void
}
/** 探测 Desktop 桥：protocolVersion===1 才认（同官方 client.js:1597-1598）。 */
function desktopBridge(): NtBrowserBridge | null {
  const c = (globalThis as unknown as { dshDesktop?: { protocolVersion?: number; browser?: NtBrowserBridge } }).dshDesktop
  return c?.protocolVersion === 1 && c.browser ? c.browser : null
}

/** 所有自绘 web tab 共用一个存储账户（同官方 cwd 粒度；key 只要进程内稳定即可）。 */
const WORKSPACE_KEY = 'cwd:dsh-newtype-workbench'

interface EngineState {
  lease?: string
  element?: HTMLElement
  ready: boolean
  pending?: string
}

/**
 * webview 引擎：挂载时 acquire + 建元素 + 引导；卸载时 release。
 * URL 变化走 pending 队列（ready 前只记账，dom-ready 后 loadURL——同官方）。
 */
function WebviewEngine(props: {
  url: string
  bridge: NtBrowserBridge
  onPopup: (url: string) => void
  onFailed: (msg: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const st = useRef<EngineState>({ ready: false })
  // 回调经 ref 取最新，避免 effect [] 里闭包住旧 props
  const onPopupRef = useRef(props.onPopup)
  onPopupRef.current = props.onPopup
  const onFailedRef = useRef(props.onFailed)
  onFailedRef.current = props.onFailed

  useEffect(() => {
    const bridge = props.bridge
    let dead = false
    let unsubOpen: (() => void) | undefined
    let leaseHeld: string | undefined
    const drop = async () => {
      const lease = leaseHeld
      leaseHeld = undefined
      st.current = { ready: false }
      if (lease) { try { await bridge.release(lease) } catch { /* guest 已亡：忽略 */ } }
    }
    ;(async () => {
      let res: NtBrowserReservation
      try {
        res = await bridge.acquire(WORKSPACE_KEY)
      } catch (e) {
        if (!dead) onFailedRef.current(`租约获取失败：${String(e)}`)
        return
      }
      if (dead) { void bridge.release(res.lease); return }
      leaseHeld = res.lease
      st.current.lease = res.lease
      const el = document.createElement('webview')
      el.setAttribute('name', res.lease)
      el.setAttribute('partition', res.partition)
      el.setAttribute('allowpopups', '')
      el.setAttribute('src', 'about:blank#' + res.lease)
      el.style.width = '100%'
      el.style.height = '100%'
      ;(el.style as CSSStyleDeclaration & { border: string }).border = '0'
      st.current.element = el
      // popup / 新窗口 → 交上层（工作台开新 web tab）
      unsubOpen = bridge.onOpenRequested(res.lease, (url) => { if (!dead) onPopupRef.current(url) })
      // dom-ready → 引导完成，换真地址（同官方 L1175-1219）。
      // E40c 修复：pending 取用即清空——否则每次 dom-ready 都重载同一 URL，
      // 无限刷新循环（主人真机实证：github 状态行 dom-ready/已加载 交替不停跳）。
      el.addEventListener('dom-ready', () => {
        st.current.ready = true
        const pending = st.current.pending
        st.current.pending = undefined
        if (pending) (el as unknown as { loadURL: (u: string) => void }).loadURL(pending)
      })
      // guest 进程死亡 → 释放 + error 态（同官方 L1207-1210）
      const onGone = () => {
        if (dead) return
        void drop()
        onFailedRef.current('浏览进程已退出')
      }
      el.addEventListener('render-process-gone', onGone)
      el.addEventListener('destroyed', onGone)
      // 主框架加载失败告警（保留）；did-attach / did-navigate 诊断日志已随探针清理撤除
      el.addEventListener('did-fail-load', (ev) => {
        const d = (ev as CustomEvent<{ errorCode?: number; errorDescription?: string; isMainFrame?: boolean }>).detail
        if (d?.isMainFrame === false) return
        console.warn('[dsh-newtype] webview did-fail-load', d?.errorCode, d?.errorDescription)
      })
      if (dead) return
      hostRef.current?.append(el)
      st.current.pending = props.url || undefined
    })()
    return () => {
      dead = true
      unsubOpen?.()
      const el = st.current.element
      el?.remove()
      void drop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 引擎每挂载周期只初始化一次；URL 变化走下方 effect
  }, [])

  // URL 变化：ready 则直接换页，否则记 pending 等 dom-ready
  useEffect(() => {
    const cur = st.current
    cur.pending = props.url || undefined
    if (cur.ready && props.url && cur.element) {
      (cur.element as unknown as { loadURL: (u: string) => void }).loadURL(props.url)
    }
  }, [props.url])

  return <div ref={hostRef} className={s.webFrame} data-nt="webview-host" />
}
export function WebPane(props: {
  url?: string
  setParams: (patch: Record<string, unknown>) => void
  /** E40：popup/新窗口 → 工作台开新 web tab（缺席时忽略） */
  openWebTab?: (url: string) => void
}) {
  const bridge = useMemo(desktopBridge, [])
  const [draft, setDraft] = useState(props.url ?? '')
  // E35：对话点链接 / 齿轮按钮从外部带 url 打开时，URL 栏跟着显示新地址
  useEffect(() => { setDraft(props.url ?? '') }, [props.url])
  // webview 引擎失败 → 本次会话内回落 iframe（重试 = 换 engineKey 重挂）
  const [engineFailed, setEngineFailed] = useState(false)
  const [engineKey, setEngineKey] = useState(0)
  const useWebview = bridge !== null && !engineFailed
  const go = (raw: string) => {
    const u = normalize(raw)
    if (u) props.setParams({ url: u })
  }
  const openExternal = (u: string) => { window.open(u, '_blank', 'noopener') }
  return (
    <div className={s.webPane}>
      <div className={s.webBar}>
        <input
          className={s.webUrl}
          value={draft}
          placeholder="输入地址，如 localhost:3080 或 example.com"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(draft) }}
          spellCheck={false}
        />
        <button className={s.webGo} onClick={() => go(draft)} title="转到">→</button>
        {props.url && (
          <button className={s.webGo} onClick={() => { if (props.url) openExternal(props.url) }} title="外部浏览器打开">
            ↗
          </button>
        )}
        {props.url && (
          <button className={s.webGo} onClick={() => props.setParams({ url: '' })} title="关闭页面">
            ✕
          </button>
        )}
      </div>
      {props.url ? (
        useWebview && bridge ? (
          <WebviewEngine
            key={engineKey}
            url={props.url}
            bridge={bridge}
            onPopup={(u) => props.openWebTab?.(normalize(u))}
            onFailed={(msg) => {
              setEngineFailed(true)
              console.warn('[dsh-newtype] webview engine fallback to iframe:', msg)
            }}
          />
        ) : (
          <iframe className={s.webFrame} src={props.url} title={props.url} />
        )
      ) : (
        <div className={s.pempty}>
          输入地址打开页面
          {!bridge && <div style={{ marginTop: 8, opacity: 0.6 }}>web 版走 iframe，部分站点拒绝嵌入时用 ↗ 外部打开</div>}
        </div>
      )}
      {engineFailed && (
        <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, fontSize: 11, opacity: 0.65, padding: '4px 0' }}>
          webview 不可用已回落 iframe。
          <button className={s.webGo} style={{ marginLeft: 6 }} onClick={() => { setEngineFailed(false); setEngineKey((k) => k + 1) }}>
            重试 webview
          </button>
        </div>
      )}
    </div>
  )
}
