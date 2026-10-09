/**
 * NewType client 入口（D14 后）：
 *  ① main key 'newtype'         → 工作台（split 树 + 每格原版对话框）
 *  ② main key 'newtype-pages'   → 图页面板
 *  ③ sidebar.panellist ×2       → 侧栏两行 PanelRow（路线 C 的真 tab）
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
import { WorkbenchView } from './workbench/WorkbenchView.tsx'
import { ArtifactsPanel } from './workbench/ArtifactsPanel.tsx'
import { Statusbar } from './shell/Statusbar.tsx'
import { artifactPanelBus, artRail, openTabBus, setPendingSession } from './bus.ts'
import { retainedByMainView } from './pages.ts'

/** main 槽的 key，必须与 sidebar.panellist 条目 id 一一对应（PointRow → selectPanel）。 */
const MAIN_WORKBENCH = 'newtype'
const MAIN_PAGES = 'newtype-pages'

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
export const inject = ['slots', 'uiWorkspace', 'sessions', 'sidebarRight', 'sidebarRightTabs', 'layout']

/** 公共 inject 工厂：惰性读 ctx（apply 时序安全） */
function sharedInject(ctx: Context) {
  return () => ({
    openSession: (id: string) => { ctx.uiWorkspace?.openSession(id as never) },
    retainSession: (id: string) => ctx.sessions?.retain(id, { source: 'dsh-newtype-multititle' }) ?? null,
    getSessionsList: () => ctx.sessions?.list ?? null,
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
  })
}

export function apply(ctx: Context): void {
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

  ctx.effect(
    () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: MAIN_WORKBENCH, order: 20, label: '自由栏位' } as never,
      panelIcon('workbench') as never,
    )),
    'dsh-newtype-multititle: 侧栏面板项（工作台）',
  )
  // —— 图页面板/图页行已按主人裁定撤除（PagesPanel.tsx 留底不删）——
  void MAIN_PAGES

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
    try { ctx.layout?.selectPanel('newtype') } catch { /* 布局面缺席：静默 */ }
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

  // —— E31b：工作台态下点左栏会话行 = 开进工作台 tab（不再被宿主踹回原生对话）——
  // 宿主 WorkspaceBrowser 行点击调 uiWorkspace.openSession → 切到原生对话面板。
  // 工作台是当前面板时改为往工作台开 session tab；对话态照走原版（不劫持）。
  // E33 补：「新会话」按钮走 startSession（另一条路），同样劫持——调原版后轮询
  // 会话列表找新增的 sid，拉回工作台开 tab（主人实测：关全部 tab 再新开会话会回退原生态）。
  const inWorkbench = (): boolean => {
    try {
      return (ctx.layout?.panelInfo as { getSnapshot?: () => { activePanelId?: string | null } } | undefined)
        ?.getSnapshot?.()?.activePanelId === 'newtype'
    } catch { return false }
  }
  const wbOpenPatch = () => {
    const ws = ctx.uiWorkspace
    if (!ws) return false
    const g = ws as { openSession?: unknown; startSession?: unknown; __ntOrig?: unknown }
    if (g.__ntOrig) return true
    const orig = (ws.openSession as (t: string) => void).bind(ws)
    try {
      ;(ws as { openSession: unknown }).openSession = (target: string) => {
        if (inWorkbench()) { openTabBus.emit(String(target)); return }
        orig(target)
      }
      const origStart = (ws.startSession as ((w?: string, b?: unknown) => Promise<void> | void) | undefined)?.bind(ws)
if (origStart) {
        ;(ws as { startSession: unknown }).startSession = (workspaceId?: string, beforeOpen?: unknown) => {
          const wb = inWorkbench()
          if (!wb) return origStart(workspaceId, beforeOpen)
          const r = origStart(workspaceId, beforeOpen)
          // 0.2.0「新会话」复用空会话（E27），等不到新 id → 改等 replaceMain 留下的
          // mainView 保留会话（它必然发生），拿到后拉回工作台开 tab
          let tries = 0
          const t = setInterval(() => {
            if (++tries > 30) { clearInterval(t); return }
            const snap = (ctx.sessions?.list as { getSnapshot?: () => { ids?: readonly string[]; byId?: Record<string, { retainedBy?: Record<string, unknown> | string[] }> } } | undefined)?.getSnapshot?.()
            const mid = retainedByMainView(snap?.ids, snap?.byId)
            if (mid) {
              clearInterval(t)
              setPendingSession(mid)
              try { ctx.layout?.selectPanel('newtype' as never) } catch { /* 布局缺席 */ }
            }
          }, 200)
          return r
        }
      }
      g.__ntOrig = orig
      return true
    } catch { return false }
  }
  let patchedWs = wbOpenPatch()
  const wsTimer = setInterval(() => {
    if (patchedWs || wbOpenPatch()) { patchedWs = true; clearInterval(wsTimer) }
  }, 600)

  // —— D15：启动自动进入工作台 ——
  // 宿主面板选择是瞬态（ui-layout README：reload 恢复默认 conversation），
  // 插件激活后主动切。apply 同步切一次会撞上宿主装配未完 → 轮询重试，
  // 以 panelInfo.activePanelId==='newtype' 确认生效才停（2026-10-09 E29，
  // 之前 setTimeout(0) 单次兜底不够，实测启动后仍停在原生对话）。
  // 不驻留——用户手动切回对话后插件不抢回。
  let wbTries = 0
  const wbTimer = setInterval(() => {
    if (wbTries++ > 25) { clearInterval(wbTimer); return }
    let active: string | null | undefined
    try {
      const snap = ctx.layout?.panelInfo
      active = (snap as { getSnapshot?: () => { activePanelId?: string | null } } | undefined)
        ?.getSnapshot?.()?.activePanelId
    } catch { /* snap 未就绪 */ }
    if (active === 'newtype') { clearInterval(wbTimer); return }
    try { ctx.layout?.selectPanel('newtype' as never) } catch { /* 服务缺席：静默 */ }
  }, 400)
}
