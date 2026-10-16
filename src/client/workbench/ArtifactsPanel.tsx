/**
 * 产出物面板（两个形态）：
 *  - mode="session"：右栏 pane.tab body（挂某会话，scope 自带 sessionId）
 *  - mode="global"：工作台右侧栏（trellis Preview 式）：新到（任意会话）+ 收件箱 两节
 * 数据全走 pages.ts 共享索引；点击 = 过目 + 进工作台焦点窗格。
 */
import s from '../newtype.module.css'
import { openTabBus } from '../bus.ts'
import { attributedTo, isFresh, markSeen, usePages, PAGE_INBOX } from '../pages.ts'
import { nt, useT } from '../i18n.ts'

export interface ArtifactsPanelProps {
  /** session scope 标准道具（pane.tab 形态用）；global 形态不需要 */
  sessionId?: string
  mode?: 'session' | 'global'
}

function Row({ id, name, fresh }: { id: string; name: string; fresh: boolean }) {
  return (
    <div
      data-nt="artrow"
      className={s.row}
      title={name + nt('art.openHint')}
      onClick={() => { markSeen([id]); openTabBus.emit('page:' + id) }}
    >
      <span className={s.ico + (fresh ? ' ' + s.icoFresh : '')}>
        <svg viewBox="0 0 24 24" className={s.ic}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M9 13h6M9 17h6" /></svg>
      </span>
      <span className={s.t}>{name}</span>
    </div>
  )
}

export function ArtifactsPanel(props: ArtifactsPanelProps) {
  const pages = usePages()
  const t = useT()
  const global = props.mode === 'global'
  const sid = props.sessionId ?? null

  const fresh = pages.list.filter((p) => isFresh(p.id))
  const inbox = pages.list.filter((p) => !isFresh(p.id) && attributedTo(p.id) === PAGE_INBOX)
  const mine = pages.list.filter((p) => attributedTo(p.id) === (sid ?? PAGE_INBOX))

  if (!global) {
    return (
      <div data-nt="artpanel" className={s.panel}>
        <div className={s.hd}>
          <span>{t('artifacts.title')}</span>
          <span className={s.count}>{mine.length}</span>
        </div>
        <div className={s.list}>
          {mine.map((p) => <Row key={p.id} id={p.id} name={p.name} fresh={isFresh(p.id)} />)}
          {!mine.length && <div className={s.empty}>{t('art.emptyMine')}</div>}
        </div>
      </div>
    )
  }

  return (
    <div data-nt="artpanel" data-nt-mode="global" className={s.panel}>
      <div className={s.hd}>
        <span>{t('art.fresh')}</span>
        <span className={s.count} data-nt="artfresh">{fresh.length}</span>
      </div>
      <div className={s.list} style={{ flex: 'none', maxHeight: '40%' }}>
        {fresh.map((p) => <Row key={p.id} id={p.id} name={p.name} fresh />)}
        {!fresh.length && <div className={s.empty}>{t('art.noFresh')}</div>}
      </div>
      <div className={s.hd}>
        <span>{t('art.inbox')}</span>
        <span className={s.count}>{inbox.length}</span>
      </div>
      <div className={s.list}>
        {inbox.map((p) => <Row key={p.id} id={p.id} name={p.name} fresh={false} />)}
        {!inbox.length && <div className={s.empty}>{t('art.inboxEmpty')}</div>}
      </div>
    </div>
  )
}
