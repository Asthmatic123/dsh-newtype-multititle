/**
 * NewType client i18n（zh/en 双语）：
 *  - 字典经 @deepseek-ai/dsh-client-locale 注册（package.json client.inject 已声明），
 *    文案跟随 DSH 语言设置；register 的「双语平衡」在编译期由键类型强制（en 键集 = zh 键集）。
 *  - 命名空间 'newtype' 经 LocaleNamespaceMap 声明合并登记（与 common/settings.locale 同法）。
 *  - nt() 任意调用点可用（读调用时刻的当前语言）；useT() 供组件订阅语言代际（revision），
 *    切语言时组件重渲染拿新文案。
 *  - 宿主无 locale 运行时（理论不存在，inject 已声明）：nt() 回落 zh 原文案，不炸插件。
 *  - 声明面遵循 host.d.ts 的最小口径（真类型在未安装的 dsh-client-locale 包）。
 */
import { useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** 本插件在 LocaleNamespaceMap 登记的命名空间。 */
export const NT_NS = 'newtype'

/** zh 字典（源文案）。键即文案标识，值可带 {name} 模板参数。导出供字典级测试引用。 */
export const zh = {
  // index.tsx：底部开关 / 2D列表按钮 / 右栏产出物
  'toggle.native': '原版',
  'toggle.workbench': '自由栏位',
  'toggle.title.back': '切回宿主原生对话（原版） · build {build}',
  'toggle.title.to': '切到自由栏位工作台 · build {build}',
  'dots.label': '2D列表',
  'dots.title.exit': '退出 2D 列表模式（还原布局与侧栏）',
  'dots.title.enter': '2D 列表模式（折叠侧栏 + 靠左点图窗格）',
  'artifacts.title': '产出物',
  'artifacts.guideDesc': '当前会话的图页与产出',

  // WorkbenchView：空态 / 启动 / tab 标题 / 右栏
  'wb.traceUnavailable': '轨迹视图不可用（宿主未提供 trajectory 视图）',
  'wb.newChat': '新对话',
  'wb.sessionNotReady': '会话服务未就绪',
  'wb.tabFile': '文件',
  'wb.tabBrowser': '浏览器',
  'wb.tabDots': '点图',
  'wb.emptyHint': '把左侧会话拖到窗格边缘分栏 · 拖到窗格中心并入 · 双击 tab 条聚焦',
  'wb.emptyNew': '新建会话：用左栏原版「新对话」（NT1013C：工作台 tab 上的「＋」已移除）',
  'wb.starting': '工作台启动中…',
  'wb.collapseRight': '收起右栏',

  // SessionAccessories：齿轮菜单 / Open In… / 下载日志 / 浏览器按钮
  'acc.cat.editor': '编辑器 · IDE',
  'acc.cat.terminal': '终端',
  'acc.cat.files': '文件管理器',
  'acc.app.explorer': '文件资源管理器',
  'acc.app.fileManager': '文件管理器',
  'acc.openWith': '用「{name}」打开会话目录',
  'acc.openIn': 'Open In… · 打开会话目录',
  'acc.openInHeader': '在以下应用中打开会话目录',
  'acc.noOpenService': '宿主未提供打开服务',
  'acc.noApps': '未探测到可用应用',
  'acc.remembered': '记住',
  'acc.category': '会话功能',
  'acc.transcriptSoon': '接宿主 transcript 导出后启用',
  'acc.downloadLog': '下载对话日志',
  'acc.openBrowser': '打开浏览器',

  // SubagentsPane：后台任务状态 / 子代理页签 / 行徽标
  'job.running': '运行中',
  'job.stopping': '停止中',
  'job.completed': '已完成',
  'job.stopped': '已停止',
  'job.failed': '失败',
  'sub.tabChat': '对话',
  'sub.tabSubs': '子代理 {n}',
  'sub.tabJobs': '后台 {n}',
  'sub.tabTrace': '轨迹',
  'sub.noJobs': '该会话没有后台任务',
  'sub.untitled': '(未命名任务)',
  'sub.unknown': '未知',
  'sub.noSubs': '该会话没有子代理记录',
  'sub.openAria': '打开子代理对话：{title}',
  'sub.resumable': '可续',
  'sub.ended': '已结束',

  // WebPane：地址栏 / 状态 / 引擎回落
  'web.leaseFailed': '租约获取失败：{error}',
  'web.exited': '浏览进程已退出',
  'web.placeholder': '输入地址，如 localhost:3080 或 example.com',
  'web.go': '转到',
  'web.openExternal': '外部浏览器打开',
  'web.closePage': '关闭页面',
  'web.enterAddress': '输入地址打开页面',
  'web.iframeHint': 'web 版走 iframe，部分站点拒绝嵌入时用 ↗ 外部打开',
  'web.webviewFellBack': 'webview 不可用已回落 iframe。',
  'web.retryWebview': '重试 webview',

  // ArtifactsPanel / 工作台右栏
  'art.openHint': '\n点击进工作台窗格',
  'art.emptyMine': '暂无产出页',
  'art.fresh': '新到',
  'art.noFresh': '无新到页',
  'art.inbox': '收件箱',
  'art.inboxEmpty': '收件箱空',

  // FilePane：只读文件窗格
  'file.noInline': '该格式暂不支持内嵌预览（{ext}）',
  'file.readFailed': '读取失败：{error}',
  'file.reading': '读取中…',
  'file.serviceNotReady': '文件服务未就绪（host 半未挂载）',
  'file.noPath': '缺少文件路径',

  // HostConversationPane / SessionPane：原版对话框窗格与降级投影
  'pane.openFailed': '打开失败',
  'pane.loadingSession': '加载会话…',
  'pane.cannotRender': '该窗格无法渲染原生对话框',
  'pane.serviceUnavailable': '会话服务不可用',
  'pane.interrupted': '（已中断）',
  'pane.noEvents': '（还没有可显示的事件）',
  'pane.hasMore': '更早的历史未加载',
}

export type NewTypeKey = keyof typeof zh

/** en 字典：键集编译期对齐 zh（缺键/多键即编译错）。 */
export const en: Record<NewTypeKey, string> = {
  'toggle.native': 'Native',
  'toggle.workbench': 'Free panes',
  'toggle.title.back': 'Back to the native host conversation · build {build}',
  'toggle.title.to': 'Open the free-pane workbench · build {build}',
  'dots.label': '2D list',
  'dots.title.exit': 'Exit 2D list mode (restores layout & sidebar)',
  'dots.title.enter': '2D list mode (collapses sidebar + left-aligned dots pane)',
  'artifacts.title': 'Artifacts',
  'artifacts.guideDesc': 'Pages and artifacts of the current session',

  'wb.traceUnavailable': 'Trace view unavailable (host provides no trajectory view)',
  'wb.newChat': 'New chat',
  'wb.sessionNotReady': 'Session service not ready',
  'wb.tabFile': 'File',
  'wb.tabBrowser': 'Browser',
  'wb.tabDots': 'Dots',
  'wb.emptyHint': 'Drag a session to a pane edge to split · drop on the center to merge · double-click a tab strip to zoom',
  'wb.emptyNew': 'New session: use the native "New chat" in the left sidebar (NT1013C: the "+" on workbench tabs was removed)',
  'wb.starting': 'Starting workbench…',
  'wb.collapseRight': 'Collapse right panel',

  'acc.cat.editor': 'Editor · IDE',
  'acc.cat.terminal': 'Terminal',
  'acc.cat.files': 'Files',
  'acc.app.explorer': 'File Explorer',
  'acc.app.fileManager': 'File Manager',
  'acc.openWith': 'Open the session folder with {name}',
  'acc.openIn': 'Open In… · open the session folder',
  'acc.openInHeader': 'Open the session folder with one of these apps',
  'acc.noOpenService': 'Host provides no open service',
  'acc.noApps': 'No usable apps detected',
  'acc.remembered': 'Remembered',
  'acc.category': 'Session tools',
  'acc.transcriptSoon': 'Enables once the host ships transcript export',
  'acc.downloadLog': 'Download chat log',
  'acc.openBrowser': 'Open browser',

  'job.running': 'Running',
  'job.stopping': 'Stopping',
  'job.completed': 'Completed',
  'job.stopped': 'Stopped',
  'job.failed': 'Failed',
  'sub.tabChat': 'Chat',
  'sub.tabSubs': 'Subagents {n}',
  'sub.tabJobs': 'Jobs {n}',
  'sub.tabTrace': 'Trace',
  'sub.noJobs': 'No background jobs in this session',
  'sub.untitled': '(untitled job)',
  'sub.unknown': 'Unknown',
  'sub.noSubs': 'No subagent records in this session',
  'sub.openAria': 'Open subagent chat: {title}',
  'sub.resumable': 'Resumable',
  'sub.ended': 'Ended',

  'web.leaseFailed': 'Failed to acquire lease: {error}',
  'web.exited': 'Browser process exited',
  'web.placeholder': 'Type an address, e.g. localhost:3080 or example.com',
  'web.go': 'Go',
  'web.openExternal': 'Open in external browser',
  'web.closePage': 'Close page',
  'web.enterAddress': 'Type an address to open a page',
  'web.iframeHint': 'Web uses an iframe; use ↗ to open externally when a site refuses embedding',
  'web.webviewFellBack': 'Webview unavailable; fell back to iframe.',
  'web.retryWebview': 'Retry webview',

  'art.openHint': '\nClick to open in a workbench pane',
  'art.emptyMine': 'No artifact pages yet',
  'art.fresh': 'New',
  'art.noFresh': 'No new pages',
  'art.inbox': 'Inbox',
  'art.inboxEmpty': 'Inbox empty',

  'file.noInline': 'No inline preview for this format yet ({ext})',
  'file.readFailed': 'Read failed: {error}',
  'file.reading': 'Reading…',
  'file.serviceNotReady': 'File service not ready (host half not mounted)',
  'file.noPath': 'Missing file path',

  'pane.openFailed': 'Failed to open',
  'pane.loadingSession': 'Loading session…',
  'pane.cannotRender': 'This pane cannot render the native conversation',
  'pane.serviceUnavailable': 'Session service unavailable',
  'pane.interrupted': '(interrupted)',
  'pane.noEvents': '(no events to show yet)',
  'pane.hasMore': 'Earlier history not loaded',
}

/** 命名空间登记：typed register/bind（框架 t 座位）与 common 查找链都靠这张表。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    [NT_NS]: NewTypeKey
  }
}

/** locale 运行时最小声明面（真类型在未安装的 dsh-client-locale 包；口径同 host.d.ts）。 */
interface NtLocaleRuntime {
  register(ns: string, dicts: Record<'zh' | 'en', Record<string, string>>): () => void
  bind(ns: string): (key: string, params?: Record<string, unknown>) => string
  getSnapshot(): { revision: number }
  subscribe(fn: () => void): () => void
}

let localeRt: NtLocaleRuntime | null = null
let tNS: ((key: NewTypeKey, params?: Record<string, unknown>) => string) | null = null

/** apply 时注册字典 + 绑定 translate；locale 运行时缺席（理论不存在）则回落 zh。 */
export function registerI18n(ctx: Context): void {
  const locale = (ctx as Context & { locale?: NtLocaleRuntime }).locale
  if (!locale) return
  localeRt = locale
  ctx.effect(() => locale.register(NT_NS, { zh, en }), 'dsh-newtype-multititle: i18n 字典注册')
  tNS = locale.bind(NT_NS) as typeof tNS
}

/** 模板参数兜底插值（仅未注册走这条；注册后由 locale 运行时插值）。 */
function fill(template: string, params?: Record<string, unknown>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    params[k] === undefined ? m : String(params[k]))
}

/** 任意调用点可用：读调用时刻的当前语言；未注册回落 zh 原文案。 */
export function nt(key: NewTypeKey, params?: Record<string, unknown>): string {
  if (tNS) return tNS(key, params)
  return fill(zh[key], params)
}

/** 组件用：订阅语言代际（切语言/字典晚到都 bump revision），重渲染取新文案。 */
export function useT(): typeof nt {
  useSyncExternalStore(
    (cb: () => void) => localeRt?.subscribe(cb) ?? (() => {}),
    () => localeRt?.getSnapshot().revision ?? 0,
    () => 0,
  )
  return nt
}
