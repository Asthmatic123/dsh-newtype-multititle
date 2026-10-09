/**
 * 浏览器窗格（E32）：工作台内置内部浏览器。
 * 自绘 URL 栏 + iframe——不骑宿主右栏，工作台态可用。
 * 已知限制：目标站 X-Frame-Options/CSP 拒绝 iframe 时显示空白（任何 iframe 方案同限；
 * dsh-sidebar-browser 的反代是例外，但它被右栏闸锁死）。
 */
import { useEffect, useState } from 'react'
import s from '../newtype.module.css'

const normalize = (raw: string): string => {
  const t = raw.trim()
  if (!t) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t
  return `http://${t}`
}

export function WebPane(props: { url?: string; setParams: (patch: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState(props.url ?? '')
  // E35：对话点链接 / 齿轮按钮从外部带 url 打开时，URL 栏跟着显示新地址
  useEffect(() => { setDraft(props.url ?? '') }, [props.url])
  const go = (raw: string) => {
    const u = normalize(raw)
    if (u) props.setParams({ url: u })
  }
  return (
    <div className={s.webPane}>
      <div className={s.webBar}>
        <input
          className={s.webUrl}
          value={draft}
          placeholder="输入地址，如 localhost:3080 或 example.com"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(draft) }}
          spellCheck={false}
        />
        <button className={s.webGo} onClick={() => go(draft)} title="转到">→</button>
        {props.url && (
          <button className={s.webGo} onClick={() => props.setParams({ url: '' })} title="关闭页面">
            ✕
          </button>
        )}
      </div>
      {props.url ? (
        <iframe className={s.webFrame} src={props.url} title={props.url} />
      ) : (
        <div className={s.pempty}>输入地址打开页面</div>
      )}
    </div>
  )
}
