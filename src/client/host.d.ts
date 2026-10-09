/**
 * 宿主服务的最小声明（骨架期防御式）：
 *  Context.slots 真类型在 ui-renderer 包（本机 0.1.7 树未装），Context.uiWorkspace 在 ui-workspace 包。
 *  速查卡风险 7/8：0.2.0 字段面可能漂移 → 这里只声明我们确证的调用点，
 *  其余走 any；升级时本文件是第一个要复验的地方。
 *
 *  (c) 路线新增（2026-10-08）：Context.sessions 最小面。
 *  真契约 = dsh-api-session-controller client/contract/{sessions,session,events}.d.ts，
 *  E11 实证 0.1.7-rc.2 与官方 master 逐行一致；这里按已读契约内联，字段全可选。
 *
 *  D14 新增（2026-10-08）：标准座位 NtSessionProviderComponent / NtRenderFactorySlot，
 *  用于窗格里渲染宿主原版对话框（05 §E21）。
 *
 *  ⚠️ 本文件必须保持「无顶层 import/export」= 全局声明文件；React 类型用
 *  import('react') 内联写，加顶层 import 会让它变模块并丢掉全部全局声明。
 */
/** React 节点（内联导入，保持本文件为全局声明）。 */
type NtNode = import('react').ReactNode

/** ObservableSnapshot 最小面（dsh-client-store：getSnapshot + subscribe，React 可直连）。 */
interface NtSnap<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** 内容块最小面：只消费 text 块（dsh-llm ContentBlockMap 的 'text' 分支）。 */
interface NtContentBlock {
  type?: string
  text?: string
}

/** SessionEvent 最小面：只取会话流投影要用的字段（types.d.ts SessionEventMap）。 */
interface NtSessionEvent {
  type?: string
  seq?: number
  time?: number
  data?: {
    content?: readonly NtContentBlock[]
    message?: { content?: readonly NtContentBlock[] }
    name?: string
    interrupted?: boolean
    attemptId?: string
    chunk?: { type?: string; text?: string }
  }
}

/** 事件窗条目：durable 事件或客户端 live-chunk（events.d.ts SessionEventLikeEntry 最小面）。 */
interface NtEventEntry {
  type?: 'event' | 'transient'
  event?: NtSessionEvent
}

/** SessionEventWindow 最小面（events.d.ts:56-63，E11 实证）。 */
interface NtEventWindow {
  entries?: readonly NtEventEntry[]
  hasMore?: boolean
  revision?: number
}

/** SessionReference 最小面（contract/sessions.d.ts:22-30）。 */
interface NtSessionRef {
  sessionId: string
  ready: Promise<{ eventSource?: NtSnap<NtEventWindow> } | undefined>
  release(): void
}

/** SessionListState 最小面（useSessions 消费形状，NOTES 1.1b 实测）。 */
interface NtSessionListState {
  ids?: readonly string[]
  byId?: Record<string, {
    id?: string
    displayTitle?: string
    title?: string
    running?: boolean
    updatedAt?: number
    /** E34：宿主判定空会话用（ui-conversation client.js:16016 summaryBlank 同源） */
    blank?: boolean
    retainedBy?: Record<string, unknown> | string[]
  }>
}

/**
 * SessionProvider 标准座位最小面（D14-R1 新增，05 §E21）。
 * 真契约 = dsh-client-ui-slots/lib/types/index.d.ts:287-303：
 * 框架只在「声明了非 root 作用域子槽」的组件 props 上装这个座位
 * （ui-renderer client.js:732-740），所以它是 WorkbenchView 拿到原生对话框的前提。
 * session 省略 = 继承外层绑定；传 undefined = 显式无会话。
 */
type NtSessionProviderComponent = (props: {
  session?: NtSessionRef | undefined
  empty?: (() => NtNode) | undefined
  children: NtNode
}) => NtNode

/**
 * renderFactorySlot 最小面（D14-R2 新增）。
 * 真契约 = dsh-client-ui-slots/lib/types/index.d.ts:395-400（RenderFactorySlot）。
 * slots 参数是 factory 声明的 caller-selectable local slot 位置；
 * `conversation.content` 声明了 views(session) / widthControls(root)，见
 * dsh-client-ui-conversation contract/slots.d.ts:317-325。
 */
type NtRenderFactorySlot = (
  name: string,
  props: Record<string, unknown>,
  options?: { slots?: Record<string, unknown>; fallback?: NtNode },
) => NtNode

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** fiber 服务的 effect（cordis 包内声明链在本地类型图未展开，这里补最小面） */
    effect(fn: () => (() => void) | void, label?: string): void
    /** 命名日志器（cordis LoggerService，真类型在 cordis/logger） */
    logger(name?: string): { info(msg: string): void; warn(msg: string): void; error(msg: string): void }
    /** 槽注册面（ui-slots register/inject 语义，见 05 §E1） */
    slots: {
      inject(key: string, cb: () => unknown): () => void
      register(options: never, component: never): () => void
      /** 枚举某槽的注册项（宿主 sidebar 用它读 sidebar.panellist 导航清单，实读自 ui-sidebar client.js） */
      entriesOfSlot?(name: string): { options?: { id?: string; order?: number; label?: unknown } }[]
      subscribe?(name: string, cb: () => void): () => void
    }
    /** 会话导航面（ui-workspace navigation.d.ts 实证签名） */
    uiWorkspace: {
      openSession(target: string): void
      openWorkspace(workspaceId: string, beforeOpen?: unknown): Promise<void>
      startSession(workspaceId?: string): void
    }
    /**
     * 布局面（ui-layout service.d.ts 实证）：中央面板切换 + 右栏/侧栏控制。
     * selectPanel(null) = 原生对话；'newtype' = 我们注册的 main key。
     */
    layout?: {
      selectPanel(panelId: string | null): void
      readonly panelInfo: NtSnap<{ activePanelId?: string | null }>
      toggleSidebar(): void
      openRightbar(track: boolean, fullscreen: boolean): void
      closeRightbar(): void
    }
    /**
     * 会话对象层（session-controller client 注入，(c) 平铺路线的公开面，05 §E11 X1）。
     * source 必须用插件自有标签 'dsh-newtype'——勿用宿主 mainView 源，否则污染当前会话（#8 修复点③）。
     */
    sessions?: {
      retain(target: string, options: { source: string; signal?: AbortSignal }): NtSessionRef
      readonly list: NtSnap<NtSessionListState>
    }
    /** 右栏导航面（sidebar-right service；openTab 按 kind 开页型 tab）。 */
    sidebarRight?: {
      openTab(kind: string, options?: Record<string, unknown>): void
      /** E31：资源打开入口（对话内点文件走这里）；工作台态会响亮失败，我们在 client 入口包一层接住 */
      openResource?(address: string, options?: Record<string, unknown>): void
    }
    /** better-sidebar 开放服务（E31c）：openTab 不带 path 落自绘底部工作台，不受右栏限制 */
    betterSidebar?: {
      openTab(seed: { type: string; path?: string; title?: string }, scope?: unknown): void
    }
    /** 右栏 tab 类型注册器（两段式的类型段）。 */
    sidebarRightTabs?: {
      register(definition: {
        id: string
        kind: string
        multiple?: boolean
        keepMounted?: boolean
        patterns?: readonly string[]
        priority?: 'extension' | 'builtin' | 'fallback'
        title: (address: string) => string
        guide?: readonly { id: string; order: number; title: () => string; description?: () => string }[]
      }): () => void
    }
  }
}
