/**
 * B10-b（2026-10-12 主人拍板方案 A）：会话窗格子页签行 + 子代理面板。
 *
 * 口径对齐原版（dsh-client-ui-subagent，bundle 实证）：
 *  - 有子代理才显示「子代理」页签（原版 SubagentCatalogAction 同判据：catalog 非空）；
 *  - 数据源 = sessions list store 的 projection `subagentCatalog`
 *    （条目 {id, createdAt, mode, label?}，dsh-subagent lib/types/projection-types.d.ts）；
 *  - 运行态 = byId[childId].running（workspace client.js runningChildCount 同款取法）；
 *  - 点击子代理 → openSession({parentSessionId, childSessionId, mode}) 走宿主
 *    openSession(SubagentAddress) 原版链路切主视图（subagent client.js:905-908 同款）。
 *
 * 多子代理的「hover 选择 / 子子 tab」先不做：页签体内是普通列表，点击即开——
 * 与 hover 菜单等价且少一层浮层（主人给的是二选一设计题，先交能用的这版）。
 *
 * 唤醒纪律：列表订阅带 catalog 签名门（沿用 WorkbenchView sessionSig 思路），
 * 流式期标题不变 emit 不会打醒 React；catalog 变化（新子代理/标题）才重渲染。
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import s from '../newtype.module.css'
import { nt, useT } from '../i18n.ts'
import type { NewTypeKey } from '../i18n.ts'

export type NtSessionMode = 'chat' | 'subs' | 'jobs' | 'trace'

type CatEntry = {
  id: string
  createdAt?: number
  mode?: 'one-shot' | 'continuable' | 'unknown'
  label?: string
}

/** JobView 最小面（dsh-jobs lib/types/view.d.ts:52-95，client-safe 明示可引用）。 */
export type JobView = {
  id?: string
  kind?: string
  label?: string
  status?: 'running' | 'stopping' | 'completed' | 'killed' | 'failed' | string
  startedAt?: number
}

type JobsModel = {
  /** 当前行集；subscribe 缺席 = 无响应式（静态读一次，页签数可能滞后） */
  rows: () => Record<string, readonly JobView[] | undefined> | undefined
  subscribe: ((cb: () => void) => () => void) | null
}

/**
 * 后台任务取数（B10-c）。ctx.jobs.state = ClientJobsModel（dsh-client-ui-jobs
 * client.js:27-38 {rows, observed}）；响应式形态未在 bundle 外实证，做双形态兼容：
 * state 自身像 store（subscribe+getSnapshot）就走响应式，否则退静态读。
 */
function jobsModel(jobs: unknown): JobsModel | null {
  const st = (jobs as { state?: {
    rows?: Record<string, readonly JobView[] | undefined>
    subscribe?: (cb: () => void) => () => void
    getSnapshot?: () => { rows?: Record<string, readonly JobView[] | undefined> | undefined }
  } } | null | undefined)?.state
  if (!st) return null
  if (typeof st.subscribe === 'function' && typeof st.getSnapshot === 'function') {
    return { rows: () => st.getSnapshot?.()?.rows, subscribe: (cb) => st.subscribe!(cb) }
  }
  return { rows: () => st.rows, subscribe: null }
}

/** 后台任务行（带签名门订阅，同 useCatalog）。 */
function useJobsRows(jobs: unknown, sid: string): readonly JobView[] {
  const m = useMemo(() => jobsModel(jobs), [jobs])
  const lastSig = useRef('')
  const subscribe = useMemo(
    () => (cb: () => void) => {
      if (!m?.subscribe) return () => {}
      return m.subscribe(() => {
        const rows = m.rows()?.[sid]
        const sig = JSON.stringify(rows ?? [])
        if (sig === lastSig.current) return
        lastSig.current = sig
        cb()
      })
    },
    [m, sid],
  )
  const getSnap = useCallback(() => m?.rows()?.[sid] ?? null, [m, sid])
  return useSyncExternalStore(subscribe, getSnap, getSnap) ?? []
}

const JOB_STATE_KEY: Record<string, NewTypeKey> = {
  running: 'job.running',
  stopping: 'job.stopping',
  completed: 'job.completed',
  killed: 'job.stopped',
  failed: 'job.failed',
}

type ListSrc = {
  getSnapshot: () => {
    byId?: Record<string, { displayTitle?: string; title?: string; running?: boolean; blank?: boolean }> | undefined
    projectionsBySession?: Record<string, {
      values?: { subagentCatalog?: readonly CatEntry[] | undefined } | undefined
    }> | undefined
  } | undefined
  subscribe: (cb: () => void) => () => void
}

