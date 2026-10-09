/**
 * 文件窗格（E31 spike）：host 半 `/newtype/file?path=` 只读端点的 iframe 渲染。
 * 触发链：工作台内点对话文件 → 宿主 openResource 报「no session surface」→
 * 我们的包装层接住 → openTabBus('file:<path>') → trellis 'file' 视图。
 *
 * 端口自探：pagesBase() 探到 7917 就满足，但旧实例残留时 7917 没有 file 路由
 * （实测 7917/7919 挂着昨日旧包）→ 这里按「file 路由应答 400（空 path）」判活，独立缓存。
 */
import { useEffect, useState } from 'react'
import s from '../newtype.module.css'

const PORTS = [7917, 7918, 7919]
let cached: string | null | undefined

async function resolveFileBase(): Promise<string | null> {
  if (cached !== undefined) return cached
  for (const port of PORTS) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 1200)
      const res = await fetch(`http://127.0.0.1:${port}/newtype/file`, { signal: ctl.signal })
      clearTimeout(t)
      // 新服务对空 path 应答 400；旧包（无路由）404 —— 以此区分
      if (res.status === 400) { cached = `http://127.0.0.1:${port}`; return cached }
    } catch { /* 端口无服务：下一个 */ }
  }
  cached = null
  return cached
}

export function FilePane({ path }: { path: string }) {
  const [base, setBase] = useState<string | null>(cached ?? null)
  useEffect(() => {
    let alive = true
    void resolveFileBase().then((b) => { if (alive) setBase(b) })
    return () => { alive = false }
  }, [])
  if (!path) return <div className={s.pempty}>缺少文件路径</div>
  if (!base) return <div className={s.pempty}>文件服务未就绪（host 半未挂载）</div>
  return (
    <iframe
      className={s.pif}
      src={`${base}/newtype/file?path=${encodeURIComponent(path)}`}
      title={path}
    />
  )
}
