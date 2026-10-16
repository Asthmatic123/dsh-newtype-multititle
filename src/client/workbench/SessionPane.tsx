/**
 * 只读会话窗格（(c) 路线核心，05 §E11 X1）：
 * ctx.sessions.retain(id, {source:'dsh-newtype'}) → binding.eventSource
 * → useSyncExternalStore 直连 ObservableSnapshot，整窗派生渲染，无增量状态。
 * 流式尾巴 = 窗内 transient 块按 attemptId 折叠（text-delta 累加）。
 * 发送不在本窗格：聚焦走「原生打开」（openSession），FR-1.2 不自绘输入。
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import s from '../newtype.module.css'
import { nt, useT } from '../i18n.ts'

export interface SessionPaneProps {
  sessionId: string
  retainSession: (id: string) => NtSessionRef | null
}

interface Row {
  kind: 'user' | 'assistant' | 'tool'
  text: string
  live?: boolean
  interrupted?: boolean
  /** 同一行去重 key（seq 或 折叠 key） */
  key: string
}

const subNoop = () => () => {}
const getNoop = (): NtEventWindow | null => null

function blocksText(blocks: readonly NtContentBlock[] | undefined): string {
  if (!blocks?.length) return ''
  return blocks.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('')
}

/** 整窗派生：durable 事件 → 行；transient live-chunk 按 attemptId 折叠成流式尾巴。 */
function projectWindow(win: NtEventWindow | null): Row[] {
  const rows: Row[] = []
  const live = new Map<string, { text: string; seq: number }>()
  const entries = win?.entries ?? []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const ev = entry?.event
    if (!ev) continue
    if (entry.type === 'transient') {
      if (ev.data?.chunk?.type === 'text-delta' && typeof ev.data.chunk.text === 'string') {
        const k = ev.data.attemptId ?? `live-${i}`
        const cur = live.get(k) ?? { text: '', seq: ev.seq ?? i }
        cur.text += ev.data.chunk.text
        live.set(k, cur)
      }
      continue
    }
    switch (ev.type) {
      case 'user/message':
        rows.push({ kind: 'user', text: blocksText(ev.data?.content), key: `e${ev.seq ?? i}` })
        break
      case 'assistant/message':
        rows.push({
          kind: 'assistant',
          text: blocksText(ev.data?.message?.content),
          interrupted: ev.data?.interrupted === true,
          key: `e${ev.seq ?? i}`,
        })
        break
      case 'tool/call':
        rows.push({ kind: 'tool', text: ev.data?.name ?? 'tool', key: `e${ev.seq ?? i}` })
        break
      default:
        break // system/developer/request/turn/step 等不投影
    }
  }
  for (const [k, v] of live) {
    if (v.text) rows.push({ kind: 'assistant', text: v.text, live: true, key: `live-${k}` })
  }
  return rows.filter((r) => r.text)
}

export function SessionPane(props: SessionPaneProps) {
  const { sessionId, retainSession } = props
  const [src, setSrc] = useState<NtSnap<NtEventWindow> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useT()

  useEffect(() => {
    let ref: NtSessionRef | null = null
    let alive = true
    setSrc(null)
    setErr(null)
    try {
      ref = retainSession(sessionId)
      if (!ref) {
        setErr(nt('pane.serviceUnavailable'))
        return
      }
      ref.ready.then(
        (binding) => { if (alive) setSrc(binding?.eventSource ?? null) },
        (e) => { if (alive) setErr(String(e?.message ?? e ?? nt('pane.openFailed'))) },
      )
    } catch (e) {
      setErr(String(e))
    }
    return () => {
      alive = false
      try { ref?.release() } catch { /* 重复 release 防御 */ }
    }
  }, [sessionId, retainSession])

  const subscribe = useCallback(
    (cb: () => void) => (src ? src.subscribe(cb) : subNoop()),
    [src],
  )
  const getSnapshot = useCallback(
    () => (src ? src.getSnapshot() : getNoop()),
    [src],
  )
  const win = useSyncExternalStore(subscribe, getSnapshot)
  const rows = projectWindow(win)

  const bodyRef = useRef<HTMLDivElement>(null)
  const rev = win?.revision ?? 0
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [rev, rows.length])

  if (err) return <div className={s.perr}>{err}</div>
  return (
    <div ref={bodyRef} data-nt="mlist" className={s.mlist}>
      {rows.map((r) =>
        r.kind === 'user' ? (
          <div key={r.key} data-nt="muser" className={s.muser}>{r.text}</div>
        ) : r.kind === 'tool' ? (
          <div key={r.key} data-nt="mtool" className={s.mtool}>
            <svg viewBox="0 0 24 24" className={s.ic}><path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L15 12l-3-3 2.7-2.7z" /></svg>
            <span>{r.text}</span>
          </div>
        ) : (
          <div key={r.key} data-nt="massistant" className={s.massistant}>
            {r.text}
            {r.live && <span className={s.caret} />}
            {r.interrupted && <span className={s.mflag}>{nt('pane.interrupted')}</span>}
          </div>
        ),
      )}
      {!rows.length && <div className={s.pempty}>{nt('pane.noEvents')}</div>}
      {win?.hasMore && <div className={s.mmore}>{nt('pane.hasMore')}</div>}
    </div>
  )
}
