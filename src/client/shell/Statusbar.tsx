/**
 * trellis 状态栏（shell.overlay 浮层，P1.7 batch 2）：
 * 仅工作台面板激活时渲染（panelInfo 订阅），不干扰原生对话。
 * 浮层默认点击穿透，本栏 root 自开 pointer-events。
 */
import { useSyncExternalStore } from 'react'
import s from '../newtype.module.css'
import { usePages } from '../pages.ts'

const subNoop = () => () => {}

export interface StatusbarProps {
  getPanelInfo?: () => NtSnap<{ activePanelId?: string | null }> | null
  getSessionsList?: () => NtSnap<NtSessionListState> | null
}

export function Statusbar(props: StatusbarProps) {
  const infoSrc = props.getPanelInfo?.() ?? null
  const info = useSyncExternalStore(
    infoSrc ? (cb) => infoSrc.subscribe(cb) : subNoop,
    () => infoSrc?.getSnapshot() ?? null,
  )
  const listSrc = props.getSessionsList?.() ?? null
  const list = useSyncExternalStore(
    listSrc ? (cb) => listSrc.subscribe(cb) : subNoop,
    () => listSrc?.getSnapshot() ?? null,
  )
  const pages = usePages()

  if (info?.activePanelId !== 'newtype') return null
  const ids = list?.ids ?? []
  const running = ids.filter((id) => list?.byId?.[id]?.running).length

  return (
    <div data-nt="stbar" className={s.stbar}>
      <span className={s.stbBrand}>DSH · 工作台</span>
      <span className={s.stbR}>
        <span>会话 {ids.length}</span>
        {running > 0 && <span>运行 {running}</span>}
        <span>图页 {pages.list.length}</span>
      </span>
    </div>
  )
}
