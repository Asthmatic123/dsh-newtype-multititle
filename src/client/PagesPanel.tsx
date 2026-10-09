/**
 * 图页面板（main key 'newtype-pages'，D14-L6）。
 *
 * D14 把左栏路线定为 C（sidebar.panellist 真 tab），所以图页不再挤在侧栏
 * NewTypePanel 里自绘 tab，而是独立成一个 main 面板。列表形态参考 trellis
 * 左侧文件树：单列行 + 悬停徽标。
 *
 * 数据面与图页面板（右栏产出物）共用 pages.ts 共享索引 —— 一份轮询，
 * 两处消费，徽标口径一致（AC-3）。
 */
import { useEffect, useMemo } from 'react'
import s from './newtype.module.css'
import { openTabBus } from './bus.ts'
import {
  attributedTo, isFresh, markSeen, noteActiveSession, retainedByMainView,
  startPages, usePages, PAGE_INBOX,
} from './pages.ts'

export interface PagesPanelProps {
  getSessionsList?: (() => NtSnap<NtSessionListState> | null) | null
}

export function PagesPanel(props: PagesPanelProps) {
  useEffect(() => { startPages() }, [])
  const pages = usePages()

  const listSrc = props.getSessionsList?.() ?? null
  const list = listSrc?.getSnapshot() ?? null
  const activeId = retainedByMainView(list?.ids, list?.byId)
  noteActiveSession(activeId)

  const rows = useMemo(
    () => pages.list.filter((p) => attributedTo(p.id) === (activeId ?? PAGE_INBOX)),
    [pages.list, activeId],
  )
  const freshN = useMemo(() => rows.filter((p) => isFresh(p.id)).length, [rows, pages.fv])

  return (
    <div data-nt="pagespanel" className={s.pgPanel}>
      <div className={s.pgHead}>
        <span className={s.pgTitle}>图页</span>
        {freshN > 0 && <span className={s.pgBadge} data-nt="pgbadge">+{freshN}</span>}
        {rows.length > 0 && (
          <button
            className={s.pgClear}
            data-nt="pgseenall"
            title="全部标记为已读"
            onClick={() => markSeen(rows.map((p) => p.id))}
          >已读</button>
        )}
      </div>
      <div className={s.pgList}>
        {rows.map((p) => (
          <div
            key={p.id}
            className={s.pgRow}
            data-nt="pgrow"
            title={p.name}
            onClick={() => { markSeen([p.id]); openTabBus.emit('page:' + p.id) }}
          >
            <svg viewBox="0 0 24 24" className={s.ic}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6" />
            </svg>
            <span className={s.pgName}>{p.name}</span>
            {isFresh(p.id) && <span className={s.pgDot} />}
          </div>
        ))}
        {!rows.length && <div className={s.pgEmpty}>暂无图页产出</div>}
      </div>
    </div>
  )
}