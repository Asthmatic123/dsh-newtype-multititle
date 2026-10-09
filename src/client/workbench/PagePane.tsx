/**
 * 图页窗格：host 半只读服务里 iframe 页面本体（FR-4.1 点开才渲染）。
 * 本地 127.0.0.1 互 iframe 无同源栅栏（05 §E6 判据存档）。
 */
import s from '../newtype.module.css'
import { pagesBase, titleOf } from '../pages.ts'

export function PagePane({ pageId }: { pageId: string }) {
  return (
    <iframe
      className={s.pif}
      src={`${pagesBase()}/newtype/page/${pageId}`}
      title={titleOf(pageId)}
    />
  )
}
