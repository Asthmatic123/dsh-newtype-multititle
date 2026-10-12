/**
 * NewType client 入口（D14 后）：
 *  ① main key 'newtype'         → 工作台（split 树 + 每格原版对话框）
 *  ② main key 'newtype-pages'   → 图页面板
 *  ③ sidebar.panellist ×2       → 侧栏两行 PanelRow（自由栏位 / 点图）
 *  ③b sidebar.footer.action     → 侧栏底部「自由栏位」开关 + 「2D列表」触发器（后者
 *                                  响应 2dlist 插件的 tab 注册，见 tabregistry.ts）
 *  ④ conversation.view          → 工作台 view（过渡兜底）
 *  ⑤ sidebar.right.pane.tab     → 产出物面板
 *  ⑥ shell.overlay             → 状态栏
 *
 * D14 左栏路线 C 已撤掉 `sidebar.workspaces` 的 priority:-10 影子注册
 * —— 宿主 WorkspaceBrowser 回来，会话列表 100% 原版（05 §E21）。
 *
 * 实证口径（0.1.7-rc.2 速查卡）：
 *  - single 槽同 cell 同 priority 二次注册 → throw（ui-slots lib/index.js:167-173）。
 *  - children 里声明非 root 作用域子槽 → props 上装 SessionProvider
 *    （ui-renderer client.js:732-740）= D14-R1 换原生对话框的前提。
 *  - ctx 注入组件 props 一律走 register options 的 inject 工厂（惰性读 ctx）。
 */
import type { Context } from '@deepseek-ai/cordis'
// 值导入：拉入 ui-slots 的类型图（SlotMap 声明合并 + Context.slots 合并声明都靠它）
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { useSyncExternalStore } from 'react'
import s from './newtype.module.css'
import { WorkbenchView } from './workbench/WorkbenchView.tsx'
import { ArtifactsPanel } from './workbench/ArtifactsPanel.tsx'
import { Statusbar } from './shell/Statusbar.tsx'
import { artifactPanelBus, artRail, openTabBus, setPendingSession } from './bus.ts'
import { subscribeTabs, tabHost, installTabHost } from './tabregistry.ts'
import { retainedByMainView } from './pages.ts'

/** main 槽的 key，必须与 sidebar.panellist 条目 id 一一对应（PointRow → selectPanel）。 */
const MAIN_WORKBENCH = 'newtype'
const MAIN_PAGES = 'newtype-pages'
/**
 * E47 自由栏位模式：面板是否常驻。
 *
 * ON  = 点左栏任何会话行 / 新建会话，面板都留在工作台（activePanelId 一旦落回 null
 *       （宿主原生对话）立即改写回 newtype）。入口 = 侧栏「自由栏位」行 或 底部开关。
 * OFF = 宿主原生对话，插件不抢面板。
 *
 * 旧实现（E43e）不是模式而是 4 秒时间窗：窗口一过就当甩手掌柜，之后任何一次落回 null
 * 都没人管 → 「tab 方式不能常驻、经常会掉」的真因。模式化后行为可解释、可预测。
 *
 * 出口（E47b，2026-10-12 改版）：宿主 PanelRow 的 onClick 写死单向 `selectPanel(id)`
 * （ui-sidebar lib/client.js:184-186），没有 toggle；`selectPanel(null)` 是回原生的唯一路。
 * 原方案「第二行按钮」要占一整行 PanelRow，观感像第三个同级面板；改为**底部单个开关**
 * （sidebar.footer.action），点一下按当前状态双向切换。
 * 参照 ds-bot（Fei2411/DeepSeek-Bot）：宿主不暴露「当前是哪个面板」的查询，也没有 toggle，
 * 状态只能插件自持——它的做法也是常注册一个按钮 + 自己持有 mode（surface.js/index.js）。
 */
let ntFreeMode = true
/** 模式订阅：底部开关靠它跟随状态（含常驻订阅被动置位的情形） */
const ntModeSubs = new Set<() => void>()
const subscribeFreeMode = (cb: () => void) => {
  ntModeSubs.add(cb)
  return () => { ntModeSubs.delete(cb) }
}
/** 改模式并广播。幂等：同值不通知，避免常驻订阅反复打醒按钮。 */
function setFreeMode(on: boolean): void {
  if (ntFreeMode === on) return
  ntFreeMode = on
  ntModeSubs.forEach((f) => { try { f() } catch { /* 单个订阅者异常不影响其余 */ } })
}
/** 面板切换句柄（apply 里惰性捕获 ctx.layout.selectPanel；服务缺席静默） */
let ntSelectPanel: ((id: string | null) => void) | null = null
/** 构建标记：hover 底部按钮看 tooltip 尾部即可确认桌面加载的是哪版（不用开 Console） */
const NT_BUILD = '20261013-01'