/** 带签名门的 catalog 订阅：catalog JSON 没变不叫醒（防流式 emit 风暴）。 */
function useCatalog(listSrc: ListSrc | null | undefined, sid: string): readonly CatEntry[] {
  const lastSig = useRef('')
  const subscribe = useMemo(
    () => (cb: () => void) => {
      if (!listSrc) return () => {}
      return listSrc.subscribe(() => {
        const cat = listSrc.getSnapshot()?.projectionsBySession?.[sid]?.values?.subagentCatalog
        const sig = JSON.stringify(cat ?? [])
        if (sig === lastSig.current) return
        lastSig.current = sig
        cb()
      })
    },
    [listSrc, sid],
  )
  const getSnap = useCallback(
    () => listSrc?.getSnapshot()?.projectionsBySession?.[sid]?.values?.subagentCatalog ?? null,
    [listSrc, sid],
  )
  return useSyncExternalStore(subscribe, getSnap, getSnap) ?? []
}

/** 子页签行：对话 / [子代理（有才显示）] / [后台（有才显示）] / 轨迹。 */
export function SessionSubTabs(props: {
  listSrc: ListSrc | null | undefined
  jobs: unknown
  sid: string
  mode: NtSessionMode
  setParams: (patch: Record<string, unknown>) => void
}) {
  const entries = useCatalog(props.listSrc, props.sid)
  const jobsRows = useJobsRows(props.jobs, props.sid)
  const t = useT()
  const tab = (id: NtSessionMode, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={props.mode === id}
      className={props.mode === id ? s.minitabOn : s.minitab}
      onClick={() => props.setParams({ mode: id })}
    >{label}</button>
  )
  return (
    <div className={s.minitabs} role="tablist">
      {tab('chat', t('sub.tabChat'))}
      {entries.length > 0 && tab('subs', t('sub.tabSubs', { n: entries.length }))}
      {jobsRows.length > 0 && tab('jobs', t('sub.tabJobs', { n: jobsRows.length }))}
      {tab('trace', t('sub.tabTrace'))}
    </div>
  )
}

/** 后台任务面板：任务列表（展开终端输出需 follow 流，本版不做，只列状态）。 */
export function JobsPane(props: { jobs: unknown; sid: string }) {
  const rows = useJobsRows(props.jobs, props.sid)
  const t = useT()
  if (rows.length === 0) {
    return <div className={s.pempty}>{t('sub.noJobs')}</div>
  }
  return (
    <div className={s.subsPane}>
      {rows.map((j, i) => {
        const running = j.status === 'running' || j.status === 'stopping'
        return (
          <div key={j.id ?? i} className={s.subsRow}>
            <span className={running ? `${s.subsDot} ${s.subsDotRun}` : s.subsDot} />
            <span className={s.subsTitle}>{j.label ?? j.id ?? nt('sub.untitled')}</span>
            <span className={s.subsState}>{(() => { const k = JOB_STATE_KEY[j.status ?? '']; return k ? t(k) : (j.status ?? nt('sub.unknown')) })()}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 子代理面板：catalog 列表，点击走宿主 openSession(SubagentAddress) 原版链路。 */
export function SubagentsPane(props: {
  listSrc: ListSrc | null | undefined
  sid: string
  /** 宿主 openSession：接 SubagentAddress（sharedInject 原样透传 uiWorkspace.openSession） */
  onOpen: (addr: { parentSessionId: string; childSessionId: string; mode: 'one-shot' | 'continuable' | 'unknown' }) => void
}) {
  const entries = useCatalog(props.listSrc, props.sid)
  const lastSig = useRef('')
  const subscribe = useMemo(
    () => (cb: () => void) => {
      if (!props.listSrc) return () => {}
      return props.listSrc.subscribe(() => {
        const byId = props.listSrc?.getSnapshot()?.byId
        const sig = entries.map((e) => `${e.id}:${byId?.[e.id]?.running ? 1 : 0}:${byId?.[e.id]?.displayTitle ?? ''}`).join('|')
        if (sig === lastSig.current) return
        lastSig.current = sig
        cb()
      })
    },
    [props.listSrc, entries],
  )
  const list = useSyncExternalStore(
    subscribe,
    () => props.listSrc?.getSnapshot() ?? null,
    () => props.listSrc?.getSnapshot() ?? null,
  )
  const t = useT()
  if (entries.length === 0) {
    return <div className={s.pempty}>{t('sub.noSubs')}</div>
  }
  return (
    <div className={s.subsPane}>
      {entries.map((e) => {
        const rec = list?.byId?.[e.id]
        const running = rec?.running === true
        const title = e.label ?? rec?.displayTitle ?? rec?.title ?? e.id.slice(0, 8)
        return (
          <button
            key={e.id}
            type="button"
            className={s.subsRow}
            title={t('sub.openAria', { title })}
            onClick={() => props.onOpen({ parentSessionId: props.sid, childSessionId: e.id, mode: e.mode ?? 'unknown' })}
          >
            <span className={running ? `${s.subsDot} ${s.subsDotRun}` : s.subsDot} />
            <span className={s.subsTitle}>{title}</span>
            <span className={s.subsState}>{running ? t('job.running') : (e.mode === 'continuable' ? t('sub.resumable') : t('sub.ended'))}</span>
          </button>
        )
      })}
    </div>
  )
}
