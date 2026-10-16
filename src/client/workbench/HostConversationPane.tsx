/**
 * 窗格内的「DSH 原版对话框」（D14-R2）。
 *
 * 为什么这么写：
 *  宿主把对话区的可复用部分做成了 Component Factory `conversation.content`
 *  （scope: session-maybe），自带 scrollBody + composer 链 + widthControls；
 *  外部要拿一份完整原生对话框，正确姿势是 renderFactorySlot 而不是重画。
 *  宿主自己的先例：ui-subagent 的右栏子智能体对话面板
 *  （dsh-client-ui-subagent/lib/client.js:770-799）——同样的三段式：
 *  ① 外层 SessionProvider 显式绑 SessionReference
 *  ② renderFactorySlot('conversation.content', {variant:'embedded'}, {slots:{views}})
 *  ③ views 位置转发 renderSlot('conversation.session', {view:'chat'})
 *
 * 两个框架硬约束（都不是风格问题，踩了直接抛）：
 *  - SessionProvider 只在声明了非 root 作用域子槽的组件 props 上
 *    （ui-renderer client.js:732-740）→ WorkbenchView 的 children 声明是前提。
 *  - factory local slot `views` 是 strict session 作用域，未绑到会话时抛
 *    SlotAssemblyError（ui-renderer client.js:888）→ 每窗格必须显式绑 ref。
 *
 * phase 口径照宿主 ConversationSlotPanel：phase 只影响 hero/settling 外观，
 * 这里恒定 active + hero:false（窗格里不做空会话引导页）。
 */
import { memo, useEffect, useRef, useState } from 'react'
import s from '../newtype.module.css'
import { SessionPane } from './SessionPane.tsx'
import { nt, useT } from '../i18n.ts'

export interface HostConversationPaneProps {
  sessionId: string
  /** E34：空会话标记（列表 byId[sid].blank）——隐藏欢迎页，composer 独占底部 */
  blank?: boolean
  /** 每窗格独立 retain（D14-R3）：多窗格不能共用一个 SessionReference */
  retainSession: (id: string) => NtSessionRef | null
  SessionProvider?: NtSessionProviderComponent
  renderFactorySlot?: NtRenderFactorySlot
  /** factory 面缺席/挂载失败时的降级内容（D14-R5） */
  fallback?: unknown
  /**
   * factory views 位置转发的会话视图名：'chat'（默认，对话框）| 'trajectory'（轨迹）。
   * D15：trellis 齿轮菜单的「对话/轨迹切换」复用同一 retain 壳，只换这个转发名。
   * trajectory 在嵌入形态能否渲染 = 落地查证项（失败时齿轮里隐藏轨迹行即可）。
   */
  viewName?: string
  /** E35：对话内点 http(s) 链接 → 转交工作台内置浏览器（web 视图）；不传则走宿主默认 */
  onOpenLink?: (url: string) => void
  /**
   * E41：对话内点文件（交付物卡 / md 文件提及 / @file 引用 chip）→ 工作台文件窗格。
   * 官方 openFile 在 embedded 形态下撞 cordis 死 fiber（「cannot get required
   * service "sessions" in inactive context」，05 §E41），捕获层绕开整条官方链路。
   */
  onOpenFile?: (path: string) => void
}

/**
 * retain 状态机。每个分支都带 `for`（它属于哪个 sessionId）。
 *
 * 为什么必须带：effect 的 setState 发生在**渲染之后**，所以 sessionId 变化时
 * React 会先拿「上一会话的 state」渲染一次。若此时直接渲染 factory，
 * SessionProvider 会挂上一个已被上一轮 cleanup release 掉的 ref，
 * 框架的 `adapter.bindingSource()` 读 `reference.binding` 就抛
 * `Session reference "..." is released`（冒烟实证：每次切 tab 必报一条）。
 * 渲染前比对 `state.for !== sessionId` 就把这个窗口彻底关掉。
 */