/** 底部开关：按当前模式双向切换。
 * 关模式时「先熄火再松手」——顺序错了常驻订阅会立刻把面板抢回工作台。
 * B8③（2026-10-12 主人定名）：自由栏位态的按钮文案 = 「原版」（点了回原生）。
 */
function ntToggleWorkbench(): void {
  if (ntFreeMode) {
    setFreeMode(false)
    try { ntSelectPanel?.(null) } catch { /* 布局缺席：静默 */ }
  } else {
    setFreeMode(true)
    try { ntSelectPanel?.(MAIN_WORKBENCH) } catch { /* 布局缺席：静默 */ }
  }
}

/**
 * 底部自由栏位开关（E47b）。宿主 footer.action 是 kind:list 且 onClick 归注册方，
 * 两态由插件自持的 ntFreeMode 决定；点击走 ntToggleWorkbench 双向切换。
 * 收起侧栏时只显示图标（props.wide 为假）。
 */
function WbToggle(props: { wide?: boolean }) {
  const on = useSyncExternalStore(subscribeFreeMode, () => ntFreeMode, () => ntFreeMode)
  const label = on ? '原版' : '自由栏位'
  return (
    <button
      type="button"
      className={s.footToggle + (on ? ' ' + s.footToggleOn : '')}
      aria-label={label}
      aria-pressed={on}
      title={on ? `切回宿主原生对话（原版） · build ${NT_BUILD}` : `切到自由栏位工作台 · build ${NT_BUILD}`}
      onClick={() => ntToggleWorkbench()}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2.5" y="4" width="8.5" height="7.5" rx="1.5" />
        <rect x="13" y="4" width="8.5" height="4.5" rx="1.5" />
        <rect x="13" y="11" width="8.5" height="9" rx="1.5" />
        <rect x="2.5" y="14" width="8.5" height="6" rx="1.5" />
      </svg>
      {props.wide ? <span className={s.footToggleText}>{label}</span> : null}
    </button>
  )
}

/** 点图雷达图标（B8① 提为模块级：panellist 行与底部「2D列表」按钮共用） */
function DotsIcon(props: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 16}
      height={props.size ?? 16}
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
}

/**
 * B8①（2026-10-12 主人拍板）：底部第二颗按钮「2D列表」= 点图触发器。
 * 2026-10-13 拆分改版：huabu tab 本体已拆到独立插件 2dlist，本按钮改为读
 * window.__ntMultititle 注册表——2dlist 未注册 'dots' 时按钮隐藏（useSyncExternalStore
 * 响应式，2dlist 晚挂载也能出现）。点击保留点图行中转链路语义：先 emit('dots')
 * （工作台未挂载时由总线 pending 记住），再 selectPanel(MAIN_WORKBENCH) 拉起工作台；
 * WorkbenchView 的 'dots' 分流改走 tabHost.openTab('dots')（注册表为空时静默）。
 * 并排依据：宿主 .footerActions 是 display:flex 行，sidebar.footer.action 是
 * kind:list，多注册项自动横排（ui-sidebar lib/client.js footArea 样式）。
 */
function DotsBtn(props: { wide?: boolean }) {
  const hasDots = useSyncExternalStore(
    subscribeTabs,
    () => tabHost.hasTab('dots'),
    () => tabHost.hasTab('dots'),
  )
  if (!hasDots) return null
  return (
    <button
      type="button"
      className={s.footToggle}
      aria-label="2D列表"
      title="打开 2D 列表（点图）"
      onClick={() => {
        openTabBus.emit('dots')
        try { ntSelectPanel?.(MAIN_WORKBENCH) } catch { /* 布局缺席：静默 */ }
      }}
    >
      <DotsIcon />
      {props.wide ? <span className={s.footToggleText}>2D列表</span> : null}
    </button>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    // 真声明在 ui-conversation contract/slots.d.ts:184-188（kind:list, scope:session）
    'conversation.view': { kind: 'list'; scope: 'session' }
    // 真声明在 ui-sidebar-right contract/slots.d.ts:53-58（keyed, scope:session）
    'sidebar.right.pane.tab': { kind: 'keyed'; scope: 'session' }
    // 框架级（ui-layout index.d.ts:44-105）：中央面板按 key 选择 / 全框浮层
    'main': { kind: 'keyed'; scope: 'root' }
    'shell.overlay': { kind: 'list'; scope: 'root' }
    // D14-L3：侧栏全局面板导航项（宿主 SidebarRoot 枚举它渲染 PanelRow）
    'sidebar.panellist': { kind: 'list'; scope: 'root' }
    // E47b：侧栏底部动作区（宿主 SidebarRoot footArea 渲染，onClick 归注册方）
    'sidebar.footer.action': { kind: 'list'; scope: 'root' }
    // B8②：原生设置行（单槽）——影子注册空组件压掉
    'sidebar.settings': { kind: 'single'; scope: 'root' }
    /**
     * D14-R1：我们自己声明的子槽，唯一目的是换到 SessionProvider 座位。
     * 框架规则：children 里出现任何非 root 作用域子槽，props 上才装 SessionProvider
     * （ui-renderer client.js:732-740；slots/lib/types/index.d.ts:335-337）。
     * 宿主不消费这个 key（不进任何 renderSlot），纯占位。
     */
    'newtype.pane.session': { kind: 'single'; scope: 'session' }
  }
}

// betterSidebar 不进 inject：它是可选增强（E31c 有回落），进 inject 会在服务缺席的
// profile（如桌面版未装 better-sidebar）把整个插件卡在 pending 不挂载（3099 实测）。
// openSidePanel 在调用点惰性读 ctx.betterSidebar，缺席自动走 artRail 回落。
// jobs 不得进 inject（2026-10-12 桌面实测翻车）：桌面客户端上下文没有 job-controller
// 服务（web 冒烟捆绑里有、桌面捆绑没有），inject 声明了就让整个插件卡 pending 不挂载
// ——「底部按钮全消失」即此。后台页签暂时牺牲：getJobs try/catch 惰性读，读不到返回
// null（页签自动隐藏），插件其余功能不受影响。待找到桌面可达的取数路径再开。
export const inject = ['slots', 'uiWorkspace', 'sessions', 'sidebarRight', 'sidebarRightTabs', 'layout']

type NtListSnap = {
  ids?: readonly string[] | undefined
  byId?: Record<string, { retainedBy?: Record<string, unknown> | string[]; blank?: boolean }> | undefined
}
const listSnap = (ctx: Context) =>
  (ctx.sessions?.list as { getSnapshot?: () => NtListSnap } | undefined)?.getSnapshot?.()

/** E43h：交付代际——新一次点击接管旧轮询，保证一次点击只有一个活轮询 */
let ntDeliverGen = 0

/**
 * E43h（2026-10-12）：＋新建会话交付武装，判据换代。旧实现（E43e~E43g）把
 * 「轮询 mainView retained 变化」押在 startSession patch 里，两个致命伤：
 *  ① patch 丢失（实例重建 / 旧引用绕过）后交付链裸奔——会话建了、tab 永不开；
 *  ② 判据「mid !== startMid」撞上空会话复用自匹配（E27）或导航 abort 跳过
 *     replaceMain（E42b）就永远不成立 → poll timeout 静默放弃。
 * 新判据对齐用户可见事实「对话列表出现新对话」：
 *  ① ids 出现新成员 → 交新 id（create placeholder 先上列表，replaceMain 被
 *     abort 也照交，tab 不再依赖宿主 retain 链走完）；
 *  ② 新 id 成为 mainView → 交它（排除 arm 窗口内无关的旧会话切换误判）；
 *  ③ 60×100ms 超时且当前 mainView 是空会话 → 兜底交付（E27 复用场景，
 *     ws.open reuse:'params' 幂等 = 跳到该空会话 tab）。
 * 交付只负责「把 id 送进工作台开 tab」；面板纠偏交给 E47 的常驻订阅（模式 ON 时
 * 任何 null 都改回 newtype），本函数不再碰 selectPanel——导航在飞时 selectPanel 必
 * abort（E42b 实证），会杀掉自己的 replaceMain，反而固化 retain 不更新的根因。
 * 武装点：newSession 点击路径（必执行，绕不过 patch）+ startSession wrapper
 * （宿主原生入口），代际号去重。
 */