type RetainState =
  | { phase: 'loading'; for: string }
  | { phase: 'ready'; for: string; ref: NtSessionRef }
  | { phase: 'absent'; for: string }
  | { phase: 'error'; for: string; message: string }

const loadingFor = (id: string): RetainState => ({ phase: 'loading', for: id })

export const HostConversationPane = memo(function HostConversationPane(props: HostConversationPaneProps) {  const { sessionId, retainSession, SessionProvider, renderFactorySlot, viewName, blank } = props
  useT()
  /** E35：捕获层拦对话内链接点击。Ctrl/Cmd 点按放行（尊重「外部打开」习惯）；
   *  非 http(s)（mailto:、锚点、相对路径）不拦。
   *  E41：同层拦文件类点击（交付物卡 / md 文件提及 / @file 引用 chip），
   *  路径从 DOM title 直读，preventDefault 绕开官方 openFile 的死 fiber。
   *  特征依据 05 §E41（0.2.0-rc.2 源码只读查证）：
   *   - 交付物卡 div[data-presented-file]，热区 button[title] title=绝对路径
   *   - md 提及 button.fileMention（css module hash，后缀 _fileMention 稳定），title=path
   *   - @file chip button[data-ref-chip="file"]，title=@path（去 @ 去引号，相对 cwd） */
  const onCaptureClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return
    const t = e.target as HTMLElement | null
    const openFile = props.onOpenFile
    if (openFile && t) {
      const card = t.closest?.('[data-presented-file]')
      if (card) {
        // 卡内可能有多个带 title 的按钮（复制路径等动作钮），只认长得像路径的 title
        const btns = Array.from(card.querySelectorAll<HTMLElement>('button[title]'))
        const raw = btns.map((b) => b.getAttribute('title') ?? '').find((s) => /[\\/]/.test(s)) ?? ''
        if (raw) { e.preventDefault(); e.stopPropagation(); openFile(raw); return }
      }
      const chip = t.closest?.('button[data-ref-chip="file"], button[class*="fileMention"]')
      if (chip) {
        const raw = (chip.getAttribute('title') ?? '').replace(/^@/, '').replace(/^"|"$/g, '')
        if (raw) { e.preventDefault(); e.stopPropagation(); openFile(raw); return }
      }
    }
    const open = props.onOpenLink
    if (!open || !t) return
    const a = t.closest?.('a')
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (!/^https?:\/\//i.test(href)) return
    e.preventDefault()
    e.stopPropagation()
    open(href)
  }
  const [state, setState] = useState<RetainState>(() => loadingFor(sessionId))
  /** E34：空会话 hero 比窗格高时，factory 初始滚动停在底部（hero 顶被裁、观感「输入框贴顶」）。
   *  会话就绪后把滚动归零几帧，呈现原生同款「hero 顶部 + composer 固定底」。 */
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (state.phase !== 'ready') return
    const root = rootRef.current
    // NT1010A：blank 结束（发出第一条消息）后必须清掉 E34b 留下的内联样式——
    // 内联 overflow:hidden 不随 .hconvBlank 摘除而消失，会把 scrollBody 滚动锁死
    //（症状：新 tab 聊起来后对话区无上下滚动条）。逐项还原成宿主原值。
    if (!blank) {
      const sc = root?.querySelector<HTMLElement>('[class*="scrollBody"]')
      if (sc) { sc.style.overflow = ''; sc.style.display = ''; sc.style.flexDirection = '' }
      const va = root?.querySelector<HTMLElement>('[class*="viewArea"]')
      if (va) va.style.display = ''
      const seat = root?.querySelector<HTMLElement>('[class*="composerSeat"]')
      if (seat) { seat.style.marginTop = ''; seat.style.position = '' }
      return
    }
    // E34b：空会话隐藏欢迎页（hero 内嵌第二份 composer 顶在上方）——内联样式，
    // CSS 模块类方案被宿主样式序/类名undefine连环坑掉（E34 实测），内联最稳
    let frames = 0
    const id = requestAnimationFrame(function tick() {
      if (!root) return
      const va = root.querySelector<HTMLElement>('[class*="viewArea"]')
      if (va) va.style.display = 'none'
      const sc = root.querySelector<HTMLElement>('[class*="scrollBody"]')
      if (sc) { sc.style.overflow = 'hidden'; sc.style.display = 'flex'; sc.style.flexDirection = 'column' }
      const seat = root.querySelector<HTMLElement>('[class*="composerSeat"]')
      if (seat) { seat.style.marginTop = 'auto'; seat.style.position = 'static' }
      if (++frames < 10) requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [state.phase, blank, sessionId])

  /** E43i（2026-10-12 bug&spec B4）：宿主 draft 状态与编辑器正文脱同步时，灰色占位
   *  浮层（showPlaceholder 只看 draft===""）压在已有正文上叠印（白字灰字互咬）。
   *  根子在宿主 ui-conversation 的 draft 单一真相源，插件侧止血：对账「编辑器有文
   *  即藏占位」。竞态窗口 = 换 tab / 重挂载（key={settled.for} 整棵重挂 + 种子
   *  effect + 镜像断窗），故就绪后 3 秒内每 250ms 对账；无文时置 '' 可逆还原。 */
  useEffect(() => {
    if (state.phase !== 'ready') return
    const root = rootRef.current
    if (!root) return
    const reconcile = () => {
      const ph = root.querySelector<HTMLElement>('[data-composer-placeholder]')
      if (!ph) return
      const ed = root.querySelector<HTMLElement>('[data-lexical-editor]')
      const hasText = !!ed && (ed.textContent ?? '').trim().length > 0
      ph.style.display = hasText ? 'none' : ''
    }
    reconcile()
    const id = setInterval(reconcile, 250)
    const stop = setTimeout(() => clearInterval(id), 3000)
    return () => { clearInterval(id); clearTimeout(stop) }
  }, [state.phase, sessionId])

  useEffect(() => {
    let ref: NtSessionRef | null = null
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    // 2026-10-10 启动对齐：重启后 trellis 立刻恢复 session tab，此时宿主会话服务
    // 常未就绪（retain 返回 null / ready 拒绝）——之前一次定性 absent/error，
    // 窗格显示「无法读取对话」，关 tab 重开才好（主人实测）。改为退避重试，
    // 服务就绪后自动接上；约 6 秒窗口内不放弃。
    const MAX_TRIES = 12
    const RETRY_MS = 500
    let tries = 0
    setState(loadingFor(sessionId))
    const attempt = () => {
      if (!alive) return
      try {
        ref = retainSession(sessionId)
        if (!ref) {
          if (++tries <= MAX_TRIES) { timer = setTimeout(attempt, RETRY_MS); return }
          if (alive) setState({ phase: 'absent', for: sessionId })
          return
        }
        const held = ref
        held.ready.then(
          () => {
            // ready 兑现时可能已卸载/换会话：此时 ref 已 release，别再挂上去
            if (alive) setState({ phase: 'ready', for: sessionId, ref: held })
          },
          (e) => {
            // 自己造成的 release（切 tab / 卸载）不算错误，静默留在 loading
            const msg = String(e?.message ?? e ?? nt('pane.openFailed'))
            if (!alive || msg.includes('is released')) return
            // 非释放类失败（典型：启动期服务未就绪）→ 先释放，退避重试
            try { held.release() } catch { /* 重复 release 防御 */ }
            ref = null
            if (++tries <= MAX_TRIES) { timer = setTimeout(attempt, RETRY_MS); return }
            if (alive) setState({ phase: 'error', for: sessionId, message: msg })
          },
        )
      } catch (e) {
        if (++tries <= MAX_TRIES) { timer = setTimeout(attempt, RETRY_MS); return }
        setState({ phase: 'error', for: sessionId, message: String(e) })
      }
    }
    attempt()
    return () => {
      alive = false
      if (timer !== null) clearTimeout(timer)
      try { ref?.release() } catch { /* 重复 release 防御 */ }
    }
  }, [sessionId, retainSession])

  // 框架面缺席（未声明 children / 宿主版本漂移）→ 直接降级，不空窗
  if (!SessionProvider || !renderFactorySlot) return <Fallback fallback={props.fallback} />
  // 状态还属于旧会话 = effect 还没跑完，这一帧绝不碰 factory
  const settled: RetainState = state.for === sessionId ? state : loadingFor(sessionId)
  if (settled.phase === 'loading') return <div className={s.pempty}>{nt('pane.loadingSession')}</div>
  if (settled.phase === 'absent') return <Fallback fallback={props.fallback} />
  if (settled.phase === 'error') return <div className={s.perr}>{settled.message}</div>

  // 框架面缺席（未声明 children / 宿主版本漂移）→ 直接降级，不空窗
  if (!SessionProvider || !renderFactorySlot) return <Fallback fallback={props.fallback} />
  if (state.phase === 'loading') return <div className={s.pempty}>{nt('pane.loadingSession')}</div>
  if (state.phase === 'absent') return <Fallback fallback={props.fallback} />
  if (state.phase === 'error') return <div className={s.perr}>{state.message}</div>

  /**
 * 关键布局细节（D14 冒烟实测 + 宿主 CSS 实读）：
 * factory 产出的顶层就是 `.body`（`data-conversation-content`），
 * `.root`（height:100%; flex column）那层是宿主的 ConversationMainPanel 给的。
 * 我们没有 MainPanel，所以必须自己补一个 root 层当 flex 父容器 ——
 * 否则 `.body` 的 `flex:1` 落空、高度塌成内容高，
 * `composerSeat` 的 `position:sticky; bottom:0` 会把输入框贴在窗格顶部
 * （症状：smoke-d14b/c 截图里输入框浮在视口最上方）。
 * 宿主同款做法 = SidebarChatTab 的 `.root` 包装（ui-subagent client.js:792-798）。
 */
return (
    <SessionProvider key={settled.for} session={settled.ref}>
      <div className={s.hconvRoot + (props.blank ? ' ' + s.hconvBlank : '')} data-nt="hconv" ref={rootRef} onClickCapture={onCaptureClick}>
        {renderFactorySlot(
          'conversation.content',
          { variant: 'embedded', phase: 'active', hero: false },
          { slots: { views: (p: { renderSlot?: (key: string, owner?: object) => unknown }) => <SessionHostView renderSlot={p.renderSlot} viewName={viewName} /> } },
        )}
      </div>
    </SessionProvider>
  )
}, panePropsEqual)
/* 卡顿治理（2026-10-09）：自定义比较器——fallback 元素每次渲染身份都变（含 SessionPane JSX），
 * 但只在 factory 缺席的降级态才渲染，不值得为它放弃 memo；
 * 其余 props（sid/blank/retain/SessionProvider/renderFactorySlot/viewName）逐一浅比。 */
function panePropsEqual(a: HostConversationPaneProps, b: HostConversationPaneProps): boolean {
  return a.sessionId === b.sessionId
    && a.blank === b.blank
    && a.retainSession === b.retainSession
    && a.SessionProvider === b.SessionProvider
    && a.renderFactorySlot === b.renderFactorySlot
    && a.viewName === b.viewName
    && a.onOpenLink === b.onOpenLink
    && a.onOpenFile === b.onOpenFile
}

/**
 * factory 的 views 位置：转发到宿主 conversation.session 的指定视图。
 * viewName='chat'（默认）= 原版对话框；'trajectory' = 轨迹（D15 查证项）。
 * framework 会把 renderSlot 等道具注进来，这里只用到 renderSlot 一个。
 */
function SessionHostView(props: { renderSlot?: (key: string, owner?: object) => unknown; viewName?: string }) {
  const renderSlot = props.renderSlot
  if (!renderSlot) return null
  return <>{renderSlot('conversation.session', { view: props.viewName ?? 'chat' })}</>
}

function Fallback(props: { fallback?: unknown }) {
  const node = props.fallback
  return <>{node ?? <div className={s.pempty}>{nt('pane.cannotRender')}</div>}</>
}