function armNewSessionDelivery(ctx: Context, start: () => unknown): unknown {
  const gen = ++ntDeliverGen
  const s0 = listSnap(ctx)
  const ids0 = s0?.ids ?? Object.keys(s0?.byId ?? {})
  const before = {
    ids: new Set(ids0),
    mid: retainedByMainView(ids0, s0?.byId),
  }
  let timer: ReturnType<typeof setInterval> | null = null
  const deliver = (id: string) => {
    if (timer) clearInterval(timer)
    setPendingSession(id)
  }
  /** ①② 每轮都查；allowBlank=true 时（start 落定 / 超时）再兜 E27 复用空会话。 */
  const check = (allowBlank: boolean): boolean => {
    const snap = listSnap(ctx)
    const ids = snap?.ids ?? Object.keys(snap?.byId ?? {})
    const mid = retainedByMainView(ids, snap?.byId)
    // 判据①②共用一个约束：只交「arm 时不存在」的 id——arm 窗口内点左栏行、
    // 连点两次 + 等无关 mainView 换人（旧 id）不得误判成交付（对抗复核致命 2）。
    const fresh = ids.find((id) => !before.ids.has(id))
    if (fresh) { deliver(fresh); return true }
    if (mid && !before.ids.has(mid)) { deliver(mid); return true }
    if (allowBlank && mid && snap?.byId?.[mid]?.blank) { deliver(mid); return true }
    return false
  }
  let tries = 0
  timer = setInterval(() => {
    if (gen !== ntDeliverGen) { if (timer) clearInterval(timer); return }
    if (check(false)) return
    if (++tries >= 60) {
      if (timer) clearInterval(timer)
      check(true)
    }
  }, 100)
  try {
    const r = start()
    // E27 复用空会话没有新 id、mid 也不变——等 start 落定（create/replaceMain 已走完）
    // 就地兜底交付，不干等 6 秒超时。落定 = 导航不在飞，纠偏交给常驻订阅。
    if (r && typeof (r as Promise<void>).then === 'function') {
      (r as Promise<void>).then(
        () => { if (gen === ntDeliverGen) check(true) },
        // create 失败：清表不交付（对抗复核致命 1——不清则 6s 兜底会误跳旧空会话）
        () => { if (gen === ntDeliverGen && timer) { clearInterval(timer); timer = null } },
      )
    }
    return r
  } catch (e) {
    if (timer) clearInterval(timer)
    throw e
  }
}

/** 公共 inject 工厂：惰性读 ctx（apply 时序安全） */
function sharedInject(ctx: Context) {
  return () => ({
    // B10-b：id 接受会话 id 或 SubagentAddress（子代理页签点击），原样透传宿主
    openSession: (id: string | { parentSessionId: string; childSessionId: string; mode: string }) => { ctx.uiWorkspace?.openSession(id as never) },
    retainSession: (id: string) => ctx.sessions?.retain(id, { source: 'dsh-newtype-multititle' }) ?? null,
    getSessionsList: () => ctx.sessions?.list ?? null,
    // B10-c：后台任务（根服务 ctx.jobs，已进 inject；见 inject 处注释）
    // B10-c：jobs 未进 inject（见 inject 处注释）。加载器对未声明属性直接抛错，
    // 这里 try/catch 吞掉返回 null——桌面无此服务，页签自动隐藏，绝不拖垮插件。
    getJobs: () => { try { return (ctx as unknown as { jobs?: unknown }).jobs ?? null } catch { return null } },
    selectPanel: (id: string | null) => { ctx.layout?.selectPanel(id as never) },
    // E31c 侧边栏按钮：better-sidebar 在 → 展开其底部工作台的文件面板（任意面板态可用）；
    // 缺席（如 0.1.7 profile）→ 回落自家产出物栏。带会话作用域（无 scope 可能被静默忽略）。
    openSidePanel: (sid?: string) => {
      try {
        if (ctx.betterSidebar) {
          const scope = sid ? { sessionId: sid } : undefined
          ctx.betterSidebar.openTab({ type: 'editor' }, scope as never)
          return
        }
      } catch { /* 服务异常：走回落 */ }
      artRail.set(true)
    },
    // D15 accessory：宿主右栏开关（右栏全局共用一个，内容跟随聚焦窗格会话）
    openRightbar: () => { try { ctx.layout?.openRightbar(true, false) } catch { /* 服务缺席：静默 */ } },
    closeRightbar: () => { try { ctx.layout?.closeRightbar() } catch { /* 服务缺席：静默 */ } },
    // E43：工作台 tab 栏「+」新建会话——走宿主 startSession（E42b patch 负责拉回工作台）。
    // E43b：必须显式传 workspaceId——原版无参时从 mainReference 推导，工作台态它常为
    // null，落到 recent/clearMain 分支（真机实证：点「＋」回退原生态）。这里复刻原版
    // recent 口径：取「最近更新会话」所属 workspace（workspaces store 就挂在
    // uiWorkspace 实例上，无需额外 inject）。
    newSession: () => {
      try {
        const ws = ctx.uiWorkspace as unknown as {
          startSession(w?: string): unknown
          workspaces?: { list?: { getSnapshot?: () => { items?: Array<{ workspaceId: string; sessionIds: readonly string[] }> } } }
        }
        let wid: string | undefined
        const items = ws?.workspaces?.list?.getSnapshot?.()?.items ?? []
        if (items.length) {
          const snap = (ctx.sessions?.list as { getSnapshot?: () => { byId?: Record<string, { updatedAt?: number }> } } | undefined)?.getSnapshot?.()
          const byId = snap?.byId ?? {}
          let best: { t: number; id: string } | null = null
          for (const it of items) {
            for (const sid of it.sessionIds) {
              const t = byId[sid]?.updatedAt ?? 0
              if (!best || t > best.t) best = { t, id: it.workspaceId }
            }
          }
          wid = best?.id ?? items[0]?.workspaceId
        }
        // E43h：交付武装放点击路径（不依赖 patch 存活——E43e 教训：旧引用可绕过 patch）。
        // 先武装再 startSession：create 是异步 RPC，晚一秒武装也来得及，但 patch 被绕过
        // 时这就是唯一交付通道。代际号保证与 wrapper 侧武装不重复交付。
        armNewSessionDelivery(ctx, () => ws?.startSession(wid as never))
      } catch { /* 宿主服务缺席：静默，下轮点击重试 */ }
    },
  })
}

export function apply(ctx: Context): void {
  // —— tab 宿主扩展点（2026-10-13）：挂 window.__ntMultititle，2dlist 经它注册 huabu tab ——
  installTabHost()

  // —— D14-L2：sidebar.workspaces 的 priority:-10 影子注册已撤除 ——
  // 宿主 WorkspaceBrowser 回到 sidebar.workspaces 位，会话列表 100% 原版
  // （SidebarRoot 无条件渲染该区，client.js:392，与 activePanelId 无关）。
  // 查证依据：0.2.1-alpha.1 仍未导出 WorkspaceBrowser（05 §E21）。

  // —— D14-R1：main 工作台。children 里声明 session 作用域子槽，
  //    唯一目的是让框架在 props 上装 SessionProvider（ui-renderer client.js:732-740），
  //    窗格才能用 renderFactorySlot 渲染宿主原版对话框。
  //    姿势照抄宿主 plugin-manager（main key + children 声明，client.js:3434-3470）。
  ctx.effect(
    () => ctx.slots.inject('main', () => ctx.slots.register(
      {
        name: 'main',
        key: MAIN_WORKBENCH,
        inject: sharedInject(ctx),
        children: { 'newtype.pane.session': { kind: 'single', scope: 'session' } },
      } as never,
      WorkbenchView as never,
    )),
    'dsh-newtype-multititle: 工作台中央面板（main newtype）',
  )

  // —— D14-L3：侧栏 PanelRow（主人 2026-10-09 裁定：撤「图页」行，只留「工作台」）——
  // 宿主 SidebarRoot 枚举 sidebar.panellist 渲染 PanelRow，点它调 selectPanel(id)，
  // id 同时就是 main 槽的 key（client.js:459-473 / 383-394）。
  // 登记项只提供图标；行本体、选中态、tooltip 全是宿主原版渲染。
  const panelIcon = (glyph: 'workbench') => (props: { size?: number }) => (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 16}
      height={props.size ?? 16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <><rect x="2.5" y="4" width="8.5" height="7.5" rx="1.5" /><rect x="13" y="4" width="8.5" height="4.5" rx="1.5" /><rect x="13" y="11" width="8.5" height="9" rx="1.5" /><rect x="2.5" y="14" width="8.5" height="6" rx="1.5" /></>
    </svg>
  )

  // —— B8④（主人 2026-10-12 反复确认拍板）：左栏「自由栏位」「点图」两行撤除 ——
  //    入口只剩底部两颗按钮（原版 / 2D列表）。宿主 SidebarRoot 枚举 sidebar.panellist
  //    渲染 PanelRow，不注册即不渲染；main 槽的 newtype key 必须保留
  //    （底部按钮 selectPanel(id) 仍要落 main 面板，main panel not registered 见下）。
  //    （原 D14-L3 / NT1011B 的两处 panellist 注册就此退役；panelIcon 留底不删。）
  void panelIcon
  // —— 图页面板/图页行已按主人裁定撤除（PagesPanel.tsx 留底不删）——
  void MAIN_PAGES

  // —— NT1011B 点图（2026-10-13 拆分）：原 main 点图中转面板与数据桥已随
  //    huabu 点图本体拆到独立插件 @dsh-external/dsh-newtype-2dlist（经
  //    window.__ntMultititle 注册 tab，见 tabregistry.ts）。本插件只留底部按钮 + 扩展点。 —

  // —— E47b：自由栏位出口 = 侧栏底部单个开关（主人 2026-10-12 参照 ds-bot 改版）——
  //    宿主 PanelRow 的 onClick 写死单向 selectPanel(id)，没有 toggle（lib/client.js:184-186），
  //    所以开关落在「onClick 归注册方」的 footer.action 槽；两态由插件自持 (ntFreeMode)。
  ntSelectPanel = (id) => ctx.layout?.selectPanel(id as never)
  ctx.effect(
    () => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'newtype-wb-toggle', order: 30 } as never,
      WbToggle as never,
    )),
    'dsh-newtype-multititle: 侧栏自由栏位开关（E47b）',
  )
  // B8①：底部并排第二颗「2D列表」（点图触发器，主人 2026-10-12 拍板）
  ctx.effect(
    () => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'newtype-dots-open', order: 31 } as never,
      DotsBtn as never,
    )),
    'dsh-newtype-multititle: 侧栏 2D列表 按钮（B8①）',
  )
  // B8② 注记：原生「设置」行改用 CSS 精准隐藏（newtype.module.css triggerRow 规则）。
  // 曾试 sidebar.settings 整槽影子注册：web 会连头像 launcher 一起杀（SettingsRoot
  // 整体被替换），桌面又实测无效——两头不讨好，已撤。

  // —— 会话区工作台 view 已按主人 2026-10-10 裁定撤除（原生对话的视图切换条上
  //    「对话/轨迹」旁不再出现工作台按钮；有 bug：多对话共用一个输入框）。
  //    WorkbenchView 组件保留（main newtype 中央面板仍在用）；sharedInject 仍被 main 注册引用。——

  // —— P3.3 右栏产出物：两段式（类型注册 + keyed body）——
  const ARTIFACT_ID = '@dsh-external/dsh-newtype-multititle/artifacts'
  ctx.effect(() => ctx.sidebarRightTabs?.register({
    id: ARTIFACT_ID,
    kind: 'newtype-artifacts',
    priority: 'extension',
    title: () => '产出物',
    guide: [{
      id: 'artifacts',
      order: 100,
      title: () => '产出物',
      description: () => '当前会话的图页与产出',
    }],
  }), 'dsh-newtype-multititle: 右栏产出物 tab 类型')

  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
      { name: 'sidebar.right.pane.tab', key: ARTIFACT_ID } as never,
      ArtifactsPanel as never,
    )),
    'dsh-newtype-multititle: 右栏产出物 body',
  )

  // 「打开产出物」= 切工作台 + 展开工作台右栏（trellis Preview 式）
  ctx.effect(() => artifactPanelBus.sub(() => {
    try { ctx.layout?.selectPanel(MAIN_WORKBENCH) } catch { /* 布局面缺席：静默 */ }
    artRail.set(true)
  }), 'dsh-newtype-multititle: 产出物栏打开请求')

  // —— 状态栏已按主人 2026-10-09 要求摘除（shell.overlay 注册撤掉；
  //     Statusbar.tsx 文件留底不删，与 layout/ 退休件同口径）——
  void Statusbar

  // —— E31 spike：接住工作台态的点文件报错 ——
  // 宿主对话 factory 点文件 → ctx.sidebarRight.openResource → 没有在屏会话时响亮失败
  // （`sidebarRight: no session surface is mounted`）。宿主写死 activePanelId===null 才有
  // 在屏会话（sidebar-right client.js:9062），工作台态无解 → 这里在**服务实例上**包一层：
  // 原调用失败且地址是文件资源时，转 openTabBus('file:<path>') 开进工作台窗格。
  // 只 patch 实例自有属性（遮蔽原型方法），不改宿主文件；服务缺席则轮询等待。
  let patched = false
  const patchTimer = setInterval(() => {
    const svc = ctx.sidebarRight
    if (!svc?.openResource || patched) { if (patched) clearInterval(patchTimer); return }
    const orig = svc.openResource.bind(svc)
    try {
      svc.openResource = (address: string, options?: Record<string, unknown>) => {
        try {
          orig(address, options)
        } catch (e) {
          // 只有「无在屏会话」这一种失败才转工作台；其余原样上抛（真资源错误不吞）
          if (!String(e).includes('no session surface')) throw e
          const m = /^dsh-resource:\/\/[^/]+\/(.*)$/.exec(String(address))
          if (!m) throw e
          let rest = m[1]
          try { rest = decodeURIComponent(rest) } catch { /* 已是明文 */ }
          // 地址文法（chat client.js:43-56）：`file/session/<sid>/<path>`，path 可为相对路径
          let p: string | null = null
          const sm = /^session\/([^/]+)\/(.*)$/.exec(rest)
          if (sm) {
            const rel = sm[2]
            if (/^[A-Za-z]:[\\/]/.test(rel) || rel.startsWith('/')) p = rel
            else {
              // 相对路径 → 查会话 cwd 拼绝对（宿主 openFile 同款口径）
              const snap = (ctx.sessions?.list as { getSnapshot?: () => { byId?: Record<string, { cwd?: string }> } } | undefined)?.getSnapshot?.()
              const cwd = snap?.byId?.[sm[1]]?.cwd
              if (cwd) p = `${cwd.replace(/[\\/]+$/, '')}/${rel.replace(/^\/+/, '')}`
            }
          } else {
            // 绝对地址兜底：盘符路径或 POSIX 绝对路径
            const win = /([A-Za-z]:[\\/].*)$/.exec(rest)
            p = win ? win[1] : rest.startsWith('/') ? rest.split('?')[0] : null
          }
          if (!p) throw e
          openTabBus.emit(`file:${p}`)
        }
      }
      patched = true
      clearInterval(patchTimer)
      ctx.logger?.('dsh-newtype-multititle')?.info?.('sidebarRight.openResource wrapped (E31 spike)')
    } catch { /* 实例不可写：放弃 patch，保持原版行为 */ }
  }, 600)

  // —— E31b：点左栏会话行 = 开进工作台 tab。——
  // E38：恒进自由栏位。E42b（2026-10-10 真机卡死 + 子代理查证修正）：
  // 0.2.0-rc.2 里原版 openSession→replaceMain("reveal") 同步做 sessions.retain("mainView")
  // + selection 更新，末尾 selectPanel(null)；原版 startSession→openWorkspace 异步
  // await sessions.create 后才 replaceMain+reveal，且 layout.selectPanel 会
  // navigation.abort()——在导航进行中调它 = openWorkspace aborted-return →
  // mainView 永不 retain（孤儿会话）+ 后续切换拿不到 id（卡死实证）。
  // 因此：
  //   openSession：必调原版（登记链路不能绕），原版同步落 selectPanel(null) 后
  //                立即夺回 newtype；emit 供 WorkbenchView 开/换 session tab。
  //   startSession：E43d 窗口期吞掉 selectPanel(null)（面板不动、无闪烁），轮询
  //                mainView retained 变化交付 pending，窗口结束归还原版。
  const wbOpenPatch = () => {
    const ws = ctx.uiWorkspace
    if (!ws) return false
    // E43h：函数标记判重（__nt）+ 每方法独立补丁。旧 __ntOrig 一次性判重两处失装：
    // ① origStart 缺席也置位 → startSession patch 永久失装；
    // ② patchedWs 成功即停表 → uiWorkspace 实例重建后无人补 patch。
    // 标记挂在函数上：宿主换函数/实例重建都会被下方复查重新捕获。
    const marked = (f: unknown): boolean => typeof f === 'function' && !!(f as { __nt?: boolean }).__nt
    try {
      const curOpen = ws.openSession as ((t: string) => void) | undefined
      if (typeof curOpen === 'function' && !marked(curOpen)) {
        const origOpen = curOpen.bind(ws)
        const wrappedOpen = (target: string) => {
          // E47：自由栏位关闭（原始对话模式）→ 宿主行为原样，插件一步都不插手
          if (!ntFreeMode) { origOpen(target); return }
          try {
            origOpen(target)
          } catch (e) {
            // 原版失败：保持「恒进工作台」的降级行为后原样上抛
            openTabBus.emit(String(target))
            try { ctx.layout?.selectPanel(MAIN_WORKBENCH as never) } catch { /* 布局缺席 */ }
            throw e
          }
          // 原版 replaceMain("reveal") 已同步落 selectPanel(null)：此刻登记链路已完成，夺回
          openTabBus.emit(String(target))
          try { ctx.layout?.selectPanel(MAIN_WORKBENCH as never) } catch { /* 布局缺席 */ }
        }
        ;(ws as { openSession: unknown }).openSession = wrappedOpen
        ;(wrappedOpen as unknown as { __nt?: boolean }).__nt = true
      }
      const curStart = ws.startSession as ((w?: string, b?: unknown) => Promise<void> | void) | undefined
      if (typeof curStart === 'function' && !marked(curStart)) {
        const origStart = curStart.bind(ws)
        // E43h：wrapper 只负责开面板保持窗口 + 武装交付（判据见 armNewSessionDelivery）。
        // 旧「轮询 mainView retained 变化」判据在空会话复用（E27）/ replaceMain 被
        // abort（E42b）时永远不成立，poll timeout 静默丢交付——这是「列表出新对话、
        // tab 不开不跳」的直接死因。新判据盯「ids 出现新成员」这一可见事实。
        const wrappedStart = (workspaceId?: string, beforeOpen?: unknown) => {
          // E47：原始对话模式下不武装交付（panel 不抢，tab 也不开）
          if (!ntFreeMode) return origStart(workspaceId, beforeOpen)
          return armNewSessionDelivery(ctx, () => origStart(workspaceId, beforeOpen))
        }
        ;(ws as { startSession: unknown }).startSession = wrappedStart
        ;(wrappedStart as unknown as { __nt?: boolean }).__nt = true
      }
      return true
    } catch { return false }
  }
  // E43h：常驻复查不清表——uiWorkspace 实例可能被宿主重建（E41 同源证据），
  // 停表即裸奔。已补丁时一次检查只做两次函数标记比较，开销可忽略。
  wbOpenPatch()
  const wsTimer = setInterval(() => { wbOpenPatch() }, 600)
  ctx.effect(() => () => clearInterval(wsTimer), 'dsh-newtype-multititle: E43h patch 常驻复查')

  // —— D15：启动自动进入工作台 ——
  // 宿主面板选择是瞬态（ui-layout README：reload 恢复默认 conversation），
  // 插件激活后主动切。apply 同步切一次会撞上宿主装配未完 → 轮询重试，
  // 以 panelInfo.activePanelId==='newtype' 确认生效才停（2026-10-09 E29，
  // 之前 setTimeout(0) 单次兜底不够，实测启动后仍停在原生对话）。
  // E47 起常驻语义由 ntFreeMode + 常驻订阅接管：真正让用户回到原生对话的是
  // 底部开关（它把 ntFreeMode 熄掉），不是「切走就放手」。本定时器只管开机进场。
  let wbTries = 0
  const wbTimer = setInterval(() => {
    if (wbTries++ > 25) { clearInterval(wbTimer); return }
    let active: string | null | undefined
    try {
      const snap = ctx.layout?.panelInfo
      active = (snap as { getSnapshot?: () => { activePanelId?: string | null } } | undefined)
        ?.getSnapshot?.()?.activePanelId
    } catch { /* snap 未就绪 */ }
    if (active === MAIN_WORKBENCH) { clearInterval(wbTimer); return }
    try { ctx.layout?.selectPanel(MAIN_WORKBENCH as never) } catch { /* 服务缺席：静默 */ }
  }, 400)

  // —— E47：自由栏位模式常驻订阅（取代 E43e 的 4 秒后写赢窗口）——
  //    模式 ON 时：不管谁把 activePanelId 改成 null（宿主原生对话），立即改回工作台。
  //    状态级订阅无法被绕过——宿主某些路径持有旧的 selectPanel 函数引用，实例遮蔽会被
  //    穿透（E43d 真机实证），但状态变化绕不过。
  //    模式 OFF：由底部开关置位，此时本订阅完全不动作。
  ctx.effect(() => {
    const pi = ctx.layout?.panelInfo as {
      subscribe?: (cb: () => void) => () => void
      getSnapshot?: () => { activePanelId?: string | null }
    } | undefined
    if (!pi?.subscribe || !pi.getSnapshot) return
    return pi.subscribe(() => {
      try {
        const active = pi.getSnapshot?.()?.activePanelId
        if (active === MAIN_WORKBENCH) { setFreeMode(true); return }
        if (ntFreeMode && active === null) ctx.layout?.selectPanel(MAIN_WORKBENCH as never)
      } catch { /* 布局缺席：静默 */ }
    })
  }, 'dsh-newtype-multititle: E47 自由栏位模式常驻')

  // —— 宿主行拖拽「默认图」压制（2026-10-12）——
  // 宿主会话/工作区行是 HTML5 draggable，onDragStart 只 setData('text/plain')
  // （dsh-client-ui-workspace/lib/client.js:1288-1291 工作区行、1599-1604 会话行），
  // 没设拖拽图 → 浏览器默认拿「被拖行快照」当拖拽图，深色、跟随光标，正好压住我们
  // 画在窗格上的蓝色落点框（主人反馈「深色卡还盖着蓝框」）。
  // 在 dragstart 冒泡末端（React 根容器之后）换成 1px 透明图 → 只剩蓝框，无深色卡。
  // 只认宿主行 [data-row-key]，不动选字等其它拖拽。
  // 用 canvas 而非 new Image()：后者 data URL 未解码完（img.complete=false）时
  // Chrome 会退回默认拖拽图 → 视觉上「没有变化」。canvas 同步可渲染，无加载时序问题。
  ctx.effect(() => {
    const blank = document.createElement('canvas')
    blank.width = 1
    blank.height = 1
    blank.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
    document.body.appendChild(blank)
    const onDragStart = (e: DragEvent) => {
      const t = e.target as Element | null
      if (!t || typeof t.closest !== 'function' || !t.closest('[data-row-key]')) return
      try { e.dataTransfer?.setDragImage(blank, 0, 0) } catch { /* 引擎不支持：忽略 */ }
    }
    document.addEventListener('dragstart', onDragStart)
    return () => {
      document.removeEventListener('dragstart', onDragStart)
      blank.remove()
    }
  }, 'dsh-newtype-multititle: 压制宿主行拖拽默认图')
}
